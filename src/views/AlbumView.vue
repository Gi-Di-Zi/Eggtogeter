<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAlbumStore } from '@/stores/album'
import { useRouter } from 'vue-router'
import { Plus, VideoPlay, Delete, Share } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CreateAlbumModal from '@/components/CreateAlbumModal.vue'

const albumStore = useAlbumStore()
const router = useRouter()

const showCreateModal = ref(false)

onMounted(async () => {
  await albumStore.fetchAlbums()
})

const handleCreateClick = () => {
  showCreateModal.value = true
}

const handleAlbumCreated = async () => {
  await albumStore.fetchAlbums()
}

const handleViewAlbum = (albumId: string, styleType: string) => {
  if (styleType === 'route_anim') {
    const url = router.resolve({ name: 'album-play', params: { id: albumId } }).href
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    router.push(`/album/${albumId}`)
  }
}

const showShareModal = ref(false)
const shareUrl = ref('')

const handleShareAlbum = (albumId: string) => {
  shareUrl.value = `${window.location.origin}/album/${albumId}/play`
  showShareModal.value = true
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    ElMessage.success('링크가 복사되었습니다!')
    showShareModal.value = false
  } catch (err) {
    ElMessage.error('복사에 실패했습니다.')
  }
}

const handleDeleteAlbum = async (albumId: string, title: string) => {
  try {
    await ElMessageBox.confirm(
      `<p>앨범 <b>"${title}"</b>을(를) 삭제하시겠습니까?</p>
       <p style="color: #f56c6c; font-weight: bold; margin-top: 10px;">
         ⚠️ 삭제 후에는 절대 복구할 수 없습니다.
       </p>`,
      '앨범 영구 삭제',
      {
        confirmButtonText: '삭제',
        cancelButtonText: '취소',
        type: 'warning',
        dangerouslyUseHTMLString: true,
        confirmButtonClass: 'el-button--danger'
      }
    )

    await albumStore.deleteAlbum(albumId)
    ElMessage.success('앨범이 삭제되었습니다.')
  } catch (err) {
    // User cancelled
  }
}

const getStyleLabel = (styleType: string) => {
  switch (styleType) {
    case 'route_anim': return 'Route Animation'
    case 'scroll_view': return 'Scroll Narrative'
    case 'ai_video': return 'AI Video'
    default: return styleType
  }
}
</script>

<template>
  <div class="album-page">
    <h2>무빙 앨범</h2>

    <!-- Create Album Button -->
    <el-button
      type="primary"
      :icon="Plus"
      @click="handleCreateClick"
      class="create-btn"
      size="large"
    >
      무빙 앨범 만들기
    </el-button>

    <el-divider />

    <!-- Album List -->
    <div v-if="albumStore.albums.length > 0" class="album-list">
      <el-card
        v-for="album in albumStore.albums"
        :key="album.id"
        class="album-card"
        shadow="hover"
      >
        <div class="album-header">
          <h3>{{ album.title }}</h3>
          <el-tag size="small">{{ getStyleLabel(album.style_type) }}</el-tag>
        </div>

        <p v-if="album.description" class="album-description">{{ album.description }}</p>

        <div class="album-meta">
          <span>{{ album.content_data.photo_ids?.length || 0 }}장의 사진</span>
          <span class="dot">•</span>
          <span>{{ new Date(album.created_at).toLocaleDateString() }}</span>
        </div>

        <div class="album-actions">
<el-button type="primary" :icon="VideoPlay" @click="handleViewAlbum(album.id, album.style_type)">
            보기
          </el-button>
          <el-button
            type="success"
            :icon="Share"
            @click="handleShareAlbum(album.id)"
            plain
          >
            공유
          </el-button>
          <el-button
            type="danger"
            :icon="Delete"
            @click="handleDeleteAlbum(album.id, album.title)"
            plain
          >
            삭제
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- Empty State -->
    <el-empty v-else description="생성된 앨범이 없습니다." :image-size="120" />

    <!-- Create Album Modal -->
    <CreateAlbumModal v-model="showCreateModal" @created="handleAlbumCreated" />

    <!-- Share Modal -->
    <el-dialog
      v-model="showShareModal"
      title="앨범 공유"
      width="400px"
      align-center
    >
      <p style="margin-bottom: 10px;">아래 링크를 복사하여 공유하세요.</p>
      <el-input v-model="shareUrl" readonly>
        <template #append>
          <el-button @click="copyToClipboard">복사</el-button>
        </template>
      </el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showShareModal = false">닫기</el-button>
          <el-button type="primary" @click="copyToClipboard">링크 복사</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.album-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.create-btn {
  width: 100%;
  height: 60px;
  font-size: 16px;
}

.album-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.album-card {
  transition: transform 0.2s;
}

.album-card:hover {
  transform: translateY(-2px);
}

.album-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.album-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.album-description {
  color: #606266;
  margin: 10px 0;
  font-size: 0.9rem;
}

.album-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 0.85rem;
  margin-bottom: 15px;
}

.dot {
  color: #DCDFE6;
}

.album-actions {
  display: flex;
  gap: 10px;
}

.album-actions .el-button {
  flex: 1;
}
</style>
