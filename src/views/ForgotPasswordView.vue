<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { supabase } from '@/lib/supabase'

const email = ref('')
const router = useRouter()
const loading = ref(false)

const handleReset = async () => {
    if (!email.value) {
        ElMessage.warning('이메일을 입력해주세요.')
        return
    }

    loading.value = true
    try {
        // 1. Check if email exists in Profiles
        // Note: This requires RLS to allow reading 'profiles' table for anonymous/authenticated users.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email.value)
            .maybeSingle()
        
        if (profileError) {
            console.error('Error checking profile:', profileError)
            ElMessage.error('프로필 확인 중 오류가 발생했습니다.')
            loading.value = false
            return
        }

        if (!profile) {
             ElMessage.warning('등록되지 않은 이메일입니다.')
             loading.value = false
             return
        }

        const redirectTo = window.location.origin + '/update-password'

        // Standard Flow
        const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
            redirectTo
        })
        
        if (error) throw error
        
        ElMessage.success('비밀번호 재설정 링크가 이메일로 발송되었습니다.')
        router.push('/login')
        
    } catch (error: any) {
        ElMessage.error('이메일 전송 실패: ' + error.message)
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
                    <h2>비밀번호 재설정</h2>
                </div>
            </template>
            <el-form @submit.prevent="handleReset" label-position="top">
                <p class="description">가입한 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>
                <el-form-item label="이메일">
                    <el-input v-model="email" type="email" placeholder="이메일을 입력하세요" required />
                </el-form-item>
                <el-button type="primary" native-type="submit" class="full-width">
                    재설정 링크 보내기
                </el-button>
                <div class="auth-links">
                    <router-link to="/login">로그인으로 돌아가기</router-link>
                </div>
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
    position: relative;
    overflow: hidden;
}

.auth-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('@/assets/forgot_bg.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.7;
    z-index: 0;
}

.auth-card {
    width: 100%;
    max-width: 400px;
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: none;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    position: relative;
    z-index: 1;
}

.card-header {
    text-align: center;
}

.description {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
}

.full-width {
    width: 100%;
    margin-top: 10px;
}

.auth-links {
    margin-top: 15px;
    text-align: center;
    font-size: 14px;
}
</style>
