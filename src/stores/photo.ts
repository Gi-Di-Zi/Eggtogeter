import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Photo {
    id: string
    created_at: string
    storage_path?: string
    latitude: number
    longitude: number
    address?: string
    taken_at?: string
    description?: string
    title?: string
    user_id: string
    publicUrl?: string
    category_color?: string
    category_name?: string
    category_ids?: number[]
    visibility?: 'public' | 'friends' | 'private'
}

export const usePhotoStore = defineStore('photo', () => {
    const photos = ref<Photo[]>([])
    const filterDateRange = ref<[Date, Date] | null>(null)
    // Changed to string | number to support user filtering (e.g., "user:uuid")
    const filterCategoryId = ref<string | number | null>(null)
    const searchQuery = ref('')
    const viewMode = ref<'list' | 'grid' | 'compact'>('list')
    const displayLimit = ref(20)
    const hiddenPhotoIds = ref<Set<string>>(new Set())
    const loading = ref(false)

    // Getters
    const filteredPhotos = computed(() => {
        let result = photos.value

        // 1. Date Filter
        if (filterDateRange.value) {
            const [start, end] = filterDateRange.value
            const endOfDay = new Date(end)
            endOfDay.setHours(23, 59, 59, 999)

            result = result.filter(photo => {
                const dateStr = photo.taken_at || photo.created_at
                const date = new Date(dateStr)
                return date >= start && date <= endOfDay
            })
        }

        // 2. Search Filter
        if (searchQuery.value.trim()) {
            const query = searchQuery.value.toLowerCase()
            result = result.filter(photo =>
                (photo.title && photo.title.toLowerCase().includes(query)) ||
                (photo.address && photo.address.toLowerCase().includes(query)) ||
                (photo.description && photo.description.toLowerCase().includes(query)) ||
                (photo.category_name && photo.category_name.toLowerCase().includes(query))
            )
        }

        // 3. Category/User Filter
        if (filterCategoryId.value) {
            const filterValue = filterCategoryId.value
            if (typeof filterValue === 'string' && filterValue.startsWith('user:')) {
                // User-based filter (Friend's photos)
                const userId = filterValue.substring(5) // Remove "user:" prefix
                result = result.filter(photo => photo.user_id === userId)
            } else if (typeof filterValue === 'number') {
                // Category-based filter
                result = result.filter(photo => {
                    if (!photo.category_ids || photo.category_ids.length === 0) return false
                    return photo.category_ids.includes(filterValue)
                })
            }
        }

        return result
    })

    const mapPhotos = computed(() => {
        return filteredPhotos.value.filter(photo => !hiddenPhotoIds.value.has(photo.id))
    })

    const displayedPhotos = computed(() => {
        return filteredPhotos.value.slice(0, displayLimit.value)
    })

    // Actions
    const fetchPhotos = async (userId?: string, includeShared: boolean = false) => {
        if (!userId) return

        loading.value = true
        try {
            let query = supabase
                .from('photos')
                .select('*, photo_categories(category_id, categories(name, color, is_favorite))')
                .order('taken_at', { ascending: false })

            // If NOT including shared (Edit Mode), filter by user_id
            if (!includeShared) {
                query = query.eq('user_id', userId)
            }
            // If including shared (Home Mode), no user_id filter -> RLS handles permissions

            const { data, error } = await query

            if (error) throw error

            if (data) {
                photos.value = data.map((photo: any) => {
                    let publicUrl: string | undefined = undefined

                    if (photo.storage_path) {
                        const { data: { publicUrl: url } } = supabase.storage
                            .from('photos')
                            .getPublicUrl(photo.storage_path)
                        publicUrl = url
                    }

                    let color: string | undefined = undefined
                    let name: string | undefined = undefined
                    const categoryIds: number[] = []

                    // 1. Check if it's a friend's photo AND we are in shared mode
                    // (Though logic works anyway, styling applies if not mine)
                    if (photo.user_id !== userId) {
                        name = '친구의 사진'
                        // Deterministic color from user_id
                        let hash = 0;
                        for (let i = 0; i < photo.user_id.length; i++) {
                            hash = photo.user_id.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
                        color = '#' + '00000'.substring(0, 6 - c.length) + c;
                    }
                    // 2. Otherwise use existing category logic
                    else if (photo.photo_categories && photo.photo_categories.length > 0) {
                        photo.photo_categories.forEach((pc: any) => {
                            if (pc.category_id) categoryIds.push(pc.category_id)

                            if (pc.categories) {
                                // Priority: Favorite > First regular
                                if (pc.categories.is_favorite) {
                                    color = '#FFD700'
                                    name = pc.categories.name
                                } else if (!color) {
                                    color = pc.categories.color
                                    name = pc.categories.name
                                }
                            }
                        })
                    }

                    return {
                        ...photo,
                        publicUrl,
                        category_color: color,
                        category_name: name,
                        category_ids: categoryIds
                    }
                })
            }
        } catch (err) {
            console.error('Error fetching photos:', err)
        } finally {
            loading.value = false
        }
    }

    const updatePhotoCategory = (photoId: string, color?: string, name?: string) => {
        const photo = photos.value.find(p => p.id === photoId)
        if (photo) {
            photo.category_color = color
            photo.category_name = name
        }
    }

    const updatePhotoVisibility = async (photoId: string, visibility: 'public' | 'friends' | 'private' | 'specific', targetUserIds: string[] = []) => {
        // Optimistic update
        const photo = photos.value.find(p => p.id === photoId)
        if (photo) photo.visibility = visibility as any // Type cast if needed until type is fully updated

        // 1. Update Visibility Column
        const { error } = await supabase
            .from('photos')
            .update({ visibility })
            .eq('id', photoId)

        if (error) {
            console.error('Error updating visibility:', error)
            return
        }

        // 2. Handle Specific Shares
        if (visibility === 'specific') {
            // clear existing
            const { error: delError } = await supabase
                .from('photo_shares')
                .delete()
                .eq('photo_id', photoId)

            if (delError) {
                console.error('Error clearing shares:', delError)
            }

            // insert new
            if (targetUserIds.length > 0) {
                const shares = targetUserIds.map(uid => ({
                    photo_id: photoId,
                    user_id: uid
                }))

                const { error: insError } = await supabase
                    .from('photo_shares')
                    .insert(shares)

                if (insError) {
                    console.error('Error inserting shares:', insError)
                }
            }
        }
    }

    const setFilterCategoryId = (id: string | number | null) => {
        filterCategoryId.value = id
        displayLimit.value = 20
    }

    const setFilterDateRange = (range: [Date, Date] | null) => {
        filterDateRange.value = range
        displayLimit.value = 20 // Reset limit on filter change
    }

    const setSearchQuery = (query: string) => {
        searchQuery.value = query
        displayLimit.value = 20 // Reset limit on filter change
    }

    const loadMore = () => {
        displayLimit.value += 20
    }

    const setViewMode = (mode: 'list' | 'grid' | 'compact') => {
        viewMode.value = mode
    }

    const toggleVisibility = (id: string) => {
        if (hiddenPhotoIds.value.has(id)) {
            hiddenPhotoIds.value.delete(id)
        } else {
            hiddenPhotoIds.value.add(id)
        }
    }

    const setAllVisibility = (visible: boolean) => {
        if (visible) {
            hiddenPhotoIds.value.clear()
        } else {
            // Hide all current filtered photos
            filteredPhotos.value.forEach(p => hiddenPhotoIds.value.add(p.id))
        }
    }

    const isVisible = (id: string) => !hiddenPhotoIds.value.has(id)

    return {
        photos,
        filterDateRange,
        filterCategoryId,
        searchQuery,
        viewMode,

        displayLimit,
        loading,
        filteredPhotos,
        mapPhotos,
        displayedPhotos,
        fetchPhotos,
        updatePhotoCategory,
        updatePhotoVisibility,
        setFilterCategoryId,
        setFilterDateRange,
        setSearchQuery,
        loadMore,
        setViewMode,
        toggleVisibility,
        setAllVisibility,
        isVisible
    }
})
