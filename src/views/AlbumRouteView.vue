<template>
  <div class="album-route-view" ref="containerRef" :class="{ 'is-fullscreen': isFullscreen }"
       v-loading="isLoading"
       element-loading-text="Loading Trip..."
       element-loading-background="rgba(0, 0, 0, 0.9)"
  >
    <!-- Settings Dialog -->
    <el-dialog
        v-model="isSettingsOpen"
        title="Map Style"
        width="400px"
        :modal="true"
        :append-to-body="true"
        class="settings-dialog"
        align-center
    >
        <div class="theme-grid">
            <div 
                v-for="item in mapThemes" 
                :key="item.value"
                class="theme-card"
                :class="{ active: selectedTheme === item.value }"
                @click="selectTheme(item.value)"
            >
                <div class="theme-preview" :style="{ background: getThemeColor(item.value) }"></div>
                <span class="theme-label">{{ item.label }}</span>
                <el-icon v-if="selectedTheme === item.value" class="check-icon"><Check /></el-icon>
            </div>
        </div>
    </el-dialog>

    <!-- 1. 3D Map Area -->
    <div class="map-section">
      <AlbumMap 
        ref="mapRef"
        :route-line="routeLine"
        :current-position="currentPosition"
        :current-transport-mode="currentTransportMode"
        :progress="progress"
        :is-playing="isPlaying"
        :photos="photos"
        :theme="mapTheme"
        :segments="segments"
        @toggle-fullscreen="toggleFullscreen"
        @map-loaded="onMapLoaded"
      />
      
      <!-- Overlays -->
      <div class="overlays-layer">
        <!-- Minimap (Top Right) -->
        <div class="minimap-wrapper">
            <AlbumMinimap 
              v-if="isRouteReady && routeLine"
              :route-geo-json="routeLine"
              :current-position="currentPosition"
              :photos="photos"
              access-token=""
            />
        </div>

        <!-- Photo/Date Overlays (Center) -->
        <AlbumOverlay 
            :current-photo="isPausedForPhoto ? currentPhoto : null"
            :show-date-overlay="isShowingDate"
            :display-date="currentDateText"
            :frame-style="currentFrameStyle"
        />
      </div>
    </div>

    <!-- 2. Footer Section -->
    <div class="footer-section">
      <!-- Title -->
      <div class="album-title">
        <h1>{{ albumTitle }}</h1>
        <span class="album-subtitle">{{ albumDateRange }}</span>
      </div>

      <!-- Timeline -->
      <div class="timeline-wrapper">
        <AlbumTimeline 
          :photos="photos"
          :current-photo-index="currentPhotoIndex"
          :segments="segments"
          @seek="seekToPhoto"
        />
      </div>

      <!-- Controls -->
      <div class="controls-wrapper">
        <AlbumControlDeck 
          :is-playing="isPlaying"
          :speed="speedMultiplier"
          @toggle-play="togglePlay"
          @update:speed="setSpeed"
          @prev="prevPhoto"
          @next="nextPhoto"
          @first="seekToFirst"
          @last="seekToLast"
          @open-map-settings="openSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAlbumStore } from '@/stores/album'
import { useAlbumAnimation } from '@/composables/useAlbumAnimation'


// Components
import AlbumControlDeck from '@/components/album/AlbumControlDeck.vue'
import AlbumMap from '@/components/album/AlbumMap.vue'
import AlbumMinimap from '@/components/album/AlbumMinimap.vue'
import AlbumOverlay from '@/components/album/AlbumOverlay.vue'
import AlbumTimeline from '@/components/album/AlbumTimeline.vue'

import { Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const albumStore = useAlbumStore()
const albumId = ref<string | null>(null) // Reactive albumId

// Computed

const isMapReady = ref(false)

// ... (skipping unchanged parts)

// onMounted logic merged below

// Animation Composable
const { 
  photos, 
  segments,
  isPlaying, 
  animationState,
  isRouteReady,
  isPausedForPhoto,
  progress, 
  speedMultiplier, 
  currentPhotoIndex, 
  currentTransportMode,
  routeLine,
  initializeRoute,
  play, 
  pause, 
  getCurrentPosition,
  jumpToPhoto
} = useAlbumAnimation()

// Local State
const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const currentPosition = ref<any>(null)
const albumTitle = ref('')
const isLoading = ref(true)

// Settings Logic
const isSettingsOpen = ref(false)
const selectedTheme = ref('STREET')

const mapThemes = [
    { label: 'Basic Street', value: 'STREET' },
    { label: 'Dark Mode', value: 'DARK' },
    { label: 'Pastel', value: 'PASTEL' },
    { label: 'Outdoor', value: 'OUTDOOR' },
    { label: 'Winter', value: 'WINTER' },
    { label: 'Satellite Hybrid', value: 'HYBRID' }
]

const mapTheme = computed(() => {
    return albumStore.currentAlbum?.content_data?.settings?.mapTheme || 'STREET'
})

const openSettings = () => {
    selectedTheme.value = mapTheme.value
    isSettingsOpen.value = true
}

const selectTheme = (val: string) => {
    selectedTheme.value = val
    saveSettings()
}

const saveSettings = () => {
    // Update store immediately for reactivity
    if (albumStore.currentAlbum && albumStore.currentAlbum.content_data) {
        if (!albumStore.currentAlbum.content_data.settings) {
            albumStore.currentAlbum.content_data.settings = {}
        }
        albumStore.currentAlbum.content_data.settings.mapTheme = selectedTheme.value
    }
    ElMessage.success('Map theme updated')
}

const getThemeColor = (theme: string) => {
    switch(theme) {
        case 'STREET': return 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
        case 'DARK': return 'linear-gradient(135deg, #232526 0%, #414345 100%)';
        case 'PASTEL': return 'linear-gradient(135deg, #FFDEE9 0%, #B5FFFC 100%)';
        case 'OUTDOOR': return 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)';
        case 'WINTER': return 'linear-gradient(135deg, #e6e9f0 0%, #eef1f5 100%)';
        case 'HYBRID': return 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)';
        default: return '#eee';
    }
}

// Watcher for loading state
watch([isRouteReady, isMapReady], ([routeReady, mapReady]) => {
    if (routeReady && mapReady) {
        isLoading.value = false
    }
})

// Computed
const currentPhoto = computed(() => {
    const idx = currentPhotoIndex.value
    if (idx >= 0 && idx < photos.value.length) {
        return photos.value[currentPhotoIndex.value]
    }
    return null
})

// Current Frame Style
const currentFrameStyle = computed(() => {
    const photo = currentPhoto.value
    if (!photo || !albumStore.currentAlbum?.content_data?.settings?.photoFrameStyles) {
        return 'classic' // Default fallback
    }
    const frameStyles = albumStore.currentAlbum.content_data.settings.photoFrameStyles
    return frameStyles[photo.id] || 'classic'
})

const isShowingDate = computed(() => {
    return animationState.value === 'showing_start_date' || animationState.value === 'showing_new_date'
})

const currentDateText = computed(() => {
    if (!currentPhoto.value) return ''
    return new Date(currentPhoto.value.taken_at).toLocaleDateString()
})



const albumDateRange = computed(() => {
    const list = photos.value
    if (list.length === 0) return ''
    
    const first = list[0]
    const last = list[list.length - 1]

    if (!first || !last) return ''

    const start = new Date(first.taken_at).toLocaleDateString()
    const end = new Date(last.taken_at).toLocaleDateString()
    return start === end ? start : `${start} - ${end}`
})

// Lifecycle
onMounted(async () => {
    // Listen for fullscreen change
    document.addEventListener('fullscreenchange', () => {
        isFullscreen.value = !!document.fullscreenElement
    })

    const idParam = route.params.id
    if (typeof idParam !== 'string') {
        isLoading.value = false
        return
    }
    
    albumId.value = idParam

    try {
        const album = await albumStore.fetchAlbumById(albumId.value, true) // Explicitly use publicMode=true for guest access logic
        if (album) {
            albumTitle.value = album.title
            
            // ... existing photo fetch logic ...
            const loadedPhotos = await albumStore.fetchAlbumPhotos(albumId.value, true)

            if (!loadedPhotos || loadedPhotos.length === 0) {
                isLoading.value = false
                return
            }
            
            // Fix: Initialize the route with loaded photos
            await initializeRoute(loadedPhotos, album.content_data?.transitions || [])

        } else {
            console.error('Album not found or access denied')
            isLoading.value = false
        }
    } catch (e: any) {
        ElMessage.error('Failed to load album: ' + e.message)
        isLoading.value = false 
    }
})

const onMapLoaded = () => {
    isMapReady.value = true
}

// Sync Position
watch(progress, () => {
    const pos = getCurrentPosition()
    if (pos) {
        currentPosition.value = pos
    }
})

// Ensure initial position is set when route is ready
watch(isRouteReady, (ready) => {
    if (ready) {
        const pos = getCurrentPosition()
        if (pos) {
            currentPosition.value = pos
        }
    }
})

// Controls
const togglePlay = () => {
    if (isPlaying.value) pause()
    else play()
}

const toggleFullscreen = () => {
    if (!containerRef.value) return
    if (!document.fullscreenElement) {
        containerRef.value.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`)
        })
    } else {
        document.exitFullscreen()
    }
}

const nextPhoto = () => {
    let newIdx = currentPhotoIndex.value + 1
    if (newIdx >= photos.value.length) newIdx = photos.value.length - 1
    seekToPhoto(newIdx)
}

const setSpeed = (val: number) => {
    speedMultiplier.value = val
}

const seekToPhoto = (idx: number) => {
    jumpToPhoto(idx)
}

const prevPhoto = () => {
    let newIdx = currentPhotoIndex.value - 1
    if (newIdx < 0) newIdx = 0
    seekToPhoto(newIdx)
}


const seekToFirst = () => {
    seekToPhoto(0)
}

const seekToLast = () => {
    seekToPhoto(photos.value.length - 1)
}
</script>

<style scoped>
.album-route-view {
  width: 100%;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden; 
  overflow-x: hidden;
}

.album-route-view.is-fullscreen .footer-section {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
    border-top: none;
    padding-bottom: 20px;
    z-index: 1000;
    pointer-events: none; 
}
.album-route-view.is-fullscreen .footer-section > * {
    pointer-events: auto; 
}
.album-route-view.is-fullscreen .album-title {
    display: none; 
}

.map-section {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0; 
}

.overlays-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3000; /* Increased to cover map markers (2000) */
}

.minimap-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
  pointer-events: auto;
  z-index: 10;
}

.footer-section {
  flex: 0 1 auto; 
  background: #111;
  padding: 10px 0 20px 0; 
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 15px; 
  z-index: 20;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
  max-height: 60vh;
}

:deep(html), :deep(body) {
    overflow: hidden !important;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

.album-title {
  text-align: center;
  padding: 5px 0 5px 0;
  color: white;
  width: 100%;
  box-sizing: border-box;
}
.album-title h1 {
  font-size: 1.1rem; 
  margin: 0;
  font-weight: 600;
  letter-spacing: 1px;
}
.album-subtitle {
  font-size: 0.75rem;
  color: #888;
}

.timeline-wrapper {
  width: 100%;
  padding: 10px 20px 0 20px; 
  box-sizing: border-box;
}

.controls-wrapper {
  width: 100%;
  padding: 0 20px;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

/* Settings Dialog Styles */
.theme-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 10px;
}

.theme-card {
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 10px;
    background: #f9f9f9;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    gap: 8px;
}

.theme-card:hover {
    background: #eee;
    transform: translateY(-2px);
}

.theme-card.active {
    border-color: #ffd700;
    background: #fff9db;
}

.theme-preview {
    width: 100%;
    height: 80px;
    border-radius: 8px;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
}

.theme-label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
}

.check-icon {
    position: absolute;
    top: 8px;
    right: 8px;
    color: #ffd700;
    font-weight: bold;
    background: rgba(255,255,255,0.8);
    border-radius: 50%;
    padding: 2px;
}
</style>
