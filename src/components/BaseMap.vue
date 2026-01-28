<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAuthStore } from '@/stores/auth'
import { usePhotoStore } from '@/stores/photo'
import { useUiStore } from '@/stores/ui'
import { MagicStick, Check } from '@element-plus/icons-vue'

const mapContainer = ref<HTMLElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const photoMarkers = shallowRef<maplibregl.Marker[]>([])
const authStore = useAuthStore()
const photoStore = usePhotoStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  (e: 'map-click', event: any): void
}>()

const isPanelOpen = ref(false)
const currentTheme = ref('Base') // Base, midnight, gray

// Themes with Preview Tile URLs (Gyeongbokgung/Sejong-daero Area - Detailed Urban/Palace Mix)
const themes = [
    { label: '기본 (V-World)', value: 'Base', type: 'vworld', preview: 'https://xdworld.vworld.kr/2d/Base/service/16/55883/25375.png' },
    { label: '컬러 (Voyager)', value: 'voyager', type: 'carto', preview: 'https://basemaps.cartocdn.com/rastertiles/voyager/16/55883/25375.png' },
    { label: '회색조 (Positron)', value: 'light_all', type: 'carto', preview: 'https://basemaps.cartocdn.com/light_all/16/55883/25375.png' },
    { label: '다크 (Dark)', value: 'dark_all', type: 'carto', preview: 'https://basemaps.cartocdn.com/dark_all/16/55883/25375.png' },
]

const togglePanel = () => {
    isPanelOpen.value = !isPanelOpen.value
}

const changeTheme = (themeValue: string) => {
    if (!map.value) return
    currentTheme.value = themeValue
    // Panel stays open for exploration

    // Find theme object to determine type
    const selectedTheme = themes.find(t => t.value === themeValue)
    const isCarto = selectedTheme?.type === 'carto'

    let tilesUrl = ''
    let attribution = ''

    if (isCarto) {
        if (themeValue === 'voyager') {
             tilesUrl = `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
        } else {
             tilesUrl = `https://basemaps.cartocdn.com/${themeValue}/{z}/{x}/{y}{r}.png`
        }
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    } else {
        // V-World Default
        tilesUrl = `https://xdworld.vworld.kr/2d/${themeValue}/service/{z}/{x}/{y}.png`
        attribution = '&copy; <a href="http://www.vworld.kr/">VWorld</a>'
    }

    const style = {
        version: 8,
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [tilesUrl],
                tileSize: 256,
                attribution: attribution
            }
        },
        layers: [
            {
                id: 'raster-layer',
                type: 'raster',
                source: 'raster-tiles',
                minzoom: 0, 
                maxzoom: 19
            }
        ]
    } as any

    map.value.setStyle(style)
    
    // Changing style removes markers/layers, need to re-add them after style load
    map.value.once('styledata', () => {
         renderMarkers()
    })
}

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
  
  // Initial style (Default is Base/V-World)
  map.value = new maplibregl.Map({
    container: mapContainer.value,

    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: ['https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; <a href="http://www.vworld.kr/">VWorld</a>'
        }
      },
      layers: [
        {
          id: 'raster-layer',
          type: 'raster',
          source: 'raster-tiles',
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
      // Close panel on map click if open
      if(isPanelOpen.value) isPanelOpen.value = false
  })
})

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
  <!-- Relative container needed for absolute positioning of controls -->
  <div class="map-wrapper" style="position: relative; width: 100%; height: 100%;">
      <div ref="mapContainer" class="map-container"></div>
      
      <!-- Theme Switcher Control -->
      <div class="theme-control-wrapper" :class="{ 'panel-open': isPanelOpen }">
          
          <!-- Panel (Appears to Left of Button on Desktop) -->
          <div class="theme-panel">
              <div class="panel-header">지도 테마 선택</div>
              <div class="theme-grid">
                  <div 
                    v-for="theme in themes" 
                    :key="theme.value" 
                    class="theme-card"
                    :class="{ 'active': currentTheme === theme.value }"
                    @click="changeTheme(theme.value)"
                    :style="{ backgroundImage: `url(${theme.preview})` }"
                  >
                        <div class="theme-label">{{ theme.label }}</div>
                        <div class="active-indicator" v-if="currentTheme === theme.value">
                            <el-icon><Check /></el-icon>
                        </div>
                  </div>
              </div>
          </div>
          
          <!-- Toggle Button -->
          <button class="theme-toggle-btn" @click="togglePanel">
              <el-icon><MagicStick /></el-icon>
          </button>
      </div>
  </div>
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
</style>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}

/* Wrapper for positioning */
.theme-control-wrapper {
    position: absolute;
    top: 20px;
    right: 20px; /* Default Right */
    display: flex;
    align-items: flex-start;
    gap: 12px;
    z-index: 100;
    flex-direction: row; /* Panel is to the left of button by order since button is 2nd in DOM? No, Wait. */
    /* Flex Direction Row: Item 1 (Panel), Item 2 (Button). */
    /* We want Button on Far Right. Panel to its Left. */
    /* So standard Row works. Panel is left of button. */
}

.theme-toggle-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    color: #606266;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 110;
    flex-shrink: 0;
}

.theme-toggle-btn:hover {
    transform: scale(1.1);
    color: #409eff;
    background-color: white;
}

/* Panel Styles */
.theme-panel {
    background: rgba(255, 255, 255, 0.85); /* Glassmorphism */
    backdrop-filter: blur(16px);
    padding: 16px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    width: 280px;
    
    /* Animation Initial State: Hidden */
    /* On Desktop (Right side): Panel is to the Left of button. */
    /* We want it to slide OUT from the button (Right -> Left)? Or Fade in? */
    /* User said: "In small screen... floating window also comes from left". */
    /* So on Desktop (Right), it should probably come from Right or just Appear. */
    /* Let's make it slide from Right (20px offset) to Left (0px) */
    
    opacity: 0;
    visibility: hidden;
    transform: translateX(20px);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Open State */
.theme-control-wrapper.panel-open .theme-panel {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
}

.theme-control-wrapper.panel-open .theme-toggle-btn {
    background-color: #409eff;
    color: white;
    transform: rotate(15deg);
}

.panel-header {
    font-size: 14px;
    font-weight: 700;
    color: #303133;
    margin-bottom: 4px;
}

.theme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr; /* 2 columns */
    gap: 10px;
}

.theme-card {
    aspect-ratio: 1;
    border-radius: 12px;
    background-size: cover;
    background-position: center;
    position: relative;
    cursor: pointer;
    overflow: hidden;
    border: 2px solid rgba(0,0,0,0.1); /* Subtle border for lighter themes */
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.theme-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.theme-card.active {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.theme-label {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(0,0,0,0.6);
    color: white;
    font-size: 11px;
    text-align: center;
    padding: 6px 0;
    backdrop-filter: blur(2px);
    font-weight: 500;
}

.active-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    background: #409eff;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* --- Responsive Design (Mobile) --- */
@media (max-width: 768px) {
    .theme-control-wrapper {
        top: 20px;
        right: auto;
        left: 20px; /* Move to Left */
        
        /* Reorder: Button First (Left), then Panel */
        flex-direction: row-reverse; 
    }

    .theme-panel {
        /* Animation: Slide from Left (-20px) to Right (0) */
        transform: translateX(-20px);
    }
    
    .theme-control-wrapper.panel-open .theme-panel {
        transform: translateX(0);
        /* Ensure pushing right */
        margin-left: 0; 
    }
}
</style>
