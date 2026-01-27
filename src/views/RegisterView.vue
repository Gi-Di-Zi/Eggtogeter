<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'

const router = useRouter()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)

const handleRegister = async () => {
    if (!email.value || !password.value || !passwordConfirm.value) {
        ElMessage.warning('모든 필드를 입력해주세요.')
        return
    }

    if (password.value !== passwordConfirm.value) {
        ElMessage.warning('비밀번호가 일치하지 않습니다.')
        return
    }

    loading.value = true
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email.value,
            password: password.value,
            options: {
                emailRedirectTo: `${window.location.origin}/login`
            }
        })

        console.log('SignUp Response Data:', data)
        console.log('SignUp Response Error:', error)

        if (error) throw error

        // 이미 가입된 이메일인 경우 (identities가 빈 배열로 반환됨)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            ElMessage.warning('이미 가입된 이메일입니다. 이메일 인증을 완료했거나 로그인을 시도해주세요.')
            return
        }

        ElMessage.success('가입 인증 메일이 발송되었습니다. 이메일을 확인해주세요.')
        router.push('/login')
    } catch (e: any) {
        console.error(e)
        ElMessage.error('회원가입 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'))
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="register-container">
        <el-card class="register-card">
            <h2>회원가입</h2>
            
            <form @submit.prevent="handleRegister">
                <div class="form-group">
                    <el-input 
                        v-model="email" 
                        type="email" 
                        placeholder="이메일" 
                        size="large"
                    />
                </div>
                
                <div class="form-group">
                    <el-input 
                        v-model="password" 
                        type="password" 
                        placeholder="비밀번호" 
                        show-password
                        size="large"
                    />
                </div>

                <div class="form-group">
                    <el-input 
                        v-model="passwordConfirm" 
                        type="password" 
                        placeholder="비밀번호 확인" 
                        show-password
                        size="large"
                    />
                </div>

                <el-button 
                    type="primary" 
                    native-type="submit" 
                    class="submit-btn" 
                    :loading="loading"
                    size="large"
                >
                    가입하기
                </el-button>
            </form>

            <div class="links">
                <router-link to="/login">이미 계정이 있으신가요? 로그인</router-link>
            </div>
        </el-card>
    </div>
</template>

<style scoped>
.register-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f5f7fa;
    padding: 20px;
}

.register-card {
    width: 100%;
    max-width: 400px;
}

h2 {
    text-align: center;
    margin-bottom: 30px;
    color: #303133;
}

.form-group {
    margin-bottom: 20px;
}

.submit-btn {
    width: 100%;
    margin-top: 10px;
}

.links {
    margin-top: 20px;
    text-align: center;
    font-size: 0.9rem;
}

.links a {
    color: #409eff;
    text-decoration: none;
}

.links a:hover {
    text-decoration: underline;
}
</style>
