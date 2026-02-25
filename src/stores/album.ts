import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

type TransitionMode = 'walk' | 'car' | 'bus' | 'subway' | 'train' | 'airplane' | 'ship' | 'none'

type AlbumTransition = {
    from: string
    to: string
    mode: TransitionMode
}

type AlbumSettings = {
    bgm?: string
    template?: string
    mapTheme?: string
    playbackSpeed?: number
    photoFrameStyles?: Record<string, string>
    [key: string]: unknown
}

type AlbumContent = {
    photo_ids: string[]
    transitions?: AlbumTransition[]
    settings?: AlbumSettings
}

export interface Album {
    id: string
    user_id: string
    title: string
    description: string | null
    style_type: 'route_anim' | 'scroll_view' | 'ai_video'
    is_public: boolean
    content_data: AlbumContent
    video_url: string | null
    created_at: string
    updated_at: string
}

const isMissingRpcError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false

    const maybeError = error as { code?: unknown; message?: unknown }
    const code = typeof maybeError.code === 'string' ? maybeError.code : ''
    const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : ''

    return code === 'PGRST202' || message.includes('get_public_album_photos')
}

const sortPhotosByAlbumOrder = <T extends { id: string }>(photoIds: string[], rows: T[]): T[] => {
    const rowById = new Map(rows.map((row) => [row.id, row]))
    return photoIds
        .map((id) => rowById.get(id))
        .filter((row): row is T => !!row)
}

export const useAlbumStore = defineStore('album', () => {
    const authStore = useAuthStore()

    const albums = ref<Album[]>([])
    const currentAlbum = ref<Album | null>(null)
    const loading = ref(false)

    async function fetchAlbums() {
        if (!authStore.user?.id) return

        loading.value = true
        try {
            const { data, error } = await supabase
                .from('albums')
                .select('*')
                .eq('user_id', authStore.user.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            albums.value = data || []
        } catch (err) {
            console.error('Error fetching albums:', err)
            albums.value = []
        } finally {
            loading.value = false
        }
    }

    async function fetchAlbumById(albumId: string, publicMode = false) {
        loading.value = true
        try {
            let query = supabase
                .from('albums')
                .select('*')
                .eq('id', albumId)

            if (publicMode) {
                query = query.eq('is_public', true)
            }

            const { data, error } = await query.single()

            if (error) throw error

            currentAlbum.value = data
            return data as Album
        } catch (err) {
            console.error('Error fetching album:', err)
            currentAlbum.value = null
            return null
        } finally {
            loading.value = false
        }
    }

    async function createAlbum(
        title: string,
        styleType: Album['style_type'],
        photoIds: string[],
        description?: string,
        settings?: Album['content_data']['settings'],
        transitions?: Album['content_data']['transitions']
    ) {
        if (!authStore.user?.id) return null

        loading.value = true
        try {
            const { data, error } = await supabase
                .from('albums')
                .insert({
                    user_id: authStore.user.id,
                    title,
                    description: description || null,
                    style_type: styleType,
                    is_public: true,
                    content_data: {
                        photo_ids: photoIds,
                        settings: settings || {},
                        transitions: transitions || []
                    }
                })
                .select()
                .single()

            if (error) throw error

            albums.value.unshift(data)
            return data as Album
        } catch (err) {
            console.error('Error creating album:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    async function updateAlbum(
        albumId: string,
        updates: Partial<Pick<Album, 'title' | 'description' | 'is_public' | 'content_data' | 'video_url'>>
    ) {
        if (!authStore.user?.id) return null

        loading.value = true
        try {
            const { data, error } = await supabase
                .from('albums')
                .update(updates)
                .eq('id', albumId)
                .eq('user_id', authStore.user.id)
                .select()
                .single()

            if (error) throw error

            const index = albums.value.findIndex((album) => album.id === albumId)
            if (index !== -1) {
                albums.value[index] = data
            }
            if (currentAlbum.value?.id === albumId) {
                currentAlbum.value = data
            }

            return data as Album
        } catch (err) {
            console.error('Error updating album:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    async function deleteAlbum(albumId: string) {
        if (!authStore.user?.id) return

        loading.value = true
        try {
            const { error } = await supabase
                .from('albums')
                .delete()
                .eq('id', albumId)
                .eq('user_id', authStore.user.id)

            if (error) throw error

            albums.value = albums.value.filter((album) => album.id !== albumId)
            if (currentAlbum.value?.id === albumId) {
                currentAlbum.value = null
            }
        } catch (err) {
            console.error('Error deleting album:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    async function fetchAlbumPhotos(albumId: string, publicMode = false) {
        const album = await fetchAlbumById(albumId, publicMode)

        if (!album || !Array.isArray(album.content_data?.photo_ids) || album.content_data.photo_ids.length === 0) {
            return []
        }

        loading.value = true
        try {
            if (publicMode) {
                const { data, error } = await supabase.rpc('get_public_album_photos', { p_album_id: albumId })

                if (!error && Array.isArray(data)) {
                    return sortPhotosByAlbumOrder(album.content_data.photo_ids, data as { id: string }[])
                }

                if (error && !isMissingRpcError(error)) {
                    console.error('Failed to fetch public photos via RPC', error)
                }
            }

            const { data, error } = await supabase
                .from('photos')
                .select('*')
                .in('id', album.content_data.photo_ids)

            if (error) throw error

            return sortPhotosByAlbumOrder(album.content_data.photo_ids, (data || []) as { id: string }[])
        } catch (error) {
            console.error('Failed to fetch album photos', error)
            return []
        } finally {
            loading.value = false
        }
    }

    async function updateVideoUrl(albumId: string, videoUrl: string) {
        return updateAlbum(albumId, { video_url: videoUrl })
    }

    return {
        albums,
        currentAlbum,
        loading,
        fetchAlbums,
        fetchAlbumById,
        fetchAlbumPhotos,
        createAlbum,
        updateAlbum,
        deleteAlbum,
        updateVideoUrl
    }
})
