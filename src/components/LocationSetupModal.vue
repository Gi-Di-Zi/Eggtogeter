<template>
  <el-dialog
    v-model="dialogVisible"
    title="기준 위치 설정"
    :close-on-click-modal="allowSkip"
    :close-on-press-escape="allowSkip"
    :show-close="allowSkip"
    width="90%"
    style="max-width: 500px;"
    class="location-setup-modal"
    @close="handleClose"
  >
    <div class="setup-container">
      <template v-if="!selectedAddress">
        <template v-if="!isSearching">
          <p class="description">
            서비스 이용을 위해 기준 위치(집)를 설정해주세요.<br>
            지도 시작 위치로 사용됩니다.
          </p>

          <div class="action-area">
            <el-button type="primary" size="large" @click="startSearch" :loading="loading">
              주소 검색하기
            </el-button>
          </div>
          
          <div v-if="allowSkip" class="skip-area">
            <el-button link @click="skipSetup">
              다음에 하기
            </el-button>
          </div>
        </template>
        
        <!-- Embedded Postcode Layer -->
        <div v-show="isSearching" class="postcode-wrapper">
          <div ref="postcodeContainer" class="postcode-layer"></div>
          <div class="cancel-search">
            <el-button @click="cancelSearch">취소</el-button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="confirmation-area">
          <p class="section-title">선택된 주소:</p>
          <p class="address-text">{{ selectedAddress }}</p>
          
          <div class="map-preview" id="preview-map"></div>

          <p class="question">이 위치로 설정하시겠습니까?</p>
          
          <div class="button-group">
            <el-button @click="resetSelection">다시 검색</el-button>
            <el-button type="primary" @click="confirmLocation" :loading="loading">
              확인
            </el-button>
          </div>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useKakaoLoader } from '@/composables/useKakaoLoader'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  allowSkip?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'skip'): void
  (e: 'success'): void
}>()

const loading = ref(false)
const isSearching = ref(false)
const selectedAddress = ref<string | null>(null)
const selectedCoords = ref<{lat: number, lng: number} | null>(null)
const postcodeContainer = ref<HTMLElement | null>(null)

const { loadKakaoMap, loadDaumPostcode } = useKakaoLoader()
const authStore = useAuthStore()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

onMounted(async () => {
    try {
        await Promise.all([loadKakaoMap(), loadDaumPostcode()])
    } catch (e) {
        console.error('Failed to load Kakao scripts', e)
        ElMessage.error('지도 모듈을 불러오는데 실패했습니다.')
    }
})

// Watch for visibility change to reset state if needed
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Reset state on open
    isSearching.value = false
    selectedAddress.value = null
    selectedCoords.value = null
  }
})

const handleClose = () => {
  emit('update:modelValue', false)
}

const skipSetup = () => {
  emit('skip')
  handleClose()
}

const startSearch = async () => {
  isSearching.value = true
  await nextTick()
  initPostcode()
}

const cancelSearch = () => {
  isSearching.value = false
}

const initPostcode = () => {
    if (!postcodeContainer.value || !window.daum?.Postcode) return

    new window.daum.Postcode({
        oncomplete: function(data: any) {
            handleAddressSelection(data.address)
        },
        onresize: function(size: any) {
            if (postcodeContainer.value) {
                postcodeContainer.value.style.height = size.height + 'px';
            }
        },
        width: '100%',
        height: '100%'
    }).embed(postcodeContainer.value)
}

const handleAddressSelection = (fullAddress: string) => {
     try {
        if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
            throw new Error('지도 서비스가 로드되지 않았습니다.')
        }

        const geocoder = new window.kakao.maps.services.Geocoder()
        geocoder.addressSearch(fullAddress, async (result: any, status: any) => {
            try {
                if (status === window.kakao.maps.services.Status.OK) {
                    selectedAddress.value = fullAddress
                    selectedCoords.value = {
                        lat: parseFloat(result[0].y),
                        lng: parseFloat(result[0].x)
                    }
                    
                    // Hide search, show confirmation
                    isSearching.value = false
                    await nextTick()
                    showPreviewMap()
                } else {
                    console.warn('Geocoding failed Status:', status)
                    ElMessage.error('주소 좌표 변환에 실패했습니다. (API 설정 확인 필요)')
                    isSearching.value = false // Go back to start
                }
            } catch (innerError: any) {
                console.error('Inner Geocode Error:', innerError)
                ElMessage.error('좌표 처리 중 오류가 발생했습니다.')
            }
        })
    } catch (err: any) {
        console.error('Postcode Error:', err)
        ElMessage.error('주소 선택 후 처리 중 오류: ' + err.message)
    }
}

const showPreviewMap = () => {
    if (!selectedCoords.value) return
    const container = document.getElementById('preview-map')
    if (!container) return

    const options = {
        center: new window.kakao.maps.LatLng(selectedCoords.value.lat, selectedCoords.value.lng),
        level: 3
    }
    const map = new window.kakao.maps.Map(container, options)
    
    // Add marker
    const markerPosition  = new window.kakao.maps.LatLng(selectedCoords.value.lat, selectedCoords.value.lng); 
    const marker = new window.kakao.maps.Marker({
        position: markerPosition
    });
    marker.setMap(map);
}

const resetSelection = () => {
    selectedAddress.value = null
    selectedCoords.value = null
    startSearch()
}

const confirmLocation = async () => {
    if (!authStore.user || !selectedAddress.value || !selectedCoords.value) return
    
    loading.value = true
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                address: selectedAddress.value,
                latitude: selectedCoords.value.lat,
                longitude: selectedCoords.value.lng
            })
            .eq('id', authStore.user.id)
        
        if (error) throw error
        
        ElMessage.success('기준 위치가 설정되었습니다.')
        await authStore.fetchProfile(authStore.user.id)
        emit('success')
        handleClose()
    } catch (error: any) {
        ElMessage.error('프로필 저장 중 오류가 발생했습니다: ' + error.message)
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.setup-container {
    text-align: center;
    padding: 10px 0;
}
.description {
    margin-bottom: 24px;
    line-height: 1.5;
    color: #606266;
}
.action-area {
  margin-bottom: 16px;
}
.skip-area {
  margin-top: 10px;
}
.address-text {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 10px 0 20px;
    color: #303133;
}
.section-title {
    color: #909399;
    font-size: 0.9rem;
}
.map-preview {
    width: 100%;
    height: 200px;
    margin: 0 auto 20px;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
}
.question {
    margin-bottom: 20px;
    color: #606266;
}
.button-group {
    display: flex;
    justify-content: center;
    gap: 12px;
}

/* Postcode Embedded Layer */
.postcode-wrapper {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}
.postcode-layer {
  width: 100%;
  min-height: 400px; /* Default height */
}
.cancel-search {
  margin-top: 10px;
}
</style>
