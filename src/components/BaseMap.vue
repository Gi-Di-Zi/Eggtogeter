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

// Themes with Preview Tile URLs
const themes = [
    { label: '기본 (Maptiler)', value: 'streets-v2', type: 'maptiler', preview: 'https://api.maptiler.com/maps/streets-v2/0/0/0.png?key=' + import.meta.env.VITE_MAPTILER_KEY },
    { label: '위성 (Hybrid)', value: 'hybrid', type: 'maptiler', preview: 'https://api.maptiler.com/maps/hybrid/0/0/0.jpg?key=' + import.meta.env.VITE_MAPTILER_KEY },
    { label: '아웃도어 (Outdoor)', value: 'outdoor-v2', type: 'maptiler', preview: 'https://api.maptiler.com/maps/outdoor-v2/0/0/0.png?key=' + import.meta.env.VITE_MAPTILER_KEY },
    { label: '윈터 (Winter)', value: 'winter-v2', type: 'maptiler', preview: 'https://api.maptiler.com/maps/winter-v2/0/0/0.png?key=' + import.meta.env.VITE_MAPTILER_KEY },
    { label: '파스텔 (Pastel)', value: 'pastel', type: 'maptiler', preview: 'https://api.maptiler.com/maps/pastel/0/0/0.png?key=' + import.meta.env.VITE_MAPTILER_KEY },
    { label: '다크 (Dark)', value: 'dataviz-dark', type: 'maptiler', preview: 'https://api.maptiler.com/maps/dataviz-dark/0/0/0.png?key=' + import.meta.env.VITE_MAPTILER_KEY },
]

const togglePanel = () => {
    isPanelOpen.value = !isPanelOpen.value
}

const add3DBuildings = () => {
    if (!map.value) return;
    const style = map.value.getStyle();
    if (!style || !style.sources) return;

    // Detect the correct vector source (MapTiler styles often vary: 'openmaptiles', 'maptiler_planet', etc.)
    let sourceId = 'openmaptiles';
    const sources = style.sources;
    
    // Explicit check for known MapTiler source names
    if (sources['openmaptiles']) {
        sourceId = 'openmaptiles';
    } else if (sources['maptiler_planet']) {
        sourceId = 'maptiler_planet';
    } else if (sources['map']) { // Sometimes just 'map'
        sourceId = 'map';
    } else {
        // Fallback: find the first vector source
        const foundSource = Object.keys(sources).find(key => {
            const s = sources[key];
            return s && s.type === 'vector';
        });
        
        if (foundSource) {
            sourceId = foundSource;
        } else {
            console.warn('No vector source found for 3D buildings');
            return;
        }
    }
    
    console.log(`Adding 3D buildings using source: ${sourceId}`);

    // Remove existing layer if present
    if (map.value.getLayer('3d-buildings')) {
        map.value.removeLayer('3d-buildings');
    }

    const layers = style.layers;
    let labelLayerId;
    
    // Insert the layer beneath any symbol layer.
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        // Note: layer should exist, but extra safety check
        if (!layer) continue;
        
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
            labelLayerId = layer.id;
            break;
        }
    }

    try {
        map.value.addLayer(
            {
                'id': '3d-buildings',
                'source': sourceId,
                'source-layer': 'building',
                'filter': [
                'all',
                ['!=', 'hide_3d', true]
            ],
            'type': 'fill-extrusion',
            'minzoom': 13,
            'paint': {
                'fill-extrusion-color': '#ffffff',
                'fill-extrusion-height': [
                    'coalesce', ['get', 'render_height'], ['get', 'height'], 0
                ],
                'fill-extrusion-base': [
                     'coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0
                ],
                'fill-extrusion-opacity': 0.2
            }
        },
        labelLayerId
    );
    } catch (e) {
        console.error('Failed to add 3D buildings layer:', e);
    }
}


const changeTheme = (themeValue: string) => {
    if (!map.value) return
    currentTheme.value = themeValue

    const key = import.meta.env.VITE_MAPTILER_KEY
    if (!key) {
        console.error('Maptiler Key Missing')
        return
    }

    // Always use MapTiler Vector Styles now
    map.value.setStyle(`https://api.maptiler.com/maps/${themeValue}/style.json?key=${key}`)

    map.value.once('styledata', () => {
         renderMarkers()
         // Add 3D buildings for all themes except hybrid
         if (themeValue !== 'hybrid') {
             // Slight delay to ensure style is fully settled and sources are available
             setTimeout(() => {
                 add3DBuildings()
             }, 200)
         }
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
            el.innerText = photo.description || photo.title || '기록'
            
            const color = photo.category_color || '#409eff'
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
  
  // Initial style: Maptiler Streets
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY
  const initialStyle = maptilerKey 
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`
    : { version: 8, sources: {}, layers: [] } // Fallback/Empty

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: initialStyle as any, // URL or Style Object
    center: center,
    zoom: 15,
    pitch: 45, // Add pitch for 3D effect
    bearing: -17.6 // Add detailed bearing
  })


  map.value.on('load', async () => {
      // Add 3D Buildings on initial load if not hybrid (default is streets-v2, so yes)
      add3DBuildings()

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
            pitch: 50, // Increase pitch on zoom in
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
