<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCategoryStore, type Category } from '@/stores/category'
import { usePhotoStore } from '@/stores/photo' // Added
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, Check, Close, CircleCheckFilled } from '@element-plus/icons-vue'
import { supabase } from '@/lib/supabase'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: boolean
  photoId?: string
}>()

const { t } = useI18n({ useScope: 'global' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:selected', ids: number[]): void
}>()

const categoryStore = useCategoryStore()
const photoStore = usePhotoStore() // Added
const newCategoryName = ref('')
const newCategoryColor = ref('#409EFF')
const editingId = ref<number | null>(null)
const editName = ref('')
const editColor = ref('')

// Changed to single ID
const assignedCategoryId = ref<number | null>(null)

// Init loading
const init = async () => {
    await categoryStore.fetchCategories()
    
    if (!props.photoId) {
        assignedCategoryId.value = null
        return
    }

    // Fetch current assignment (Single)
    const { data } = await supabase
        .from('photo_categories')
        .select('category_id')
        .eq('photo_id', props.photoId)
        .limit(1)
        .maybeSingle()
    
    if (data) {
        assignedCategoryId.value = data.category_id
    } else {
        assignedCategoryId.value = null
    }
    emitSelection()
}

watch(() => props.modelValue, (val) => {
    if (val) {
        init()
        newCategoryName.value = ''
        newCategoryColor.value = '#409EFF' // Reset default
    }
})

const emitSelection = () => {
    emit('update:selected', assignedCategoryId.value ? [assignedCategoryId.value] : [])
}

const handleClose = () => {
  emit('update:modelValue', false)
  editingId.value = null
}

// Assignment Logic (Single Select)
const setAssignment = async (categoryId: number) => {
    if (!props.photoId) return
    
    // If clicking already selected -> Deselect (Optional, but good UX if they want 'No Category')
    if (assignedCategoryId.value === categoryId) {
        try {
            await supabase.from('photo_categories').delete().eq('photo_id', props.photoId)
            assignedCategoryId.value = null
            emitSelection()
            // Update Store for reactivity
            photoStore.updatePhotoCategory(props.photoId, undefined, undefined)
        } catch(e) { console.error(e) }
        return
    }

    // Select New
    try {
        // 1. Delete all existing
        await supabase.from('photo_categories').delete().eq('photo_id', props.photoId)
        
        // 2. Insert new
        const { error } = await supabase
            .from('photo_categories')
            .insert({ photo_id: props.photoId, category_id: categoryId })
            
        if (error) throw error
        
        assignedCategoryId.value = categoryId
        emitSelection()

        // Update Store for reactivity
        const category = categoryStore.categories.find(c => c.id === categoryId)
        if (category) {
            const color = category.is_favorite ? '#FFD700' : (category.color || undefined)
            photoStore.updatePhotoCategory(props.photoId, color, category.name)
        }
    } catch (e) {
        console.error(e)
        ElMessage.error(t('category_manager.msg_change_fail'))
    }
}

// CRUD Logic
const handleAdd = async () => {
  if (!newCategoryName.value.trim()) return
  try {
    await categoryStore.addCategory(newCategoryName.value.trim(), newCategoryColor.value)
    newCategoryName.value = ''
    newCategoryColor.value = '#409EFF'
    ElMessage.success(t('category_manager.msg_added'))
  } catch (error) {
    ElMessage.error(t('category_manager.msg_add_fail'))
  }
}

const startEdit = (category: Category) => {
  editingId.value = category.id
  editName.value = category.name
  editColor.value = category.color || '#409EFF'
}

const handleUpdate = async (id: number) => {
  if (!editName.value.trim()) return
  try {
    await categoryStore.updateCategory(id, editName.value.trim(), editColor.value)
    editingId.value = null
    ElMessage.success(t('category_manager.msg_updated'))
  } catch (error) {
    ElMessage.error(t('category_manager.msg_update_fail'))
  }
}

const cancelEdit = () => {
  editingId.value = null
}

const handleDelete = async (category: Category) => {
  if (category.is_favorite) return
  
  try {
    await ElMessageBox.confirm(
      t('category_manager.delete_confirm_msg', { name: category.name }),
      t('category_manager.delete_confirm_title'),
      { confirmButtonText: t('category_manager.btn_delete'), cancelButtonText: t('category_manager.btn_cancel'), type: 'warning' }
    )
    
    await categoryStore.deleteCategory(category.id)
    // Also remove from local assignment if matches
    if (assignedCategoryId.value === category.id) {
        assignedCategoryId.value = null
        emitSelection()
        // Update Store for reactivity
        if (props.photoId) {
             photoStore.updatePhotoCategory(props.photoId, undefined, undefined)
        }
    }
    ElMessage.success(t('category_manager.msg_deleted'))
  } catch (e) {
    // Cancelled
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="$t('category_manager.title')"
    width="450px"
    @close="handleClose"
    append-to-body
  >
    <div class="category-manager">
      <!-- Add New -->
      <div class="add-section">
        <el-color-picker v-model="newCategoryColor" size="small" />
        <el-input 
            v-model="newCategoryName" 
            :placeholder="$t('category_manager.ph_new_name')" 
            @keyup.enter="handleAdd"
            style="flex: 1"
        >
            <template #append>
                <el-button :icon="Plus" @click="handleAdd">{{ $t('category_manager.btn_add') }}</el-button>
            </template>
        </el-input>
      </div>

      <el-divider style="margin: 15px 0" />

      <!-- List -->
      <ul class="category-list">
        <li v-for="category in categoryStore.categories" :key="category.id" class="category-item">
            <!-- Edit Mode -->
            <template v-if="editingId === category.id">
                <div class="edit-mode">
                    <el-color-picker v-model="editColor" size="small" />
                    <el-input 
                        v-model="editName" 
                        size="small" 
                        @keyup.enter="handleUpdate(category.id)"
                        style="flex: 1; margin: 0 5px;" 
                    />
                    <el-button size="small" :icon="Check" type="success" circle @click="handleUpdate(category.id)" />
                    <el-button size="small" :icon="Close" circle @click="cancelEdit" />
                </div>
            </template>

            <!-- View Mode -->
            <template v-else>
                <div class="view-mode">
                    <!-- Assignment Selection (Single) -->
                    <div 
                        v-if="props.photoId" 
                        class="select-area"
                        @click="setAssignment(category.id)"
                        style="margin-right: 10px; cursor: pointer;"
                    >
                         <el-icon 
                            v-if="assignedCategoryId === category.id" 
                            :color="category.color || '#409EFF'" 
                            size="20"
                        >
                            <CircleCheckFilled />
                        </el-icon>
                         <div v-else class="unchecked-circle"></div>
                    </div>
                    
                    <!-- Color Badge & Name -->
                    <div class="cat-info">
                        <span 
                            class="color-dot" 
                            :style="{ backgroundColor: category.is_favorite ? '#FFD700' : (category.color || '#999') }"
                        ></span>
                        <span class="name">{{ category.name }}</span>
                        <el-tag 
                            v-if="category.is_favorite"
                            size="small" 
                            effect="dark" 
                            style="margin-left:5px; background-color: #FFD700; border-color: #FFD700; color: #333; font-weight: bold;"
                        >
                            {{ $t('category_manager.favorites') }}
                        </el-tag>
                    </div>

                    <!-- Actions -->
                    <div class="actions" v-if="!category.is_favorite">
                        <el-button circle size="small" :icon="Edit" @click="startEdit(category)" />
                        <el-button circle size="small" :icon="Delete" type="danger" plain @click="handleDelete(category)" />
                    </div>
                </div>
            </template>
        </li>
      </ul>
    </div>
  </el-dialog>
</template>

<style scoped>
.add-section {
    display: flex;
    gap: 10px;
    align-items: center;
}
.category-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
}
.category-item {
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    min-height: 40px; /* Force minimum height to prevent shift */
    display: flex;
    align-items: center;
}
.view-mode {
    display: flex;
    align-items: center;
    width: 100%;
}
.cat-info {
    flex: 1;
    display: flex;
    align-items: center;
    margin-left: 10px;
}
.color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 8px;
    display: inline-block;
}
.name {
    font-size: 15px;
}
.edit-mode {
    display: flex;
    align-items: center;
    width: 100%;
}
.actions {
    display: flex;
    gap: 5px;
    margin-left: 10px;
}
.unchecked-circle {
    width: 20px;
    height: 20px;
    border: 2px solid #dcdfe6;
    border-radius: 50%;
    box-sizing: border-box;
}
</style>
