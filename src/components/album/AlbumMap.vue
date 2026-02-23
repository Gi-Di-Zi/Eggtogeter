<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// import * as THREE from 'three'
import * as turf from '@turf/turf'
import { FullScreen } from '@element-plus/icons-vue'

// Props receive the SHARED state from parent (which initializes useAlbumAnimation)
const props = defineProps<{
    routeLine: any
    photos: any[]
    currentPosition: any
    currentTransportMode: string
    isPlaying: boolean
    theme?: string
    segments?: any[]  // Segment data for path styling
}>()

const emit = defineEmits(['map-loaded', 'toggle-fullscreen'])

const mapContainer = ref<HTMLElement | null>(null)
let map: maplibregl.Map | null = null

// Three.js State
/*
let camera: THREE.Camera
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let vehicleGroup: THREE.Group
// Model Cache
const models = {
    car: null as THREE.Group | null,
    walk: null as THREE.Group | null,
    airplane: null as THREE.Group | null,
    bicycle: null as THREE.Group | null,
    bus: null as THREE.Group | null,
    subway: null as THREE.Group | null,
    ship: null as THREE.Group | null,
    boat: null as THREE.Group | null,
    ferry: null as THREE.Group | null
}
*/

// Fallback 2D Marker
let vehicleMarker: maplibregl.Marker | null = null
let previousPosCoordinates: number[] | null = null


const maptilerKey = import.meta.env.VITE_MAPTILER_KEY
const mapStyles: Record<string, string> = {
    STREET: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`,
    DARK: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`,
    PASTEL: `https://api.maptiler.com/maps/pastel/style.json?key=${maptilerKey}`,
    OUTDOOR: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${maptilerKey}`,
    WINTER: `https://api.maptiler.com/maps/winter-v2/style.json?key=${maptilerKey}`,
    HYBRID: `https://api.maptiler.com/maps/hybrid/style.json?key=${maptilerKey}`
}

// ----------------------------------------------------------------------
// Helper Functions (Hoisted)
// ----------------------------------------------------------------------

function add3DBuildings() {
    if (!map) return;
    const style = map.getStyle();
    if (!style || !style.sources) return;
    if (props.theme === 'HYBRID') return;

    let sourceId = 'openmaptiles';
    const sources = style.sources;
    
    if (sources['openmaptiles']) sourceId = 'openmaptiles';
    else if (sources['maptiler_planet']) sourceId = 'maptiler_planet';
    else if (sources['map']) sourceId = 'map';
    else {
        const foundSource = Object.keys(sources).find(key => {
            const s = sources[key];
            return s && 'type' in s && s.type === 'vector';
        });
        if (foundSource) sourceId = foundSource;
        else return;
    }

    if (map.getLayer('3d-buildings')) return;

    let labelLayerId;
    const layers = style.layers;
    for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
            labelLayerId = layer.id;
            break;
        }
    }

    try {
        map.addLayer(
            {
                'id': '3d-buildings',
                'source': sourceId,
                'source-layer': 'building',
                'filter': ['all', ['!=', 'hide_3d', true]],
                'type': 'fill-extrusion',
                'minzoom': 13,
                'paint': {
                    'fill-extrusion-color': '#ffffff',
                    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
                    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
                    'fill-extrusion-opacity': 0.2
                }
            },
            labelLayerId
        );
    } catch (e) {
        console.error('Failed to add 3D buildings layer:', e);
    }
}

function addPhotoMarkers() {
    if (!map || !props.photos) return
    
    props.photos.forEach((photo) => {
        const el = document.createElement('div')
        el.className = 'map-photo-marker'
        el.style.backgroundImage = `url(${photo.publicUrl})`
        el.style.width = '40px'
        el.style.height = '40px'
        el.style.backgroundSize = 'cover'
        el.style.borderRadius = '50%'
        el.style.border = '2px solid white'
        el.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)'

        new maplibregl.Marker({ element: el })
            .setLngLat([photo.longitude, photo.latitude])
            .addTo(map!)
    })
}

/*
function _getTransportIcon(_mode: string): string {
    return '' // Handled by CSS
}
*/


// function addRouteLayer() {
//     if (!map) return
    
//     // Add Sources
//     if (!map.getSource('route')) {
//         map.addSource('route', {
//             type: 'geojson',
//             data: { type: 'FeatureCollection', features: [] }
//         })
//     }
//     if (!map.getSource('history-route')) {
//         map.addSource('history-route', {
//             type: 'geojson',
//             data: { type: 'FeatureCollection', features: [] }
//         })
//     }
// }
    
    // Remove old segment layers if they exist

const addRouteLayer = () => {
    if (!map) return

    // Ensure history source exists
    if (!map.getSource('history-route')) {
        map.addSource('history-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        })
    }

    // Add segment layers if segments are available
    if (props.segments && props.segments.length > 0) {
        // [FIX] Remove global solid route line first
        if (map.getLayer('route-line')) map.removeLayer('route-line')
        if (map.getSource('route')) map.removeSource('route')

        props.segments.forEach((segment: any, index: number) => {
            const sourceId = `segment-${index}`
            const layerId = `segment-layer-${index}`
            
            // Update exist source or create new
            const source = map!.getSource(sourceId) as maplibregl.GeoJSONSource
            if (source) {
                source.setData(segment.geometry)
            } else {
                map!.addSource(sourceId, {
                    type: 'geojson',
                    data: segment.geometry
                })
            }
            
            // Determine line style based on mode
            const isNoneMode = segment.mode === 'none'
            const lineDasharray = isNoneMode ? [0.1, 4] : undefined 
            const lineOpacity = isNoneMode ? 0.6 : 0.8
            
            // Add layer for this segment (only if missing)
            if (!map!.getLayer(layerId)) {
                map!.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    layout: { 
                        'line-join': 'round', 
                        'line-cap': 'round' 
                    },
                    paint: { 
                        'line-color': '#ff4757', 
                        'line-width': 8, 
                        'line-opacity': lineOpacity,
                        ...(lineDasharray ? { 'line-dasharray': lineDasharray } : {})
                    }
                })
            }
        })
    } else {
        // Fallback: single route line
        // ... (Keep existing verify logic or simplify)
        const source = map.getSource('route') as maplibregl.GeoJSONSource
        if (source && props.routeLine) {
            source.setData(props.routeLine)
        } else if (props.routeLine) {
             map.addSource('route', {
                 type: 'geojson',
                 data: props.routeLine
             })
        }

        if (!map.getLayer('route-line')) {
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ff4757', 'line-width': 8, 'line-opacity': 0.8 }
            })
        }
    }

    // History Route (Green/Traveled Path)
    if (!map.getLayer('history-route-line')) {
        map.addLayer({
            id: 'history-route-line',
            type: 'line',
            source: 'history-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2ed573', 'line-width': 8, 'line-opacity': 0.9 }
        })
    }
}

// Watch for segment changes to ensure route layer is added (especially for 'none' mode dashed lines)
watch(() => props.segments, (newSegments) => {
    // console.log('[AlbumMap] Segments changed:', newSegments?.length) 
    if (map && newSegments && newSegments.length > 0) {
        // [FIX] Do NOT clear layers here. addRouteLayer now handles updates smartly via setData.
        // clearRouteLayers() 
        addRouteLayer()
    }
}, { deep: true })

// Custom 3D Layer implementation (Standard MapLibre + ThreeJS Pattern)
/*
function _add3DLayer() {
    if (!map) return

    const customLayer: maplibregl.CustomLayerInterface = {
        id: '3d-models',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (mapInstance: maplibregl.Map, gl: WebGLRenderingContext) {
            camera = new THREE.Camera()
            scene = new THREE.Scene()

            // Lights
            const ambient = new THREE.AmbientLight(0xffffff, 1.2)
            scene.add(ambient)
            const dirLight = new THREE.DirectionalLight(0xffffff, 2.5)
            dirLight.position.set(0, -70, 100).normalize()
            scene.add(dirLight)
            
            // Main Vehicle Group
            vehicleGroup = new THREE.Group()
            scene.add(vehicleGroup)

            // DEBUG CUBE for Visibility Check
            // Move to Scene Root to verify layer works at all
            // @ts-ignore
            const debugCube = new THREE.Mesh(
                new THREE.BoxGeometry(100, 100, 100), // Giant Cube
                new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 })
            )
            // debugCube.position.z = 100
            // scene.add(debugCube) // Add to scene, not group
            
            // Actually, keep it in group but make it huge so we see it if group is anywhere near
            const groupCube = new THREE.Mesh(
                new THREE.BoxGeometry(50, 50, 50),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            )
            vehicleGroup.add(groupCube)

            createFallbackModels()

            renderer = new THREE.WebGLRenderer({
                canvas: mapInstance.getCanvas(),
                context: gl,
                antialias: true,
                alpha: true
            })
            renderer.autoClear = false
            renderer.shadowMap.enabled = true
        },
        render: function (_gl: WebGLRenderingContext, matrix: any) {
            // console.log('3D Render Loop') // Verbose but useful
            if (!scene || !camera || !renderer) return
            
            // Sync Camera Matrix
            const m = new THREE.Matrix4().fromArray(matrix)
            
            camera.projectionMatrix = m
            
            renderer.resetState()
            renderer.render(scene, camera)
            
            if (map) map.triggerRepaint()
        }
    }

    if (map.getLayer('3d-models')) map.removeLayer('3d-models')
    map.addLayer(customLayer)
}
*/

/*
function createFallbackModels() {
    // Shared material for visibility
    const matOptions = { depthTest: true, depthWrite: true } // Enable depth? MapLibre handles it.
    // Try disabling depthTest if visibility is issue
    // const matOptions = { depthTest: false }

    const makeGroup = (mesh: THREE.Object3D) => {
        const group = new THREE.Group()
        group.add(mesh)
        // Normalize rotation?
        return group
    }

    // CAR
    const carGeo = new THREE.BoxGeometry(10, 5, 20) // Bigger
    const carMat = new THREE.MeshLambertMaterial({ color: 0xff4757, ...matOptions })
    const carMesh = new THREE.Mesh(carGeo, carMat)
    carMesh.position.y = 2.5
    models.car = makeGroup(carMesh)

    // AIRPLANE
    const planeGeo = new THREE.ConeGeometry(10, 40, 32) // Bigger
    planeGeo.rotateX(Math.PI / 2) // Points Z
    const planeMat = new THREE.MeshLambertMaterial({ color: 0xf1f2f6 })
    const planeMesh = new THREE.Mesh(planeGeo, planeMat)
    const wingGeo = new THREE.BoxGeometry(60, 2, 12)
    const wingMesh = new THREE.Mesh(wingGeo, new THREE.MeshLambertMaterial({ color: 0x747d8c }))
    planeMesh.add(wingMesh)
    models.airplane = makeGroup(planeMesh)
    
    // Others generic
    models.walk = makeGroup(new THREE.Mesh(new THREE.CylinderGeometry(4,4,12), new THREE.MeshBasicMaterial({ color: 0xe67e22 })))
    models.bicycle = makeGroup(new THREE.Mesh(new THREE.BoxGeometry(4,12,16), new THREE.MeshBasicMaterial({ color: 0x2ed573 })))
    models.bus = makeGroup(new THREE.Mesh(new THREE.BoxGeometry(12,12,30), new THREE.MeshBasicMaterial({ color: 0xffa502 })))
    models.subway = makeGroup(new THREE.Mesh(new THREE.BoxGeometry(12,12,40), new THREE.MeshBasicMaterial({ color: 0xa4b0be })))
    models.ship = makeGroup(new THREE.Mesh(new THREE.BoxGeometry(20,10,60), new THREE.MeshBasicMaterial({ color: 0x3742fa })))
    models.boat = models.ship.clone()
    models.ferry = models.ship.clone()
}
*/

function updateVehiclePosition(pos: any) {
    // console.log('[AlbumMap] updateVehiclePosition called', pos)
    if (!pos || !map) return

    const [lng, lat] = pos.geometry.coordinates
    // console.log('[AlbumMap] Coords:', lng, lat)

    // Safety check for invalid coordinates (prevents black screen crash)
    if (isNaN(lng) || isNaN(lat)) return

    // Calculate Bearing
    let bearing = 0
    if (previousPosCoordinates) {
        const from = turf.point(previousPosCoordinates)
        const to = turf.point([lng, lat])
        bearing = turf.bearing(from, to)
    }
    previousPosCoordinates = [lng, lat]
    
    // Global Safety Check for Bearing
    if (isNaN(bearing)) bearing = 0

    // --- 3D UPDATE ---
    /*
    if (vehicleGroup && map) {
        // Calculate Mercator Coordinate
        const altitude = props.currentTransportMode === 'airplane' ? 500 : 0
        const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
            [lng, lat], 
            altitude
        )
        
        // Sanitize Bearing
        if (isNaN(bearing)) bearing = 0

        // Set Position
        // console.log('[AlbumMap] Mercator:', modelAsMercatorCoordinate.x, modelAsMercatorCoordinate.y, modelAsMercatorCoordinate.z)
        vehicleGroup.position.set(
            modelAsMercatorCoordinate.x, 
            modelAsMercatorCoordinate.y, 
            modelAsMercatorCoordinate.z
        )

        // Calculate Scale
        const meterScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
        const visualFactor = props.currentTransportMode === 'airplane' ? 1500 : 800
        const scale = meterScale * visualFactor
        
        // console.log('[AlbumMap] Scale:', scale)
        if (!isNaN(scale)) {
            vehicleGroup.scale.set(scale, scale, scale)
        }
        
        // Rotation
        // Three.js rotation is radians. Z-axis is "up" in Mercator (if not flipped?).
        // MapLibre bearing is clockwise from North.
        // We typically rotate around Z.
        // -bearing in radians usually aligns correct with North.
        vehicleGroup.rotation.z = -THREE.MathUtils.degToRad(bearing)
        
        // Reset other rotations
        vehicleGroup.rotation.x = Math.PI / 2; // Often models need to be flipped up to stand on map? 
        // NOTE: Our geometries (Box) are centered. 
        // If we use BoxGeometry, it's aligned with axes. 
        // Let's keep X rotation simple or per-model in createFallbackModels.
        // Actually, let's zero it here and handle orientation in the model Group wrapper.
        vehicleGroup.rotation.x = 0 
        vehicleGroup.rotation.y = 0

        // If Airplane, maybe tilt?
        if (props.currentTransportMode === 'airplane') {
            // Check Pitch?
        }
    }
    */

    // --- 2D DOM MARKER UPDATE ---
    if (!vehicleMarker) {
        const el = document.createElement('div')
        el.className = 'vehicle-marker-container'
        
        const inner = document.createElement('div')
        inner.className = 'vehicle-marker-content'
        inner.style.fontSize = '32px'
        inner.style.transition = 'transform 0.1s linear'
        // inner.style.transformOrigin = 'center center'
        el.appendChild(inner)

        vehicleMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map)
    }

    vehicleMarker.setLngLat([lng, lat])
    
    // Update Icon & Rotation
    const markerEl = vehicleMarker.getElement()
    const contentEl = markerEl.querySelector('.vehicle-marker-content') as HTMLElement
    if (contentEl) {
        // contentEl.innerText = getTransportIcon(props.currentTransportMode) 
        // Use CSS class for shape instead of text/emoji
        const safeMode = props.currentTransportMode || 'walk'
        contentEl.className = `vehicle-marker-content mode-${safeMode}`
        contentEl.style.transform = `rotate(${bearing}deg)`
        contentEl.innerText = '' // Clear text! Use pure CSS.
        
        // Debug Visibility Loss
        // console.log(`[AlbumMap] Marker Update: Mode=${safeMode} Bearing=${bearing} Lng=${lng} Lat=${lat}`)
    }

    // History & Camera (ALWAYS FOLLOW)
    // if (props.isPlaying) { 
        map.jumpTo({
            center: [lng, lat],
            zoom: props.currentTransportMode === 'airplane' ? 12 : 16, 
            pitch: 60
        })
    // }
    
    // Trailed Route
    if (props.routeLine) {
        try {
            const startPoint = turf.point(props.routeLine.geometry.coordinates[0])
            const history = turf.lineSlice(startPoint, pos, props.routeLine)
            const source = map.getSource('history-route') as maplibregl.GeoJSONSource
            if (source) source.setData(history)
        } catch (e) { }
    }
}

onMounted(() => {
    initMap()
})

onUnmounted(() => {
    clearRouteLayers()
    if (map) map.remove()
})

const clearRouteLayers = () => {
    if (!map) return
    
    // Remove fallback
    if (map.getLayer('route-layer')) map.removeLayer('route-layer')
    if (map.getSource('route-source')) map.removeSource('route-source')
    
    // Remove segments (Iterate safely up to a reasonable limit or track IDs)
    // Since we don't track IDs, we iterate broadly or assume index based.
    // Better to iterate existing style layers but that's complex.
    // Simple loop 0..50
    for (let i = 0; i < 50; i++) {
        if (map.getLayer(`segment-layer-${i}`)) map.removeLayer(`segment-layer-${i}`)
        if (map.getSource(`segment-${i}`)) map.removeSource(`segment-${i}`)
    }
}



const initMap = () => {
    if (!mapContainer.value) return

    const styleUrl = mapStyles[props.theme || 'STREET'] || mapStyles.STREET

    map = new maplibregl.Map({
        container: mapContainer.value,
        style: styleUrl,
        center: [127.0, 37.5],
        zoom: 14,
        pitch: 60,
        interactive: false,
        attributionControl: false
    })

    map.on('load', () => {
        // Initial Layer Setup
        setupAllLayers()
        addPhotoMarkers() // [FIX] Ensure markers are added
        
        if (props.currentPosition) {
            updateVehiclePosition(props.currentPosition)
        }
        emit('map-loaded', map)
    })

    // Handle Style Changes (Theme Switch)
    map.on('styledata', () => {
        // When style changes, layers are removed. We must re-add them.
        // Wait for style to be ready.
        if (map?.isStyleLoaded()) {
            setupAllLayers()
        } else {
            setTimeout(setupAllLayers, 500)
        }
    })
}

// Helper to add all layers if missing
const setupAllLayers = () => {
    if (!map) return
    
    // 1. Buildings
    add3DBuildings()
    
    // 2. Route & History
    // Check source first
    if (!map.getSource('route')) addRouteLayer()
    else {
         // If source exists but layers missing (rare with setStyle, usually all gone)
         if (!map.getLayer('route-line')) addRouteLayer()
    }

    // 3. 3D Model Layer (Disabled for reliability, using HQ 2D instead)
    // if (!map.getLayer('3d-models')) add3DLayer()

    // 4. Force Initial Position Update for 3D/2D Sync
    if (props.currentPosition) {
        updateVehiclePosition(props.currentPosition)
    }
}

// Methods
function updateMapTheme(themeVal: string) {
    if (!map) return
    const styleUrl = mapStyles[themeVal] || mapStyles.STREET
    
    // Changing style removes all layers. We must wait for 'style.load' to re-add them.
    if (styleUrl) map.setStyle(styleUrl)
    
    map.once('style.load', () => {
        console.log('[AlbumMap] Style loaded, re-adding layers...')
        setupAllLayers()
    })
}

watch(() => props.theme, (val) => {
    if (val) updateMapTheme(val)
})

watch(() => props.routeLine, (newVal) => {
    if (map && newVal) {
        try {
            const source = map.getSource('route') as maplibregl.GeoJSONSource
            if (source) {
                source.setData(newVal)
                if (newVal.geometry && newVal.geometry.coordinates && newVal.geometry.coordinates.length > 0) {
                     const bounds = new maplibregl.LngLatBounds()
                     newVal.geometry.coordinates.forEach((coord: number[]) => bounds.extend(coord as [number, number]))
                     map.fitBounds(bounds, { padding: 50 })
                }
            }
        } catch (e) {
            console.warn('[AlbumMap] Failed to update route data:', e)
        }
    }
})

watch(() => props.currentPosition, (pos) => {
    updateVehiclePosition(pos)
}, { immediate: true })

watch(() => props.currentTransportMode, (_mode) => {
    // 3D Update
    /*
    if (vehicleGroup) {
        vehicleGroup.clear()
        if (mode !== 'none' && models[mode as keyof typeof models]) {
            vehicleGroup.add(models[mode as keyof typeof models]!.clone())
        }
    }
    */
    
    // 2D Update
    if (vehicleMarker) {
        const markerEl = vehicleMarker.getElement()
        const contentEl = markerEl.querySelector('.vehicle-marker-content') as HTMLElement
        if (contentEl) {
            contentEl.innerText = '' // Clear text! Use pure CSS.
            // contentEl.innerText = getTransportIcon(mode)
        }
    }
})

</script>

<template>
  <div class="album-map-wrapper" style="width: 100%; height: 100%; position: relative;">
     <div ref="mapContainer" class="map-container" style="width: 100%; height: 100%;"></div>
     
     <button class="fullscreen-btn" @click="emit('toggle-fullscreen')">
       <el-icon><FullScreen /></el-icon>
     </button>
  </div>
</template>

<style>
.fullscreen-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    background: rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
.fullscreen-btn:hover {
    background: rgba(0,0,0,0.8);
}

.vehicle-marker-container {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none; /* Let clicks pass through */
    z-index: 2000; /* Ensure visibility */
}
/* DEFAULT ARROW (Unified Style) */
.vehicle-marker-content {
    width: 0; 
    height: 0; 
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-bottom: 25px solid #2ecc71; /* Green Arrow (Emerald) */
    transform-origin: center center;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
    will-change: transform;
    /* Ensure z-index is managed by Leaflet/MapLibre context, but marker-container is 2000 */
}

/* Reset specific mode shapes to default arrow */
.vehicle-marker-content.mode-walk,
.vehicle-marker-content.mode-car,
.vehicle-marker-content.mode-bus,
.vehicle-marker-content.mode-airplane {
    background-color: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    /* Re-apply arrow borders just in case */
    border-left: 12px solid transparent !important;
    border-right: 12px solid transparent !important;
    border-bottom: 25px solid #2ecc71 !important;
    width: 0 !important;
    height: 0 !important;
}
</style>
