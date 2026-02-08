<template>
  <div class="album-minimap" ref="mapContainer"></div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount, toRaw } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'

const props = defineProps<{
  routeGeoJson: any // Feature<LineString>
  currentPosition: any // Feature<Point> | null
  photos: any[]     // Added for dots
  accessToken: string 
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: maplibregl.Map | null = null
let currentMarker: maplibregl.Marker | null = null

const maptilerKey = import.meta.env.VITE_MAPTILER_KEY

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: `https://api.maptiler.com/maps/dataviz-light/style.json?key=${maptilerKey}`,
    center: [0, 0],
    zoom: 1,
    interactive: false,
    attributionControl: false
  })

  map.on('load', () => {
    // 1. Add Route
    if (props.routeGeoJson) {
      addRouteLayer(props.routeGeoJson)
      fitBounds(props.routeGeoJson)
      // Initial update for traveled path if position exists
      if (props.currentPosition) {
          updateTraveledLayer(props.currentPosition)
      }
    } else if (props.photos && props.photos.length > 0) {
        fitBoundsToPhotos(props.photos)
    }

    // 2. Add Dots
    if (props.photos && props.photos.length > 0) {
      addPhotoDotsLayer(props.photos)
    }
    
    // Fix: Force resize to prevent visibility issues on some browsers/containers
    map?.resize()
  })
})

// Watchers
// Watchers
watch(() => props.routeGeoJson, (newVal) => {
    if (!newVal) return

    // Robustly handle map state
    if (map && map.loaded()) {
        addRouteLayer(newVal)
        fitBounds(newVal)
    } else if (map) {
        // Map created but not loaded; verify logic
        // We can rely on 'load' event, but if it already fired (state ambiguity),
        // we can force consistency.
        // However, standard pattern is to wait.
        // Let's ensure we try to fit bounds if layer exists but bounds weird.
        if (map.getSource('minimap-route')) {
             addRouteLayer(newVal)
             fitBounds(newVal)
        }
    }
}, { immediate: true })

const addRouteLayer = (geoJson: any) => {
    if (!map) return

    // 1. Check for Dummy Route (0,0 to 1,1) - identical logic to fitBounds
    try {
        const bbox = turf.bbox(geoJson)
        if (bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 1 && bbox[3] === 1) {
            console.warn('[Minimap] Dummy route detected, skipping addRouteLayer')
            return
        }
    } catch(e) { /* ignore */ }
    
    // 2. Resolve Proxy
    const rawGeoJson = toRaw(geoJson)

    // 1. Base Route (Yellow - full path)
    if (map.getSource('minimap-route')) {
        (map.getSource('minimap-route') as maplibregl.GeoJSONSource).setData(rawGeoJson)
    } else {
        map.addSource('minimap-route', {
            type: 'geojson',
            data: rawGeoJson
        })
        map.addLayer({
            id: 'minimap-route-line',
            type: 'line',
            source: 'minimap-route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FFD700', // Yellow
                'line-width': 4,
                'line-opacity': 0.5 // Dim base route slightly
            }
        })
    }
    
    // 2. Traveled Route (Green - initially empty)
    // We will update this in the currentPosition watcher
    if (!map.getSource('minimap-route-traveled')) {
        map.addSource('minimap-route-traveled', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        })
        map.addLayer({
            id: 'minimap-route-traveled-line',
            type: 'line',
            source: 'minimap-route-traveled',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#2ecc71', // Green
                'line-width': 4
            }
        })
    }
}

const updateTraveledLayer = (currentPos: any) => {
    if (!map || !props.routeGeoJson || !currentPos) return
    
    try {
        const rawRoute = toRaw(props.routeGeoJson)
        // Ensure route is valid LineString
        if (rawRoute.geometry.type !== 'LineString') return
        
        const startPoint = turf.point(rawRoute.geometry.coordinates[0])
        const sliced = turf.lineSlice(startPoint, currentPos, rawRoute)
        
        if (map.getSource('minimap-route-traveled')) {
            (map.getSource('minimap-route-traveled') as maplibregl.GeoJSONSource).setData(sliced)
        }
    } catch (e) {
        // Silent fail for slice errors during init
    }
}

const addPhotoDotsLayer = (photos: any[]) => {
    if (!map) return
    
    const features = photos
        .filter(p => p.longitude && p.latitude)
        .map(p => turf.point([p.longitude, p.latitude]))
    
    const geoJson = turf.featureCollection(features)

    if (map.getSource('minimap-photos')) {
        (map.getSource('minimap-photos') as maplibregl.GeoJSONSource).setData(geoJson)
    } else {
        map.addSource('minimap-photos', {
            type: 'geojson',
            data: geoJson
        })
        map.addLayer({
            id: 'minimap-photo-dots',
            type: 'circle',
            source: 'minimap-photos',
            paint: {
                'circle-color': '#fff',
                'circle-radius': 3,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#000'
            }
        })
    }
}

const fitBounds = (geoJson: any) => {
    if (!map || !geoJson) return
    
    // Check for "Dummy Route" (0,0 to 1,1)
    try {
        const bbox = turf.bbox(geoJson)
        // [minX, minY, maxX, maxY]
        // If it matches exactly [0, 0, 1, 1], treat as invalid/default
        if (bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 1 && bbox[3] === 1) {
            console.warn('[Minimap] Default route detected, falling back to photos bounds')
            if (props.photos && props.photos.length > 0) {
                fitBoundsToPhotos(props.photos)
            }
            return
        }
        
        map.fitBounds(bbox as [number, number, number, number], { padding: 20 })
    } catch (e) {
        console.error('[Minimap] FitBounds failed:', e)
    }
}

const fitBoundsToPhotos = (photos: any[]) => {
    if (!map || !photos || photos.length === 0) return
    try {
        const features = photos
            .filter(p => p.longitude && p.latitude)
            .map(p => turf.point([p.longitude, p.latitude]))
        
        if (features.length === 0) return

        const collection = turf.featureCollection(features)
        const bbox = turf.bbox(collection)
        map.fitBounds(bbox as [number, number, number, number], { padding: 30 })
    } catch (e) {
        console.error('[Minimap] FitBoundsToPhotos failed:', e)
    }
}

// Watchers

watch(() => props.photos, (newVal) => {
    if (map && map.loaded() && newVal.length > 0) {
        addPhotoDotsLayer(newVal)
        // If route is missing but photos exist, ensure we see something
        if (!props.routeGeoJson) {
             fitBoundsToPhotos(newVal)
        }
    }
})

watch(() => props.currentPosition, (newPos) => {
    if (!map) return
    
    if (newPos) {
        const coords = newPos.geometry.coordinates as [number, number]
        
        if (!currentMarker) {
            const el = document.createElement('div')
            el.className = 'minimap-marker'
            el.style.width = '10px'
            el.style.height = '10px'
            el.style.backgroundColor = 'white'
            el.style.borderRadius = '50%'
            el.style.border = '2px solid black'
            
            // Fix: offset null to center the marker
            currentMarker = new maplibregl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map)
        } else {
            currentMarker.setLngLat(coords)
        }
        
        // Update Traveled Path
        if (map.loaded()) {
            updateTraveledLayer(newPos)
        }
    }
})

onBeforeUnmount(() => {
    if (map) map.remove()
})
</script>

<style scoped>
.album-minimap {
    width: 200px;
    height: 150px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    background: #111;
}
</style>
