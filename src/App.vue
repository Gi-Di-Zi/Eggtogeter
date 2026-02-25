<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import TheNavBar from '@/components/TheNavBar.vue'
import TheDrawer from '@/components/TheDrawer.vue'
import BaseMap from '@/components/BaseMap.vue'
import { User, Loading } from '@element-plus/icons-vue'
import PhotoUploadModal from '@/components/PhotoUploadModal.vue'
import ProfileSetupModal from '@/components/ProfileSetupModal.vue'
import PhotoDetailModal from '@/components/PhotoDetailModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'
import { onMounted, ref, watch, provide } from 'vue'
import { usePhotoStore } from '@/stores/photo'
import { useLocale } from '@/composables/useLocale'
// ... (existing imports)

const { initLocale } = useLocale()

const router = useRouter()
const isRouterReady = ref(false)

// Capture if this is a password recovery flow before Supabase clears the hash
const isRecoveryFlow = window.location.hash.includes('type=recovery')

const authStore = useAuthStore()
const uiStore = useUiStore()
const photoStore = usePhotoStore()
const profileStore = useProfileStore()

// Profile Setup Modal state
const showProfileSetup = ref(false)

// BaseMap Reference for global control
const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null)

// Provide function for child components to open the modal
const openLocationSetup = () => {
    // Deprecated
}
provide('openLocationSetup', openLocationSetup)

const handleUploadSuccess = ({ lat, lng }: { lat: number, lng: number }) => {
  // Trigger map refresh via store with coordinates for flyTo
  uiStore.triggerMapRefresh(lat, lng)
}

// Watch for refresh triggers from global store (Triggered by Upload Success or Manual)
watch(() => uiStore.mapRefreshTrigger, async () => {
    if (authStore.user?.id) {
        // Refresh data via store - Include shared photos
        await photoStore.fetchPhotos(authStore.user.id, true)
    }

    if (baseMapRef.value && uiStore.lastUploadedLocation) {
        baseMapRef.value.flyTo(uiStore.lastUploadedLocation.lat, uiStore.lastUploadedLocation.lng)
    }
})

onMounted(async () => {
  // Initialize Auth
  await authStore.initialize()
  
  // Initialize Locale (IP Detection)
  initLocale()
  
  // Check if profile setup needed
  if (authStore.user?.id) {
    const profile = await profileStore.fetchProfile(authStore.user.id)
    if (profile && !profile.profile_completed) {
      showProfileSetup.value = true
    }
  }
  
  // Wait for Router to resolve initial route (prevents Home flash on Reset Link)
  await router.isReady()
  isRouterReady.value = true
})

const handleProfileSetupComplete = () => {
  // Refresh profile after setup
  if (authStore.user?.id) {
    profileStore.fetchProfile(authStore.user.id)
  }
}

// Watch for profile changes - Removed Location Setup Logic

</script>

<template>
  <!-- Global Loading State -->
  <div v-if="authStore.loading || !isRouterReady || (isRecoveryFlow && !['/update-password', '/login'].includes($route.path))" class="global-loading">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
  </div>

  <!-- Main Content (Only render when Auth is Initialized) -->
  <template v-else>
    <!-- Standalone Layout (Public, No Nav/Sidebar) -->
    <template v-if="$route.meta.layout === 'empty'">
      <RouterView />
    </template>

    <!-- Authenticated Layout -->
    <template v-else-if="authStore.isAuthenticated && !['/login', '/register', '/forgot-password', '/update-password'].includes($route.path)">
        <TheNavBar />
        
        <!-- Persistent Map Layer -->
        <div class="map-layer">
        <BaseMap ref="baseMapRef" />
        </div>

        <!-- Drawer Navigation Layer (Edit / Album / Home / Friends) -->
        <template v-if="['/edit', '/album', '/', '/friends'].includes($route.path)">
        <TheDrawer :key="$route.path">
            <RouterView />
        </TheDrawer>
        <!-- Mobile Floating My Account Button (Visible only on small screens) -->
        <RouterLink to="/my" class="mobile-my-account-btn">
            <el-avatar 
                :size="40" 
                :icon="User" 
                :src="profileStore.profile?.avatar_url || undefined" 
                alt="My" 
            />
        </RouterLink>
        </template>

        <!-- Other Authenticated Views (My Account Desktop, etc) -->
        <template v-else>
        <div class="app-content-overlay">
            <RouterView />
        </div>
        </template>

        <!-- Global Modals -->
        <ProfileSetupModal 
            v-model="showProfileSetup"
            @complete="handleProfileSetupComplete"
        />
        <PhotoUploadModal 
            v-model="uiStore.isUploadModalOpen"
            @upload-success="handleUploadSuccess"
        />
        <PhotoDetailModal 
            v-model="uiStore.isDetailModalOpen"
            :photo="uiStore.selectedPhoto"
        />
    </template>

    <!-- Guest Layout (Login/Register/Reset) -->
    <template v-else>
        <RouterView />
    </template>
  </template>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
#app {
  width: 100%;
  height: 100%;
}

.map-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0; /* Behind everything */
}

.app-content-overlay {
  position: absolute;
  top: 0;
  left: 90px; /* Sidebar offset */
  width: calc(100% - 90px);
  height: 100%;
  pointer-events: auto;
  z-index: 500; /* Above map */
}

.app-content-overlay.pointer-events-none {
    pointer-events: none;
}

@media (max-width: 768px) {
  .app-content-overlay {
    left: 0;
    width: 100%;
    bottom: 70px;
    height: calc(100% - 70px);
  }
}

.mobile-my-account-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2000; /* Higher than drawer/navbar */
  display: none; /* Hidden by default (desktop) */
  cursor: pointer;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 50%;
}

@media (max-width: 768px) {
  .mobile-my-account-btn {
    display: block; /* Visible on mobile */
  }
}

.global-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    background-color: #ffffff;
    font-size: 2rem;
    color: #409EFF;
}
</style>
