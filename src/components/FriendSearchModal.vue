<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFriendStore } from '@/stores/friend'
import { Search, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const friendStore = useFriendStore()
const dialogVisible = ref(false)
const searchQuery = ref('') // 변경: searchEmail → searchQuery
const searchMethod = ref<'email' | 'nickname'>('email') // 새로 추가
const hasSearched = ref(false)

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
  if (!val) {
      // Reset on close
      searchQuery.value = ''
      friendStore.searchResult = null
      hasSearched.value = false
  }
})

watch(dialogVisible, (val) => {
  emit('update:modelValue', val)
})

const handleSearch = async () => {
    if (!searchQuery.value.trim()) return
    
    if (searchMethod.value === 'email') {
        await friendStore.searchUserByEmail(searchQuery.value)
    } else {
        await friendStore.searchUserByNickname(searchQuery.value)
    }
    hasSearched.value = true
}

const handleAdd = async () => {
    if (!friendStore.searchResult) return
    try {
        await friendStore.sendRequest(friendStore.searchResult.id)
        ElMessage.success('친구 요청을 보냈습니다.')
        dialogVisible.value = false
    } catch (e: any) {
        // Display the specific error message from sendRequest
        ElMessage.error(e.message || '요청 전송에 실패했습니다.')
    }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="친구 추가"
    width="90%"
    style="max-width: 400px;"
    align-center
    append-to-body
  >
    <div class="search-modal-content">
        <!-- Search Method Toggle -->
        <el-segmented v-model="searchMethod" :options="[
            { label: '이메일', value: 'email' },
            { label: '별명', value: 'nickname' }
        ]" block />

        <div class="search-box">
            <el-input 
                v-model="searchQuery" 
                :placeholder="searchMethod === 'email' ? '이메일 입력' : '별명 입력'" 
                @keyup.enter="handleSearch"
                clearable
            >
                <template #append>
                    <el-button :icon="Search" @click="handleSearch" :loading="friendStore.loading" />
                </template>
            </el-input>
        </div>

        <div class="result-area" v-if="friendStore.searchResult">
            <div class="user-card">
                <el-avatar 
                    :icon="UserFilled" 
                    :src="friendStore.searchResult.avatar_url || undefined"
                    class="user-avatar" 
                />
                <div class="user-info">
                    <span class="user-name">{{ friendStore.searchResult.nickname || friendStore.searchResult.email }}</span>
                    <span v-if="friendStore.searchResult.nickname" class="user-email-sub">{{ friendStore.searchResult.email }}</span>
                </div>
                <el-button type="primary" size="small" @click="handleAdd">
                    추가
                </el-button>
            </div>
        </div>
        <div class="no-result" v-else-if="hasSearched && !friendStore.loading">
            <p>사용자를 찾을 수 없습니다.</p>
        </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.search-modal-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 10px 0;
}
.result-area {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 12px;
}
.user-card {
    display: flex;
    align-items: center;
    gap: 12px;
}
.user-info {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.user-name {
    font-size: 14px;
    color: #333;
    font-weight: 500;
}
.user-email-sub {
    font-size: 12px;
    color: #909399;
}
.user-email {
    font-size: 14px;
    color: #333;
    font-weight: 500;
}
.no-result {
    text-align: center;
    color: #909399;
    font-size: 14px;
}
</style>
