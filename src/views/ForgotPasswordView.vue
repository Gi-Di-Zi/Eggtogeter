<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { supabase } from '@/lib/supabase'
import { useI18n } from 'vue-i18n'

const email = ref('')
const router = useRouter()
const loading = ref(false)
const { t } = useI18n()

const handleReset = async () => {
    if (!email.value) {
        ElMessage.warning(t('auth.reset.msg_enter_email'))
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
            ElMessage.error(t('auth.reset.msg_profile_error'))
            loading.value = false
            return
        }

        if (!profile) {
             ElMessage.warning(t('auth.reset.msg_email_not_found'))
             loading.value = false
             return
        }

        const redirectTo = window.location.origin + '/update-password'

        // Standard Flow
        const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
            redirectTo
        })
        
        if (error) throw error
        
        ElMessage.success(t('auth.reset.msg_link_sent'))
        router.push('/login')
        
    } catch (error: any) {
        ElMessage.error(t('auth.reset.msg_send_fail') + error.message)
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
                    <h2>{{ $t('auth.reset.title') }}</h2>
                </div>
            </template>
            <el-form @submit.prevent="handleReset" label-position="top">
                <p class="description">{{ $t('auth.reset.description') }}</p>
                <el-form-item :label="$t('auth.reset.label_email')">
                    <el-input v-model="email" type="email" :placeholder="$t('auth.reset.ph_email')" required />
                </el-form-item>
                <el-button type="primary" native-type="submit" class="full-width">
                    {{ $t('auth.reset.btn_submit') }}
                </el-button>
                <div class="auth-links">
                    <router-link to="/login">{{ $t('auth.reset.link_back') }}</router-link>
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
