<template>
  <div class="album-route-view" ref="containerRef" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 1. 3D Map Area -->
    <div class="map-section">
      <AlbumMap 
        ref="mapRef"
        :route-line="routeData"
        :current-position="currentPosition"
        :current-transport-mode="currentTransportMode"
        :progress="progress"
        :is-playing="isPlaying"
        :photos="photos"
        :theme="mapTheme"
        @toggle-fullscreen="toggleFullscreen"
      />
      
      <!-- Overlays -->
      <div class="overlays-layer">
        <!-- Minimap (Top Right) -->
        <div class="minimap-wrapper">
            <AlbumMinimap 
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
          @settings="openSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAlbumStore } from '@/stores/album'
import { useAlbumAnimation } from '@/composables/useAlbumAnimation'
import { supabase } from '@/lib/supabase'

// Components
import AlbumMap from '@/components/album/AlbumMap.vue'
import AlbumControlDeck from '@/components/album/AlbumControlDeck.vue'
import AlbumTimeline from '@/components/album/AlbumTimeline.vue'
import AlbumOverlay from '@/components/album/AlbumOverlay.vue'
import AlbumMinimap from '@/components/album/AlbumMinimap.vue'

import { ElMessage } from 'element-plus'

const route = useRoute()
const albumStore = useAlbumStore()
const albumId = route.params.id as string

// Animation Composable
const { 
  photos, 
  segments,
  isPlaying, 
  animationState,
  isPausedForPhoto, // Computed ref
  progress, 
  speedMultiplier, 
  currentPhotoIndex, 
  currentTransportMode,
  routeLine,
  photoArrivalPoints, // Exposed from composable
  initializeRoute,
  play, 
  pause, 
  seekTo,
  getCurrentPosition
} = useAlbumAnimation()

// Local State
const containerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const currentPosition = ref<any>(null)
const albumTitle = ref('')

// Computed
const currentPhoto = computed(() => photos.value[currentPhotoIndex.value] || null)

const isShowingDate = computed(() => {
    return animationState.value === 'showing_start_date' || animationState.value === 'showing_new_date'
})

const currentDateText = computed(() => {
    if (!currentPhoto.value) return ''
    return new Date(currentPhoto.value.taken_at).toLocaleDateString()
})

const routeData = computed(() => {
    return routeLine.value
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

const mapTheme = computed(() => {
    return albumStore.currentAlbum?.content_data?.settings?.mapTheme || 'STREET'
})

// Lifecycle
onMounted(async () => {
    // Listen for fullscreen change
    document.addEventListener('fullscreenchange', () => {
        isFullscreen.value = !!document.fullscreenElement
    })

    if (!albumId) return
    
    try {
        const album = await albumStore.fetchAlbumById(albumId)
        if (album) {
            albumTitle.value = album.title
            // Fetch photos
            const loadedPhotos = await albumStore.fetchAlbumPhotos(albumId)
            
            // Add Public URL
            const photosWithUrl = loadedPhotos.map((p: any) => {
                let pubUrl = p.publicUrl
                if (!pubUrl && p.storage_path) {
                     const { data } = supabase.storage.from('photos').getPublicUrl(p.storage_path)
                     pubUrl = data.publicUrl
                }
                return {
                    ...p,
                    publicUrl: pubUrl
                }
            })

            // Fetch transitions from album metadata
            const transitions = album.content_data?.transitions || [] 
            
            initializeRoute(photosWithUrl, transitions)
        }
    } catch (e: any) {
        ElMessage.error('Failed to load album: ' + e.message)
    }
})

// Sync Position
watch(progress, () => {
    const pos = getCurrentPosition()
    if (pos) {
        currentPosition.value = pos
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

const setSpeed = (val: number) => {
    speedMultiplier.value = val
}

const seekToPhoto = (idx: number) => {
    if (isPlaying.value) pause()
    const targetP = photoArrivalPoints.value[idx] ?? 0
    seekTo(targetP)
    // Force state to show photo immediately
    animationState.value = 'paused_for_photo'
}

const prevPhoto = () => {
    let newIdx = currentPhotoIndex.value - 1
    if (newIdx < 0) newIdx = 0
    seekToPhoto(newIdx)
}

const nextPhoto = () => {
    let newIdx = currentPhotoIndex.value + 1
    if (newIdx >= photos.value.length) newIdx = photos.value.length - 1
    seekToPhoto(newIdx)
}

const seekToFirst = () => {
    seekToPhoto(0)
}

const seekToLast = () => {
    seekToPhoto(photos.value.length - 1)
}

const openSettings = () => {
    ElMessage.info('Settings not implemented yet')
}
</script>

<style scoped>
.album-route-view {
  width: 100%;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Prevent both scrollbars on root */
  overflow-x: hidden;
}

/* Fullscreen Mode Styles */
.album-route-view.is-fullscreen .footer-section {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
    border-top: none;
    padding-bottom: 20px;
    z-index: 1000;
    pointer-events: none; /* Let clicks pass through empty areas */
}
.album-route-view.is-fullscreen .footer-section > * {
    pointer-events: auto; /* Re-enable pointer events for controls */
}
.album-route-view.is-fullscreen .album-title {
    display: none; /* Hide title in FS mode to save space? Or keep it? User didn't specify. I'll keep it but maybe it overlaps map. */
}
/* Ensure map takes full space */
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
  z-index: 5;
}

.minimap-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
  pointer-events: auto;
  z-index: 10;
}

.footer-section {
  flex: 0 1 auto; /* Allow it to shrink if map needs space, but grow for content */
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
  max-height: 60vh; /* Don't let footer take more than 60% of screen */
}

/* Global No-Scroll Force */
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
  font-size: 1.1rem; /* Slightly smaller title to save space */
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
  padding: 10px 20px 0 20px; /* More top padding for labels */
  box-sizing: border-box;
}

.controls-wrapper {
  width: 100%;
  padding: 0 20px;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}
</style>
