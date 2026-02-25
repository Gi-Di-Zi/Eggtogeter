import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Category {
    id: number
    user_id: string
    name: string
    is_favorite: boolean
    color: string | null
}

export interface PhotoCategory {
    photo_id: string
    category_id: number
}

export const useCategoryStore = defineStore('category', () => {
    const categories = ref<Category[]>([])
    const loading = ref(false)

    const fetchCategories = async () => {
        loading.value = true
        try {
            const { data: existing, error: fetchError } = await supabase
                .from('categories')
                .select('*')
                .order('id', { ascending: true })

            if (fetchError) throw fetchError

            // Ensure "Favorites" exists
            const hasFavorites = existing?.some(c => c.is_favorite)
            if (!hasFavorites) {
                const { data: newFav, error: createError } = await supabase
                    .from('categories')
                    .insert({
                        name: '즐겨찾기',
                        is_favorite: true,
                        user_id: (await supabase.auth.getUser()).data.user?.id,
                        color: '#FFD700' // Golden
                    })
                    .select()
                    .single()

                if (createError) console.error('Error creating Favorites:', createError)
                if (newFav) categories.value = [...(existing || []), newFav]
                else categories.value = existing || []
            } else {
                categories.value = existing || []
            }

            // Sort: Favorites first, then by ID
            categories.value.sort((a, b) => {
                if (a.is_favorite === b.is_favorite) return a.id - b.id
                return a.is_favorite ? -1 : 1
            })

        } catch (err) {
            console.error('Error fetching categories:', err)
        } finally {
            loading.value = false
        }
    }

    const addCategory = async (name: string, color: string = '#409EFF') => {
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) throw new Error('No user')

            const { data, error } = await supabase
                .from('categories')
                .insert({ name, user_id: user.id, is_favorite: false, color })
                .select()
                .single()

            if (error) throw error
            if (data) categories.value.push(data)
            return data
        } catch (error) {
            console.error('Error adding category:', error)
            throw error
        }
    }

    const updateCategory = async (id: number, name: string, color: string) => {
        try {
            const { data, error } = await supabase
                .from('categories')
                .update({ name, color })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            const index = categories.value.findIndex(c => c.id === id)
            if (index !== -1 && data) {
                categories.value[index] = data
            }
        } catch (error) {
            console.error('Error updating category:', error)
            throw error
        }
    }

    const deleteCategory = async (id: number) => {
        try {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', id)
                .eq('is_favorite', false) // Extra safety

            if (error) throw error

            categories.value = categories.value.filter(c => c.id !== id)
        } catch (error) {
            console.error('Error deleting category:', error)
            throw error
        }
    }

    return {
        categories,
        loading,
        fetchCategories,
        addCategory,
        updateCategory,
        deleteCategory
    }
})
