<template>
  <div class="album-minimap" ref="mapContainer"></div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, onBeforeUnmount } from 'vue'
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

onMounted(() => {
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
        { 
          id: 'vworld', 
          type: 'raster', 
          source: 'vworld',
          paint: {
            'raster-saturation': -1, // Makes it grey
            'raster-brightness-min': 0.2,
            'raster-contrast': 0.1
          }
        }
      ]
    },
    center: [0, 0],
    zoom: 1,
    interactive: false,
    attributionControl: false
  })

  map.on('load', () => {
    if (props.routeGeoJson) {
      addRouteLayer(props.routeGeoJson)
      fitBounds(props.routeGeoJson)
    }
    if (props.photos && props.photos.length > 0) {
      addPhotoDotsLayer(props.photos)
    }
  })
})

const addRouteLayer = (geoJson: any) => {
    if (!map) return
    
    if (map.getSource('minimap-route')) {
        (map.getSource('minimap-route') as maplibregl.GeoJSONSource).setData(geoJson)
    } else {
        map.addSource('minimap-route', {
            type: 'geojson',
            data: geoJson
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
                'line-color': '#FFD700',
                'line-width': 3
            }
        })
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
    const bbox = turf.bbox(geoJson)
    map.fitBounds(bbox as [number, number, number, number], { padding: 20 })
}

// Watchers
watch(() => props.routeGeoJson, (newVal) => {
    if (map && map.loaded()) {
        addRouteLayer(newVal)
        fitBounds(newVal)
    }
})

watch(() => props.photos, (newVal) => {
    if (map && map.loaded()) {
        addPhotoDotsLayer(newVal)
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
            
            currentMarker = new maplibregl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map)
        } else {
            currentMarker.setLngLat(coords)
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
