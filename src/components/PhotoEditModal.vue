<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { type Photo } from '@/stores/photo'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Search, Location, Edit, Calendar, ChatLineRound } from '@element-plus/icons-vue'
import { supabase } from '@/lib/supabase'
import { useKakaoLoader } from '@/composables/useKakaoLoader'

const props = defineProps<{
  modelValue: boolean
  photo: Photo | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'refresh'): void // Signal to refresh list
}>()

const { loadDaumPostcode, loadKakaoMap } = useKakaoLoader()

const localPhoto = ref<Partial<Photo>>({})
const loading = ref(false)

// Location State
const showLocationHelper = ref(false)
const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = ref<any>(null)
const mapMarker = ref<any>(null)
const tempLocation = ref<{ lat: number, lng: number, address: string } | null>(null)

// Postcode Overlay State
const showPostcodeOverlay = ref(false)
const postcodeEmbedContainer = ref<HTMLElement | null>(null)

// Watch for photo prop change to initialize data
watch(() => props.photo, async (newPhoto) => {
    if (newPhoto) {
        localPhoto.value = { ...newPhoto }
        
        // If address is missing but we have coordinates, try to recover it
        if (!localPhoto.value.address && localPhoto.value.latitude && localPhoto.value.longitude) {
            localPhoto.value.address = '주소 불러오는 중...' // Temporary feedback
            
            // Ensure SDK is loaded
            await loadKakaoMap()
            
            const recoveredAddr = await getAddressFromCoords(localPhoto.value.latitude, localPhoto.value.longitude)
            if (recoveredAddr) {
                localPhoto.value.address = recoveredAddr
            } else {
                 localPhoto.value.address = '주소 정보 없음'
            }
        }
    } else {
        localPhoto.value = {}
    }
}, { immediate: true })

const handleClose = () => {
    emit('update:modelValue', false)
}

const handleSave = async () => {
    if (!props.photo) return

    loading.value = true
    try {
        // Update Photo Details
        const { error: updateError } = await supabase
            .from('photos')
            .update({
                title: localPhoto.value.title,
                description: localPhoto.value.description,
                taken_at: localPhoto.value.taken_at,
                address: localPhoto.value.address,
                latitude: localPhoto.value.latitude,
                longitude: localPhoto.value.longitude
            })
            .eq('id', props.photo.id)
        
        if (updateError) throw updateError

        ElMessage.success('저장되었습니다.')
        emit('refresh')
        handleClose()
    } catch (e) {
        console.error(e)
        ElMessage.error('저장 중 오류가 발생했습니다.')
    } finally {
        loading.value = false
    }
}

const handleDelete = async () => {
    if (!props.photo) return
    try {
        await ElMessageBox.confirm('정말 이 사진을 삭제하시겠습니까?', '경고', {
            type: 'warning',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        })
        
        // Delete from Storage
        if (props.photo.storage_path) {
            await supabase.storage.from('photos').remove([props.photo.storage_path])
        }

        // Delete from DB
        const { error } = await supabase.from('photos').delete().eq('id', props.photo.id)
        if (error) throw error

        ElMessage.success('삭제되었습니다.')
        emit('refresh')
        handleClose()
    } catch (e) {
        // Cancelled or error
    }
}

// --- Location Logic (Ported from PhotoUploadModal) ---

const getAddressFromCoords = (lat: number, lng: number): Promise<string | null> => {
    return new Promise((resolve) => {
        if (!window.kakao?.maps?.services) {
            resolve(null)
            return
        }
        const geocoder = new window.kakao.maps.services.Geocoder()
        geocoder.coord2Address(lng, lat, (result: any, status: any) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const addr = result[0].road_address?.address_name || result[0].address?.address_name
                resolve(addr)
            } else {
                resolve(null)
            }
        })
    })
}

const openLocationHelper = () => {
    showLocationHelper.value = true
    showPostcodeOverlay.value = false
    nextTick(async () => {
        await loadKakaoMap()
        await loadDaumPostcode()
        initMap()
    })
}

const initMap = async () => {
    if (!mapContainer.value || !window.kakao?.maps) return

    // Use current photo location or default (Seoul)
    const initialLat = localPhoto.value.latitude || 37.5665
    const initialLng = localPhoto.value.longitude || 126.9780

    const options = {
        center: new window.kakao.maps.LatLng(initialLat, initialLng),
        level: 3
    }

    if (!mapInstance.value) {
        mapInstance.value = new window.kakao.maps.Map(mapContainer.value, options)
        
        mapMarker.value = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(initialLat, initialLng)
        })
        mapMarker.value.setMap(mapInstance.value)

        window.kakao.maps.event.addListener(mapInstance.value, 'click', function(mouseEvent: any) {
            const latlng = mouseEvent.latLng
            updateTempLocation(latlng.getLat(), latlng.getLng())
        })
    } else {
        mapInstance.value.relayout()
        mapInstance.value.setCenter(new window.kakao.maps.LatLng(initialLat, initialLng))
        mapMarker.value.setPosition(new window.kakao.maps.LatLng(initialLat, initialLng))
    }

    // Init temp location state
    // Don't overwrite address if we just opened the map, unless we dragged/clicked.
    // But for consistency with upload modal, we set tempLocation.
    const addr = localPhoto.value.address || await getAddressFromCoords(initialLat, initialLng)
    tempLocation.value = { lat: initialLat, lng: initialLng, address: addr || '주소 정보 없음' }
}

const updateTempLocation = async (lat: number, lng: number) => {
    mapMarker.value.setPosition(new window.kakao.maps.LatLng(lat, lng))
    mapInstance.value.panTo(new window.kakao.maps.LatLng(lat, lng))
    
    const addr = await getAddressFromCoords(lat, lng)
    tempLocation.value = { lat, lng, address: addr || '주소 정보 없음' }
}

const togglePostcodeSearch = () => {
    showPostcodeOverlay.value = !showPostcodeOverlay.value
    if (showPostcodeOverlay.value) {
        nextTick(() => {
            initPostcode()
        })
    }
}

const initPostcode = () => {
    if (!postcodeEmbedContainer.value || !window.daum?.Postcode) return
    
    new window.daum.Postcode({
        oncomplete: function(data: any) {
             const fullAddress = data.address
             handleAddressSelection(fullAddress)
        },
        width: '100%',
        height: '100%'
    }).embed(postcodeEmbedContainer.value)
}

const handleAddressSelection = (addr: string) => {
    if (!window.kakao?.maps?.services) return
    const geocoder = new window.kakao.maps.services.Geocoder()
    
    geocoder.addressSearch(addr, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
            const lat = parseFloat(result[0].y)
            const lng = parseFloat(result[0].x)
            
            showPostcodeOverlay.value = false
            updateTempLocation(lat, lng)
        }
    })
}

const confirmLocation = () => {
    if (tempLocation.value) {
        localPhoto.value.latitude = tempLocation.value.lat
        localPhoto.value.longitude = tempLocation.value.lng
        localPhoto.value.address = tempLocation.value.address
    }
    showLocationHelper.value = false
}

</script>

<template>
    <el-dialog
        :model-value="modelValue"
        title="사진 정보 편집"
        width="90%"
        max-width="500px"
        @close="handleClose"
        append-to-body
        align-center
    >
        <div v-if="localPhoto" class="edit-form">
            <!-- Image Preview -->
            <div v-if="localPhoto.publicUrl" class="image-preview" :style="{ backgroundImage: `url(${localPhoto.publicUrl})` }"></div>
            <div v-else class="image-preview text-record-placeholder">
                <el-icon :size="48"><ChatLineRound /></el-icon>
                <span>텍스트 전용 기록</span>
            </div>

            <el-form label-position="top">
                <!-- 1. Title -->
                <el-form-item label="제목">
                    <el-input v-model="localPhoto.title" placeholder="제목을 입력하세요" :prefix-icon="Edit" />
                </el-form-item>

                <!-- 2. Description (Moved up) -->
                <el-form-item label="설명">
                    <el-input 
                        v-model="localPhoto.description" 
                        type="textarea" 
                        :rows="3" 
                        placeholder="설명을 입력하세요" 
                        :prefix-icon="Edit"
                    />
                </el-form-item>

                <!-- 3. Taken Date -->
                <el-form-item label="촬영 날짜">
                    <el-date-picker
                        v-model="localPhoto.taken_at"
                        type="datetime"
                        placeholder="날짜 선택"
                        style="width: 100%"
                        format="YYYY-MM-DD HH:mm"
                        :prefix-icon="Calendar"
                    />
                </el-form-item>

                <!-- 4. Location (Map Integration) -->
                <el-form-item label="위치">
                    <div class="location-display">
                         <div class="location-text-group">
                             <el-icon><Location /></el-icon>
                             <span class="location-text">
                                 {{ localPhoto.address || '위치 정보 없음' }}
                             </span>
                         </div>
                         <el-button size="small" type="primary" plain @click="openLocationHelper">
                            {{ localPhoto.address ? '위치 수정' : '위치 설정' }}
                         </el-button>
                    </div>
                </el-form-item>

            </el-form>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button type="danger" :icon="Delete" @click="handleDelete" plain>삭제</el-button>
                <div class="right-actions">
                    <el-button @click="handleClose">취소</el-button>
                    <el-button type="primary" @click="handleSave" :loading="loading">저장</el-button>
                </div>
            </div>
        </template>
    </el-dialog>

    <!-- Location Helper Modal -->
    <el-dialog
        v-model="showLocationHelper"
        title="위치 설정"
        width="90%"
        style="max-width: 500px"
        append-to-body
        align-center
    >
        <div class="helper-header">
            <el-button type="primary" :icon="Search" @click="togglePostcodeSearch" class="search-toggle-btn">
                {{ showPostcodeOverlay ? '지도로 돌아가기' : '주소 검색' }}
            </el-button>
            <p v-if="!showPostcodeOverlay && tempLocation" class="current-selected-addr">
                <el-icon><Location /></el-icon> {{ tempLocation.address || '지도에서 위치를 선택하세요' }}
            </p>
        </div>

        <div class="map-wrapper">
            <div ref="mapContainer" class="map-picker-container"></div>
            <div v-show="showPostcodeOverlay" class="postcode-overlay">
                 <div ref="postcodeEmbedContainer" style="width: 100%; height: 100%;"></div>
            </div>
        </div>

        <div class="map-picker-footer">
            <el-button @click="showLocationHelper = false">취소</el-button>
            <el-button type="primary" @click="confirmLocation" :disabled="!tempLocation">이 위치로 설정</el-button>
        </div>
    </el-dialog>
</template>

<style scoped>
.edit-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}
.image-preview {
    width: 100%;
    height: 200px;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
}
.text-record-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #909399;
    gap: 12px;
}
.text-record-placeholder span {
    font-size: 14px;
    font-weight: bold;
}
.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.right-actions {
    display: flex;
    gap: 10px;
}
.location-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f5f7fa;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #dcdfe6;
    width: 100%;
    box-sizing: border-box;
}
.location-text-group {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #606266;
    overflow: hidden;
    flex: 1;
}
.location-text {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Map Modal Styles */
.helper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 10px;
}
.current-selected-addr {
    margin: 0;
    font-size: 0.9rem;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: right;
}
.map-wrapper {
    position: relative;
    width: 100%;
    height: 400px;
    background-color: #eee;
    margin-bottom: 10px;
    border-radius: 4px;
    overflow: hidden;
}
.map-picker-container {
    width: 100%;
    height: 100%;
}
.postcode-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    z-index: 10;
}
.map-picker-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>
