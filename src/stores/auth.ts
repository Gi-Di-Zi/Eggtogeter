import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
    id: string
    email: string
    address: string | null
    latitude: number | null
    longitude: number | null
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const session = ref<Session | null>(null)
    const userProfile = ref<UserProfile | null>(null)
    const loading = ref(true)

    const isAuthenticated = computed(() => !!user.value)

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            userProfile.value = data
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    async function initialize() {
        loading.value = true
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            session.value = currentSession
            user.value = currentSession?.user ?? null

            if (user.value) {
                await fetchProfile(user.value.id)
            }

            supabase.auth.onAuthStateChange(async (_event, newSession) => {
                session.value = newSession
                user.value = newSession?.user ?? null
                if (user.value) {
                    await fetchProfile(user.value.id)
                } else {
                    userProfile.value = null
                }
            })
        } catch (error) {
            console.error('Auth initialization error:', error)
        } finally {
            loading.value = false
        }
    }

    async function signOut() {
        loading.value = true
        try {
            await supabase.auth.signOut()
            user.value = null
            session.value = null
            userProfile.value = null
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            loading.value = false
        }
    }

    async function resetPassword(email: string) {
        loading.value = true
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // TODO: Ensure this URL is whitelisted in Supabase Dashboard -> Authentication -> URL Configuration
                redirectTo: `${window.location.origin}/update-password`,
            })
            if (error) throw error
        } finally {
            loading.value = false
        }
    }

    async function updatePassword(password: string) {
        loading.value = true
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
        } finally {
            loading.value = false
        }
    }

    return {
        user,
        session,
        userProfile,
        loading,
        isAuthenticated,
        initialize,
        fetchProfile,
        signOut,
        resetPassword,
        updatePassword
    }
})
