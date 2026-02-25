<script setup lang="ts">
import { ref, watch } from 'vue'
import { type Photo } from '@/stores/photo'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Location, Edit, Calendar, MapLocation } from '@element-plus/icons-vue'
import { supabase } from '@/lib/supabase'
import { useGoogleMapsLoader } from '@/composables/useGoogleMapsLoader'
import { useI18n } from 'vue-i18n'
import PhotoLocationPicker from '@/components/PhotoLocationPicker.vue'
import { isPlusCodeAddress, pickBestFormattedAddress, sanitizeAddress } from '@/utils/addressUtils'

const props = defineProps<{
  modelValue: boolean
  photo: Photo | null
}>()

const { t } = useI18n({ useScope: 'global' })
const { loadGoogleMaps } = useGoogleMapsLoader()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'refresh'): void
}>()

const localPhoto = ref<Partial<Photo>>({})
const loading = ref(false)
const showLocationHelper = ref(false)

watch(() => props.photo, async (newPhoto) => {
    if (newPhoto) {
        localPhoto.value = { ...newPhoto }
        const currentAddress = localPhoto.value.address?.trim() || ''
        const needsRecovery = !currentAddress || isPlusCodeAddress(currentAddress)

        if (needsRecovery && localPhoto.value.latitude && localPhoto.value.longitude) {
            try {
                await loadGoogleMaps()
                const recoveredAddr = await getAddressFromCoords(localPhoto.value.latitude, localPhoto.value.longitude)
                if (recoveredAddr) {
                    localPhoto.value.address = recoveredAddr
                }
            } catch (e) {
                console.error('Failed to init map for address recovery', e)
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
        
        if (props.photo.storage_path) {
            await supabase.storage.from('photos').remove([props.photo.storage_path])
        }

        const { error } = await supabase.from('photos').delete().eq('id', props.photo.id)
        if (error) throw error

        ElMessage.success(t('photo.edit.msg_deleted'))
        emit('refresh')
        handleClose()
    } catch (e) {
        // Cancelled or error
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

const handleLocationConfirm = (location: { lat: number, lng: number, address: string }) => {
    localPhoto.value.latitude = location.lat
    localPhoto.value.longitude = location.lng
    localPhoto.value.address = sanitizeAddress(location.address) || ''
    showLocationHelper.value = false
}

const getDisplayAddress = (address?: string | null) => {
    return sanitizeAddress(address) || t('photo.edit.no_location')
}
</script>

<template>
  <el-dialog 
    :model-value="modelValue" 
    @update:model-value="emit('update:modelValue', $event)"
    :title="$t('photo.edit.title')" 
    width="90%" 
    style="max-width: 500px"
    @close="handleClose"
    append-to-body
  >
    <div class="edit-content">
        <!-- Preview Area -->
        <div class="preview-area">
            <div v-if="localPhoto.publicUrl" class="preview-image" :style="{ backgroundImage: `url(${localPhoto.publicUrl})` }"></div>
             <!-- Placeholder if no image (e.g. legacy data) -->
            <div v-else class="preview-image no-image">
                <span>{{ $t('photo.edit.text_only_placeholder') }}</span>
            </div>
        </div>

        <div class="form-area">
            <!-- Title -->
             <div class="form-item">
                <label><el-icon><Edit /></el-icon> {{ $t('photo.edit.label_title') }}</label>
                <el-input 
                    v-model="localPhoto.title" 
                    :placeholder="$t('photo.edit.ph_title')" 
                    clearable 
                />
            </div>

            <!-- Description -->
            <div class="form-item">
                <label><el-icon><Edit /></el-icon> {{ $t('photo.edit.label_desc') }}</label>
                <el-input 
                    v-model="localPhoto.description" 
                    type="textarea" 
                    :rows="2" 
                    :placeholder="$t('photo.edit.ph_desc')" 
                />
            </div>

            <!-- Date -->
            <div class="form-item">
                <label><el-icon><Calendar /></el-icon> {{ $t('photo.edit.label_date') }}</label>
                <el-date-picker
                    v-model="localPhoto.taken_at"
                    type="datetime"
                    :placeholder="$t('photo.edit.ph_date')"
                    format="YYYY-MM-DD HH:mm"
                    style="width: 100%"
                />
            </div>

            <!-- Location -->
            <div class="form-item">
                <label><el-icon><MapLocation /></el-icon> {{ $t('photo.edit.label_location') }}</label>
                <div v-if="localPhoto.latitude && localPhoto.longitude" class="location-info">
                    <p class="address">{{ getDisplayAddress(localPhoto.address) }}</p>
                    <div class="location-btns">
                        <el-button size="small" type="primary" plain @click="showLocationHelper = true">{{ $t('photo.edit.edit_location') }}</el-button>
                    </div>
                </div>
                <div v-else class="location-empty">
                    <p>{{ $t('photo.edit.no_location') }}</p>
                    <div class="location-btns-center">
                        <el-button type="primary" plain @click="showLocationHelper = true"><el-icon><Location /></el-icon> {{ $t('photo.edit.set_location') }}</el-button>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div class="actions">
                <el-button type="danger" :icon="Delete" @click="handleDelete" plain class="delete-btn">{{ $t('photo.edit.btn_delete') }}</el-button>
                <div class="right-actions">
                    <el-button @click="handleClose" size="large">{{ $t('photo.edit.btn_cancel') }}</el-button>
                    <el-button type="primary" size="large" @click="handleSave" :loading="loading" class="save-btn">
                        {{ $t('photo.edit.btn_save') }}
                    </el-button>
                </div>
            </div>
        </div>
    </div>

    <!-- Unified Location Helper Modal -->
    <PhotoLocationPicker
        v-model="showLocationHelper"
        :initial-lat="localPhoto.latitude"
        :initial-lng="localPhoto.longitude"
        :initial-address="localPhoto.address"
        @confirm="handleLocationConfirm"
    />
  </el-dialog>
</template>

<style scoped>
/* Unified Styles matching PhotoUploadModal */
.edit-content {
    padding: 10px 0;
}

.preview-area {
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    background: #f5f7fa;
    border: 1px solid #dcdfe6;
}

.preview-image {
    width: 100%;
    height: 300px; /* Specific height for edit mode */
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    background-color: #000;
}

.no-image {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f5f7fa;
    color: #909399;
    height: 200px;
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

.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
}

.right-actions {
    display: flex;
    gap: 10px;
}

.save-btn {
    font-weight: bold;
    min-width: 100px;
}
</style>
