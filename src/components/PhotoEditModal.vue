<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { type Photo } from '@/stores/photo'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Search, Location, Edit, Calendar, ChatLineRound } from '@element-plus/icons-vue'
import { supabase } from '@/lib/supabase'
import { useKakaoLoader } from '@/composables/useKakaoLoader'

import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: boolean
  photo: Photo | null
}>()

const { t } = useI18n({ useScope: 'global' })

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
const tempLocation = ref<{ lat: number, lng: number, address: string | null } | null>(null)

// Postcode Overlay State
const showPostcodeOverlay = ref(false)
const postcodeEmbedContainer = ref<HTMLElement | null>(null)

// Watch for photo prop change to initialize data
watch(() => props.photo, async (newPhoto) => {
    if (newPhoto) {
        localPhoto.value = { ...newPhoto }
        
        // If address is missing but we have coordinates, try to recover it
        if (!localPhoto.value.address && localPhoto.value.latitude && localPhoto.value.longitude) {
            // Do NOT set placeholder to address (avoids saving "Loading..." text)
            
            // Ensure SDK is loaded
            await loadKakaoMap()
            
            const recoveredAddr = await getAddressFromCoords(localPhoto.value.latitude, localPhoto.value.longitude)
            if (recoveredAddr) {
                localPhoto.value.address = recoveredAddr
            }
            // If still null, template will handle showing "No Location"
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

        ElMessage.success(t('photo.edit.msg_saved'))
        emit('refresh')
        handleClose()
    } catch (e) {
        console.error(e)
        ElMessage.error(t('photo.edit.msg_save_error'))
    } finally {
        loading.value = false
    }
}
const handleDelete = async () => {
    if (!props.photo) return
    try {
        await ElMessageBox.confirm(
            t('photo.edit.delete_confirm_msg'), 
            t('photo.edit.delete_confirm_title'), 
            {
                type: 'warning',
                confirmButtonText: t('photo.edit.btn_delete'),
                cancelButtonText: t('photo.edit.btn_cancel')
            }
        )
        
        // Delete from Storage
        if (props.photo.storage_path) {
            await supabase.storage.from('photos').remove([props.photo.storage_path])
        }

        // Delete from DB
        const { error } = await supabase.from('photos').delete().eq('id', props.photo.id)
        if (error) throw error

        ElMessage.success(t('photo.edit.msg_deleted'))
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
    const addr = localPhoto.value.address || await getAddressFromCoords(initialLat, initialLng)
    // Fix: Don't use t() here. Use null if no address, handle fallback in template
    tempLocation.value = { lat: initialLat, lng: initialLng, address: addr || null }
}

const updateTempLocation = async (lat: number, lng: number) => {
    mapMarker.value.setPosition(new window.kakao.maps.LatLng(lat, lng))
    mapInstance.value.panTo(new window.kakao.maps.LatLng(lat, lng))
    
    const addr = await getAddressFromCoords(lat, lng)
    tempLocation.value = { lat, lng, address: addr || null }
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
        localPhoto.value.address = tempLocation.value.address || ''
    }
    showLocationHelper.value = false
}
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        :title="$t('photo.edit.title')"
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
                <span>{{ $t('photo.edit.text_only_placeholder') }}</span>
            </div>

            <el-form label-position="top">
                <!-- 1. Title -->
                <el-form-item :label="$t('photo.edit.label_title')">
                    <el-input v-model="localPhoto.title" :placeholder="$t('photo.edit.ph_title')" :prefix-icon="Edit" />
                </el-form-item>

                <!-- 2. Description (Moved up) -->
                <el-form-item :label="$t('photo.edit.label_desc')">
                    <el-input 
                        v-model="localPhoto.description" 
                        type="textarea" 
                        :rows="3" 
                        :placeholder="$t('photo.edit.ph_desc')" 
                        :prefix-icon="Edit"
                    />
                </el-form-item>

                <!-- 3. Taken Date -->
                <el-form-item :label="$t('photo.edit.label_date')">
                    <el-date-picker
                        v-model="localPhoto.taken_at"
                        type="datetime"
                        :placeholder="$t('photo.edit.ph_date')"
                        style="width: 100%"
                        format="YYYY-MM-DD HH:mm"
                        :prefix-icon="Calendar"
                    />
                </el-form-item>

                <!-- 4. Location (Map Integration) -->
                <el-form-item :label="$t('photo.edit.label_location')">
                    <div class="location-display">
                         <div class="location-text-group">
                             <el-icon><Location /></el-icon>
                             <span class="location-text">
                                 {{ localPhoto.address || $t('photo.edit.no_location') }}
                             </span>
                         </div>
                         <el-button size="small" type="primary" plain @click="openLocationHelper">
                            {{ localPhoto.address ? $t('photo.edit.edit_location') : $t('photo.edit.set_location') }}
                         </el-button>
                    </div>
                </el-form-item>

            </el-form>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button type="danger" :icon="Delete" @click="handleDelete" plain>{{ $t('photo.edit.btn_delete') }}</el-button>
                <div class="right-actions">
                    <el-button @click="handleClose">{{ $t('photo.edit.btn_cancel') }}</el-button>
                    <el-button type="primary" @click="handleSave" :loading="loading">{{ $t('photo.edit.btn_save') }}</el-button>
                </div>
            </div>
        </template>
    </el-dialog>

    <!-- Location Helper Modal -->
    <el-dialog
        v-model="showLocationHelper"
        :title="$t('location_helper.title')"
        width="90%"
        style="max-width: 500px"
        append-to-body
        align-center
    >
        <div class="helper-header">
            <el-button type="primary" :icon="Search" @click="togglePostcodeSearch" class="search-toggle-btn">
                {{ showPostcodeOverlay ? $t('location_helper.back_to_map') : $t('location_helper.search') }}
            </el-button>
            <p v-if="!showPostcodeOverlay && tempLocation" class="current-selected-addr">
                <el-icon><Location /></el-icon> {{ tempLocation.address || $t('location_helper.select_on_map') }}
            </p>
        </div>

        <div class="map-wrapper">
            <div ref="mapContainer" class="map-picker-container"></div>
            <div v-show="showPostcodeOverlay" class="postcode-overlay">
                 <div ref="postcodeEmbedContainer" style="width: 100%; height: 100%;"></div>
            </div>
        </div>

        <div class="map-picker-footer">
            <el-button @click="showLocationHelper = false">{{ $t('photo.edit.btn_cancel') }}</el-button>
            <el-button type="primary" @click="confirmLocation" :disabled="!tempLocation">{{ $t('location_helper.confirm') }}</el-button>
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
