import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Profile {
    id: string
    nickname?: string
    avatar_url?: string
    profile_completed: boolean
}

export const useProfileStore = defineStore('profile', () => {
    const profile = ref<Profile | null>(null)
    const loading = ref(false)

    // Fetch profile for current user
    const fetchProfile = async (userId: string) => {
        loading.value = true
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            profile.value = data
            return data
        } catch (err) {
            console.error('Error fetching profile:', err)
            return null
        } finally {
            loading.value = false
        }
    }

    // Generate avatar URL using DiceBear API (Avataaars style)
    const generateAvatarUrl = (nickname: string): string => {
        // DiceBear API: https://api.dicebear.com/7.x/avataaars/svg?seed={seed}
        const seed = encodeURIComponent(nickname)
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
    }

    // Update profile (nickname and/or avatar)
    const updateProfile = async (
        userId: string,
        nickname: string,
        avatarFile?: File | null
    ) => {
        loading.value = true
        try {
            let avatarUrl = profile.value?.avatar_url

            // If avatar file provided, upload to storage
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop()
                const fileName = `${userId}-${Date.now()}.${fileExt}`
                const filePath = `avatars/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('photos') // 기존 photos 버킷 활용 or 'avatars' 버킷 생성 필요
                    .upload(filePath, avatarFile, { upsert: true })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('photos')
                    .getPublicUrl(filePath)

                avatarUrl = publicUrl
            } else if (!avatarUrl) {
                // No file and no existing avatar -> generate from nickname
                avatarUrl = generateAvatarUrl(nickname)
            }

            // Update profile in database
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    nickname,
                    avatar_url: avatarUrl,
                    profile_completed: true
                })
                .eq('id', userId)
                .select()
                .single()

            if (error) throw error

            profile.value = data
            return data
        } catch (err) {
            console.error('Error updating profile:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        profile,
        loading,
        fetchProfile,
        updateProfile,
        generateAvatarUrl
    }
})
