<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAlbumStore } from '@/stores/album'
import { ElMessage } from 'element-plus'
import { ArrowLeft, VideoPlay, VideoPause, Refresh, Location, Loading as ElIconLoading } from '@element-plus/icons-vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useGoogleMapsLoader } from '@/composables/useGoogleMapsLoader'
import { isPlusCodeAddress, pickBestFormattedAddress, sanitizeAddress } from '@/utils/addressUtils'

const route = useRoute()
const router = useRouter()
const albumStore = useAlbumStore()

const albumId = route.params.id as string
const photos = ref<any[]>([])
const mapContainer = ref<HTMLElement | null>(null)
const map = ref<any>(null)

const isPlaying = ref(false)
const currentPhotoIndex = ref(0)
const playbackSpeed = computed(() => albumStore.currentAlbum?.content_data?.settings?.playbackSpeed || 1)

// Map Themes Mapping (same as CreateAlbumModal)
const key = import.meta.env.VITE_MAPTILER_KEY
const mapStyles = {
  STREET: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
  DARK: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${key}`,
  LIGHT: `https://api.maptiler.com/maps/basic-v2-light/style.json?key=${key}`,
  OUTDOOR: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`
}

onMounted(async () => {
  const album = await albumStore.fetchAlbumById(albumId)
  if (!album) {
    ElMessage.error('앨범을 찾을 수 없습니다.')
    router.push('/album')
    return
  }

  // Fetch full photo data
  const rawPhotos = await albumStore.fetchAlbumPhotos(albumId)
  
  if (rawPhotos.length > 0) {
    const { loadGoogleMaps } = useGoogleMapsLoader()
    await loadGoogleMaps()
    
    const geocoder = new google.maps.Geocoder()
    const recoveryPromises = rawPhotos.map(async (photo: any) => {
      // 주소가 비어있거나 '주소 정보 없음'인 경우 복구 시도
      const currentAddress = photo.address?.trim() || ''
      const needsRecovery = !currentAddress || isPlusCodeAddress(currentAddress)

      if (needsRecovery && photo.latitude && photo.longitude) {
        return new Promise<void>((resolve) => {
          geocoder.geocode({ location: { lat: photo.latitude, lng: photo.longitude } }, (results: any, status: any) => {
            if (status === 'OK' && results && results.length > 0) {
              const recovered = pickBestFormattedAddress(results)
              if (recovered && !isPlusCodeAddress(recovered)) {
                photo.address = recovered
              }
            }
            resolve()
          })
        })
      }
      return Promise.resolve()
    })
    
    await Promise.all(recoveryPromises)
    photos.value = rawPhotos
  }
  
  if (album.style_type === 'route_anim') {
    initMap()
  }
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

const initMap = () => {
  if (!mapContainer.value || photos.value.length === 0) return

  const firstPhoto = photos.value[0]
  const theme = (albumStore.currentAlbum?.content_data?.settings?.mapTheme || 'STREET') as keyof typeof mapStyles

  const mapOptions: any = {
    container: mapContainer.value,
    style: mapStyles[theme],
    center: [firstPhoto.longitude, firstPhoto.latitude],
    zoom: 13,
    pitch: 45
  }

  map.value = new maplibregl.Map(mapOptions)

  if (map.value) {
    // @ts-ignore
    map.value.on('load', () => {
      addRouteLayer()
      addMarkers()
    })
  }
}

const addRouteLayer = () => {
  if (!map.value || photos.value.length < 2) return

  const coordinates = photos.value.map(p => [p.longitude, p.latitude])

  map.value.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    }
  })

  ;(map.value as any).addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#409eff',
      'line-width': 4,
      'line-opacity': 0.6
    }
  })
}

const markers = ref<maplibregl.Marker[]>([])
const addMarkers = () => {
  if (!map.value) return

  photos.value.forEach((photo, index) => {
    const el = document.createElement('div')
    el.className = `marker-point ${index === 0 ? 'start' : index === photos.value.length - 1 ? 'end' : ''}`
    
    const marker = new maplibregl.Marker(el)
      .setLngLat([photo.longitude, photo.latitude])
      .addTo(map.value as any)
    
    // @ts-ignore
    markers.value.push(marker)
  })
}

const handleBack = () => {
  router.push('/album')
}

const togglePlayback = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    startAnimation()
  }
}

const restart = () => {
  isPlaying.value = true
  currentPhotoIndex.value = 0
  startAnimation()
}

const startAnimation = async () => {
  if (!map.value || photos.value.length === 0) return

  for (let i = currentPhotoIndex.value; i < photos.value.length; i++) {
    if (!isPlaying.value) break
    
    currentPhotoIndex.value = i
    const photo = photos.value[i]
    
    // Move Camera
    map.value.flyTo({
      center: [photo.longitude, photo.latitude],
      zoom: 16,
      speed: 1.2 / playbackSpeed.value,
      curve: 1.4,
      essential: true
    })

    // Wait for flyTo or a fixed duration
    await new Promise(resolve => setTimeout(resolve, 3000 / playbackSpeed.value))
  }
  
  if (currentPhotoIndex.value === photos.value.length - 1) {
    isPlaying.value = false
  }
}

const getReadableAddress = (address?: string | null) => {
  return sanitizeAddress(address) || '위치 정보 없음'
}
</script>

<template>
  <div class="album-viewer">
    <div class="viewer-header">
      <el-button :icon="ArrowLeft" @click="handleBack" circle />
      <h2 v-if="albumStore.currentAlbum">{{ albumStore.currentAlbum.title }}</h2>
    </div>

    <div v-if="albumStore.loading" class="loading">
      <el-icon class="is-loading" :size="40"><el-icon-loading /></el-icon>
    </div>

    <div v-else-if="albumStore.currentAlbum" class="viewer-content">
      <!-- Route Animation Style -->
      <div v-if="albumStore.currentAlbum.style_type === 'route_anim'" class="route-anim-container">
        <div ref="mapContainer" class="map-view"></div>
        
        <!-- Controls Overlay -->
        <div class="viewer-controls">
          <div class="control-top">
            <el-button :icon="ArrowLeft" @click="handleBack" circle />
            <div class="album-title-badge">
              <span>{{ albumStore.currentAlbum.title }}</span>
            </div>
          </div>

          <div class="control-bottom">
            <div class="playback-bar">
              <el-button 
                type="primary" 
                :icon="isPlaying ? VideoPause : VideoPlay" 
                circle 
                size="large"
                @click="togglePlayback"
              />
              <el-button :icon="Refresh" circle @click="restart" title="다시보기" />
              
              <div class="progress-info">
                <el-slider 
                  v-model="currentPhotoIndex" 
                  :max="photos.length - 1" 
                  :disabled="true"
                  style="flex: 1"
                />
                <span class="count">{{ currentPhotoIndex + 1 }} / {{ photos.length }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Photo Card Popup (Floating) -->
        <transition name="el-zoom-in-center">
          <div v-if="photos[currentPhotoIndex]" class="photo-popup">
            <div class="popup-image">
              <img :src="photos[currentPhotoIndex].publicUrl || photos[currentPhotoIndex].storage_path" />
            </div>
            <div class="popup-info">
              <h4 class="popup-title">{{ photos[currentPhotoIndex].title || '제목 없음' }}</h4>
              <div class="popup-meta">
                <el-icon><Location /></el-icon>
                <span>{{ getReadableAddress(photos[currentPhotoIndex].address) }}</span>
              </div>
              <p v-if="photos[currentPhotoIndex].description" class="popup-desc">
                {{ photos[currentPhotoIndex].description }}
              </p>
            </div>
          </div>
        </transition>
      </div>

      <!-- Scroll Narrative Style -->
      <div v-else-if="albumStore.currentAlbum.style_type === 'scroll_view'" class="scroll-view">
        <h3>Scroll Narrative</h3>
        <p>블로그 형태 세로 스크롤 (준비 중)</p>
        <el-alert type="info" :closable="false">
          이 스타일은 현재 개발 중입니다. 곧 블로그 형태로 사진과 텍스트가 조화롭게 표시됩니다.
        </el-alert>
      </div>

      <!-- AI Video Style -->
      <div v-else-if="albumStore.currentAlbum.style_type === 'ai_video'" class="ai-video">
        <h3>AI Video</h3>
        <p>AI 동영상 생성 (준비 중)</p>
        <el-alert type="info" :closable="false">
          이 스타일은 현재 개발 중입니다. AI가 선택된 사진들로 동영상을 자동 생성합니다.
        </el-alert>
      </div>

      <!-- Album Info -->
      <el-divider />
      <div class="album-info">
        <p><strong>설명:</strong> {{ albumStore.currentAlbum.description || '없음' }}</p>
        <p><strong>사진 수:</strong> {{ albumStore.currentAlbum.content_data.photo_ids?.length || 0 }}장</p>
        <p><strong>생성일:</strong> {{ new Date(albumStore.currentAlbum.created_at).toLocaleString() }}</p>
      </div>
    </div>
  </div>
</template>


<style scoped>
.album-viewer {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: #000;
  overflow: hidden;
}

.route-anim-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-view {
  width: 100%;
  height: 100%;
}

.viewer-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 10;
}

.control-top {
  display: flex;
  align-items: center;
  gap: 15px;
  pointer-events: auto;
}

.album-title-badge {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  color: white;
  padding: 8px 20px;
  border-radius: 25px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.control-bottom {
  display: flex;
  justify-content: center;
  padding-bottom: 20px;
}

.playback-bar {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  padding: 10px 25px;
  border-radius: 40px;
  display: flex;
  align-items: center;
  gap: 20px;
  width: 600px;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.progress-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 15px;
}

.count {
  font-size: 14px;
  color: #606266;
  font-weight: 600;
  min-width: 50px;
}

.photo-popup {
  position: absolute;
  right: 30px;
  top: 100px;
  width: 320px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  z-index: 20;
}

.popup-image img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.popup-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.popup-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 5px;
}

.popup-desc {
  margin: 0;
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}

/* Marker Styles */
:deep(.marker-point) {
  width: 12px;
  height: 12px;
  background: #409eff;
  border: 2px white solid;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(64, 158, 255, 0.5);
}

:deep(.marker-point.start) {
  background: #67c23a;
  width: 16px;
  height: 16px;
}

:deep(.marker-point.end) {
  background: #f56c6c;
  width: 16px;
  height: 16px;
}
</style>
