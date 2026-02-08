import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

export interface Album {
    id: string
    user_id: string
    title: string
    description: string | null
    style_type: 'route_anim' | 'scroll_view' | 'ai_video'
    is_public: boolean
    content_data: {
        photo_ids: string[]
        transitions?: {
            from: string
            to: string
            mode: 'walk' | 'car' | 'bus' | 'subway' | 'train' | 'airplane' | 'ship' | 'none'
        }[]
        settings?: {
            bgm?: string
            template?: string
            [key: string]: any
        }
    }
    video_url: string | null
    created_at: string
    updated_at: string
}

export const useAlbumStore = defineStore('album', () => {
    const authStore = useAuthStore()

    const albums = ref<Album[]>([])
    const currentAlbum = ref<Album | null>(null)
    const loading = ref(false)

    // 내 앨범 목록 가져오기
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

    // 특정 앨범 가져오기 (ID 기준) - 공개 앨범 지원
    async function fetchAlbumById(albumId: string, publicMode = false) {
        loading.value = true
        try {
            let query = supabase
                .from('albums')
                .select('*')
                .eq('id', albumId)

            // Public mode: only fetch if is_public is true
            if (publicMode) {
                query = query.eq('is_public', true)
            }

            const { data, error } = await query.single()

            if (error) throw error

            currentAlbum.value = data
            return data
        } catch (err) {
            console.error('Error fetching album:', err)
            currentAlbum.value = null
            return null
        } finally {
            loading.value = false
        }
    }

    // 앨범 생성
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
                    is_public: true, // Default to public for easy sharing
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
            return data
        } catch (err) {
            console.error('Error creating album:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    // 앨범 수정
    async function updateAlbum(
        albumId: string,
        updates: Partial<Pick<Album, 'title' | 'description' | 'is_public' | 'content_data'>>
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

            // Update local state
            const index = albums.value.findIndex(a => a.id === albumId)
            if (index !== -1) {
                albums.value[index] = data
            }
            if (currentAlbum.value?.id === albumId) {
                currentAlbum.value = data
            }

            return data
        } catch (err) {
            console.error('Error updating album:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    // 앨범 삭제
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

            // Remove from local state
            albums.value = albums.value.filter(a => a.id !== albumId)
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

    // 앨범 내 사진 상세 정보 가져오기
    async function fetchAlbumPhotos(albumId: string, publicMode = false) {
        console.log('[fetchAlbumPhotos] albumId:', albumId, 'publicMode:', publicMode)
        const album = await fetchAlbumById(albumId, publicMode)
        console.log('[fetchAlbumPhotos] album:', album)

        if (!album || !album.content_data.photo_ids || album.content_data.photo_ids.length === 0) {
            console.log('[fetchAlbumPhotos] No photo_ids in album')
            return []
        }
        loading.value = true
        try {
            // [New] Public Mode: use Secure RPC to bypass RLS
            if (publicMode) {
                const { data, error } = await supabase.rpc('get_public_album_photos', { p_album_id: albumId })

                if (error) {
                    console.error('Failed to fetch public photos via RPC', error)
                    return []
                }
                return data || []
            }

            // Standard Mode (Private/Authenticated)
            const album = await fetchAlbumById(albumId, false) // fetchAlbumById handles its own loading state
            if (!album || !album.content_data.photo_ids || album.content_data.photo_ids.length === 0) {
                return []
            }

            const { data, error } = await supabase
                .from('photos')
                .select('*')
                .in('id', album.content_data.photo_ids)

            if (error) throw error

            // Sort by album order
            const sorted = album.content_data.photo_ids
                .map((id: string) => data.find((p: any) => p.id === id))
                .filter((p: any) => !!p)

            return sorted
        } catch (e) {
            console.error('Failed to fetch album photos', e)
            return []
        } finally {
            loading.value = false
        }
    }

    // AI Video URL 업데이트
    async function updateVideoUrl(albumId: string, videoUrl: string) {
        return updateAlbum(albumId, { video_url: videoUrl } as any)
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
