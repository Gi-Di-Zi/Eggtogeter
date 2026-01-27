<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'

const email = ref('')
const password = ref('')
const loading = ref(false)
const router = useRouter()

const handleLogin = async () => {
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) throw error
    
    ElMessage.success('로그인 성공!')
    router.push('/')
  } catch (error: any) {
    ElMessage.error(error.message)
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
          <h2>로그인</h2>
        </div>
      </template>
      <el-form @submit.prevent="handleLogin" label-position="top">
        <el-form-item label="이메일">
          <el-input v-model="email" type="email" placeholder="이메일을 입력하세요" required />
        </el-form-item>
        <el-form-item label="비밀번호">
          <el-input v-model="password" type="password" placeholder="비밀번호를 입력하세요" required show-password />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="full-width">로그인</el-button>
        <div class="auth-links">
          <router-link to="/register">계정이 없으신가요? 회원가입</router-link>
          <div class="forgot-password-link">
            <router-link to="/forgot-password">비밀번호를 잊으셨나요?</router-link>
          </div>
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
.auth-links {
  margin-top: 15px;
  text-align: center;
  font-size: 14px;
}
</style>
