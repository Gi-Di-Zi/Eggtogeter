<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAuthStore } from '@/stores/auth'
import { usePhotoStore } from '@/stores/photo'
import { useUiStore } from '@/stores/ui'

const mapContainer = ref<HTMLElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const photoMarkers = shallowRef<maplibregl.Marker[]>([])
const authStore = useAuthStore()
const photoStore = usePhotoStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  (e: 'map-click', event: any): void
}>()



const renderMarkers = () => {
    if (!map.value) return

    // Clear existing markers
    photoMarkers.value.forEach(marker => marker.remove())
    photoMarkers.value = []

    photoStore.mapPhotos.forEach(photo => {
        // Create custom marker element
        const el = document.createElement('div')
        
        if (photo.storage_path && photo.publicUrl) {
            // Photo Marker
            el.className = 'photo-marker'
            el.style.backgroundImage = `url(${photo.publicUrl})`
            if (photo.category_color) {
                el.style.border = `3px solid ${photo.category_color}`
            }
        } else {
            // Text-only Marker (Overlay Card Style)
            el.className = 'text-marker'
            // User requested Description instead of Title
            // Fallback to title if description is empty, then generic text
            el.innerText = photo.description || photo.title || '기록'
            
            const color = photo.category_color || '#409eff'
            // Use color for text, NO border (User "remove blue mark on left")
            el.style.color = color
        }

        if (photo.storage_path && photo.publicUrl) {
            el.addEventListener('click', (e) => {
                 e.stopPropagation() // Prevent map click
                 flyTo(photo.latitude, photo.longitude)
                 uiStore.openDetailModal(photo)
            })
        }
        
        // Create popup
        const dateStr = photo.taken_at ? new Date(photo.taken_at).toLocaleDateString() : '날짜 없음'
        const popup = new maplibregl.Popup({ offset: 25 })
            .setHTML(`
                <div style="text-align:center;">
                    ${photo.publicUrl ? `<img src="${photo.publicUrl}" style="max-width:200px; border-radius:4px; margin-bottom: 8px; border: 2px solid ${photo.category_color || 'transparent'};" />` : ''}
                    <p style="margin:0 0 5px 0; font-weight:bold;">${photo.title || dateStr}</p>
                    ${photo.address ? `<p style="margin:0 0 5px 0; font-size:0.9em; color:#333;">📍 ${photo.address}</p>` : ''}
                    ${photo.description ? `<p style="margin:0; font-size:0.9em; color:#555;">${photo.description}</p>` : ''}
                </div>
            `)

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([photo.longitude, photo.latitude])
            .addTo(map.value!)

        if (photo.storage_path && photo.publicUrl) {
           marker.setPopup(popup)
        }

        photoMarkers.value.push(marker)
    })
}

onMounted(async () => {
  if (!mapContainer.value) return

  // Default: Seoul City Hall
  let center: [number, number] = [126.9780, 37.5665]
  
  map.value = new maplibregl.Map({
    container: mapContainer.value,

    style: {
      version: 8,
      sources: {
        'vworld-base': {
          type: 'raster',
          tiles: ['https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; <a href="http://www.vworld.kr/">VWorld</a>'
        }
      },
      layers: [
        {
          id: 'vworld-base-layer',
          type: 'raster',
          source: 'vworld-base',
          minzoom: 6,
          maxzoom: 19
        }
      ]
    } as any,
    center: center,
    zoom: 15
  })


  map.value.on('load', async () => {
      if (authStore.user?.id) {
          // Map should show shared photos too
          await photoStore.fetchPhotos(authStore.user.id, true)
      }

      // Try GPS
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  const { latitude, longitude } = position.coords
                  // Fly to user location
                  if (map.value) {
                      map.value.flyTo({
                          center: [longitude, latitude],
                          zoom: 15
                      })
                      // Optional: Show user location marker or similar (skipping for now based on simplifying)
                  }
              },
              (error) => {
                  console.warn('Geolocation failed or permission denied:', error)
                  // Stays at Seoul default
              },
              { enableHighAccuracy: true }
          )
      }
  })

  map.value.on('click', (e) => {
      emit('map-click', e)
  })
})

// Watch for profile changes (Removed location sync logic)


// Watch for photos changes
watch(() => photoStore.mapPhotos, () => {
    renderMarkers()
}, { deep: true })

// Watch for auth changes to fetch photos
watch(() => authStore.user, async (newUser) => {
    if (newUser?.id) {
        await photoStore.fetchPhotos(newUser.id)
    }
})

const flyTo = (lat: number, lng: number) => {
    if (map.value) {
        map.value.flyTo({
            center: [lng, lat],
            zoom: 17,
            speed: 1.2
        })
    }
}

defineExpose({
    flyTo
})
</script>

<template>
  <div ref="mapContainer" class="map-container"></div>
</template>


<style>
.photo-marker {
    background-size: cover;
    background-position: center;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    border: 2px solid white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.2s;
}

.photo-marker:hover {
    transform: scale(1.1);
    z-index: 100;
}

.text-marker {
    background: white;
    padding: 14px 20px; /* Increased padding */
    min-height: 48px; /* Taller */
    border-radius: 12px;
    border: none;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 8px 16px rgba(0,0,0,0.15); /* Slightly softer but deep shadow */
    position: relative;
    cursor: default;
    max-width: 180px;
    overflow: visible;
    text-overflow: ellipsis;
    transition: transform 0.2s;
    margin-bottom: 20px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit; /* Color inherited from JS style */
}

.text-marker:hover {
    transform: scale(1.05);
    z-index: 100;
}

.text-marker::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 10px 8px 0 8px;
    border-style: solid;
    border-color: white transparent transparent transparent;
    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.1));
}

/* Removed ::after arrow to make it look like a mini overlay card */
</style>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
