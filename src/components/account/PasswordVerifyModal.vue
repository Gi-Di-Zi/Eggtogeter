<template>
  <el-dialog
    v-model="visible"
    title="비밀번호 확인"
    width="400px"
    :close-on-click-modal="false"
    :show-close="false"
    align-center
  >
    <div class="verify-container">
      <p class="desc">개인정보 보호를 위해 비밀번호를 다시 입력해주세요.</p>
      
      <el-form @submit.prevent="handleSubmit">
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="비밀번호 입력"
            show-password
            :disabled="isValidating"
            ref="passwordInput"
          />
        </el-form-item>
        
        <div class="actions">
          <el-button @click="handleCancel" :disabled="isValidating">취소</el-button>
          <el-button type="primary" native-type="submit" :loading="isValidating" :disabled="!password">
            확인
          </el-button>
        </div>
      </el-form>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'verified'): void
}>()

const visible = ref(props.modelValue)
const password = ref('')
const isValidating = ref(false)
const passwordInput = ref()

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    password.value = ''
    nextTick(() => {
        passwordInput.value?.focus()
    })
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const handleCancel = () => {
  visible.value = false
}

const handleSubmit = async () => {
    if (!password.value) return
    
    isValidating.value = true
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) {
            throw new Error('User not found')
        }

        // Verify by signing in again (safest way to verify password)
        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password.value
        })

        if (error) {
            ElMessage.error('비밀번호가 일치하지 않습니다.')
        } else {
            ElMessage.success('비밀번호가 확인되었습니다.')
            visible.value = false
            emit('verified')
        }
    } catch (e: any) {
        ElMessage.error(e.message || '오류가 발생했습니다.')
    } finally {
        isValidating.value = false
    }
}
</script>

<style scoped>
.verify-container {
    text-align: center;
}
.desc {
    font-size: 14px;
    color: #666;
    margin-bottom: 20px;
}
.actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
}
</style>
