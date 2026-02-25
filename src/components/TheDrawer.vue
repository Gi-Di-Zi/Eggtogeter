<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CaretRight } from '@element-plus/icons-vue'

const route = useRoute()

// Drawer visibility based on route
const isOpen = computed(() => {
  return ['/edit', '/album', '/', '/friends'].includes(route.path)
})

// Collapsed state
const isCollapsed = ref(false)

// Auto-expand when route changes (entry)
watch(() => route.path, (newPath) => {
  if (['/edit', '/album', '/', '/friends'].includes(newPath)) {
    isCollapsed.value = false
  }
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="drawer-container" :class="{ open: isOpen, collapsed: isCollapsed }">
    <!-- Handle -->
    <div class="drawer-handle" @click="toggleCollapse">
        <el-icon class="handle-icon" :class="{ 'rotate-desktop': true }">
            <CaretRight />
        </el-icon>
    </div>

    <!-- Content -->
    <div class="drawer-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<style scoped>
.drawer-container {
  position: fixed;
  background-color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 900; /* Lower than NavBar (1000) */
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: visible; /* Allow handle to stick out */
}

/* Common Handle Styles */
.drawer-handle {
  position: absolute;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 901;
  color: #909399; /* Neutral gray for icon */
  transition: color 0.2s;
}

.drawer-handle:hover {
    color: #409EFF;
}

.handle-icon {
    font-size: 16px;
    transition: transform 0.3s ease;
}

.drawer-container:not(.open) {
  /* Hide completely when not on valid route */
  pointer-events: none;
  opacity: 0;
} 

.drawer-content {
  height: 100%;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: hidden; /* Let child views manage scrolling */
}

/* Mobile: Bottom Sheet */
@media (max-width: 768px) {
  .drawer-container {
    bottom: 70px; /* Navbar height */
    left: 0;
    width: 100%;
    height: 40vh;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    transform: translateY(110%); /* Hidden by default */
  }

  .drawer-container.open {
    transform: translateY(0);
  }

  .drawer-container.open.collapsed {
    transform: translateY(calc(100% - 24px)); 
  }

  /* Mobile Handle: Top Center */
  .drawer-handle {
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 24px;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
  }

  /* Mobile Rotation Logic */
  /* Default (Open): Point Down (Collapse direction) -> Rotate 90deg */
  .drawer-container.open .handle-icon {
      transform: rotate(90deg);
  }
  
  /* Collapsed: Point Up (Expand direction) -> Rotate -90deg */
  .drawer-container.open.collapsed .handle-icon {
       transform: rotate(-90deg);
  }

  .drawer-content {
      padding: 12px 12px 10px 12px; /* Restore slight bottom padding */
  }
}

/* Desktop: Left Sidebar Panel */
@media (min-width: 769px) {
  .drawer-container {
    top: 0;
    left: 90px; /* Sidebar width */
    width: 400px;
    height: 100vh;
    border-right: 1px solid rgba(0,0,0,0.05);
    background: rgba(255, 255, 255, 0.98);
    transform: translateX(-110%); /* Hidden by default (Left) */
  }

  .drawer-container.open {
    transform: translateX(0);
  }

  .drawer-container.open.collapsed {
    transform: translateX(-100%);
  }

  /* Desktop Handle: Right Center */
  .drawer-handle {
    right: -24px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 60px;
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  /* Desktop Rotation Logic */
  /* Default (Open): Point Left (Collapse direction) -> Rotate 180deg */
  .drawer-container.open .handle-icon {
      transform: rotate(180deg);
  }

  /* Collapsed: Point Right (Expand direction) -> Rotate 0deg */
  .drawer-container.open.collapsed .handle-icon {
      transform: rotate(0deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
