import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User, Session, Subscription } from '@supabase/supabase-js'

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

    let authStateSubscription: Subscription | null = null
    let initPromise: Promise<void> | null = null

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

    async function applySession(nextSession: Session | null) {
        session.value = nextSession
        user.value = nextSession?.user ?? null

        if (user.value) {
            await fetchProfile(user.value.id)
        } else {
            userProfile.value = null
        }
    }

    async function initialize() {
        if (initPromise) return initPromise

        initPromise = (async () => {
            loading.value = true
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                await applySession(currentSession)

                if (!authStateSubscription) {
                    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
                        void applySession(newSession)
                    })
                    authStateSubscription = data.subscription
                }
            } catch (error) {
                console.error('Auth initialization error:', error)
            } finally {
                loading.value = false
                initPromise = null
            }
        })()

        return initPromise
    }

    async function signOut() {
        loading.value = true
        try {
            await supabase.auth.signOut()
            await applySession(null)
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

    onScopeDispose(() => {
        authStateSubscription?.unsubscribe()
        authStateSubscription = null
    })

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
