<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useAlbumStore } from '@/stores/album'
import { usePhotoStore } from '@/stores/photo'
import { ElMessage } from 'element-plus'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { VideoCamera, Timer, Memo, Picture, Close, Van, Ship, User, Right, Promotion, Location, Bicycle } from '@element-plus/icons-vue'
import { useKakaoLoader } from '@/composables/useKakaoLoader'
import { calculateRoute } from '@/utils/routeCalculator'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
}>()

const albumStore = useAlbumStore()
const photoStore = usePhotoStore()

const dialogVisible = ref(false)
const currentStep = ref(0)
const mapContainer = ref<HTMLElement | null>(null)
let map: any = null

// Step 1: 기본 정보
const title = ref('')
const description = ref('')
const styleType = ref<'route_anim' | 'scroll_view' | 'ai_video'>('route_anim')

// Step 4: 스타일 세부 설정 (신규 필드들)
const mapTheme = ref('light')

// Transitions Data (Step 3)
const transitions = ref<{ from: string, to: string, mode: string }[]>([])

const styleOptions = [
  {
    value: 'route_anim',
    label: 'Route Animation',
    description: '지도 위 시간순 카메라 워크'
  },
  {
    value: 'scroll_view',
    label: 'Scroll Narrative',
    description: '블로그 형태 세로 스크롤'
  },
  {
    value: 'ai_video',
    label: 'AI Video',
    description: 'AI로 동영상 생성 (준비 중)'
  }
]


// Step 2: 사진 선택
const selectedPhotoIds = ref<string[]>([])
const filterCategory = ref<string>('all')
const filterOwner = ref<string>('all') // 'all', 'mine', 'friends'
const filterDateRange = ref<[Date, Date] | null>(null)

// Computed property for selection tray
const selectedPhotos = computed(() => {
  return photoStore.photos.filter(p => selectedPhotoIds.value.includes(p.id))
})

// Filtered photos based on user selections
const filteredPhotos = computed(() => {
  // 텍스트 전용 기록(사진 없는 기록)은 무빙 앨범 제작에서 제외
  let result = photoStore.photos.filter(p => !!p.storage_path)

  // Category filter
  if (filterCategory.value !== 'all') {
    result = result.filter(p => p.category_name === filterCategory.value)
  }

  // Owner filter
  if (filterOwner.value === 'mine') {
    // 자신의 사진만 필터링 (photoStore.photos[0] 기반 대신 authStore.user.id 기반 검사가 안전함)
    result = result.filter(p => p.user_id === photoStore.photos.find(p => p.storage_path)?.user_id) 
  } else if (filterOwner.value === 'friends') {
    result = result.filter(p => p.user_id !== photoStore.photos.find(p => p.storage_path)?.user_id)
  }

  // Date range filter
  if (filterDateRange.value) {
    const [start, end] = filterDateRange.value
    const endOfDay = new Date(end)
    endOfDay.setHours(23, 59, 59, 999)

    result = result.filter(photo => {
      const dateStr = photo.taken_at || photo.created_at
      const date = new Date(dateStr)
      return date >= start && date <= endOfDay
    })
  }

  return result
})

// Unique categories for filter
const categories = computed(() => {
  const uniqueCategories = new Set<string>()
  photoStore.photos.forEach(p => {
    if (p.category_name) uniqueCategories.add(p.category_name)
  })
  return Array.from(uniqueCategories)
})

// Step 3: 확인 (자동 시간순 정렬)
const sortedPhotos = computed(() => {
  const selected = photoStore.photos.filter(p => selectedPhotoIds.value.includes(p.id))
  return selected.sort((a, b) => 
    new Date(a.taken_at || a.created_at).getTime() - new Date(b.taken_at || b.created_at).getTime()
  )
})

const timelineItems = computed(() => {
  return sortedPhotos.value.map((photo, index) => {
    // Ensure transition object exists for the gap between this photo and the next
    const transition = index < sortedPhotos.value.length - 1 ? transitions.value[index] : undefined
    return {
      photo,
      index,
      transition
    }
  })
})

// Duration and Location Summary
const travelDuration = computed(() => {
  if (sortedPhotos.value.length < 2) return null
  const first = sortedPhotos.value[0]
  const last = sortedPhotos.value[sortedPhotos.value.length - 1]
  
  if (!first || !last) return null
  
  const start = new Date(first.taken_at || first.created_at)
  const end = new Date(last.taken_at || last.created_at)
  
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays === 0 ? '당일 여행' : `${diffDays}일 동안의 여정`
})

// Address Recovery Logic
const startAddr = ref('시작 지점')
const endAddr = ref('종료 지점')
const { loadKakaoMap } = useKakaoLoader()

const getAddressFromCoords = (lat: number, lng: number): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!(window as any).kakao?.maps?.services) {
      resolve(null)
      return
    }
    const geocoder = new (window as any).kakao.maps.services.Geocoder()
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === (window as any).kakao.maps.services.Status.OK) {
        const addr = result[0].road_address?.address_name || result[0].address?.address_name
        resolve(addr)
      } else {
        resolve(null)
      }
    })
  })
}

watch(sortedPhotos, async (photos) => {
  if (photos && photos.length > 0) {
    await loadKakaoMap()
    
    // Recover addresses for all photos if missing
    const recoveryPromises = photos.map(async (photo) => {
      if (!photo.address?.trim() && photo.latitude && photo.longitude) {
        const recovered = await getAddressFromCoords(photo.latitude, photo.longitude)
        if (recovered) {
          photo.address = recovered
        }
      }
    })
    
    await Promise.all(recoveryPromises)

    const first = photos[0]
    const last = photos[photos.length - 1]
    
    if (first?.address) {
      startAddr.value = first.address
    } else {
      startAddr.value = '시작 지점'
    }

    if (last?.address) {
      endAddr.value = last.address
    } else {
      endAddr.value = '종료 지점'
    }

    // Initialize Transitions
    const newTransitions = []
    for (let i = 0; i < photos.length - 1; i++) {
      const fromId = photos[i]!.id
      const toId = photos[i + 1]!.id
      // Clean up transitions: Find existing or default to 'car'
      const existing = transitions.value.find(t => t.from === fromId && t.to === toId)
      newTransitions.push({
        from: fromId,
        to: toId,
        mode: existing ? existing.mode : 'walk'
      })
    }
    transitions.value = newTransitions
  } else {
    startAddr.value = '시작 지점'
    endAddr.value = '종료 지점'
    transitions.value = []
  }
}, { immediate: true })

// Map & Routing Logic
watch(currentStep, async (newStep) => {
  if (newStep === 2) {
    await nextTick()
    if (mapContainer.value) {
      initPreviewMap()
    }
  }
})

const initPreviewMap = () => {
  if (map) {
    map.remove()
    map = null
  }

  if (!mapContainer.value || sortedPhotos.value.length === 0) return
  
  const firstPhoto = sortedPhotos.value[0]
  if (!firstPhoto) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [firstPhoto.longitude, firstPhoto.latitude],
    zoom: 12
  })

  map.on('load', async () => {
    if (sortedPhotos.value.length >= 2) {
      await drawRoute()
    } else {
      const photo = sortedPhotos.value[0]
      if (photo) {
        new maplibregl.Marker({ color: '#409EFF' })
          .setLngLat([photo.longitude, photo.latitude])
          .addTo(map!)
      }
    }
  })
}

// ...

const drawRoute = async () => {
  if (!map || sortedPhotos.value.length < 2) return

  const points = sortedPhotos.value.map(p => ({ lat: p.latitude, lng: p.longitude }))
  const routeGeometry = await calculateRoute(points)

  if (routeGeometry) {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry
        }
      })

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#409EFF',
          'line-width': 4,
          'line-opacity': 0.8
        }
      })

      // Add Markers
      const bounds = new maplibregl.LngLatBounds()
      
      sortedPhotos.value.forEach((photo, index) => {
        const isStart = index === 0
        const isEnd = index === sortedPhotos.value.length - 1
        
        const el = document.createElement('div')
        el.className = 'map-marker'
        if (isStart) el.classList.add('start')
        if (isEnd) el.classList.add('end')

        new maplibregl.Marker(el)
          .setLngLat([photo.longitude, photo.latitude])
          .addTo(map!)

        bounds.extend([photo.longitude, photo.latitude])
      })

      map.fitBounds(bounds, { padding: 50 })
  } else {
    // Fallback to straight lines if OSRM fails
    drawStraightLines()
  }
}

const drawStraightLines = () => {
  if (!map) return
  const lineCoords = sortedPhotos.value.map(p => [p.longitude, p.latitude])
  
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: lineCoords
      }
    }
  })

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#909399', 'line-width': 3, 'line-dasharray': [2, 2] }
  })
}

onUnmounted(() => {
  if (map) map.remove()
})

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (val) {
    // Reset on open
    currentStep.value = 0
    title.value = ''
    description.value = ''
    styleType.value = 'route_anim'
    selectedPhotoIds.value = []
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const canProceed = computed(() => {
  if (currentStep.value === 0) {
    return title.value.trim().length > 0
  }
  if (currentStep.value === 1) {
    return selectedPhotoIds.value.length > 0
  }
  return true
})

const handleNext = () => {
  // [New] Block unimplemented styles (Step 0)
  if (currentStep.value === 0 && styleType.value !== 'route_anim') {
       ElMessage.info('선택하신 스타일은 현재 준비 중입니다. Route Animation을 이용해주세요.')
       return
  }
  
  if (currentStep.value < 3) {
    currentStep.value++
  }
}

const handlePrev = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const togglePhotoSelection = (photoId: string) => {
  const index = selectedPhotoIds.value.indexOf(photoId)
  if (index > -1) {
    selectedPhotoIds.value.splice(index, 1)
  } else {
    selectedPhotoIds.value.push(photoId)
  }
}

const handleCreate = async () => {
  if (!canProceed.value) return

  try {
    // Save style settings in content_data (simplified for now)
    const extraOptions = {
      mapTheme: mapTheme.value,
    }

    await albumStore.createAlbum(
      title.value.trim(),
      styleType.value,
      sortedPhotos.value.map(p => p.id),
      description.value.trim() || undefined,
      extraOptions, // Pass the style settings to the store
      transitions.value as any // Pass transitions data (cast to any for union type compatibility)
    )
    ElMessage.success('무빙 앨범이 생성되었습니다!')
    dialogVisible.value = false
    emit('created')
  } catch (err) {
    console.error('Album creation error:', err)
    ElMessage.error('앨범 생성에 실패했습니다.')
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="무빙 앨범 만들기"
    width="95%"
    style="max-width: 1000px;"
    align-center
    :close-on-click-modal="false"
    append-to-body
  >
    <el-steps :active="currentStep" finish-status="success" align-center>
      <el-step title="기본 정보" />
      <el-step title="사진 선택" />
      <el-step title="정보 확인" />
      <el-step title="스타일 세부 설정" />
    </el-steps>

    <div class="step-content">
      <!-- Step 1: 기본 정보 -->
      <div v-if="currentStep === 0" class="step-panel">
        <el-form label-position="top">
          <el-form-item label="앨범 제목" required>
            <el-input
              v-model="title"
              placeholder="예: 2025 제주도 여행"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="앨범 설명">
            <el-input
              v-model="description"
              type="textarea"
              :rows="3"
              placeholder="앨범에 대한 간단한 설명 (선택사항)"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="스타일 선택" required>
            <div class="style-grid">
              <el-popover
                v-for="style in styleOptions"
                :key="style.value"
                placement="bottom"
                :title="style.label"
                :width="300"
                trigger="hover"
                popper-class="style-preview-popover"
              >
                <template #reference>
                  <div 
                    class="style-card large"
                    :class="{ selected: styleType === style.value }"
                    @click="styleType = style.value as 'route_anim' | 'scroll_view' | 'ai_video'"
                  >
                    <div class="style-card-icon">
                      <el-icon v-if="style.value === 'route_anim'" :size="40"><Timer /></el-icon>
                      <el-icon v-else-if="style.value === 'scroll_view'" :size="40"><Memo /></el-icon>
                      <el-icon v-else :size="40"><VideoCamera /></el-icon>
                    </div>
                    <div class="style-card-content">
                      <strong>{{ style.label }}</strong>
                      <p>{{ style.description }}</p>
                    </div>
                  </div>
                </template>
                <div class="preview-content">
                  <p v-if="style.value === 'route_anim'">
                    지도 위에서 이동 경로를 따라 카메라가 움직이며 사진을 한 장씩 보여주는 역동적인 스타일입니다. 하이라이트 여행 영상과 같은 느낌을 줍니다.
                  </p>
                  <p v-else-if="style.value === 'scroll_view'">
                    한 편의 블로그 포스팅처럼 거대한 타임라인을 세로로 스크롤하며 추억을 되짚는 서사적인 스타일입니다. 사진의 앞뒤 맥락을 느끼기에 좋습니다.
                  </p>
                  <p v-else>
                    선택한 사진들을 바탕으로 AI가 자동으로 배경음악과 효과를 넣은 멋진 비디오를 생성합니다. (현재 기능 준비 중)
                  </p>
                  <div class="preview-placeholder">
                    <el-icon :size="40"><Picture /></el-icon>
                    <span>미리보기 이미지 준비 중</span>
                  </div>
                </div>
              </el-popover>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 2: 사진 선택 -->
      <div v-if="currentStep === 1" class="step-panel">
        <!-- Filters -->
        <div class="photo-filters">
          <el-select v-model="filterOwner" placeholder="소유자" size="small" style="width: 120px;">
            <el-option label="전체" value="all" />
            <el-option label="내 사진" value="mine" />
            <el-option label="친구 사진" value="friends" />
          </el-select>

          <el-select v-model="filterCategory" placeholder="카테고리" size="small" style="width: 140px;">
            <el-option label="전체 카테고리" value="all" />
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>

          <el-date-picker
            v-model="filterDateRange"
            type="daterange"
            size="small"
            range-separator="~"
            start-placeholder="시작일"
            end-placeholder="종료일"
            style="width: 240px;"
          />
        </div>

        <div class="photo-grid-container">
          <div class="photo-grid large">
            <div
              v-for="photo in filteredPhotos"
              :key="photo.id"
              class="photo-item large"
              :class="{ selected: selectedPhotoIds.includes(photo.id) }"
              @click="togglePhotoSelection(photo.id)"
            >
              <img :src="photo.publicUrl || photo.storage_path" :alt="photo.title || 'Photo'" />
              <div class="check-overlay large">
                <el-icon v-if="selectedPhotoIds.includes(photo.id)" :size="32">
                  <el-icon-check />
                </el-icon>
              </div>
              <div class="photo-overlay-info">
                <span>{{ photo.address?.split(' ').slice(0, 2).join(' ') || '장소 정보 없음' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Selection Tray (신규) -->
        <div v-if="selectedPhotos.length > 0" class="selected-photos-tray">
          <div class="tray-header">
            <span>선택된 사진 ({{ selectedPhotos.length }})</span>
            <el-button link type="primary" size="small" @click="selectedPhotoIds = []">전체 해제</el-button>
          </div>
          <div class="tray-scroll">
            <div 
              v-for="photo in selectedPhotos" 
              :key="photo.id" 
              class="tray-item"
              @click="togglePhotoSelection(photo.id)"
              title="클릭하여 선택 해제"
            >
              <img :src="photo.publicUrl || photo.storage_path" />
              <div class="remove-badge">
                <el-icon :size="10"><Close /></el-icon>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="selection-count">사진을 선택해주세요.</p>
      </div>

      <!-- Step 3: 정보 확인 (기존 Step 3) -->
      <div v-if="currentStep === 2" class="step-panel">
        <div class="route-summary-bar">
          <div class="route-info">
            <div class="route-destinations">
              <span class="dest-label">출발</span>
              <span class="dest-name">{{ startAddr }}</span>
              <el-icon class="arrow-icon"><el-icon-right /></el-icon>
              <span class="dest-label">도착</span>
              <span class="dest-name">{{ endAddr }}</span>
            </div>
            <div class="route-duration" v-if="travelDuration">
              <el-icon><el-icon-timer /></el-icon>
              {{ travelDuration }}
            </div>
          </div>
        </div>

        <div class="map-preview-container large">
          <div ref="mapContainer" class="album-preview-map"></div>
          <div class="map-overlay-title">여정 경로 요약</div>
        </div>

        <div class="summary-details">
          <div class="detail-item">
            <strong>제목</strong>
            <span>{{ title }}</span>
          </div>
          <div class="detail-item">
            <strong>스타일</strong>
            <span>{{ styleOptions.find(o => o.value === styleType)?.label }}</span>
          </div>
        </div>

        <el-divider />

        <div class="photo-timeline">
          <h4>타임라인</h4>
          <div class="timeline-container custom-timeline">
            <div 
              v-for="item in timelineItems" 
              :key="item.photo.id" 
              class="timeline-row"
            >
              <!-- Photo Item -->
              <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content card-style">
                  <img :src="item.photo.publicUrl || item.photo.storage_path" class="timeline-thumbnail" />
                  <div class="timeline-text">
                    <div class="timeline-date">{{ new Date(item.photo.taken_at || item.photo.created_at).toLocaleString() }}</div>
                    <h5 class="timeline-photo-title">{{ item.photo.title || '제목 없음' }}</h5>
                    <div class="timeline-addr">
                      <el-icon><Location /></el-icon>
                      {{ item.photo.address?.trim() || '주소 정보 없음' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Simple Connector Line (restored) -->
              <div v-if="item.transition" class="simple-connector">
                <div class="line"></div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: 스타일 세부 설정 (신규) -->
      <div v-if="currentStep === 3" class="step-panel">
        <div class="style-setup-panel">
          <h3>
            <el-icon style="margin-right: 8px;"><el-icon-setting /></el-icon>
            {{ styleOptions.find(o => o.value === styleType)?.label }} 세부 설정
          </h3>
          <el-form>
            <el-form-item label="지도 테마">
              <el-radio-group v-model="mapTheme">
                <el-radio-button label="light">밝게</el-radio-button>
                <el-radio-button label="dark">어둡게</el-radio-button>
                <el-radio-button label="outdoor">아웃도어</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <!-- Route Animation 설정 (신규) -->
          <div v-if="styleType === 'route_anim'" class="route-anim-settings">
            <el-divider content-position="left">구간별 이동 수단 설정</el-divider>
            <div class="transition-list">
              <template v-for="item in timelineItems" :key="item.photo.id + '_trans'">
                 <div v-if="item.transition" class="transition-setting-row">
                    <div class="route-segment-info">
                      <div class="segment-point-start">
                        <span class="segment-point-badge">{{ item.index + 1 }}</span>
                        <img 
                          :src="item.photo.publicUrl || item.photo.storage_path" 
                          class="segment-thumbnail"
                        />
                        <span class="segment-name">{{ item.photo.title || '사진' }}</span>
                      </div>
                      
                      <el-icon class="segment-arrow"><Right /></el-icon>
                      
                      <div class="segment-point-end">
                        <span class="segment-point-badge">{{ item.index + 2 }}</span>
                        <img 
                          :src="timelineItems[item.index + 1]?.photo.publicUrl || timelineItems[item.index + 1]?.photo.storage_path" 
                          class="segment-thumbnail"
                        />
                        <span class="segment-name">{{ timelineItems[item.index + 1]?.photo.title || '사진' }}</span>
                      </div>
                    </div>
                
                    <el-select 
                      v-model="item.transition.mode" 
                      size="small" 
                      style="width: 140px;"
                      placeholder="이동 수단"
                    >
                       <template #prefix>
                         <el-icon v-if="item.transition.mode === 'walk'"><User /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'car'"><Van /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'bus'"><Van /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'subway'"><Location /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'airplane'"><Promotion /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'ship'"><Ship /></el-icon>
                         <el-icon v-else-if="item.transition.mode === 'bicycle'"><Bicycle /></el-icon>
                      </template>
                      <el-option label="도보" value="walk"><span>🚶 도보</span></el-option>
                      <el-option label="차량" value="car"><span>🚗 차량</span></el-option>
                      <el-option label="버스" value="bus"><span>🚌 버스</span></el-option>
                      <el-option label="지하철/기차" value="subway"><span>🚇 지하철/기차</span></el-option>
                      <el-option label="비행기" value="airplane"><span>✈️ 비행기</span></el-option>
                      <el-option label="배" value="ship"><span>🚢 배</span></el-option>
                      <el-option label="자전거" value="bicycle"><span>🚲 자전거</span></el-option>
                      <el-option label="이동 없음" value="none">이동 없음 (점프)</el-option>
                    </el-select>
                 </div>
              </template>
            </div>
          </div>
          
          <div class="style-preview-tip">
            <el-alert
              title="세부 설정은 앨범 생성 후에도 수정할 수 있습니다."
              type="info"
              show-icon
              :closable="false"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="currentStep > 0" @click="handlePrev">이전</el-button>
        <el-button v-if="currentStep < 3" type="primary" @click="handleNext" :disabled="!canProceed">
          다음
        </el-button>
        <el-button v-if="currentStep === 3" type="primary" @click="handleCreate" :loading="albumStore.loading">
          생성
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { 
  Check as ElIconCheck, 
  Timer as ElIconTimer, 
  Right as ElIconRight, 
  Setting as ElIconSetting, 
  Close as ElIconClose,
  Picture as ElIconPicture,
  Memo as ElIconMemo
} from '@element-plus/icons-vue'

export default {
  components: {
    ElIconCheck,
    ElIconTimer,
    ElIconRight,
    ElIconSetting,
    ElIconClose,
    ElIconPicture,
    ElIconMemo
  }
}
</script>

<style scoped>
.step-content {
  margin: 20px 0;
  min-height: 400px;
}

.step-panel {
  animation: fadeIn 0.3s;
  padding: 10px; /* Added from suggested edit */
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Style Selection Grid */
.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  width: 100%;
}

.style-card.large {
  border: 2px solid #dcdfe6;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #f8f9fa;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
}

.style-card.large:hover {
  border-color: #409EFF;
  transform: translateY(-8px);
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.15);
  background: #fff;
}

.style-card.large.selected {
  border-color: #409EFF;
  background: #ECF5FF;
  color: #409eff;
  box-shadow: 0 8px 16px rgba(64, 158, 255, 0.25);
  transform: translateY(-5px);
}

.style-card-icon {
  margin-bottom: 15px;
  color: #606266;
  transition: color 0.3s;
}

.style-card.selected .style-card-icon {
  color: #409eff;
}

.style-card-content strong {
  display: block;
  margin-bottom: 8px;
  font-size: 18px;
  color: #303133;
}

.style-card-content p {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

/* Style Preview Popover */
.preview-content {
  padding: 10px;
}

/* Custom Timeline & Transition Selector */
.custom-timeline {
  padding: 10px;
  max-width: 600px;
  margin: 0 auto;
}

.timeline-row {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  position: relative;
  padding-bottom: 20px;
}

.timeline-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #409EFF;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #409EFF;
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 2;
}

.timeline-content.card-style {
  margin-left: 50px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  gap: 15px;
  border: 1px solid #e4e7ed;
  width: 100%;
}

.timeline-content .timeline-thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}

.timeline-text {
  flex: 1;
}

.timeline-date {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.timeline-photo-title {
  margin: 0 0 4px;
  font-size: 16px;
  color: #303133;
}

.timeline-addr {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Transition Connector */
.transition-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 20px; /* Aligned with marker center roughly */
  margin-top: -10px;
  position: relative;
  z-index: 1;
  width: 40px; /* limit width to keep selector centered near line? No, selector is wide */
}

/* Re-adjust for better layout */
.timeline-row {
  position: relative;
}

.transition-connector {
  margin-left: 0;
  padding-left: 50px; /* Match content margin */
  margin-bottom: 20px;
  display: flex;
  flex-direction: row; /* Horizontal line with selector in middle */
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.connector-line {
  width: 2px;
  height: 40px;
  background-color: #dcdfe6;
  position: absolute;
  left: 26px; /* Center of marker (20px + 6px) */
  top: -20px;
}

.transition-selector {
  margin-left: 60px; /* Push right to avoid line overlap if needed, or just center it */
  background: #fff;
  padding: 5px;
  border-radius: 20px;
  border: 1px solid #dcdfe6;
  z-index: 2;
}

.transition-selector .el-select {
  --el-input-border-color: transparent;
}


.preview-placeholder {
  height: 150px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 10px;
  border: 1px dashed #dcdfe6;
}

/* Mobile: stack vertically */
@media (max-width: 600px) {
  .style-grid {
    grid-template-columns: 1fr;
  }
  .style-card.large {
    height: 140px;
  }
}

/* Photo Filters */
.photo-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.photo-grid.large {
  display: grid; /* Added */
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 15px;
  max-height: 600px;
  overflow-y: auto; /* Added */
}

.photo-item.large {
  position: relative; /* Added */
  aspect-ratio: 1; /* Added */
  cursor: pointer; /* Added */
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border: 2px solid transparent; /* Added */
  transition: all 0.2s; /* Added */
}

.photo-item.large.selected { /* Added */
  border-color: #409EFF;
}

.photo-item.large:hover {
  transform: translateY(-5px);
}

.photo-item.large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.check-overlay.large {
  position: absolute; /* Added */
  top: 10px; /* Changed from 5px */
  right: 10px; /* Changed from 5px */
  background: rgba(64, 158, 255, 0.9); /* Added */
  border-radius: 50%;
  width: 44px; /* Changed from 30px */
  height: 44px; /* Changed from 30px */
  display: flex; /* Added */
  align-items: center; /* Added */
  justify-content: center; /* Added */
  color: white;
  z-index: 2; /* Added */
}

.photo-overlay-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  padding: 10px;
  color: white;
  font-size: 12px;
  opacity: 0.9;
  z-index: 1; /* Added */
}

.selection-count {
  margin-top: 15px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

/* Selection Tray (신규) */
.selected-photos-tray {
  margin-top: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px 15px;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
  position: sticky;
  bottom: 0px;
  z-index: 100;
}

.tray-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tray-header span {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.tray-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 5px;
  scrollbar-width: thin;
}

.tray-item {
  flex: 0 0 60px;
  height: 60px;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  transition: transform 0.2s;
}

.tray-item:hover {
  transform: scale(1.05);
  border-color: #f56c6c;
}

.tray-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(245, 108, 108, 0.9);
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.tray-item:hover .remove-badge {
  opacity: 1;
}

/* Vertical Timeline in Step 3 */
.timeline-container.vertical {
  max-height: 500px;
  overflow-y: auto;
  padding: 20px 10px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #ebeef5;
}

.timeline-item-content {
  display: flex;
  gap: 15px;
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  transition: transform 0.2s;
}

.timeline-item-content:hover {
  transform: translateX(5px);
  border-color: #409eff;
}

.timeline-thumbnail {
  width: 100px;
  height: 70px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.timeline-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
}

.timeline-photo-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-addr {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-desc {
  font-size: 12px;
  color: #606266;
  margin: 0;
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Style Setup Panel in Step 4 */
.style-setup-panel {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 25px;
}

.style-setup-panel h3 {
  margin-top: 0;
  margin-bottom: 25px;
  display: flex;
  align-items: center;
  color: #303133;
}

.style-preview-tip {
  margin-top: 30px;
}

.map-preview-container.large {
  position: relative; /* Added */
  width: 100%;
  height: 350px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 25px;
  border: 1px solid #ebeef5;
}

.album-preview-map {
  width: 100%;
  height: 100%;
}

.map-overlay-title {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  pointer-events: none;
  border: 1px solid #dcdfe6;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  z-index: 10; /* Added */
}

/* Route Summary Bar */
.route-summary-bar {
  background: #f0f7ff;
  border-radius: 12px;
  padding: 15px 20px;
  margin-bottom: 20px;
  border: 1px solid #d9ecff;
}

.route-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.route-destinations {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.dest-label {
  font-size: 12px;
  color: #909399;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.dest-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.arrow-icon {
  color: #409eff;
  font-size: 18px;
}

.route-duration {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  color: #409eff;
  font-weight: 600;
  padding-left: 20px;
  border-left: 1px solid #dcdfe6;
}

/* Map Markers */
:deep(.map-marker) {
  width: 12px;
  height: 12px;
  background: #409eff;
  border: 2px solid #fff;
  border-radius: 40%;
  box-shadow: 0 0 0 2px #409eff;
}

:deep(.map-marker.start) {
  width: 20px;
  height: 20px;
  background: #67c23a;
  box-shadow: 0 0 0 2px #67c23a;
  z-index: 2;
}

:deep(.map-marker.end) {
  width: 20px;
  height: 20px;
  background: #f56c6c;
  box-shadow: 0 0 0 2px #f56c6c;
  z-index: 2;
}

/* Summary Details */
.summary-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 5px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.detail-item strong {
  width: 60px;
  color: #909399;
  font-size: 13px;
}

.detail-item span {
  color: #303133;
  font-weight: 500;
}

.simple-connector {
  position: relative;
  height: 20px;
  margin-left: 20px; /* Aligned with marker center roughly */
}

.simple-connector .line {
  position: absolute;
  left: 6px; /* Center of marker (20px left + 6px radius) */
  top: -20px; /* Connect from bottom of previous item */
  bottom: 0;
  width: 2px;
  background-color: #dcdfe6;
  height: 40px; /* Stretch to next item */
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Step 4 Route Settings */
.route-anim-settings {
  margin-top: 20px;
  animation: fadeIn 0.3s;
}

.transition-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 5px;
}

.transition-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.route-segment-info {
  display: flex;
  align-items: center;
  gap: 15px; /* Increased gap */
  font-size: 13px;
  color: #606266;
  flex: 1;
  overflow: hidden;
}

.segment-point-start, .segment-point-end {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.segment-thumbnail {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.segment-point-badge {
  background: #909399;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
}

.segment-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.segment-arrow {
  color: #dcdfe6;
}
</style>
