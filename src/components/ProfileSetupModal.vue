<script setup lang="ts">
import { ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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

const ADJECTIVES = ['Happy', 'Lucky', 'Sunny', 'Fast', 'Smart', 'Cool', 'Bright', 'Kind', 'Brave', 'Calm']
const NOUNS = ['Traveler', 'Explorer', 'Friend', 'Neighbor', 'Artist', 'Chef', 'Runner', 'Dreamer', 'Pioneer', 'Walker']

const generateRandomNickname = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    // Add random number to ensure uniqueness if needed, but simple combo is friendlier
    // Let's add 2 digits
    const num = Math.floor(Math.random() * 99) + 1
    return `${adj}${noun}${num}`
}

const handleRandom = async () => {
    // Generate random nickname
    const newNickname = generateRandomNickname()
    nickname.value = newNickname
    
    // Auto-generate avatar preview for better UX before submit
    avatarFile.value = null
    avatarPreview.value = profileStore.generateAvatarUrl(newNickname)
    
    ElMessage.info(t('profile_setup.msg_random_generated', { nickname: newNickname }))
    
    // Submit immediately as requested ("바로 가입/완료")
    await handleSubmit()
}

const handleSubmit = async () => {
    if (!nickname.value.trim()) {
        ElMessage.error(t('my.warn_nickname'))
        return
    }

    if (!authStore.user?.id) {
        ElMessage.error(t('common.login_required'))
        return
    }

    uploading.value = true
    try {
        await profileStore.updateProfile(
            authStore.user.id,
            nickname.value.trim(),
            avatarFile.value
        )
        ElMessage.success(t('profile_setup.msg_success'))
        emit('update:modelValue', false)
        emit('complete')
    } catch (err) {
        console.error('Profile setup error:', err)
        ElMessage.error(t('profile_setup.error_setup'))
    } finally {
        uploading.value = false
    }
}
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :title="$t('profile_setup.title')"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        width="90%"
        style="max-width: 500px;"
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
                <!-- Manual Auto Generate Button Removed -->
            </div>

            <el-form :model="{ nickname }" label-position="top">
                <el-form-item :label="$t('profile_setup.nickname')" required>
                    <el-input
                        v-model="nickname"
                        :placeholder="$t('my.nickname_placeholder')"
                        maxlength="20"
                        show-word-limit
                    />
                </el-form-item>
            </el-form>
        </div>

        <template #footer>
            <el-button @click="handleRandom" :loading="uploading">{{ $t('profile_setup.random_generation') }}</el-button>
            <el-button type="primary" @click="handleSubmit" :loading="uploading">
                {{ $t('common.complete') }}
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
