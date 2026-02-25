<template>
  <div class="not-found-container">
    <div class="content">
      <h1 class="error-code">404</h1>
      <h2 class="error-message">{{ $t('common.not_found') }}</h2>
      <p class="description" v-html="$t('common.not_found_desc')"></p>
      
      <el-button type="primary" size="large" @click="goHome" class="home-button">
        {{ $t('common.go_home') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push({ name: 'home' })
}
</script>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f7fa;
  text-align: center;
  padding: 20px;
}

.content {
  background: white;
  padding: 40px 60px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-width: 500px;
  width: 100%;
}

.error-code {
  font-size: 80px;
  font-weight: 900;
  color: #409eff; /* Element Plus Primary Color */
  margin: 0;
  line-height: 1;
}

.error-message {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 20px 0 10px;
}

.description {
  font-size: 16px;
  color: #606266;
  margin-bottom: 30px;
  line-height: 1.6;
}

.home-button {
  min-width: 160px;
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .content {
    padding: 30px 20px;
  }
  
  .error-code {
    font-size: 60px;
  }
  
  .error-message {
    font-size: 20px;
  }
}
</style>
