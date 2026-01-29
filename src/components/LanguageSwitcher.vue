<template>
  <div class="language-switcher">
    <el-dropdown trigger="click" @command="handleCommand">
      <span class="el-dropdown-link">
        {{ currentLocale.toUpperCase() }}
        <el-icon class="el-icon--right"><arrow-down /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="ko" :disabled="currentLocale === 'ko'">한국어</el-dropdown-item>
          <el-dropdown-item command="en" :disabled="currentLocale === 'en'">English</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { ArrowDown } from '@element-plus/icons-vue'

const { locale, setLocale } = useLocale()

const currentLocale = computed(() => locale.value)

const handleCommand = (command: string) => {
  setLocale(command)
}
</script>

<style scoped>
.language-switcher {
  cursor: pointer;
  display: flex;
  align-items: center;
}

.el-dropdown-link {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.el-dropdown-link:hover {
  color: #409eff;
}
</style>
