<template>
  <div class="moving-album-view">
    <el-empty description="무빙 앨범 기능 준비 중입니다.">
      <template #image>
        <el-icon :size="60"><VideoCamera /></el-icon>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { VideoCamera } from '@element-plus/icons-vue'
</script>

<style scoped>
.moving-album-view {
  padding: 20px 0;
  height: 100%;
  overflow-y: auto;
}
</style>
