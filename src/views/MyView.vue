<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Edit } from '@element-plus/icons-vue'
import { ref, onMounted } from 'vue'

const authStore = useAuthStore()
const profileStore = useProfileStore()
const router = useRouter()

const showNicknameModal = ref(false)
const nickname = ref('')

onMounted(async () => {
  if (authStore.user?.id) {
    await profileStore.fetchProfile(authStore.user.id)
  }
})

const openNicknameModal = () => {
  nickname.value = profileStore.profile?.nickname || ''
  showNicknameModal.value = true
}

const handleAvatarChange = async (file: File) => {
  if (!authStore.user?.id) return

  try {
    // Keep current nickname, just update avatar
    await profileStore.updateProfile(
      authStore.user.id,
      profileStore.profile?.nickname || '',
      file
    )
    ElMessage.success('프로필 이미지가 업데이트되었습니다!')
  } catch (err) {
    console.error('Avatar update error:', err)
    ElMessage.error('이미지 업데이트에 실패했습니다.')
  }
}

const handleNicknameSave = async () => {
  if (!nickname.value.trim()) {
    ElMessage.error('별명을 입력해주세요.')
    return
  }

  if (!authStore.user?.id) return

  try {
    // Keep current avatar, just update nickname
    await profileStore.updateProfile(
      authStore.user.id,
      nickname.value.trim(),
      null
    )
    ElMessage.success('별명이 업데이트되었습니다!')
    showNicknameModal.value = false
  } catch (err) {
    console.error('Nickname update error:', err)
    ElMessage.error('별명 업데이트에 실패했습니다.')
  }
}

const handleLogout = async () => {
  try {
    await authStore.signOut()
    ElMessage.success('로그아웃 되었습니다.')
    router.push('/login')
  } catch (error) {
    ElMessage.error('로그아웃 중 오류가 발생했습니다.')
  }
}
</script>

<template>
  <div class="my-page">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <h2>내 계정</h2>
        </div>
      </template>
      
      <div class="profile-content">
        <!-- Avatar Section -->
        <div class="avatar-section">
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            :on-change="(file: any) => handleAvatarChange(file.raw)"
            accept="image/*"
            class="avatar-upload-wrapper"
          >
            <el-avatar 
              :size="120" 
              :icon="User"
              :src="profileStore.profile?.avatar_url || undefined"
              class="clickable-avatar"
            />
          </el-upload>
          <p class="hint">클릭하여 이미지 변경</p>
        </div>

        <el-divider />

        <!-- User Info Section -->
        <div class="user-info">
          <p class="label">별명</p>
          <div class="nickname-row">
            <p class="value">{{ profileStore.profile?.nickname || '설정되지 않음' }}</p>
            <el-button :icon="Edit" circle size="small" @click="openNicknameModal" />
          </div>
        </div>

        <div class="user-info">
          <p class="label">이메일</p>
          <p class="value">{{ authStore.user?.email || '정보 없음' }}</p>
        </div>
        
        <el-divider />

        <!-- Logout Button -->
        <el-button type="danger" @click="handleLogout" class="logout-btn" plain>
          로그아웃
        </el-button>
      </div>
    </el-card>

    <!-- Nickname Edit Modal -->
    <el-dialog
      v-model="showNicknameModal"
      title="별명 변경"
      width="90%"
      style="max-width: 350px;"
      align-center
    >
      <el-input
        v-model="nickname"
        placeholder="별명 입력"
        maxlength="20"
        show-word-limit
      />

      <template #footer>
        <el-button @click="showNicknameModal = false">취소</el-button>
        <el-button type="primary" @click="handleNicknameSave" :loading="profileStore.loading">
          저장
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.my-page {
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: white; 
}

.profile-card {
  width: 100%;
  max-width: 500px;
  margin-top: 20px;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-upload-wrapper {
  cursor: pointer;
}

.clickable-avatar {
  cursor: pointer;
  transition: opacity 0.2s;
}

.clickable-avatar:hover {
  opacity: 0.8;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 0.9rem;
  color: #909399;
  margin: 0;
}

.nickname-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.value {
  font-size: 1.1rem;
  font-weight: 500;
  color: #303133;
  text-align: center;
  margin: 0;
}

.logout-btn {
  width: 100%;
  margin-top: 10px;
}
</style>
