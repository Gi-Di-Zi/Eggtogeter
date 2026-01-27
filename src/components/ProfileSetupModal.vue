<script setup lang="ts">
import { ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User, Upload } from '@element-plus/icons-vue'

const props = defineProps<{
    modelValue: boolean
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'complete'): void
}>()

const profileStore = useProfileStore()
const authStore = useAuthStore()

const nickname = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const uploading = ref(false)

const handleAvatarChange = (file: File) => {
    avatarFile.value = file
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
        avatarPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
}

const handleAutoGenerate = () => {
    if (!nickname.value.trim()) {
        ElMessage.warning('별명을 먼저 입력해주세요.')
        return
    }
    // Clear file and set preview to auto-generated avatar
    avatarFile.value = null
    avatarPreview.value = profileStore.generateAvatarUrl(nickname.value.trim())
}

const handleSubmit = async () => {
    if (!nickname.value.trim()) {
        ElMessage.error('별명을 입력해주세요.')
        return
    }

    if (!authStore.user?.id) {
        ElMessage.error('로그인 정보를 찾을 수 없습니다.')
        return
    }

    uploading.value = true
    try {
        await profileStore.updateProfile(
            authStore.user.id,
            nickname.value.trim(),
            avatarFile.value
        )
        ElMessage.success('프로필이 설정되었습니다!')
        emit('update:modelValue', false)
        emit('complete')
    } catch (err) {
        console.error('Profile setup error:', err)
        ElMessage.error('프로필 설정에 실패했습니다.')
    } finally {
        uploading.value = false
    }
}

const handleSkip = async () => {
    if (!nickname.value.trim()) {
        ElMessage.error('별명을 입력한 후 건너뛰기를 해주세요.')
        return
    }
    // Skip avatar upload, auto-generate from nickname
    await handleSubmit()
}
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        title="프로필 설정"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        width="500px"
    >
        <div class="profile-setup">
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
                        :src="avatarPreview || undefined"
                        class="clickable-avatar"
                    />
                </el-upload>
                <el-button 
                    @click="handleAutoGenerate" 
                    size="small"
                    :icon="Upload"
                >
                    이미지 자동 생성
                </el-button>
            </div>

            <el-form :model="{ nickname }" label-position="top">
                <el-form-item label="별명" required>
                    <el-input
                        v-model="nickname"
                        placeholder="별명을 입력하세요"
                        maxlength="20"
                        show-word-limit
                    />
                </el-form-item>
            </el-form>
        </div>

        <template #footer>
            <el-button @click="handleSkip" :loading="uploading">건너뛰기</el-button>
            <el-button type="primary" @click="handleSubmit" :loading="uploading">
                완료
            </el-button>
        </template>
    </el-dialog>
</template>

<style scoped>
.profile-setup {
    padding: 20px 0;
}

.avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
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
</style>
