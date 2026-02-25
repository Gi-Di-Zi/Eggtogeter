<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFriendStore } from '@/stores/friend'
import { Plus, User, Check, Close } from '@element-plus/icons-vue'
import FriendSearchModal from '@/components/FriendSearchModal.vue'


const friendStore = useFriendStore()
const activeTab = ref('friends')
const showSearchModal = ref(false)

onMounted(() => {
    refreshData()
})

const refreshData = () => {
    friendStore.fetchFriends()
    friendStore.fetchRequests()
}

const handleAccept = async (id: string) => {
    await friendStore.respondToRequest(id, true)
}

const handleReject = async (id: string) => {
    await friendStore.respondToRequest(id, false)
}
</script>

<template>
    <div class="friends-view">
        <div class="header-section">
            <h3>{{ $t('friends.title') }}</h3>
            <el-button type="primary" size="small" :icon="Plus" circle @click="showSearchModal = true" />
        </div>

        <el-tabs v-model="activeTab" class="friend-tabs" @tab-click="refreshData">
            <el-tab-pane :label="$t('friends.tab_my_friends')" name="friends">
                <div class="list-container" v-if="friendStore.friends.length > 0">
                    <div class="friend-item" v-for="friend in friendStore.friends" :key="friend.id">
                        <div class="friend-info">
                            <el-avatar 
                                :size="40" 
                                :icon="User" 
                                :src="friend.avatar_url || undefined"
                            />
                            <div class="friend-text">
                                <span class="friend-name">{{ friend.nickname || friend.email }}</span>
                                <span v-if="friend.nickname" class="friend-email-sub">{{ friend.email }}</span>
                            </div>
                        </div>
                        <!-- Future: Delete friend button -->
                    </div>
                </div>
                <el-empty v-else :description="$t('friends.no_friends')" :image-size="80" />
            </el-tab-pane>
            
            <el-tab-pane :label="$t('friends.tab_requests')" name="requests">
                 <div class="list-container" v-if="friendStore.receivedRequests.length > 0">
                    <div class="request-item" v-for="req in friendStore.receivedRequests" :key="req.id">
                        <div class="friend-info">
                            <el-avatar 
                                :size="40" 
                                :icon="User" 
                                :src="req.friend_profile?.avatar_url || undefined"
                            />
                            <div class="req-text">
                                <span class="friend-name">{{ req.friend_profile?.nickname || req.friend_profile?.email }}</span>
                                <span class="req-date">{{ new Date(req.created_at).toLocaleDateString() }}</span>
                            </div>
                        </div>
                        <div class="req-actions">
                            <el-button type="success" size="small" circle :icon="Check" @click="handleAccept(req.id)" />
                            <el-button type="danger" size="small" circle :icon="Close" @click="handleReject(req.id)" />
                        </div>
                    </div>
                </div>
                 <el-empty v-else :description="$t('friends.no_requests')" :image-size="80" />
            </el-tab-pane>

        </el-tabs>

        <FriendSearchModal v-model="showSearchModal" />
    </div>
</template>

<style scoped>
.friends-view {
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
}

.header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.header-section h3 {
    margin: 0;
    font-size: 1.1rem;
}

.friend-tabs {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
:deep(.el-tabs__content) {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;
}

.list-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.friend-item, .request-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 8px;
}

.friend-info {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
}

.friend-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.friend-name {
    font-size: 14px;
    font-weight: 500;
    color: #333;
}

.friend-email-sub {
    font-size: 12px;
    color: #909399;
}

.friend-email {
    font-size: 14px;
    font-weight: 500;
    color: #333;
}

.req-text {
    display: flex;
    flex-direction: column;
}
.req-date {
    font-size: 11px;
    color: #909399;
}

.req-actions {
    display: flex;
    gap: 6px;
}

.status-pending {
    font-size: 12px;
    color: #e6a23c;
    background: #fdf6ec;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #faecd8;
}
</style>
