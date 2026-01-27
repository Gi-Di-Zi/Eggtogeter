<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as THREE from 'three'
import * as turf from '@turf/turf'
import { FullScreen } from '@element-plus/icons-vue'

// Props receive the SHARED state from parent (which initializes useAlbumAnimation)
const props = defineProps<{
  routeLine: any
  progress: number
  isPlaying: boolean
  currentTransportMode: 'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'none'
  currentPosition: any // Turf Point
  photos: any[] // Added
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: maplibregl.Map | null = null

// Three.js
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
    ship: null as THREE.Group | null
}

const emit = defineEmits(['map-loaded', 'toggle-fullscreen'])

onMounted(() => {
    initMap()
})

onUnmounted(() => {
    if (map) map.remove()
})

const initMap = () => {
    if (!mapContainer.value) return

    map = new maplibregl.Map({
        container: mapContainer.value,
        style: {
             version: 8,
             sources: {
                 'vworld': {
                     type: 'raster',
                     tiles: ['https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png'],
                     tileSize: 256,
                     attribution: 'V-World'
                 }
             },
             layers: [
                 { id: 'bg', type: 'background', paint: { 'background-color': '#111' } },
                 { id: 'vworld', type: 'raster', source: 'vworld' }
             ]
        },
        center: [127.0, 37.5],
        zoom: 14,
        pitch: 60, // Task 2: Increased pitch
        interactive: false, // Task 2: View only
        attributionControl: false
    })

    map.on('load', () => {
        addRouteLayer()
        add3DLayer()
        addPhotoMarkers() // Task 3: Map Markers
        emit('map-loaded', map)
    })
}

const addPhotoMarkers = () => {
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

const addRouteLayer = () => {
    if (!map) return
    
    // Add Sources
    map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    })
    map.addSource('history-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    })
    
    // 1. Upcoming Path (Red)
    map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff4757', 'line-width': 8, 'line-opacity': 0.8 }
    })

    // 2. Traveled Path (Green/History)
    map.addLayer({
        id: 'history-route-line',
        type: 'line',
        source: 'history-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2ed573', 'line-width': 8, 'line-opacity': 0.9 }
    })
}

const add3DLayer = () => {
    if (!map) return

    const customLayer: maplibregl.CustomLayerInterface = {
        id: '3d-models',
        type: 'custom',
        renderingMode: '3d',
        onAdd: (mapInstance, gl) => {
            camera = new THREE.Camera()
            scene = new THREE.Scene()
            
            // Lights
            const ambient = new THREE.AmbientLight(0xffffff, 0.8)
            scene.add(ambient)
            const sun = new THREE.DirectionalLight(0xffffff, 2.0)
            sun.position.set(50, 50, 50)
            scene.add(sun)

            vehicleGroup = new THREE.Group()
            scene.add(vehicleGroup)

            // Setup Geometries as fallback (User requested specific models, using geometric representations)
            createFallbackModels()

            renderer = new THREE.WebGLRenderer({
                canvas: mapInstance.getCanvas(),
                context: gl,
                antialias: true
            })
            renderer.autoClear = false

            // [FIX] Ensure initial model is added
            if (props.currentTransportMode !== 'none' && models[props.currentTransportMode as keyof typeof models]) {
                vehicleGroup.add(models[props.currentTransportMode as keyof typeof models]!.clone())
            }
        },
        render: (_gl, matrix) => {
            const m = new THREE.Matrix4().fromArray(matrix as unknown as number[])
            camera.projectionMatrix = m
            renderer.resetState()
            renderer.render(scene, camera)
            map?.triggerRepaint()
        }
    }
    map.addLayer(customLayer)
}

const createFallbackModels = () => {
    // 1. CAR (Box)
    const carGeo = new THREE.BoxGeometry(2.5, 1.2, 5)
    const carMat = new THREE.MeshStandardMaterial({ color: 0x3498db })
    const carMesh = new THREE.Mesh(carGeo, carMat)
    models.car = new THREE.Group()
    models.car.add(carMesh)

    // 2. WALK (Shoes/Sphere)
    const walkGeo = new THREE.SphereGeometry(1, 16, 16)
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 })
    const walkMesh = new THREE.Mesh(walkGeo, walkMat)
    walkMesh.position.y = 1
    models.walk = new THREE.Group()
    models.walk.add(walkMesh)

    // 3. AIRPLANE (Cone)
    const planeGeo = new THREE.ConeGeometry(2, 6, 16)
    planeGeo.rotateX(Math.PI / 2) // Point forward
    const planeMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1 })
    const planeMesh = new THREE.Mesh(planeGeo, planeMat)
    planeMesh.position.y = 15 // Fly high
    models.airplane = new THREE.Group()
    models.airplane.add(planeMesh)

    // 4. BICYCLE (Thin Box)
    const bikeGeo = new THREE.BoxGeometry(0.5, 1.5, 3)
    const bikeMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 })
    const bikeMesh = new THREE.Mesh(bikeGeo, bikeMat)
    models.bicycle = new THREE.Group()
    models.bicycle.add(bikeMesh)

    // 5. BUS (Long Box)
    const busGeo = new THREE.BoxGeometry(3, 2, 8)
    const busMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f })
    const busMesh = new THREE.Mesh(busGeo, busMat)
    models.bus = new THREE.Group()
    models.bus.add(busMesh)

    // 6. SUBWAY (Tube-like)
    const subGeo = new THREE.CapsuleGeometry(1.5, 8, 4, 16)
    subGeo.rotateX(Math.PI / 2)
    const subMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6 })
    const subMesh = new THREE.Mesh(subGeo, subMat)
    models.subway = new THREE.Group()
    models.subway.add(subMesh)

    // 7. SHIP (Pyramid-ish)
    const shipGeo = new THREE.ConeGeometry(3, 8, 4)
    shipGeo.rotateX(Math.PI / 2)
    shipGeo.rotateZ(Math.PI / 4)
    const shipMat = new THREE.MeshStandardMaterial({ color: 0x34495e })
    const shipMesh = new THREE.Mesh(shipGeo, shipMat)
    models.ship = new THREE.Group()
    models.ship.add(shipMesh)
}

// Watchers
watch(() => props.routeLine, (newVal) => {
    if (map && newVal) {
        (map.getSource('route') as maplibregl.GeoJSONSource).setData(newVal)
        
        // Fit bounds
        const bounds = new maplibregl.LngLatBounds()
        newVal.geometry.coordinates.forEach((coord: number[]) => bounds.extend(coord as [number, number]))
        map.fitBounds(bounds, { padding: 50 })
    }
})

watch(() => props.currentPosition, (pos) => {
    if (!pos || !map || !vehicleGroup) return

    const [lng, lat] = pos.geometry.coordinates
    
    // Important: Scale and Altitude are crucial.
    // mercator.z might be 0, let's use a small altitude for visibility
    const altitude = props.currentTransportMode === 'airplane' ? 50 : 2
    const m_coord = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude)
    const worldScale = m_coord.meterInMercatorCoordinateUnits()
    
    vehicleGroup.position.set(m_coord.x, m_coord.y, m_coord.z || 0)
    
    // Scale: Let's make it bigger (e.g. 15 meters) for better visibility
    const finalScale = worldScale * 15
    vehicleGroup.scale.set(finalScale, finalScale, finalScale)

    // Heading (Rotation)
    if (map && props.isPlaying) {
        const bearing = map.getBearing()
        // MapLibre bearing is degrees, Three.js rotation is radians
        // We might need to adjust based on current movement direction instead of map bearing
        // but since camera follows vehicle, map bearing is a good proxy for now.
        vehicleGroup.rotation.z = - (bearing * Math.PI / 180)
    }

    // Update Traveled Path (History)
    if (props.routeLine) {
        try {
            const startPoint = turf.point(props.routeLine.geometry.coordinates[0])
            const history = turf.lineSlice(startPoint, pos, props.routeLine)
            const source = map.getSource('history-route') as maplibregl.GeoJSONSource
            if (source) source.setData(history)
        } catch (e) {
            console.warn('History route update failed', e)
        }
    }

    // Camera follow
    if (props.isPlaying) {
        map.easeTo({
            center: [lng, lat],
            zoom: props.currentTransportMode === 'airplane' ? 12 : 17,
            pitch: 60,
            duration: 0 // Instant follow
        })
    }
})

watch(() => props.currentTransportMode, (mode) => {
    if (!vehicleGroup) return
    vehicleGroup.clear()
    
    if (mode !== 'none' && models[mode as keyof typeof models]) {
        // Clone to avoid removing from cache
        vehicleGroup.add(models[mode as keyof typeof models]!.clone())
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

<style scoped>
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
</style>


