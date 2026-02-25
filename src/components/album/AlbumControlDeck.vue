<template>
  <div class="control-deck-container">
    <!-- Left: Speed Control -->
    <div class="control-group left">
      <span class="label">Speed</span>
      <el-slider 
        v-model="internalSpeed" 
        :min="0.1" 
        :max="5.0" 
        :step="0.1" 
        :show-tooltip="true"
        size="small"
        style="width: 100px;" 
        @change="updateSpeed"
      />
      <span class="value">{{ internalSpeed.toFixed(1) }}x</span>
    </div>

    <!-- Center: Playback Controls (5 Buttons) -->
    <div class="control-group center">
      <el-button circle size="large" @click="$emit('first')" class="nav-btn sub">
         <el-icon><d-arrow-left /></el-icon>
      </el-button>
      
      <el-button circle size="large" @click="$emit('prev')" class="nav-btn sub">
        <el-icon><arrow-left /></el-icon>
      </el-button>

      <el-button circle type="warning" class="play-btn" @click="togglePlay">
        <el-icon v-if="isPlaying" size="24"><video-pause /></el-icon>
        <el-icon v-else size="24"><video-play /></el-icon>
      </el-button>

      <el-button circle size="large" @click="$emit('next')" class="nav-btn sub">
        <el-icon><arrow-right /></el-icon>
      </el-button>
      
      <el-button circle size="large" @click="$emit('last')" class="nav-btn sub">
         <el-icon><d-arrow-right /></el-icon>
      </el-button>
    </div>

    <!-- Right: Settings -->
    <div class="control-group right">
      <el-popover
        trigger="click"
        placement="top-end"
        :width="200"
        popper-class="settings-popover"
      >
        <template #reference>
            <el-button circle text>
                <el-icon :size="20"><setting /></el-icon>
            </el-button>
        </template>
        <div class="settings-menu">
            <div class="menu-item" @click="$emit('open-map-settings')">
                <el-icon><MapLocation /></el-icon>
                <span>Map Style</span>
            </div>
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VideoPlay, VideoPause, ArrowLeft, ArrowRight, DArrowLeft, DArrowRight, Setting, MapLocation } from '@element-plus/icons-vue'

const props = defineProps<{
  isPlaying: boolean
  speed: number
}>()

const emit = defineEmits(['toggle-play', 'prev', 'next', 'first', 'last', 'update:speed', 'open-map-settings'])

const internalSpeed = ref(props.speed)

watch(() => props.speed, (val) => {
  internalSpeed.value = val
})

const togglePlay = () => {
  emit('toggle-play')
}

const updateSpeed = (val: number) => {
  emit('update:speed', val)
}
</script>

<style scoped>
.control-deck-container {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 100%;
  height: 80px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 0 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  pointer-events: auto; /* Ensure clickable */
}

.control-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.control-group.left {
  justify-content: flex-start;
}

.control-group.center {
  justify-content: center;
  gap: 24px;
}

.control-group.right {
  justify-content: flex-end;
}

.label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
  margin-right: 8px;
}

.value {
    font-size: 12px;
    margin-left: 8px;
    width: 30px;
    text-align: right;
}

.play-btn {
  width: 64px;
  height: 64px;
  font-size: 24px;
  box-shadow: 0 4px 15px rgba(255, 165, 0, 0.4);
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
  border: none;
  transition: transform 0.2s;
}

.play-btn:active {
  transform: scale(0.95);
}

.nav-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
}
.nav-btn:hover {
    background: rgba(255,255,255,0.2);
}

/* Element Plus overrides for transparent/dark theme */
:deep(.el-slider__runway) {
    background-color: rgba(255,255,255,0.3);
}
:deep(.el-slider__bar) {
    background-color: #ffd700;
}
:deep(.el-slider__button) {
    border-color: #ffd700;
}

.settings-menu {
    display: flex;
    flex-direction: column;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;
    color: #333;
}

.menu-item:hover {
    background: #f5f7fa;
}

</style>
