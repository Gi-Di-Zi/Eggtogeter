<script setup lang="ts">
import { usePhotoStore } from '@/stores/photo'
import { computed, onMounted } from 'vue'
import { Calendar, Location, Picture, Search, List, Grid, Files, ChatLineRound } from '@element-plus/icons-vue'
import { useUiStore } from '@/stores/ui'
import { useCategoryStore } from '@/stores/category'
import { useAuthStore } from '@/stores/auth'
import { useFriendStore } from '@/stores/friend'
import { useI18n } from 'vue-i18n'

const photoStore = usePhotoStore()
const uiStore = useUiStore()
const categoryStore = useCategoryStore()
const authStore = useAuthStore()
const friendStore = useFriendStore()
const { t } = useI18n()

onMounted(async () => {
    categoryStore.fetchCategories()
    if (authStore.user?.id) {
         // Home View: Show Shared Photos
         photoStore.fetchPhotos(authStore.user.id, true)
         // Fetch friends for nickname lookup
         await friendStore.fetchFriends()
    }
})

// Generate filter options for friends based on loaded photos with nicknames
const friendFilterOptions = computed(() => {
    if (!authStore.user?.id) return []
    const myId = authStore.user.id
    const friendMap = new Map<string, { id: string; name: string; color: string; avatarUrl?: string }>()

    photoStore.photos.forEach(photo => {
        if (photo.user_id !== myId && !friendMap.has(photo.user_id)) {
            // Find friend info
            const friend = friendStore.friends.find(f => f.id === photo.user_id)
            const displayName = friend?.nickname 
                ? `${friend.nickname}의 사진` 
                : (friend?.email || t('home.friend_photos'))

            // Generate deterministic color (same logic as store)
            let hash = 0;
            for (let i = 0; i < photo.user_id.length; i++) {
                hash = photo.user_id.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            const color = '#' + '00000'.substring(0, 6 - c.length) + c;

            friendMap.set(photo.user_id, {
                id: `user:${photo.user_id}`,
                name: displayName,
                color
            })
        }
    })

    return Array.from(friendMap.values())
})

const getCardStyle = (photo: any) => {
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

const dateRange = computed({
    get: () => photoStore.filterDateRange,
    set: (val) => photoStore.setFilterDateRange(val)
})

const handleCardClick = (photo: any) => {
    // Toggle Visibility (Requested by User: "Map on/off function")
    toggleVisibility(photo.id)
}

const navigateToPhoto = (photo: any) => {
    // Explicit navigation action
    uiStore.triggerMapRefresh(photo.latitude, photo.longitude)
}

// Infinite scroll handler
const handleLoadMore = () => {
    if (photoStore.displayedPhotos.length < photoStore.filteredPhotos.length) {
        photoStore.loadMore()
    }
}

// Check if all data is loaded
const noMore = computed(() => photoStore.displayedPhotos.length >= photoStore.filteredPhotos.length)



const toggleVisibility = (id: string) => {
    photoStore.toggleVisibility(id)
}

const isAllVisible = computed({
    get: () => photoStore.filteredPhotos.length > 0 && photoStore.filteredPhotos.every(p => photoStore.isVisible(p.id)),
    set: (val) => photoStore.setAllVisibility(val)
})
</script>

<template>
    <div class="home-drawer-content">
        <div class="controls-section">
            <div class="control-row">
                <el-date-picker
                    v-model="dateRange"
                    type="daterange"
                    range-separator="~"
                    :start-placeholder="$t('home.start_date')"
                    :end-placeholder="$t('home.end_date')"
                    format="YYYY-MM-DD"
                    style="flex: 1;"
                    :shortcuts="[
                        { text: $t('home.today'), value: [new Date(), new Date()] },
                        { text: $t('home.last_7_days'), value: () => { const end = new Date(); const start = new Date(); start.setTime(start.getTime() - 3600 * 1000 * 24 * 7); return [start, end] } }
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

            <!-- Second Row: Search & Bulk Action -->
            <div class="control-row">
                <el-input
                    v-model="photoStore.searchQuery"
                    :placeholder="$t('home.search_placeholder')"
                    :prefix-icon="Search"
                    clearable
                    @input="photoStore.setSearchQuery"
                    style="flex: 1"
                />
            </div>
            
            <!-- Third Row: Category & Visibility -->
            <div class="control-row">
                 <el-select
                    v-model="photoStore.filterCategoryId"
                    :placeholder="$t('home.select_category')"
                    style="flex: 1"
                    clearable
                    @change="photoStore.setFilterCategoryId"
                >
                    <!-- Friend Options (User-based Filter) -->
                    <el-option-group :label="$t('home.friend_photos')" v-if="friendFilterOptions.length > 0">
                        <el-option
                            v-for="friend in friendFilterOptions"
                            :key="friend.id"
                            :label="friend.name"
                            :value="friend.id"
                        >
                            <span :style="{ color: friend.color, marginRight: '8px' }">●</span>
                            {{ friend.name }}
                        </el-option>
                    </el-option-group>
                    <!-- Category Options -->
                    <el-option-group label="카테고리">
                        <el-option
                            v-for="cat in categoryStore.categories"
                            :key="cat.id"
                            :label="cat.name"
                            :value="cat.id"
                        >
                            <span :style="{ color: cat.color || '#000', marginRight: '8px' }">●</span>
                            {{ cat.name }}
                        </el-option>
                    </el-option-group>
                </el-select>
                <el-checkbox v-model="isAllVisible" border>{{ $t('home.view_all') }}</el-checkbox>
            </div>
        </div>


        <!-- Photo List -->
        <div 
            class="photo-list-container" 
            v-if="photoStore.displayedPhotos.length > 0"
            v-infinite-scroll="handleLoadMore"
            :infinite-scroll-disabled="noMore"
            :infinite-scroll-distance="10"
        >
            <div :class="['photo-list', photoStore.viewMode]">
                <el-card 
                    v-for="photo in photoStore.displayedPhotos" 
                    :key="photo.id" 
                    class="photo-card" 
                    :class="{ 'hidden-item': !photoStore.isVisible(photo.id), 'active-item': photoStore.isVisible(photo.id) }"
                    :style="getCardStyle(photo)"
                    shadow="hover"
                    @click="handleCardClick(photo)"
                >
                    <div class="card-content">
                        <!-- Grid Mode -->
                        <template v-if="photoStore.viewMode === 'grid'">
                            <div v-if="photo.publicUrl" class="grid-thumbnail" :style="{ backgroundImage: `url(${photo.publicUrl})` }">
                                <div class="grid-date-overlay">
                                    {{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}
                                </div>
                            </div>
                            <div v-else class="grid-thumbnail text-placeholder">
                                <el-icon class="placeholder-icon"><ChatLineRound /></el-icon>
                                <span>{{ $t('home.text_record') }}</span>
                                <div class="grid-date-overlay">
                                    {{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}
                                </div>
                            </div>
                        </template>

                        <!-- List Mode -->
                        <template v-else-if="photoStore.viewMode === 'list'">
                            <div v-if="photo.publicUrl" class="list-thumbnail" :style="{ backgroundImage: `url(${photo.publicUrl})` }"></div>
                            <div v-else class="list-thumbnail text-placeholder">
                                <el-icon><ChatLineRound /></el-icon>
                            </div>
                            <div class="list-info">
                                <!-- Always show a bold title row -->
                                <div class="info-row title">
                                    <span class="text-truncate" style="font-weight: bold; color: #333;">
                                        {{ photo.title || $t('home.no_title') }}
                                    </span>
                                </div>
                                <div class="info-row date">
                                    <el-icon><Calendar /></el-icon>
                                    <span>{{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}</span>
                                </div>
                                <!-- Description -->
                                <div class="info-row desc" v-if="photo.description">
                                    <span>{{ photo.description }}</span>
                                </div>
                            </div>
                            <div class="list-actions" @click.stop>
                                <el-button circle size="small" :icon="Location" @click.stop.prevent="navigateToPhoto(photo)" title="지도 위치로 이동"></el-button>
                            </div>
                        </template>

                        <!-- Compact Mode -->
                        <template v-else>
                            <div class="compact-row">
                                <div class="compact-info">
                                     <span class="title-compact text-truncate">{{ photo.title || $t('home.no_title') }}</span>
                                     <span class="date">{{ new Date(photo.taken_at || photo.created_at).toLocaleDateString() }}</span>
                                </div>
                            </div>
                             <!-- Action Buttons for Compact Mode -->
                            <div class="compact-actions" @click.stop>
                                <el-button circle size="small" :icon="Location" @click.stop.prevent="navigateToPhoto(photo)" title="지도 위치로 이동"></el-button>
                            </div>
                        </template>
                    </div>
                </el-card>
            </div>
        </div>
        
        <el-empty v-else :description="$t('home.no_results')" image-size="100">
             <template #image>
                <el-icon :size="60" color="#909399"><Picture /></el-icon>
            </template>
        </el-empty>

    </div>
</template>

<style scoped>
.home-drawer-content {
    /* Prevent double scroll by restricting height and hiding overflow */
    height: 100vh; /* changed from 100% to ensure full view height usage if parent allows, or keep 100% if parent is fixed */
    height: 100%;
    padding: 16px;
    box-sizing: border-box; /* Ensure padding doesn't add to height */
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden; /* Critical for inner scrolling */
}

@media (max-width: 768px) {
    .home-drawer-content {
        padding-bottom: 8px; /* Slightly relaxed */
    }

}



.controls-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background-color: var(--el-bg-color);
    /* removed sticky, just let it be top flex item */
    flex-shrink: 0; 
}

.control-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.photo-list-container {
    flex: 1;
    overflow-y: auto; /* Scroll only this area */
    min-height: 0;
    padding-right: 4px; /* Space for scrollbar */
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
    padding-right: 80px; /* Increased for 2 buttons */
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
    aspect-ratio: 1; /* Force square */
    border: 1px solid #dcdfe6; /* Match photo card border */
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
    aspect-ratio: auto; /* Reset for fixed size */
}
.photo-list.list .text-placeholder .placeholder-icon {
    font-size: 26px;
}
.grid-visibility-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    color: #606266;
    transition: all 0.2s;
}
.grid-visibility-toggle:hover {
    background: white;
    color: #409eff;
    transform: scale(1.1);
}
.list-actions {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
}

/* Grid Layout */
.photo-list.grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}
.photo-list.grid .photo-card {
    padding: 0 !important;
    /* Default border from .photo-card is used (1px solid #dcdfe6) */
    transition: all 0.2s;
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
.grid-thumbnail {
    width: 100%;
    aspect-ratio: 1;
    background-size: cover;
    background-position: center;
    position: relative; /* For overlay */
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
.grid-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    opacity: 0.8;
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
    padding-right: 80px;
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
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
}

/* Common Card Styles */
.photo-card {
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #dcdfe6; /* Removed !important to allow dynamic border color */
}

/* Inactive/Hidden State */
.photo-card.hidden-item {
    opacity: 0.5;
    filter: grayscale(100%);
    /* No background color change */
}

/* Grid Override for background/border logic (handled above generally, but ensure grid looks clean) */
.photo-list.grid .photo-card {
    /* Restore default card style including border and background */
    background-color: #fff;
    /* Border is inherited from .photo-card */
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
