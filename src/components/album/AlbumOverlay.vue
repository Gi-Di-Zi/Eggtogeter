<script setup lang="ts">


interface Props {
  currentPhoto: any | null
  showDateOverlay: boolean
  displayDate: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="overlay-container">
    <!-- 1. Polaroid Photo Overlay -->
    <transition name="pop-in">
      <div v-if="currentPhoto" class="polaroid-wrapper">
        <div class="polaroid-frame">
          <div class="photo-area">
             <img :src="currentPhoto.publicUrl" class="photo-img" />
          </div>
          <div class="caption-area">
             <p class="description">{{ currentPhoto.description || 'No Description' }}</p>
             <span class="date">{{ new Date(currentPhoto.taken_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 2. Date Transition Overlay -->
    <transition name="fade">
      <div v-if="showDateOverlay" class="date-overlay">
         <div class="date-card">
            <h1>{{ displayDate }}</h1>
            <div class="line"></div>
         </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.overlay-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
}

/* Polaroid Style */
.polaroid-wrapper {
  perspective: 1000px;
}
.polaroid-frame {
  background: white;
  padding: 15px 15px 40px 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  transform: rotate(-3deg) scale(1);
  animation: float 6s ease-in-out infinite;
  max-width: 320px;
  text-align: center;
}
.photo-area {
  width: 290px;
  height: 290px;
  background: #eee;
  overflow: hidden;
  margin-bottom: 15px;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.caption-area {
  font-family: 'Courier New', Courier, monospace;
  color: #333;
}
.description {
  font-size: 1.1rem;
  font-weight: bold;
  margin: 0;
}
.date {
  font-size: 0.8rem;
  color: #666;
}

/* Date Overlay */
.date-overlay {
  background: rgba(0,0,0,0.7);
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.date-card {
  color: white;
  text-align: center;
}
.date-card h1 {
  font-size: 3rem;
  font-weight: 300;
  letter-spacing: 2px;
}

/* Transitions */
.pop-in-enter-active {
  animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.pop-in-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.pop-in-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

@keyframes popIn {
  0% { opacity: 0; transform: scale(0.5) translateY(50px) rotate(10deg); }
  100% { opacity: 1; transform: scale(1) translateY(0) rotate(-3deg); }
}

@keyframes float {
  0%, 100% { transform: rotate(-3deg) translateY(0); }
  50% { transform: rotate(-3deg) translateY(-10px); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
