<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import exifr from 'exifr'
import { useKakaoLoader } from '@/composables/useKakaoLoader'
import { Plus, Calendar, Edit, Location, MapLocation, Search } from '@element-plus/icons-vue'

const props = defineProps<{
    modelValue: boolean
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'upload-success', payload: { lat: number, lng: number }): void
}>()

const authStore = useAuthStore()
const { loadDaumPostcode, loadKakaoMap } = useKakaoLoader()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const takenAt = ref<Date | null>(null)
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)
const address = ref<string>('')
const title = ref<string>('')
const description = ref<string>('')
const isUploading = ref(false)

// Unified Location Helper State
const showLocationHelper = ref(false)
const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = ref<any>(null)
const mapMarker = ref<any>(null)
const tempLocation = ref<{ lat: number, lng: number, address: string } | null>(null)

// Postcode Overlay State
const showPostcodeOverlay = ref(false)
const postcodeEmbedContainer = ref<HTMLElement | null>(null)

// Watch visibility to clear state if needed
watch(() => props.modelValue, (val) => {
    if (!val) {
        resetForm()
    }
})

const handleClose = () => {
    emit('update:modelValue', false)
}

const triggerFileInput = () => {
    fileInput.value?.click()
}

const resetForm = () => {
    selectedFile.value = null
    previewUrl.value = null
    takenAt.value = null
    latitude.value = null
    longitude.value = null
    address.value = ''
    title.value = ''
    description.value = ''
    if (fileInput.value) fileInput.value.value = ''
}

const isDragging = ref(false)

const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = false
}

const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = false
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) {
            await processFile(file)
        } else {
            ElMessage.warning('이미지 파일만 업로드 가능합니다.')
        }
    }
}

const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
        const file = target.files[0]
        if (file) await processFile(file)
    }
}

const processFile = async (file: File) => {
    if (!file) return
    
    resetForm() // Reset previous data
    selectedFile.value = file
    previewUrl.value = URL.createObjectURL(file)
    
    // Set title from filename (remove extension)
    const lastDotIndex = file.name.lastIndexOf('.')
    if (lastDotIndex > 0) {
        title.value = file.name.substring(0, lastDotIndex)
    } else {
        title.value = file.name
    }

    try {
        // Parse EXIF
        const data = await exifr.parse(file, { gps: true, tiff: true })
        if (data) {
            if (data.latitude && data.longitude) {
                // Strict Address Check
                const addr = await getAddressFromCoords(data.latitude, data.longitude)
                if (addr) {
                    latitude.value = data.latitude
                    longitude.value = data.longitude
                    address.value = addr
                } else {
                    ElMessage.warning('위치 정보에 해당하는 주소를 찾을 수 없어 위치 정보를 불러오지 않았습니다.')
                }
            }
            if (data.DateTimeOriginal) {
                takenAt.value = data.DateTimeOriginal
            } else if (data.CreateDate) {
                takenAt.value = data.CreateDate
            } else {
                    takenAt.value = new Date() 
            }
        } else {
            takenAt.value = new Date()
        }
    } catch (e) {
        console.error('EXIF parsing error', e)
        takenAt.value = new Date()
    }
}

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

// Unified Helper Logic
const openLocationHelper = () => {
    showLocationHelper.value = true
    showPostcodeOverlay.value = false // Start with map
    nextTick(async () => {
        await loadKakaoMap()
        await loadDaumPostcode() // Preload both
        initMap()
    })
}

const initMap = async () => {
    if (!mapContainer.value || !window.kakao?.maps) return

    const initialLat = latitude.value || 37.5665
    const initialLng = longitude.value || 126.9780

    const options = {
        center: new window.kakao.maps.LatLng(initialLat, initialLng),
        level: 3
    }

    // Create map
    if (!mapInstance.value) {
        mapInstance.value = new window.kakao.maps.Map(mapContainer.value, options)
        
        // Marker
        mapMarker.value = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(initialLat, initialLng)
        })
        mapMarker.value.setMap(mapInstance.value)

        // Click event
        window.kakao.maps.event.addListener(mapInstance.value, 'click', function(mouseEvent: any) {
            const latlng = mouseEvent.latLng
            updateTempLocation(latlng.getLat(), latlng.getLng())
        })
    } else {
        // Resize and relayout if re-opening
        mapInstance.value.relayout()
        mapInstance.value.setCenter(new window.kakao.maps.LatLng(initialLat, initialLng))
        mapMarker.value.setPosition(new window.kakao.maps.LatLng(initialLat, initialLng))
    }

    // Init temp location
    const addr = await getAddressFromCoords(initialLat, initialLng)
    tempLocation.value = { lat: initialLat, lng: initialLng, address: addr || '주소 정보 없음' }
}

const updateTempLocation = async (lat: number, lng: number) => {
    mapMarker.value.setPosition(new window.kakao.maps.LatLng(lat, lng))
    mapInstance.value.panTo(new window.kakao.maps.LatLng(lat, lng))
    
    const addr = await getAddressFromCoords(lat, lng)
    tempLocation.value = { lat, lng, address: addr || '주소 정보 없음' }
}

// Postcode Overlay Logic
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
            
            // Close overlay and update map
            showPostcodeOverlay.value = false
            updateTempLocation(lat, lng)
        }
    })
}

const confirmLocation = () => {
    if (tempLocation.value) {
        latitude.value = tempLocation.value.lat
        longitude.value = tempLocation.value.lng
        address.value = tempLocation.value.address
    }
    showLocationHelper.value = false
}

const registerPhoto = async () => {
    if (!latitude.value || !longitude.value || !authStore.user) {
        ElMessage.warning('위치 정보는 필수입니다.')
        return
    }

    // 사진이 없고 제목도 없는 경우 최소한의 제목 생성
    if (!selectedFile.value && !title.value.trim()) {
        title.value = '새로운 기록'
    }

    isUploading.value = true
    try {
        let fileName = null

        // 1. Upload to Storage (Only if file selected)
        if (selectedFile.value) {
            const fileExt = selectedFile.value.name.split('.').pop()
            fileName = `${authStore.user.id}/${Date.now()}.${fileExt}`
            
            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(fileName, selectedFile.value)

            if (uploadError) throw uploadError
        }

        // 2. Insert to DB
        const { error: dbError } = await supabase
            .from('photos')
            .insert({
                user_id: authStore.user.id,
                storage_path: fileName,
                latitude: latitude.value,
                longitude: longitude.value,
                taken_at: takenAt.value || new Date(),
                description: description.value,
                title: title.value,
                address: address.value,
                created_at: new Date()
            })

        if (dbError) throw dbError

        ElMessage.success('사진이 등록되었습니다.')
        
        // Emit success with coordinates for auto-pan
        emit('upload-success', { lat: latitude.value, lng: longitude.value })
        
        // Close modal and reset
        emit('update:modelValue', false)
        resetForm()

    } catch (e: any) {
        console.error('Upload Error', e)
        ElMessage.error('업로드 중 오류가 발생했습니다: ' + e.message)
    } finally {
        isUploading.value = false
    }
}
</script>

<template>
  <el-dialog 
    :model-value="modelValue" 
    @update:model-value="emit('update:modelValue', $event)"
    title="사진 업로드" 
    width="90%" 
    style="max-width: 500px"
    @close="handleClose"
    append-to-body
  >
    <div class="upload-content">
        <div 
            class="upload-area" 
            :class="{ dragging: isDragging }"
            @click="triggerFileInput" 
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
            v-if="!previewUrl"
        >
            <el-icon class="upload-icon"><Plus /></el-icon>
            <p>클릭 또는 드래그하여 사진 선택</p>
            <input 
                type="file" 
                ref="fileInput" 
                @change="handleFileChange" 
                accept="image/*" 
                style="display: none"
            >
        </div>

        <div v-else class="preview-area">
            <img :src="previewUrl" class="preview-image" />
            <el-button @click="triggerFileInput" size="small" class="reselect-btn">다시 선택</el-button>
            <input 
                type="file" 
                ref="fileInput" 
                @change="handleFileChange" 
                accept="image/*" 
                style="display: none"
            >
        </div>

        <div class="form-area">
            <!-- Title -->
             <div class="form-item">
                <label><el-icon><Edit /></el-icon> 제목</label>
                <el-input 
                    v-model="title" 
                    placeholder="기록의 이름을 입력하세요" 
                    clearable 
                />
            </div>

            <!-- Description -->
            <div class="form-item">
                <label><el-icon><Edit /></el-icon> 내용 / 설명</label>
                <el-input 
                    v-model="description" 
                    type="textarea" 
                    :rows="2" 
                    placeholder="내용을 남겨주세요" 
                />
            </div>

            <div class="form-item">
                <label><el-icon><Calendar /></el-icon> 일시</label>
                <el-date-picker
                    v-model="takenAt"
                    type="datetime"
                    placeholder="날짜 선택"
                    format="YYYY-MM-DD HH:mm"
                    style="width: 100%"
                />
            </div>

            <div class="form-item">
                <label><el-icon><MapLocation /></el-icon> 위치</label>
                <div v-if="latitude && longitude" class="location-info">
                    <p class="address">{{ address || '주소 정보를 불러오는 중..' }}</p>
                    <div class="location-btns">
                        <el-button size="small" type="primary" plain @click="openLocationHelper">위치 수정</el-button>
                    </div>
                </div>
                <div v-else class="location-empty">
                    <p>위치 정보가 없습니다.</p>
                    <div class="location-btns-center">
                        <el-button type="primary" plain @click="openLocationHelper"><el-icon><Location /></el-icon> 위치 설정하기</el-button>
                    </div>
                </div>
            </div>

            <div class="actions">
                <el-button type="primary" size="large" @click="registerPhoto" :loading="isUploading" class="submit-btn">
                    기록 등록하기
                </el-button>
            </div>
        </div>
    </div>

    <!-- Unified Location Helper Modal -->
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
            <!-- Map Container -->
            <div ref="mapContainer" class="map-picker-container"></div>
            
            <!-- Postcode Overlay -->
            <div v-show="showPostcodeOverlay" class="postcode-overlay">
                 <div ref="postcodeEmbedContainer" style="width: 100%; height: 100%;"></div>
            </div>
        </div>

        <div class="map-picker-footer">
            <el-button @click="showLocationHelper = false">취소</el-button>
            <el-button type="primary" @click="confirmLocation" :disabled="!tempLocation">이 위치로 설정</el-button>
        </div>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
.upload-content {
    padding: 10px 0;
}
.upload-area {
    border: 2px dashed #dcdfe6;
    border-radius: 8px;
    height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.3s;
    background-color: #f5f7fa;
}
.upload-area:hover {
    border-color: #409eff;
}
.upload-area.dragging {
    border-color: #409eff;
    background-color: #ecf5ff;
    transform: scale(1.02);
}
.upload-icon {
    font-size: 40px;
    color: #909399;
    margin-bottom: 10px;
}
.preview-area {
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.preview-image {
    width: 100%;
    display: block;
    max-height: 400px;
    object-fit: contain;
    background: #000;
}
.reselect-btn {
    position: absolute;
    top: 10px;
    right: 10px;
}
.form-area {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 20px;
}
.form-item label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: bold;
    margin-bottom: 8px;
    color: #303133;
}
.location-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f0f2f5;
    padding: 10px;
    border-radius: 4px;
}
.address {
    margin: 0;
    font-size: 0.9rem;
    color: #606266;
    word-break: break-all;
    margin-right: 10px;
    flex: 1;
}
.location-btns {
    display: flex;
    gap: 5px;
}
.location-empty {
    text-align: center;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 4px;
}
.location-btns-center {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    gap: 10px;
}
.submit-btn {
    width: 100%;
    font-weight: bold;
}
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
