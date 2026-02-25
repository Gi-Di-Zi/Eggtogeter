<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { usePhotoStore, type PhotoVisibility } from '@/stores/photo'
import { useFriendStore } from '@/stores/friend'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import { Plus, Delete, User } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  modelValue: boolean
  photoId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const photoStore = usePhotoStore()
const friendStore = useFriendStore()
const dialogVisible = ref(false)
const shareScope = ref<'friends' | 'specific' | 'private'>('private')
const selectedFriendIds = ref<string[]>([])
const targetFriendId = ref('') // For the single select input
const loadingShares = ref(false)

const isPhotoVisibility = (value: unknown): value is PhotoVisibility => {
    return value === 'friends' || value === 'specific' || value === 'private'
}

// Sync with v-model ans init scope
watch(() => props.modelValue, async (val) => {
    dialogVisible.value = val
    if (val && props.photoId) {
        // Load Friends list if needed
        if (friendStore.friends.length === 0) {
           await friendStore.fetchFriends()
        }

        const photo = photoStore.photos.find(p => p.id === props.photoId)
        shareScope.value = isPhotoVisibility(photo?.visibility) ? photo.visibility : 'private'

        // Load existing shares if specific
        if (shareScope.value === 'specific') {
            await loadExistingShares(props.photoId)
        }
    }
})

const loadExistingShares = async (photoId: string) => {
    loadingShares.value = true
    try {
        const { data } = await supabase
            .from('photo_shares')
            .select('user_id')
            .eq('photo_id', photoId)
        
        if (data) {
            selectedFriendIds.value = data.map(r => r.user_id)
        }
    } catch (e) {
        console.error('Error loading shares', e)
    } finally {
        loadingShares.value = false
    }
}

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
  if (!val) {
      selectedFriendIds.value = [] 
      targetFriendId.value = ''
  }
})

// If user switches to specific, we might want to ensure shares are loaded, 
// strictly speaking only if we haven't loaded them yet. 
watch(shareScope, async (newVal) => {
    if (newVal === 'specific' && props.photoId && selectedFriendIds.value.length === 0) {
        await loadExistingShares(props.photoId)
    }
})

type AddedFriendView = {
    id: string
    email: string
    nickname?: string
    avatar_url?: string
    isUnknown: boolean
}

// Computed for UI
const addedFriends = computed<AddedFriendView[]>(() => {
    return selectedFriendIds.value.map(id => {
        const friend = friendStore.friends.find(fr => fr.id === id)
        if (friend) {
            return {
                ...friend,
                isUnknown: false
            }
        }

        return {
            id,
            email: '',
            nickname: '',
            avatar_url: '',
            isUnknown: true
        }
    })
})

const availableFriends = computed(() => {
    return friendStore.friends.filter(f => !selectedFriendIds.value.includes(f.id))
})

const handleAddFriend = () => {
    if (!targetFriendId.value) return
    if (selectedFriendIds.value.includes(targetFriendId.value)) return

    selectedFriendIds.value.push(targetFriendId.value)
    targetFriendId.value = '' // Clear input
}

const handleRemoveFriend = (id: string) => {
    selectedFriendIds.value = selectedFriendIds.value.filter(fid => fid !== id)
}

const handleSave = async () => {
    if (props.photoId) {
        if (shareScope.value === 'specific' && selectedFriendIds.value.length === 0) {
             ElMessage.warning(t('photo.share.warn_select_one'))
             return
        }

        await photoStore.updatePhotoVisibility(
            props.photoId, 
            shareScope.value, 
            selectedFriendIds.value
        )
        ElMessage.success(t('photo.share.msg_saved'))
    }
    dialogVisible.value = false
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('photo.share.title')"
    width="90%"
    style="max-width: 450px;"
    align-center
    append-to-body
  >
    <div class="share-modal-content">
        <p class="description">{{ $t('photo.share.description') }}</p>
        
        <el-radio-group v-model="shareScope" class="scope-group">
            <div class="scope-item">
                <el-radio label="friends" size="large" border>
                    <span class="label-title">{{ $t('photo.share.scope_friends') }}</span>
                    <span class="label-desc">{{ $t('photo.share.scope_friends_desc') }}</span>
                </el-radio>
            </div>
            
            <div class="scope-item">
                <el-radio label="specific" size="large" border>
                    <span class="label-title">{{ $t('photo.share.scope_specific') }}</span>
                    <span class="label-desc">{{ $t('photo.share.scope_specific_desc') }}</span>
                </el-radio>
                
                <!-- Specific Friends UI: Input + List -->
                <div v-if="shareScope === 'specific'" class="specific-area">
                    <div class="add-row">
                        <el-select
                            v-model="targetFriendId"
                            :placeholder="$t('photo.share.ph_select_friend')"
                            filterable
                            style="flex: 1;"
                        >
                            <template #default>
                                <el-option
                                    v-for="friend in availableFriends"
                                    :key="friend.id"
                                    :label="friend.nickname ? `${friend.nickname} (${friend.email})` : friend.email"
                                    :value="friend.id"
                                >
                                    <div class="option-content">
                                        <el-avatar :size="24" :src="friend.avatar_url" :icon="User" />
                                        <span>{{ friend.nickname ? `${friend.nickname} (${friend.email})` : friend.email }}</span>
                                    </div>
                                </el-option>
                            </template>
                        </el-select>
                        <el-button type="primary" :icon="Plus" @click="handleAddFriend" :disabled="!targetFriendId">
                            {{ $t('photo.share.btn_add') }}
                        </el-button>
                    </div>

                    <!-- Added Friends List -->
                    <div class="added-list">
                        <div v-if="addedFriends.length === 0" class="empty-msg">
                            {{ $t('photo.share.empty_friends') }}
                        </div>
                        <div v-else class="friend-item" v-for="friend in addedFriends" :key="friend.id">
                            <div class="friend-info">
                                <el-avatar :size="32" :src="friend.avatar_url" :icon="User" />
                                <div class="friend-text">
                                    <span class="friend-name">
                                        {{ friend.isUnknown ? $t('photo.share.unknown_user') : (friend.nickname || friend.email.split('@')[0]) }}
                                    </span>
                                    <span class="friend-email" v-if="!friend.isUnknown" >
                                        {{ friend.email }}
                                    </span>
                                </div>
                            </div>
                            <el-button 
                                circle 
                                size="small" 
                                type="danger" 
                                plain 
                                :icon="Delete" 
                                @click="handleRemoveFriend(friend.id)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div class="scope-item">
                <el-radio label="private" size="large" border>
                    <span class="label-title">{{ $t('photo.share.scope_private') }}</span>
                    <span class="label-desc">{{ $t('photo.share.scope_private_desc') }}</span>
                </el-radio>
            </div>
        </el-radio-group>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="photoStore.loading">
          {{ $t('common.save') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.share-modal-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 8px 0;
}
.description {
    margin: 0;
    color: #606266;
    font-size: 15px;
    font-weight: 500;
}

.scope-group {
    display: flex;
    flex-direction: column;
    gap: 16px; /* Increased gap */
    width: 100%;
}

.scope-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Customize Radio Button Height/Layout */
:deep(.el-radio) {
    width: 100%;
    height: auto;
    padding: 16px; /* More padding */
    margin-right: 0;
    display: flex;
    align-items: center; /* Center alignment */
    border-radius: 8px;
}
:deep(.el-radio.is-bordered.is-checked) {
    background-color: var(--el-color-primary-light-9);
}

:deep(.el-radio__input) {
    /* Align radio button nicely */
    margin-top: 0; 
}

:deep(.el-radio__label) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    white-space: normal;
    width: 100%;
}

.label-title {
    font-weight: 600;
    font-size: 16px; /* Bigger font */
    color: #303133;
}
.label-desc {
    font-size: 13px;
    color: #909399;
}

/* Specific UI Styles */
.specific-area {
    padding-left: 12px;
    padding-right: 12px;
    animation: fadeIn 0.3s ease;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.add-row {
    display: flex;
    gap: 8px;
}

.added-list {
    background: #f5f7fa;
    border-radius: 8px;
    padding: 12px;
    min-height: 40px;
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.empty-msg {
    color: #909399;
    font-size: 13px;
    text-align: center;
    padding: 10px 0;
}

.friend-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: white;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #e4e7ed;
}

.friend-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #606266;
    font-size: 14px;
    overflow: hidden;
}

.friend-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

.option-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

.friend-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.2;
}

.friend-email {
    font-size: 12px;
    color: #909399;
}
</style>
