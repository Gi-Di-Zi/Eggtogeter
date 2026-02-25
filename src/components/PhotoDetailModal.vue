<script setup lang="ts">
import { type Photo } from '@/stores/photo'
import { Calendar, Location, ChatLineRound, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  photo: Photo | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const handleClose = () => {
    emit('update:modelValue', false)
}
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        width="420px"
        @close="handleClose"
        append-to-body
        align-center
        class="photo-detail-dialog"
        :show-close="false"
    >
        <div v-if="photo" class="detail-container">
            <!-- Header with Close Button -->
            <div class="detail-header">
                <span class="detail-type-tag" :style="{ backgroundColor: photo.category_color || '#409eff' }">
                    {{ photo.category_name || t('detail.record') }}
                </span>
                <el-button 
                    circle 
                    :icon="Close" 
                    class="close-btn" 
                    @click="handleClose"
                />
            </div>

            <!-- Media Section -->
            <div class="media-section">
                <template v-if="photo.publicUrl">
                    <img :src="photo.publicUrl" :alt="photo.title" class="detail-image" />
                </template>
                <template v-else>
                    <div class="text-record-hero" :style="{ borderLeft: `6px solid ${photo.category_color || '#409eff'}` }">
                        <el-icon :size="48" color="#909399"><ChatLineRound /></el-icon>
                        <h4>{{ t('detail.text_only') }}</h4>
                    </div>
                </template>
            </div>

            <!-- Content Section -->
            <div class="content-section">
                <h2 class="detail-title">{{ photo.title || t('common.no_title') }}</h2>
                
                <div class="meta-row">
                    <div class="meta-item">
                        <el-icon><Calendar /></el-icon>
                        <span>{{ new Date(photo.taken_at || photo.created_at).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                    </div>
                </div>

                <div class="meta-row" v-if="photo.address">
                    <div class="meta-item">
                        <el-icon><Location /></el-icon>
                        <span class="address-text">{{ photo.address }}</span>
                    </div>
                </div>

                <el-divider />

                <div class="description-box" v-if="photo.description">
                    <p>{{ photo.description }}</p>
                </div>
                <div v-else class="no-description">
                    <p>{{ t('detail.no_content') }}</p>
                </div>
            </div>

            <!-- Footer / Action Area (Optional) -->
            <div class="detail-footer">
                <p class="footer-hint">{{ t('detail.map_hint') }}</p>
            </div>
        </div>
    </el-dialog>
</template>

<style scoped>
.photo-detail-dialog :deep(.el-dialog__header) {
    display: none;
}
.photo-detail-dialog :deep(.el-dialog__body) {
    padding: 0;
    overflow: hidden;
    border-radius: 16px;
    box-shadow: 0 15px 45px rgba(0,0,0,0.3);
}

.detail-container {
    display: flex;
    flex-direction: column;
    background: white;
}

.detail-header {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
}

.detail-type-tag {
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.close-btn {
    background: rgba(0, 0, 0, 0.4) !important;
    border: none !important;
    color: white !important;
    backdrop-filter: blur(4px);
}
.close-btn:hover {
    background: rgba(0, 0, 0, 0.6) !important;
}

.media-section {
    width: 100%;
    background: #f8f9fa;
    line-height: 0;
}

.detail-image {
    width: 100%;
    height: auto;
    max-height: 40vh;
    object-fit: contain;
    background: #000;
}

.text-record-hero {
    height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    gap: 12px;
}
.text-record-hero h4 {
    margin: 0;
    color: #606266;
    font-size: 1.1rem;
    font-weight: 600;
}

.content-section {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.detail-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #303133;
    line-height: 1.3;
    word-break: break-all;
}

.meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #909399;
    font-size: 0.85rem;
}

.address-text {
    line-height: 1.4;
}

.description-box {
    background: #f8f9fa;
    padding: 16px;
    border-radius: 8px;
    min-height: 80px;
}

.description-box p {
    margin: 0;
    line-height: 1.6;
    color: #303133;
    white-space: pre-wrap;
    word-break: break-all;
}

.no-description p {
    margin: 0;
    color: #909399;
    font-style: italic;
    text-align: center;
}

.detail-footer {
    padding: 12px 24px;
    border-top: 1px solid #f2f6fc;
    text-align: center;
}

.footer-hint {
    margin: 0;
    font-size: 12px;
    color: #909399;
}
</style>
