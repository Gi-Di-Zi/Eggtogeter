<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)

const handleRegister = async () => {
    if (!email.value || !password.value || !passwordConfirm.value) {
        ElMessage.warning(t('auth.register.msg_fill_all'))
        return
    }

    if (password.value !== passwordConfirm.value) {
        ElMessage.warning(t('auth.register.msg_pw_mismatch'))
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
            ElMessage.warning(t('auth.register.msg_email_exists'))
            return
        }

        ElMessage.success(t('auth.register.msg_verify_email'))
        router.push('/login')
    } catch (e: any) {
        console.error(e)
        ElMessage.error(t('auth.register.msg_error') + (e.message || 'Unknown Error'))
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="register-container">
        <el-card class="register-card">
            <h2>{{ $t('auth.register.title') }}</h2>
            
            <form @submit.prevent="handleRegister">
                <div class="form-group">
                    <el-input 
                        v-model="email" 
                        type="email" 
                        :placeholder="$t('auth.register.email_placeholder')" 
                        size="large"
                    />
                </div>
                
                <div class="form-group">
                    <el-input 
                        v-model="password" 
                        type="password" 
                        :placeholder="$t('auth.register.pw_placeholder')" 
                        show-password
                        size="large"
                    />
                </div>

                <div class="form-group">
                    <el-input 
                        v-model="passwordConfirm" 
                        type="password" 
                        :placeholder="$t('auth.register.pw_confirm_placeholder')" 
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
                    {{ $t('auth.register.btn_submit') }}
                </el-button>
            </form>

            <div class="links">
                <router-link to="/login">{{ $t('auth.register.link_login') }}</router-link>
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
    position: relative;
    overflow: hidden;
}

.register-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('@/assets/register_bg.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.7;
    z-index: 0;
}

.register-card {
    width: 100%;
    max-width: 400px;
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: none;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    position: relative;
    z-index: 1;
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
