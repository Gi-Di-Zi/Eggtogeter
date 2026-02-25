<template>
  <div class="album-timeline-container" ref="containerRef">
    <div class="timeline-scroll-area">
      <div class="timeline-track" :class="{ 'is-zigzag': isZigzag }">
        <!-- Rows for Snaking Layout -->
        <template v-for="(rowItems, rIdx) in timelineRows" :key="rIdx">
          <div 
            class="timeline-row"
            :class="{ 'row-reverse': rIdx % 2 === 1 }"
          >
            <div 
              v-for="item in rowItems" 
              :key="item.type === 'photo' ? item.data.id : 'seg-'+item.fromIndex"
              class="timeline-item"
              :class="['type-' + item.type, { active: currentPhotoIndex === (item.type === 'photo' ? item.photoIndex : -1) }]"
              :style="getItemStyle(item)"
              @click="item.type === 'photo' ? onPhotoClick(item.photoIndex) : null"
            >
              <!-- Photo Node -->
              <template v-if="item.type === 'photo'">
                <div class="date-group-label" v-if="item.isNewDate">
                  {{ formatDate(item.data.taken_at) }}
                </div>
                
                <div class="node-content">
                  <div class="node-marker" :class="{ 'has-image': !!item.data.publicUrl }">
                     <img 
                       v-if="item.data.publicUrl" 
                       :src="item.data.publicUrl" 
                       class="node-thumb" 
                       alt="thumb"
                     />
                     <el-icon v-else><CameraFilled /></el-icon>
                  </div>
                  <div class="time-label">{{ formatTime(item.data.taken_at) }}</div>
                </div>
              </template>

              <!-- Segment (Connector) -->
              <template v-else-if="item.type === 'segment'">
                <div class="segment-line">
                  <div class="segment-info">
                    <el-icon v-if="item.mode === 'walk'"><User /></el-icon> 
                    <el-icon v-else-if="item.mode === 'bicycle'"><Bicycle /></el-icon> 
                    <el-icon v-else-if="item.mode === 'airplane'"><Promotion /></el-icon> 
                    <BusIcon v-else-if="item.mode === 'bus'" />
                    <SubwayIcon v-else-if="item.mode === 'subway'" />
                    <el-icon v-else-if="['ship', 'boat', 'ferry'].includes(item.mode)"><Ship /></el-icon> 
                    <CarIcon v-else-if="item.mode === 'car'" />
                    <el-icon v-else><Van /></el-icon>
                    <span class="dist-text">{{ item.distance.toFixed(1) }}km</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
          
          <!-- Row Connector (Vertical for snaking) - Now sibling of timeline-row -->
          <div v-if="rIdx < timelineRows.length - 1" class="row-v-connector" :class="{ 'connector-reverse': rIdx % 2 === 1 }">
            <!-- Display transport mode and distance if connector data exists -->
            <div v-if="rowConnectors[rIdx]" class="connector-info">
              <el-icon v-if="rowConnectors[rIdx].mode === 'walk'"><User /></el-icon> 
              <el-icon v-else-if="rowConnectors[rIdx].mode === 'bicycle'"><Bicycle /></el-icon> 
              <el-icon v-else-if="rowConnectors[rIdx].mode === 'airplane'"><Promotion /></el-icon> 
              <BusIcon v-else-if="rowConnectors[rIdx].mode === 'bus'" />
              <SubwayIcon v-else-if="rowConnectors[rIdx].mode === 'subway'" />
              <el-icon v-else-if="['ship', 'boat', 'ferry'].includes(rowConnectors[rIdx].mode)"><Ship /></el-icon> 
              <CarIcon v-else-if="rowConnectors[rIdx].mode === 'car'" />
              <el-icon v-else><Van /></el-icon>
              <span class="dist-text">{{ rowConnectors[rIdx].distance.toFixed(1) }}km</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type CSSProperties } from 'vue'
import { CameraFilled, Bicycle, Van, Promotion, User, Ship } from '@element-plus/icons-vue'
import { h } from 'vue'

// Custom SVG Icons - Simplified & Larger
const BusIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2.5',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: 'width: 22px; height: 22px; color: #ffd700;'
}, [
  // 버스 몸체 (단순 사각형)
  h('rect', { x: '4', y: '6', width: '16', height: '10', rx: '2' }),
  // 왼쪽 창문
  h('rect', { x: '6', y: '8', width: '4', height: '3', rx: '0.5' }),
  // 오른쪽 창문
  h('rect', { x: '14', y: '8', width: '4', height: '3', rx: '0.5' }),
  // 앞바퀴
  h('circle', { cx: '8', cy: '18', r: '1.5' }),
  // 뒷바퀴
  h('circle', { cx: '16', cy: '18', r: '1.5' })
])

const CarIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2.5',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: 'width: 22px; height: 22px; color: #ffd700;'
}, [
  // 차체 (단순화된 측면 뷰)
  h('path', { d: 'M7 16h10M5 12h14c1 0 2 1 2 2v2H3v-2c0-1 1-2 2-2z' }),
  // 지붕 (더 넓은 곡선 - 승객 공간 확대)
  h('path', { d: 'M8.5 12l1-4h7l1 4' }),
  // 앞바퀴
  h('circle', { cx: '8', cy: '18', r: '1.5' }),
  // 뒷바퀴
  h('circle', { cx: '16', cy: '18', r: '1.5' })
])

const SubwayIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2.5',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: 'width: 22px; height: 22px; color: #ffd700;'
}, [
  // 지하철 몸체 (더 높은 사각형)
  h('rect', { x: '5', y: '5', width: '14', height: '12', rx: '2' }),
  // 왼쪽 창문
  h('circle', { cx: '9', cy: '10', r: '1.5' }),
  // 오른쪽 창문
  h('circle', { cx: '15', cy: '10', r: '1.5' }),
  // 선로 연결부 (좌)
  h('line', { x1: '9', y1: '17', x2: '7', y2: '19' }),
  // 선로 연결부 (우)
  h('line', { x1: '15', y1: '17', x2: '17', y2: '19' })
])

const props = defineProps<{
  photos: any[]
  currentPhotoIndex: number
  segments: any[]
}>()

const emit = defineEmits(['seek'])

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(1000)

// Detect width for layout
onMounted(() => {
  if (containerRef.value) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

// Limit to 17 photos as requested
const displayPhotos = computed(() => {
  return props.photos ? props.photos.slice(0, 17) : []
})

// Build Linear List of Items (Photo -> Segment -> Photo ...)
const timelineItems = computed(() => {
  const items: any[] = []
  if (!displayPhotos.value.length) return items

  let lastDate = ''
  
  displayPhotos.value.forEach((photo, idx) => {
    // Check Date Grouping
    const dateStr = new Date(photo.taken_at).toLocaleDateString()
    const isNewDate = dateStr !== lastDate
    lastDate = dateStr

    // Add Photo Node
    items.push({
      type: 'photo',
      data: photo,
      photoIndex: idx,
      isNewDate
    })

    // Add Segment if not last
    if (idx < displayPhotos.value.length - 1) {
      const seg = props.segments.find((s: any) => s.fromIndex === idx)
      if (seg) {
        items.push({
          type: 'segment',
          distance: seg.distance,
          mode: seg.mode,
          fromIndex: idx
        })
      } else {
         items.push({
          type: 'segment',
          distance: 0,
          mode: 'car',
          fromIndex: idx
        })
      }
    }
  })
  return items
})

// Row-based snaking logic (Dynamic based on width)
const timelineRows = computed(() => {
  const items = timelineItems.value
  
  // Determine ideal rows (1, 2, or 3)
  const totalPhotos = displayPhotos.value.length
  let targetRows = 1
  if (totalPhotos > 10) targetRows = 3
  else if (totalPhotos > 5) targetRows = 2
  
  // Calculate items per row (rounded up to front-load)
  const photosPerRow = Math.ceil(totalPhotos / targetRows)
  
  const rows: any[][] = []
  let currentRow: any[] = []
  let currentPhotoCount = 0

  for (const item of items) {
    // Skip segment if it's the start of a new row (connector replaces it visually)
    if (currentRow.length === 0 && item.type === 'segment' && rows.length > 0) {
        continue; 
    }

    currentRow.push(item)
    
    if (item.type === 'photo') {
        currentPhotoCount++
        if (currentPhotoCount >= photosPerRow) {
            rows.push(currentRow)
            currentRow = []
            currentPhotoCount = 0
        }
    }
  }
  
  if (currentRow.length > 0) {
      rows.push(currentRow)
  }

  return rows
})

// Extract connector data (the segment that connects rows)
const rowConnectors = computed(() => {  const items = timelineItems.value
  const rows = timelineRows.value
  const connectors: any[] = []
  
  // Track which items are in rows
  const itemsInRows = new Set()
  for (const row of rows) {
    for (const item of row) {
      if (item.type === 'photo') {
        itemsInRows.add(item.photoIndex)
      }
    }
  }
  
  // Find segments between row transitions
  let currentRowIdx = 0
  let photosInCurrentRow = 0
  const photosPerRow = rows[0] ? rows[0].filter((i: any) => i.type === 'photo').length : 0
  
  for (const item of items) {
    if (item.type === 'photo') {
      photosInCurrentRow++
      
      // Check if we've completed a row
      if (photosInCurrentRow >= photosPerRow && currentRowIdx < rows.length - 1) {
        photosInCurrentRow = 0
        currentRowIdx++
      }
    } else if (item.type === 'segment') {
      // If this segment is not displayed in any row, it's a connector
      const nextItem = items[items.indexOf(item) + 1]
      if (nextItem && nextItem.type === 'photo' && photosInCurrentRow === 0 && currentRowIdx > 0) {
        connectors.push(item)
      }
    }
  }
  
  return connectors
})

const isZigzag = computed(() => displayPhotos.value.length > 5)

const getItemStyle = (item: any): CSSProperties => {
  if (isZigzag.value) {
     return {
         flex: item.type === 'photo' ? '0 0 60px' : '1 1 50px',
         margin: '0'
     }
  } else {
      return {
          flex: item.type === 'segment' ? '1 1 auto' : '0 0 auto',
          textAlign: 'center'
      }
  }
}

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()}`
}

const onPhotoClick = (idx: number) => {
  emit('seek', idx)
}
</script>

<style scoped>
.album-timeline-container {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 10px 40px; /* Increased side padding for "C-shape" connectors */
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  color: white;
  overflow: hidden; /* Keep hidden to clip border-radius, but inner scroll area handles content */
  border: 1px solid rgba(255,255,255,0.1);
  max-height: 600px; /* Increased to show all 3 rows + connectors */
}

.timeline-scroll-area {
    width: 100%;
    height: 100%;
    overflow-y: auto; /* Internal scroll */
    overflow-x: visible; /* Allow connectors to extend beyond */
    padding: 20px 10px 0 10px; /* Extra internal padding */
    scrollbar-width: none; 
}
.timeline-scroll-area::-webkit-scrollbar { display: none; }

.timeline-track {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.timeline-row {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
  min-height: 80px;
}

.timeline-row.row-reverse {
  flex-direction: row-reverse;
}

/* Row Styling */
/* Row Styling */
.timeline-row {
  display: flex;
  width: 100%;
  position: relative;
  align-items: center;
  justify-content: space-between; /* Ensure items hit the edges for connectors */
  padding: 10px 0; /* Vertical spacing between rows */
}

/* ... existing code ... */

/* Connectors for Snake Layout - Vertical lines with segment-info styling */
.row-v-connector {
  position: relative;
  width: 100%; /* Full width to allow absolute positioning */
  height: 100px; /* Increased for better line visibility */
  margin: -40px auto 0; /* Move upward to avoid covering dates */
  border: none;
  z-index: 1;
  pointer-events: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Vertical line through connector */
.row-v-connector::before {
  content: '';
  position: absolute;
  width: 2px;
  height: 50%;
  background: rgba(255,255,255,0.2);
  top: 30%;
  transform: translateX(-50%);
  z-index: 0;
}

/* Vertical line through connector */
.row-v-connector:not(.connector-reverse)::before {
  right: 30px; /* Fixed pixel instead of 3% for consistent positioning */
}

.row-v-connector.connector-reverse::before {
  left: 30px; /* Fixed pixel instead of 3% for consistent positioning */
}

/* LTR connectors (right side) - Info on left side of line */
.row-v-connector:not(.connector-reverse) {
  margin-right: 0;
}

.row-v-connector:not(.connector-reverse) .connector-info {
  position: absolute;
  right: 0; /* Left of the line */
}

/* RTL connectors (left side) - Info on right side of line */
.row-v-connector.connector-reverse {
  margin-left: 0;
}

.row-v-connector.connector-reverse .connector-info {
  position: absolute;
  left: 0; /* Right of the line */
}

/* Transport mode info - EXACT copy of segment-info styling */
.connector-info {
  position: relative;
  z-index: 1;
  background: #000;
  margin-top: 10px;
  padding: 5px 14px; /* Same as segment-info */
  border-radius: 16px; /* Same as segment-info */
  font-size: 13px; /* Same as segment-info */
  display: flex;
  gap: 8px; /* Same as segment-info */
  align-items: center;
  color: #aaa; /* Same as segment-info */
  border: 1px solid rgba(255,255,255,0.2); /* Same as segment-info */
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5); /* Same as segment-info */
}

.connector-info .el-icon {
  font-size: 18px; /* Same as segment-info */
  color: #ffd700; /* Same as segment-info */
}



.timeline-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.type-photo {
  margin-top: 30px; /* Increased to avoid being too close to labels */
}

/* Photo Node */
.node-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  z-index: 2;
  transition: transform 0.2s;
}
.timeline-item.active .node-content {
  transform: scale(1.1);
}
.timeline-item.active .node-marker {
  color: #ffd700;
  border-color: #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}

.node-marker {
  width: 40px; /* Larger for thumbnail */
  height: 40px;
  border: 2px solid rgba(255,255,255,0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #222;
  transition: all 0.3s;
  font-size: 16px; 
  overflow: hidden; /* Crop image circle */
  position: relative;
}

.node-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.time-label {
  font-size: 10px;
  margin-top: 4px;
  opacity: 0.7;
}

.date-group-label {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  white-space: nowrap;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
}

/* Segment */
.segment-line {
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.2);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.segment-info {
  background: #000;
  padding: 5px 14px; /* Even more padding */
  border-radius: 16px;
  font-size: 13px; /* Larger font-size */
  display: flex;
  gap: 8px; /* Larger gap */
  align-items: center;
  color: #aaa;
  border: 1px solid rgba(255,255,255,0.2);
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5); /* Add depth */
}

.segment-info :deep(.el-icon) {
  font-size: 18px;
  color: #ffd700;
}

/* Custom SVG icons inherit sizing from parent */
.segment-info svg {
  display: inline-block;
  vertical-align: middle;
}

.dist-text {
  color: white;
  font-weight: 700;
}
</style>
