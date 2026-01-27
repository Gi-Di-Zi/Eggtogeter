import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
    // Modal visibility
    const isUploadModalOpen = ref(false)
    const isDetailModalOpen = ref(false)
    const selectedPhoto = ref<any>(null)

    const openUploadModal = () => {
        isUploadModalOpen.value = true
    }

    const closeUploadModal = () => {
        isUploadModalOpen.value = false
    }

    const openDetailModal = (photo: any) => {
        selectedPhoto.value = photo
        isDetailModalOpen.value = true
    }

    const closeDetailModal = () => {
        isDetailModalOpen.value = false
        selectedPhoto.value = null
    }

    // Trigger to refresh map markers (increment to trigger)
    const mapRefreshTrigger = ref(0)

    // Last uploaded location to fly to
    const lastUploadedLocation = ref<{ lat: number; lng: number } | null>(null)

    const triggerMapRefresh = (lat?: number, lng?: number) => {
        if (lat && lng) {
            lastUploadedLocation.value = { lat, lng }
        }
        mapRefreshTrigger.value++
    }

    return {
        isUploadModalOpen,
        isDetailModalOpen,
        selectedPhoto,
        mapRefreshTrigger,
        lastUploadedLocation,
        openUploadModal,
        closeUploadModal,
        openDetailModal,
        closeDetailModal,
        triggerMapRefresh
    }
})
