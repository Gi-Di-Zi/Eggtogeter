<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'

const email = ref('')
const password = ref('')
const loading = ref(false)
const autoLogin = ref(false)
const saveEmail = ref(false)
const router = useRouter()

onMounted(() => {
  const saved = localStorage.getItem('savedEmail')
  if (saved) {
    email.value = saved
    saveEmail.value = true
  }
})

const handleLogin = async () => {
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) throw error
    
    // Save Email Logic
    if (saveEmail.value) {
      localStorage.setItem('savedEmail', email.value)
    } else {
      localStorage.removeItem('savedEmail')
    }

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
        
        <!-- Option Row: Auto Login & Save Email (Moved Up) -->
        <div class="option-row">
          <el-checkbox v-model="autoLogin">자동 로그인</el-checkbox>
          <el-checkbox v-model="saveEmail">이메일 저장</el-checkbox>
        </div>

        <el-button type="primary" native-type="submit" :loading="loading" class="full-width-btn">로그인</el-button>

        <!-- Link Row: Reset Password & Sign Up (Modern Style) -->
        <div class="action-row">
          <el-button class="sub-action-btn" @click="$router.push('/forgot-password')">비밀번호 재설정</el-button>
          <el-button class="sub-action-btn" type="success" plain @click="$router.push('/register')">회원가입</el-button>
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
  background-image: url('@/assets/login_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.7; /* Reduce vividness */
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
.full-width-btn {
  width: 100%;
  margin-top: 5px;
  margin-bottom: 20px;
  height: 40px;
  font-size: 16px;
}
.option-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.action-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.sub-action-btn {
  flex: 1;
  margin: 0 !important; /* Override element-plus default margin */
}
</style>

