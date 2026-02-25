<script setup lang="ts">



interface Props {
  currentPhoto: any | null
  showDateOverlay: boolean
  displayDate: string
  frameStyle?: 'classic' | 'vintage' | 'neon' | 'gradient' | 'retro' | 'modern'
}

const props = withDefaults(defineProps<Props>(), {
  frameStyle: 'classic'
})
</script>

<template>
  <div class="overlay-container">
    <!-- 1. Photo Overlay with Dynamic Frame Style -->
    <transition name="pop-in">
      <div v-if="currentPhoto" class="polaroid-wrapper">
        <div :class="['photo-frame', `frame-${frameStyle}`]">
          <div class="photo-area">
             <img :src="currentPhoto.publicUrl" class="photo-img" />
          </div>
          <div class="caption-area">
             <h3 v-if="currentPhoto.title" class="location-title">{{ currentPhoto.title }}</h3>
             <h3 v-else-if="false" class="location-title">hidden</h3> <!-- Fallback removed -->
             <h3 v-else class="location-title no-data">No Title</h3>
             
             <span class="date">{{ new Date(currentPhoto.taken_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span>
             
             <p v-if="currentPhoto.description" class="description">{{ currentPhoto.description }}</p>
             <p v-else class="description no-data">No Description</p>
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
/* Photo Frame Styles (Polaroid-inspired) */
.photo-frame {
  background: white;
  border: 20px solid #ffffff;
  padding: 15px;
  padding-bottom: 60px;
  box-shadow: 0 15px 40px rgba(0,0,0,0.3);
  position: relative;
}

/*  1. Classic Polaroid (기본 폴라로이드) */
.frame-classic {
  background: #faf9f6; /* 크림색 배경 */
  border: 15px solid #ffffff;
  padding: 12px;
  padding-bottom: 55px;
  box-shadow: 
    0 8px 20px rgba(0,0,0,0.2),
    0 3px 8px rgba(0,0,0,0.15);
  transform: rotate(-2deg);
  animation: float 6s ease-in-out infinite;
}

/* 2. Vintage (빈티지 세피아) */
.frame-vintage {
  background: linear-gradient(135deg, #f4e1c1 0%, #e6d5b8 100%); /* 세피아 그라데이션 */
  border: 18px solid #d4c5a9;
  padding: 14px;
  padding-bottom: 60px;
  box-shadow: 
    0 12px 30px rgba(101, 67, 33, 0.4),
    inset 0 0 10px rgba(101, 67, 33, 0.1); /* 안쪽 그림자로 빈티지 느낌 */
  transform: rotate(1.5deg);
  filter: sepia(0.15) contrast(1.05);
  animation: float 7s ease-in-out infinite;
}

/* 3. Neon (네온 글로우) */
.frame-neon {
  background: #1a1a2e; /* 다크 배경 */
  border: 8px solid transparent;
  background-image: 
    linear-gradient(#1a1a2e, #1a1a2e),
    linear-gradient(45deg, #ff0080, #ff8c00, #40e0d0, #ff0080); /* 네온 그라데이션 */
  background-origin: border-box;
  background-clip: padding-box, border-box;
  padding: 16px;
  padding-bottom: 65px;
  box-shadow: 
    0 0 30px rgba(255, 0, 128, 0.6),
    0 0 50px rgba(64, 224, 208, 0.4),
    0 15px 40px rgba(0,0,0,0.5);
  transform: rotate(0deg);
  animation: neon-pulse 2s ease-in-out infinite, float 5s ease-in-out infinite;
}

@keyframes neon-pulse {
  0%, 100% { 
    box-shadow: 
      0 0 30px rgba(255, 0, 128, 0.6),
      0 0 50px rgba(64, 224, 208, 0.4),
      0 15px 40px rgba(0,0,0,0.5);
  }
  50% { 
    box-shadow: 
      0 0 50px rgba(255, 0, 128, 0.8),
      0 0 80px rgba(64, 224, 208, 0.6),
      0 15px 40px rgba(0,0,0,0.5);
  }
}

/* 4. Gradient (그라데이션 무지개) */
.frame-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%);
  border: none;
  padding: 4px; /* 얇은 패딩으로 그라데이션 테두리 효과 */
  box-shadow: 
    0 15px 50px rgba(102, 126, 234, 0.5),
    0 8px 25px rgba(118, 75, 162, 0.3);
  transform: rotate(-1deg);
  animation: float 6s ease-in-out infinite, gradient-rotate 8s linear infinite;
}

.frame-gradient .photo-area {
  background: white;
  padding: 12px;
  padding-bottom: 55px;
}

@keyframes gradient-rotate {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

/* 5. Retro (레트로 그루브) */
.frame-retro {
  background: 
    repeating-linear-gradient(
      45deg,
      #ff6b6b,
      #ff6b6b 10px,
      #feca57 10px,
      #feca57 20px,
      #48dbfb 20px,
      #48dbfb 30px,
      #ff9ff3 30px,
      #ff9ff3 40px
    );
  border: 15px solid #ffffff;
  padding: 18px;
  padding-bottom: 70px;
  box-shadow: 
    8px 8px 0 rgba(255, 107, 107, 0.4),
    16px 16px 0 rgba(254, 202, 87, 0.3),
    24px 24px 0 rgba(72, 219, 251, 0.2);
  transform: rotate(2deg);
  animation: float 5s ease-in-out infinite;
}

/* 6. Modern (모던 미니멀) */
.frame-modern {
  background: #ffffff;
  border: 2px solid #e0e0e0;
  padding: 20px;
  padding-bottom: 70px;
  box-shadow: 
    0 20px 60px rgba(0,0,0,0.15),
    0 8px 20px rgba(0,0,0,0.1);
  transform: rotate(0deg);
  border-radius: 8px;
  animation: none; /* 미니멀하게 애니메이션 제거 */
}

.frame-modern::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border: 1px solid rgba(0,0,0,0.05);
  border-radius: 6px;
  pointer-events: none;
}
.photo-area {
  width: 400px; /* Increased from 290px */
  height: 400px; /* Increased from 290px */
  background: #eee;
  overflow: hidden;
  margin-bottom: 20px;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.caption-area {
  font-family: 'Courier New', Courier, monospace;
  color: #333;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.location-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  color: #000;
}
.description {
  font-size: 1.0rem;
  font-weight: normal;
  margin: 5px 0 0 0;
  color: #444;
  white-space: pre-wrap; /* Preserve line breaks */
}
.no-data {
    color: #999;
    font-style: italic;
    font-weight: 300;
}
.date {
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
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

/* Black Fade Overlay (For 'none' mode transitions) */
.black-fade-overlay {
  background: rgba(0,0,0,1);
  position: absolute;
  inset: 0;
  z-index: 25; /* Above photo overlay */
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
