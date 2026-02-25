<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import exifr from 'exifr'

import { Plus, Calendar, Edit, Location, MapLocation } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import PhotoLocationPicker from '@/components/PhotoLocationPicker.vue'
import { isPlusCodeAddress, pickBestFormattedAddress, sanitizeAddress } from '@/utils/addressUtils'

const { t } = useI18n()

const props = defineProps<{
    modelValue: boolean
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'upload-success', payload: { lat: number, lng: number }): void
}>()

const authStore = useAuthStore()


const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const takenAt = ref<Date | null>(null)
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)
const address = ref<string>('')
const title = ref<string>('')
const description = ref<string>('')
const visibility = ref<'private' | 'friends' | 'specific'>('private')
const isUploading = ref(false)

// Unified Location Helper State
// Unified Location Helper State
const showLocationHelper = ref(false)


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
    visibility.value = 'private'
    if (fileInput.value) fileInput.value.value = ''
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
            ElMessage.warning(t('upload.warn_image_only'))
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
                    ElMessage.warning(t('upload.warn_no_address'))
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
        if (!window.google?.maps?.Geocoder) {
            resolve(null)
            return
        }
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results.length > 0) {
                const best = pickBestFormattedAddress(results)
                resolve(best && !isPlusCodeAddress(best) ? best : null)
            } else {
                resolve(null)
            }
        })
    })
}

// Unified Helper Logic
const openLocationHelper = () => {
    showLocationHelper.value = true
}

const handleLocationConfirm = (payload: { lat: number, lng: number, address: string }) => {
    latitude.value = payload.lat
    longitude.value = payload.lng
    address.value = sanitizeAddress(payload.address) || ''
    showLocationHelper.value = false
}

const getDisplayAddress = (value?: string | null) => {
    return sanitizeAddress(value) || t('upload.loading_address')
}

const registerPhoto = async () => {
    if (!latitude.value || !longitude.value || !authStore.user) {
        ElMessage.warning(t('upload.warn_location_required'))
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
                visibility: visibility.value,
                created_at: new Date()
            })

        if (dbError) throw dbError

        ElMessage.success(t('upload.success'))
        
        // Emit success with coordinates for auto-pan
        emit('upload-success', { lat: latitude.value, lng: longitude.value })
        
        // Close modal and reset
        emit('update:modelValue', false)
        resetForm()

    } catch (e: any) {
        console.error('Upload Error', e)
        ElMessage.error(t('upload.error') + e.message)
    } finally {
        isUploading.value = false
    }
}
</script>

<template>
  <el-dialog 
    :model-value="modelValue" 
    @update:model-value="emit('update:modelValue', $event)"
    :title="$t('upload.title')" 
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
            <p>{{ $t('upload.drag_text') }}</p>
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
            <el-button @click="triggerFileInput" size="small" class="reselect-btn">{{ $t('upload.reselect') }}</el-button>
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
                <label><el-icon><Edit /></el-icon> {{ $t('upload.label_title') }}</label>
                <el-input 
                    v-model="title" 
                    :placeholder="$t('upload.ph_title')" 
                    clearable 
                />
            </div>

            <!-- Description -->
            <div class="form-item">
                <label><el-icon><Edit /></el-icon> {{ $t('upload.label_desc') }}</label>
                <el-input 
                    v-model="description" 
                    type="textarea" 
                    :rows="2" 
                    :placeholder="$t('upload.ph_desc')" 
                />
            </div>
            

            <div class="form-item">
                <label><el-icon><Calendar /></el-icon> {{ $t('upload.label_date') }}</label>
                <el-date-picker
                    v-model="takenAt"
                    type="datetime"
                    :placeholder="$t('upload.ph_date')"
                    format="YYYY-MM-DD HH:mm"
                    style="width: 100%"
                />
            </div>

            <div class="form-item">
                <label><el-icon><MapLocation /></el-icon> {{ $t('upload.label_location') }}</label>
                <div v-if="latitude && longitude" class="location-info">
                    <p class="address">{{ getDisplayAddress(address) }}</p>
                    <div class="location-btns">
                        <el-button size="small" type="primary" plain @click="openLocationHelper">{{ $t('upload.edit_location') }}</el-button>
                    </div>
                </div>
                <div v-else class="location-empty">
                    <p>{{ $t('upload.no_location') }}</p>
                    <div class="location-btns-center">
                        <el-button type="primary" plain @click="openLocationHelper"><el-icon><Location /></el-icon> {{ $t('upload.set_location') }}</el-button>
                    </div>
                </div>
            </div>

            <div class="actions">
                <el-button type="primary" size="large" @click="registerPhoto" :loading="isUploading" class="submit-btn">
                    {{ $t('upload.submit') }}
                </el-button>
            </div>
        </div>
    </div>

    <!-- Unified Location Helper Modal -->
    <PhotoLocationPicker
        v-model="showLocationHelper"
        :initial-lat="latitude"
        :initial-lng="longitude"
        :initial-address="address"
        @confirm="handleLocationConfirm"
    />
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
.visibility-group {
    width: 100%;
}
.visibility-group :deep(.el-radio-button) {
    flex: 1;
}
.visibility-group :deep(.el-radio-button__inner) {
    width: 100%;
}
.visibility-hint {
    margin: 8px 0 0;
    font-size: 0.85rem;
    color: #909399;
    line-height: 1.4;
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
    background: rgba(255, 255, 255, 0.95);
    z-index: 10;
    padding: 20px;
    box-sizing: border-box; /* Fix width overflow */
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

/* Enhanced Autocomplete Styling */
.location-input :deep(.el-input__wrapper) {
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); /* Enhanced shadow */
}

.search-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 250px;
    overflow-y: auto;
    margin-bottom: 15px;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
}

.search-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 6px;
    transition: background-color 0.2s;
}

.search-result-item:hover {
    background-color: #f0f0f0;
}

.result-info {
    display: flex;
    flex-direction: column;
    text-align: left;
    overflow: hidden;
    margin-right: 10px;
}

.result-name {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 2px;
}

.result-address {
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.no-results {
    text-align: center;
    color: #888;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
}

.map-picker-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>


