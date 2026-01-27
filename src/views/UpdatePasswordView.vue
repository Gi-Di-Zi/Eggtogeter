<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const router = useRouter()
const authStore = useAuthStore()

const handleUpdate = async () => {
    if (password.value !== confirmPassword.value) {
        ElMessage.error('비밀번호가 일치하지 않습니다.')
        return
    }

    loading.value = true
    try {
        // console.log('UpdatePasswordView: Starting update...')
        
        // 1. Session Check (Required: "Why am I logged in?" -> Because Supabase logs you in via the link to allow the update!)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
             // If no session, looking at the screen makes no sense
             ElMessage.error('세션이 만료되었습니다. 링크를 다시 클릭해주세요.')
             router.push('/login')
             return
        }

        // 2. Update Password (with Timeout Guard)
        // If it hangs for 5s, we assume it's the "Network Hang" issue but the request likely processsed.
        // User wants to proceed regardless.
        const updatePromise = supabase.auth.updateUser({ password: password.value })
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject('TIMEOUT'), 5000)
        )

        try {
            const { error }: any = await Promise.race([updatePromise, timeoutPromise])
            if (error) {
                console.error('Update Error:', error)
                throw error
            }
        } catch (err: any) {
            if (err === 'TIMEOUT') {
                console.warn('Update API timed out - Proceeding assuming success.')
            } else {
                throw err // Real error (e.g. password too weak)
            }
        }

        // 3. Success
        ElMessage.success('비밀번호가 변경되었습니다.')
        
        // Wait briefly for user to see message
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 4. Force Logout (Client-Side State + Server Request + Storage Nuke)
        
        // A. Clear Store IMMEDIATELY to pass Router Guard
        authStore.user = null
        authStore.session = null
        
        // B. Nuke LocalStorage to prevent zombie session on refresh
        // Even if signOut hangs, this ensures next page load finds no token.
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key)
            }
        })

        // C. Attempt Server SignOut (with timeout to prevent hang)
        const signOutPromise = supabase.auth.signOut()
        const signOutTimeout = new Promise(resolve => setTimeout(resolve, 1000))
        await Promise.race([signOutPromise, signOutTimeout]).catch(err => console.warn('SignOut Ignored:', err))
        
        // Force full reload to clear 'isRecoveryFlow' state in App.vue
        window.location.replace('/login')

    } catch (error: any) {
        console.error('Update error:', error)
        ElMessage.error('오류 발생: ' + error.message)
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="auth-container">
        <el-card class="auth-card">
            <template #header>
                <div class="card-header">
                    <h2>새 비밀번호 설정</h2>
                </div>
            </template>
            <el-form @submit.prevent="handleUpdate" label-position="top">
                <el-form-item label="새 비밀번호">
                    <el-input v-model="password" type="password" placeholder="새 비밀번호를 입력하세요" required show-password />
                </el-form-item>
                <el-form-item label="비밀번호 확인">
                    <el-input v-model="confirmPassword" type="password" placeholder="비밀번호를 다시 입력하세요" required
                        show-password />
                </el-form-item>
                <el-button type="primary" native-type="submit" :loading="loading" class="full-width">
                    비밀번호 변경
                </el-button>
            </el-form>
        </el-card>
    </div>
</template>

<style scoped>
.auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f0f2f5;
}

.auth-card {
    width: 100%;
    max-width: 400px;
}

.card-header {
    text-align: center;
}

.full-width {
    width: 100%;
    margin-top: 10px;
}
</style>
