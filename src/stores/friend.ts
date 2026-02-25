import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

export interface FriendUser {
    id: string
    email: string
    nickname?: string
    avatar_url?: string
}

export interface FriendRequest {
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'blocked'
    created_at: string
    friend_profile?: FriendUser // JSON joined data
}

export const useFriendStore = defineStore('friend', () => {
    const authStore = useAuthStore()

    // State
    const friends = ref<FriendUser[]>([])
    const receivedRequests = ref<FriendRequest[]>([])
    const sentRequests = ref<FriendRequest[]>([])
    const searchResult = ref<FriendUser | null>(null)
    const loading = ref(false)
    const pendingCount = ref(0)

    // Actions
    async function fetchFriends() {
        if (!authStore.user?.id) return

        loading.value = true
        try {
            const { data, error } = await supabase
                .from('friends')
                .select(`
                    id,
                    requester_id,
                    recipient_id,
                    status,
                    requester:profiles!friends_requester_id_fkey(id, email, nickname, avatar_url),
                    recipient:profiles!friends_recipient_id_fkey(id, email, nickname, avatar_url)
                `)
                .or(`requester_id.eq.${authStore.user.id},recipient_id.eq.${authStore.user.id}`)
                .eq('status', 'accepted')

            if (error) throw error

            const friendList: FriendUser[] = []
            data?.forEach((item: any) => {
                if (item.requester_id === authStore.user?.id) {
                    if (item.recipient) friendList.push(item.recipient)
                } else {
                    if (item.requester) friendList.push(item.requester)
                }
            })
            friends.value = friendList

        } catch (err) {
            console.error('Error fetching friends:', err)
        } finally {
            loading.value = false
        }
    }

    async function fetchRequests() {
        if (!authStore.user?.id) return

        loading.value = true
        try {
            // 1. Received Requests
            const { data: received, error: rxError } = await supabase
                .from('friends')
                .select(`
                    id,
                    requester_id,
                    recipient_id,
                    status,
                    created_at,
                    requester:profiles!friends_requester_id_fkey(id, email, nickname, avatar_url)
                `)
                .eq('recipient_id', authStore.user.id)
                .eq('status', 'pending')

            if (rxError) throw rxError

            receivedRequests.value = received?.map((r: any) => ({
                ...r,
                friend_profile: r.requester
            })) || []

            // Update Badge Count
            pendingCount.value = receivedRequests.value.length

            // 2. Sent Requests
            const { data: sent, error: txError } = await supabase
                .from('friends')
                .select(`
                    id,
                    requester_id,
                    recipient_id,
                    status,
                    created_at,
                    recipient:profiles!friends_recipient_id_fkey(id, email, nickname, avatar_url)
                `)
                .eq('requester_id', authStore.user.id)
                .eq('status', 'pending')

            if (txError) throw txError

            sentRequests.value = sent?.map((r: any) => ({
                ...r,
                friend_profile: r.recipient
            })) || []

        } catch (err) {
            console.error('Error fetching requests:', err)
        } finally {
            loading.value = false
        }
    }

    // Updated Search: Exclude self & Partial Match
    async function searchUserByEmail(email: string): Promise<FriendUser | null> {
        if (!authStore.user?.id) return null

        loading.value = true
        searchResult.value = null
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, nickname, avatar_url')
                .ilike('email', `%${email}%`) // Partial match
                .neq('id', authStore.user.id) // Exclude self
                .limit(1)

            if (error) throw error

            if (data && data.length > 0) {
                const user = data[0] as FriendUser
                searchResult.value = user
                return user
            }
            return null
        } catch (err) {
            console.error('Search error:', err)
            return null
        } finally {
            loading.value = false
        }
    }

    // Search by Nickname
    async function searchUserByNickname(nickname: string): Promise<FriendUser | null> {
        if (!authStore.user?.id) return null

        loading.value = true
        searchResult.value = null
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, nickname, avatar_url')
                .ilike('nickname', `%${nickname}%`) // Partial match
                .not('nickname', 'is', null) // Exclude null nicknames
                .neq('nickname', '') // Exclude empty nicknames
                .neq('id', authStore.user.id) // Exclude self
                .limit(1) // Get top result

            if (error) throw error

            if (data && data.length > 0) {
                const user = data[0] as FriendUser
                searchResult.value = user
                return user
            }
            return null
        } catch (err) {
            console.error('Search error:', err)
            return null
        } finally {
            loading.value = false
        }
    }

    async function sendRequest(targetUserId: string) {
        if (!authStore.user?.id) return

        // 1. Check if ANY relationship exists (My request OR Their request)
        const { data: existing, error: checkError } = await supabase
            .from('friends')
            .select('*')
            .or(`and(requester_id.eq.${authStore.user.id},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${authStore.user.id})`)
            .maybeSingle()

        if (checkError) throw checkError

        if (existing) {
            if (existing.status === 'accepted') {
                throw new Error('이미 친구로 등록되었습니다.')
            }
            if (existing.status === 'blocked') {
                throw new Error('친구 요청을 보낼 수 없습니다.')
            }

            // If I am the requester (I already sent it)
            if (existing.requester_id === authStore.user.id) {
                throw new Error('이미 요청을 보냈습니다. 응답을 기다려주세요.')
            }

            // If I am the recipient (They sent to me) -> Auto Accept!
            if (existing.recipient_id === authStore.user.id) {
                await respondToRequest(existing.id, true)
                throw new Error('상대방이 이미 요청을 보냈습니다. 자동으로 수락되어 친구가 되었습니다!')
            }
        }

        // 2. No existing relationship -> Send New Request
        const { error } = await supabase
            .from('friends')
            .insert({
                requester_id: authStore.user.id,
                recipient_id: targetUserId,
                status: 'pending'
            })

        if (error) throw error

        await fetchRequests()
    }

    async function respondToRequest(requestId: string, accept: boolean) {
        try {
            if (accept) {
                const { error } = await supabase
                    .from('friends')
                    .update({ status: 'accepted' })
                    .eq('id', requestId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('friends')
                    .delete()
                    .eq('id', requestId)
                if (error) throw error
            }
            await fetchRequests()
            await fetchFriends()
        } catch (err) {
            console.error('Error responding:', err)
        }
    }

    return {
        friends,
        receivedRequests,
        sentRequests,
        searchResult,
        loading,
        pendingCount,
        fetchFriends,
        fetchRequests,
        searchUserByEmail,
        searchUserByNickname,
        sendRequest,
        respondToRequest
    }
})
