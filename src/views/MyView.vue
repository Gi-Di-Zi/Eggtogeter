<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Edit } from '@element-plus/icons-vue'
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@/composables/useLocale'
import { computed } from 'vue'

const { t } = useI18n()
const { locale, setLocale } = useLocale()

const currentLocale = computed({
    get: () => locale.value,
    set: (val) => setLocale(val)
})

const handleLocaleChange = (val: string | number | boolean | undefined) => {
    if (typeof val === 'string') {
        setLocale(val)
        ElMessage.success(t('common.saved'))
    }
}

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
    ElMessage.success(t('my.msg_avatar_updated'))
  } catch (err) {
    console.error('Avatar update error:', err)
    ElMessage.error(t('my.update_image_failed'))
  }
}

const handleNicknameSave = async () => {
  if (!nickname.value.trim()) {
    ElMessage.error(t('my.warn_nickname'))
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
    ElMessage.success(t('my.msg_nickname_updated'))
    showNicknameModal.value = false
  } catch (err) {
    console.error('Nickname update error:', err)
    ElMessage.error(t('my.update_nickname_failed'))
  }
}

const handleLogout = async () => {
  try {
    await authStore.signOut()
    ElMessage.success(t('my.msg_logout'))
    router.push('/login')
  } catch (error) {
    ElMessage.error(t('my.msg_logout_error'))
  }
}
</script>

<template>
  <div class="my-page">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <h2>{{ $t('my.title') }}</h2>
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
          <p class="hint">{{ $t('my.avatar_hint') }}</p>
        </div>

        <el-divider />

        <!-- Locale Setting -->
        <div class="user-info">
            <p class="label">{{ $t('common.language') }}</p>
            <el-radio-group v-model="currentLocale" @change="handleLocaleChange">
                <el-radio-button label="ko">한국어</el-radio-button>
                <el-radio-button label="en">English</el-radio-button>
            </el-radio-group>
        </div>

        <el-divider />

        <!-- User Info Section -->
        <div class="user-info">
          <p class="label">{{ $t('my.nickname') }}</p>
          <div class="nickname-row">
            <p class="value">{{ profileStore.profile?.nickname || $t('my.not_set') }}</p>
            <el-button :icon="Edit" circle size="small" @click="openNicknameModal" />
          </div>
        </div>

        <div class="user-info">
          <p class="label">{{ $t('my.email') }}</p>
          <p class="value">{{ authStore.user?.email || $t('my.no_info') }}</p>
        </div>
        
        <el-divider />

        <!-- Logout Button -->
        <el-button type="danger" @click="handleLogout" class="logout-btn" plain>
          {{ $t('common.logout') }}
        </el-button>
      </div>
    </el-card>

    <!-- Nickname Edit Modal -->
    <el-dialog
      v-model="showNicknameModal"
      :title="$t('my.change_nickname')"
      width="90%"
      style="max-width: 350px;"
      align-center
    >
      <el-input
        v-model="nickname"
        :placeholder="$t('my.nickname_placeholder')"
        maxlength="20"
        show-word-limit
      />

      <template #footer>
        <el-button @click="showNicknameModal = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleNicknameSave" :loading="profileStore.loading">
          {{ $t('common.save') }}
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
