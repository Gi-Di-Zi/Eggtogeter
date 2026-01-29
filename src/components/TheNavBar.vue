<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { House, Edit, Camera, VideoCamera, User, Connection } from '@element-plus/icons-vue'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'

import { useFriendStore } from '@/stores/friend'
import { useAuthStore } from '@/stores/auth'
import { watch } from 'vue'

const route = useRoute()
const uiStore = useUiStore()
const profileStore = useProfileStore()
const friendStore = useFriendStore()
const authStore = useAuthStore()

const isActive = (path: string) => route.path === path

// Fetch requests when auth is ready or changed
watch(() => authStore.user, (newVal) => {
    if (newVal) {
        friendStore.fetchRequests()
    }
}, { immediate: true })

</script>

<template>
  <nav class="navbar">
    <div class="nav-items">
      <RouterLink to="/" class="nav-item" :class="{ active: isActive('/') }">
        <el-icon><House /></el-icon>
        <span class="label">{{ $t('navbar.home') }}</span>
      </RouterLink>
      
      <!-- Edit (Photo Edit) -->
      <RouterLink to="/edit" class="nav-item" active-class="active">
        <el-icon :size="24"><Edit /></el-icon>
        <span>{{ $t('navbar.manage_photos') }}</span>
      </RouterLink>

      <div class="nav-item center-btn" :class="{ active: uiStore.isUploadModalOpen }" @click="uiStore.openUploadModal" style="cursor: pointer;">
        <div class="upload-btn-container">
            <el-icon class="upload-icon"><Camera /></el-icon>
            <span class="label">{{ $t('navbar.upload_photo') }}</span>
        </div>
      </div>

      <RouterLink to="/album" class="nav-item" :class="{ active: isActive('/album') }">
        <el-icon><VideoCamera /></el-icon>
        <span class="label">{{ $t('navbar.moving_album') }}</span>
      </RouterLink>

      <RouterLink to="/friends" class="nav-item" :class="{ active: isActive('/friends') }">
        <el-badge :value="friendStore.pendingCount" :hidden="friendStore.pendingCount === 0" class="nav-badge">
            <el-icon><Connection /></el-icon>
        </el-badge>
        <span class="label">{{ $t('navbar.friends') }}</span>
      </RouterLink>

      <RouterLink to="/my" class="nav-item my-account-item desktop-only" :class="{ active: isActive('/my') }">
        <el-avatar 
          :size="32" 
          :icon="User" 
          :src="profileStore.profile?.avatar_url || undefined"
        />
        <span class="label">{{ $t('navbar.my_account') }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;
}

.nav-items {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 100%;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #8c8c8c;
  font-size: 11px;
  width: 100%;
  height: 100%;
  transition: color 0.3s;
}

.nav-item:hover, .nav-item.active {
  color: #409EFF;
}

.nav-item .el-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

/* Upload Button Styling */
.center-btn {
    color: #409EFF; /* Default to brand color for upload */
}

.upload-btn-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f0f9eb;
  border-radius: 12px;
  padding: 5px 15px;
  transition: all 0.2s;
}

.center-btn.active .upload-btn-container,
.center-btn:hover .upload-btn-container {
    background-color: #409EFF;
    color: white;
}

.upload-icon {
    font-size: 26px !important;
}


/* Mobile (Default / Bottom Tab) */
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
  .navbar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 70px; /* Increased height for better centering */
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  .upload-btn-container {
      background-color: transparent;
      padding: 10px; /* Increased padding for larger hover area */
      border-radius: 50%; /* Circular hover effect */
  }
  
  .upload-btn-container .upload-icon {
      background-color: #409EFF;
      color: white;
      border-radius: 50%;
      width: 40px; /* Reduced size */
      height: 40px; /* Reduced size */
      margin-bottom: 0; /* Removing bottom margin to center perfectly */
      display: flex; /* Flex required for icon centering */
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 8px rgba(64, 158, 255, 0.3);
  }
}

/* Desktop (Side Bar) */
@media (min-width: 769px) {
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    width: 90px;
    height: 100vh;
    border-top: none;
    border-right: 1px solid rgba(0, 0, 0, 0.1);
  }

  .nav-items {
    flex-direction: column;
    justify-content: flex-start;
    padding: 40px 0 20px 0;
    gap: 0; /* Removing gap to control spacing manually */
    box-sizing: border-box; /* Include padding in height calculation to prevent overflow */
  }

  .nav-item {
    height: auto;
    width: 100%;
    padding: 10px 0;
    margin-bottom: 30px; /* Default spacing for top items */
  }

  /* Reordering for Desktop: Home/Edit/Album (0) -> Upload (10) -> Account (11) */
  
  .center-btn {
      order: 10;
      margin-top: auto; /* Pushes everything below it to the bottom */
      margin-bottom: 10px; /* Small space above the separating line */
  }

  /* My Account at the very bottom */
  .my-account-item {
      order: 11;
      margin-top: 0;
      margin-bottom: 0; /* Ensure it stays visible */
      border-top: 1px solid #eee;
      padding-top: 15px; /* Space inside the account area */
      padding-bottom: 0;
      width: 80%;
  }

  .my-account-item .el-avatar {
      margin-bottom: 8px;
  }
  
  .upload-btn-container {
      width: 70px;
      height: 70px;
      border-radius: 20px;
      padding: 5px; /* Reduce padding to prevent overflow */
      box-sizing: border-box; /* Ensure padding includes in width */
  }
}

.nav-badge :deep(.el-badge__content) {
    top: 0;
    right: -2px;
}
</style>
