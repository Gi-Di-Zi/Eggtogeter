```html
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { usePhotoStore } from '@/stores/photo'
import { useFriendStore } from '@/stores/friend'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import { Plus, Delete, User } from '@element-plus/icons-vue'

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

// Sync with v-model ans init scope
watch(() => props.modelValue, async (val) => {
    dialogVisible.value = val
    if (val && props.photoId) {
        // Load Friends list if needed
        if (friendStore.friends.length === 0) {
           await friendStore.fetchFriends()
        }

        const photo = photoStore.photos.find(p => p.id === props.photoId)
        if (photo && photo.visibility && photo.visibility !== 'public') {
             // Type cast safely
             shareScope.value = photo.visibility as any
        } else {
            // Default to private if unknown or public(legacy)
            shareScope.value = 'friends' 
        }

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

// Computed for UI
const addedFriends = computed(() => {
    return selectedFriendIds.value.map(id => {
        const f = friendStore.friends.find(fr => fr.id === id)
        return f || { id, email: '알 수 없는 사용자' }
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
             ElMessage.warning('공유할 친구를 최소 한 명 추가이어주세요.')
             return
        }

        await photoStore.updatePhotoVisibility(
            props.photoId, 
            shareScope.value, 
            selectedFriendIds.value
        )
        ElMessage.success('공유 설정이 저장되었습니다.')
    }
    dialogVisible.value = false
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="공유 설정"
    width="90%"
    style="max-width: 450px;"
    align-center
    append-to-body
  >
    <div class="share-modal-content">
        <p class="description">이 사진을 누구에게 보여줄까요?</p>
        
        <el-radio-group v-model="shareScope" class="scope-group">
            <div class="scope-item">
                <el-radio label="friends" size="large" border>
                    <span class="label-title">전체 친구</span>
                    <span class="label-desc">등록된 모든 친구에게 보입니다.</span>
                </el-radio>
            </div>
            
            <div class="scope-item">
                <el-radio label="specific" size="large" border>
                    <span class="label-title">특정 친구 선택</span>
                    <span class="label-desc">선택한 친구에게만 보입니다.</span>
                </el-radio>
                
                <!-- Specific Friends UI: Input + List -->
                <div v-if="shareScope === 'specific'" class="specific-area">
                    <div class="add-row">
                        <el-select
                            v-model="targetFriendId"
                            placeholder="친구 선택"
                            style="flex: 1;"
                            filterable
                            :loading="loadingShares"
                        >
                            <el-option
                                v-for="friend in availableFriends"
                                :key="friend.id"
                                :label="friend.email"
                                :value="friend.id"
                            />
                        </el-select>
                        <el-button type="primary" :icon="Plus" @click="handleAddFriend" :disabled="!targetFriendId">
                            추가
                        </el-button>
                    </div>

                    <!-- Added Friends List -->
                    <div class="added-list">
                        <div v-if="addedFriends.length === 0" class="empty-msg">
                            친구를 추가해주세요.
                        </div>
                        <div v-else class="friend-item" v-for="friend in addedFriends" :key="friend.id">
                            <div class="friend-info">
                                <el-icon><User /></el-icon>
                                <span class="friend-name">{{ friend.email }}</span>
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
                    <span class="label-title">나만 보기 (비공개)</span>
                    <span class="label-desc">지도에서도 나에게만 보입니다.</span>
                </el-radio>
            </div>
        </el-radio-group>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">취소</el-button>
        <el-button type="primary" @click="handleSave" :loading="photoStore.loading">
          저장
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
</style>
