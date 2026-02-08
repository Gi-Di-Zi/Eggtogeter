<script setup lang="ts">
import { usePhotoStore, type Photo } from '@/stores/photo'
import { computed, ref, onMounted } from 'vue'
import { Calendar, Search, List, Grid, Files, Edit, PriceTag, Share, Picture, ChatLineRound } from '@element-plus/icons-vue' 
import PhotoEditModal from '@/components/PhotoEditModal.vue'
import CategoryManagerModal from '@/components/CategoryManagerModal.vue'
import PhotoShareModal from '@/components/PhotoShareModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/category'
import { useUiStore } from '@/stores/ui'

const photoStore = usePhotoStore()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()

const uiStore = useUiStore()

const showEditModal = ref(false)
const showCategoryManager = ref(false)
const showShareModal = ref(false)
const showPreviewModal = ref(false)
const selectedPhoto = ref<Photo | null>(null)


// Ensure we have data when entering this view
onMounted(() => {
    categoryStore.fetchCategories()
    
    // Fix: Clear friend filter (e.g. "user:...") when entering My Photo Management
    // 홈 화면에서 친구 필터를 켠 채로 이동했을 때, 관리 화면 select box에 'user:uuid'가 노출되는 현상 방지
    if (typeof photoStore.filterCategoryId === 'string') {
        photoStore.setFilterCategoryId(null)
    }

    // Don't refetch - use existing photos from store (keeps map showing shared photos)
})

// Filter to show only my photos in Edit View (local filtering)
const myPhotos = computed(() => {
    const userId = authStore.user?.id
    if (!userId) return []
    return photoStore.photos.filter(p => p.user_id === userId)
})

// Override filteredPhotos for Edit View to work with myPhotos
const editFilteredPhotos = computed(() => {
    let result = myPhotos.value

    // 1. Date Filter
    if (photoStore.filterDateRange) {
        const [start, end] = photoStore.filterDateRange
        const endOfDay = new Date(end)
        endOfDay.setHours(23, 59, 59, 999)

        result = result.filter(photo => {
            const dateStr = photo.taken_at || photo.created_at
            const date = new Date(dateStr)
            return date >= start && date <= endOfDay
        })
    }

    // 2. Search Filter
    if (photoStore.searchQuery.trim()) {
        const query = photoStore.searchQuery.toLowerCase()
        result = result.filter(photo =>
            (photo.title && photo.title.toLowerCase().includes(query)) ||
            (photo.address && photo.address.toLowerCase().includes(query)) ||
            (photo.description && photo.description.toLowerCase().includes(query)) ||
            (photo.category_name && photo.category_name.toLowerCase().includes(query))
        )
    }

    // 3. Category Filter
    if (photoStore.filterCategoryId && typeof photoStore.filterCategoryId === 'number') {
        result = result.filter(photo => {
            if (!photo.category_ids || photo.category_ids.length === 0) return false
            return photo.category_ids.includes(photoStore.filterCategoryId as number)
        })
    }

    return result
})

const dateRange = computed({
    get: () => photoStore.filterDateRange,
    set: (val) => photoStore.setFilterDateRange(val)
})

const handleCardClick = (photo: Photo) => {
    // Use Global Detail Modal (instead of local preview)
    uiStore.openDetailModal(photo)
}

const openEditModal = (photo: Photo) => {
    selectedPhoto.value = photo
    showEditModal.value = true
}

const openCategoryManager = (photo: Photo) => {
    selectedPhoto.value = photo
    showCategoryManager.value = true
}

const openShareModal = (photo: Photo) => {
    selectedPhoto.value = photo
    showShareModal.value = true
}

const handlePhotoUpdate = () => {
    // After edit/delete, refresh with SHARED photos to keep map consistent
    const userId = authStore.user?.id
    if (userId) {
        photoStore.fetchPhotos(userId, true) 
    }
}
// Infinite scroll handler
const handleLoadMore = () => {
    if (displayedEditPhotos.value.length < editFilteredPhotos.value.length) {
        photoStore.loadMore()
    }
}

// Check if all data is loaded
const noMore = computed(() => displayedEditPhotos.value.length >= editFilteredPhotos.value.length)

// Displayed photos with limit
const displayedEditPhotos = computed(() => {
    return editFilteredPhotos.value.slice(0, photoStore.displayLimit)
})

const getCardStyle = (photo: Photo) => {
    const color = photo.category_color
    if (!color) return {}

    if (photoStore.viewMode === 'grid') {
        return {
            boxShadow: `inset 0 0 0 3px ${color}`
        }
    } else {
        // List or Compact
        return {
            boxShadow: `inset 5px 0 0 0 ${color}`
        }
    }
}

// Filter out "user:..." categories (friend shares) for this view
// Since this is "My Photo Management", we only want standard categories.
const availableCategories = computed(() => {
    return categoryStore.categories.filter(c => !c.name.startsWith('user:'))
})

</script>

<template>
    <div class="photo-edit-view">
        <div class="header-section">
            <h3>{{ $t('edit.title') }}</h3>
        </div>

        <div class="controls-section">
            <div class="control-row">
                <el-date-picker
                    v-model="dateRange"
                    type="daterange"
                    range-separator="~"
                    :start-placeholder="$t('common.start_date')"
                    :end-placeholder="$t('common.end_date')"
                    format="YYYY-MM-DD"
                    style="flex: 1;"
                    :shortcuts="[
                        { text: $t('common.today'), value: [new Date(), new Date()] },
                        { text: $t('common.last_7_days'), value: () => { const end = new Date(); const start = new Date(); start.setTime(start.getTime() - 3600 * 1000 * 24 * 7); return [start, end] } }
                    ]"
                />
                <el-button-group>
                    <el-button 
                        :type="photoStore.viewMode === 'list' ? 'primary' : ''" 
                        :icon="List" 
                        @click="photoStore.setViewMode('list')" 
                    />
                    <el-button 
                        :type="photoStore.viewMode === 'grid' ? 'primary' : ''" 
                        :icon="Grid" 
                        @click="photoStore.setViewMode('grid')" 
                    />
                    <el-button 
                        :type="photoStore.viewMode === 'compact' ? 'primary' : ''" 
                        :icon="Files" 
                        @click="photoStore.setViewMode('compact')" 
                    />
                </el-button-group>
            </div>

            <!-- Second Row: Search & Filter -->
            <div class="control-row">
                <el-select
                    v-model="photoStore.filterCategoryId"
                    :placeholder="$t('common.select_category')"
                    style="width: 160px; flex-shrink: 0;"
                    clearable
                    @change="photoStore.setFilterCategoryId"
                >
                    <el-option
                        v-for="cat in availableCategories"
                        :key="cat.id"
                        :label="cat.name"
                        :value="cat.id"
                    >
                         <span :style="{ color: cat.color || '#000', marginRight: '8px' }">●</span>
                         {{ cat.name }}
                    </el-option>
                </el-select>
                <el-input
                    v-model="photoStore.searchQuery"
                    :placeholder="$t('common.search_placeholder')"
                    :prefix-icon="Search"
                    clearable
                    @input="photoStore.setSearchQuery"
                    style="flex: 1"
                />
            </div>
        </div>

        <!-- Photo List -->
        <div 
            class="photo-list-container" 
            v-if="displayedEditPhotos.length > 0"
            v-infinite-scroll="handleLoadMore"
            :infinite-scroll-disabled="noMore"
            :infinite-scroll-distance="10"
        >
            <div :class="['photo-list', photoStore.viewMode]">
                <el-card 
                    v-for="photo in displayedEditPhotos" 
                    :key="photo.id" 
                    class="photo-card" 
                    shadow="hover"
                    :style="getCardStyle(photo)"
                    @click="handleCardClick(photo)"
                >
                    <div class="card-content">
                        <!-- Grid Mode -->
                        <template v-if="photoStore.viewMode === 'grid'">
                            <div v-if="photo.publicUrl" class="grid-thumbnail" :style="{ backgroundImage: `url(${photo.publicUrl})` }">
                                <div class="grid-date-overlay">
                                    {{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}
                                </div>
                                <div class="grid-edit-icon" @click.stop>
                                    <div class="icon-circle" @click.stop="openCategoryManager(photo)" :title="$t('common.category')">
                                        <el-icon><PriceTag /></el-icon>
                                    </div>
                                    <div class="icon-circle" @click.stop="openShareModal(photo)" :title="$t('common.share')">
                                        <el-icon><Share /></el-icon>
                                    </div>
                                    <div class="icon-circle" @click.stop="openEditModal(photo)" :title="$t('common.edit')">
                                        <el-icon><Edit /></el-icon>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="grid-thumbnail text-placeholder">
                                <el-icon class="placeholder-icon"><ChatLineRound /></el-icon>
                                <span>{{ $t('detail.text_only') }}</span>
                                <div class="grid-date-overlay">
                                    {{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}
                                </div>
                                <div class="grid-edit-icon" @click.stop>
                                    <div class="icon-circle" @click.stop="openCategoryManager(photo)">
                                        <el-icon><PriceTag /></el-icon>
                                    </div>
                                    <div class="icon-circle" @click.stop="openShareModal(photo)">
                                        <el-icon><Share /></el-icon>
                                    </div>
                                    <div class="icon-circle" @click.stop="openEditModal(photo)">
                                        <el-icon><Edit /></el-icon>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <!-- List Mode -->
                        <template v-else-if="photoStore.viewMode === 'list'">
                            <div v-if="photo.publicUrl" class="list-thumbnail" :style="{ backgroundImage: `url(${photo.publicUrl})` }"></div>
                            <div v-else class="list-thumbnail text-placeholder">
                                <el-icon class="placeholder-icon"><ChatLineRound /></el-icon>
                            </div>
                            <div class="list-info">
                                <div class="info-row title">
                                    <span class="text-truncate" style="font-weight: bold; color: #333;">
                                        {{ photo.title || $t('common.no_title') }}
                                    </span>
                                </div>
                                <div class="info-row date">
                                    <el-icon><Calendar /></el-icon>
                                    <span>{{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}</span>
                                </div>
                                <div class="info-row desc" v-if="photo.description">
                                    <span>{{ photo.description }}</span>
                                </div>
                            </div>
                            <div class="list-actions">
                                <el-button circle size="small" :icon="PriceTag" @click.stop="openCategoryManager(photo)" />
                                <el-button circle size="small" :icon="Share" @click.stop="openShareModal(photo)" />
                                <el-button circle size="small" :icon="Edit" @click.stop="openEditModal(photo)" />
                            </div>
                        </template>

                        <!-- Compact Mode -->
                        <template v-else>
                            <div class="compact-row">
                                <div class="compact-info">
                                     <span class="title-compact text-truncate">{{ photo.title || $t('common.no_title') }}</span>
                                     <span class="date">{{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}</span>
                                </div>
                            </div>
                            <div class="compact-actions">
                                <el-button circle size="small" :icon="PriceTag" @click.stop="openCategoryManager(photo)" />
                                <el-button circle size="small" :icon="Share" @click.stop="openShareModal(photo)" />
                                <el-button circle size="small" :icon="Edit" @click.stop="openEditModal(photo)" />
                            </div>
                        </template>
                    </div>
                </el-card>
            </div>
        </div>
        
        <el-empty v-else :description="$t('common.no_photos')" image-size="100">
             <template #image>
                <el-icon :size="60" color="#909399"><Picture /></el-icon>
            </template>
        </el-empty>

        <!-- Edit Modal -->
        <PhotoEditModal 
            v-model="showEditModal" 
            :photo="selectedPhoto" 
            @refresh="handlePhotoUpdate" 
        />
        
        <!-- Category Manager -->
        <CategoryManagerModal v-model="showCategoryManager" :photo-id="selectedPhoto?.id" />

        <!-- Share Settings Modal -->
        <PhotoShareModal v-model="showShareModal" :photo-id="selectedPhoto?.id" />

        <!-- Image Preview Modal -->
        <el-dialog v-model="showPreviewModal" width="80%" style="max-width: 800px; background: transparent; box-shadow: none;" :show-close="false" align-center append-to-body>
            <div class="preview-container" @click="showPreviewModal = false">
                 <img v-if="selectedPhoto" :src="selectedPhoto.publicUrl" style="width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
            </div>
        </el-dialog>
    </div>
</template>

<style scoped>
.photo-edit-view {
    height: 100vh;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden; 
}

.header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: -5px;
}
.header-section h3 {
    margin: 0;
    font-size: 1.1rem;
}

.controls-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0; 
}

.control-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.photo-list-container {
    flex: 1;
    overflow-y: auto; 
    min-height: 0;
    padding-right: 4px;
}

/* List Layout */
.photo-list.list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.photo-list.list .photo-card .card-content {
    display: flex;
    gap: 12px;
    align-items: center;
    position: relative;
    padding-right: 90px; /* Adjusted for 3 buttons */
}
.list-thumbnail {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    flex-shrink: 0;
    border: 1px solid #e0e0e0;
}
.list-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
/* List Layout Logic */
.list-actions {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex; 
    gap: 4px; /* Reduced gap */
}

/* Grid Layout */
.photo-list.grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}
.photo-list.grid .photo-card {
    padding: 0 !important;
    border: 1px solid #dcdfe6;
}

.photo-list.grid .el-card__body {
    padding: 0;
}
.photo-list.grid .card-content {
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 0; 
    overflow: hidden;
    height: 100%;
}
.text-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #f8f9fb !important;
    color: #909399;
    gap: 10px;
    font-size: 13px;
    height: 100%;
    width: 100%;
    aspect-ratio: 1; /* Force square for Grid */
    border: 1px solid #dcdfe6;
    box-sizing: border-box;
}
.text-placeholder .placeholder-icon {
    font-size: 36px;
    color: #dcdfe6;
    margin-bottom: 2px;
}
.photo-list.list .text-placeholder {
    width: 60px; /* Match .list-thumbnail width */
    height: 60px; /* Match .list-thumbnail height */
    border-radius: 6px;
    aspect-ratio: auto;
}
.photo-list.list .text-placeholder .placeholder-icon {
    font-size: 26px;
}
.grid-thumbnail {
    width: 100%;
    aspect-ratio: 1;
    background-size: cover;
    background-position: center;
    position: relative; 
}
.grid-date-overlay {
    position: absolute;
    bottom: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-top-left-radius: 4px;
}
.grid-edit-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    gap: 8px; /* Reduced gap */
    width: 100%;
    justify-content: center;
    padding: 0 4px;
    box-sizing: border-box;
}
.photo-card:hover .grid-edit-icon {
    opacity: 1;
}
.icon-circle {
    background: rgba(0,0,0,0.5);
    color: white;
    border-radius: 50%;
    width: 32px; /* Smaller size */
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
}
.icon-circle:hover {
    background: rgba(0,0,0,0.8);
}

/* Compact Layout */
.photo-list.compact {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.photo-list.compact .card-content {
    display: flex;
    align-items: center;
    padding: 0;
    position: relative;
    padding-right: 120px; /* Increased from 90px to prevent overlap */
    height: 40px; 
}
.compact-row {
    flex: 1;
}
.compact-info {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    align-items: center;
}
.compact-actions {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    gap: 4px; /* Reduced gap */
}

/* Common Card Styles */
.photo-card {
    cursor: pointer;
    transition: all 0.2s;
}

.info-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #606266;
}
.info-row.title {
    font-size: 15px;
    margin-bottom: 2px;
}
.title-compact {
    font-weight: 600;
    margin-right: 8px;
    flex: 1;
}

.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
