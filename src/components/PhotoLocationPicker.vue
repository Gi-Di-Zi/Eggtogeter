/// <reference types="google.maps" />
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useGoogleMapsLoader } from '@/composables/useGoogleMapsLoader'
import { Search, Location } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import i18n from '@/plugins/i18n'
import { ElMessage } from 'element-plus'
import { isPlusCodeAddress, pickBestFormattedAddress, sanitizeAddress } from '@/utils/addressUtils'

const { t } = useI18n()
const { loadGoogleMaps } = useGoogleMapsLoader()

const props = defineProps<{
    modelValue: boolean
    initialLat?: number | null
    initialLng?: number | null
    initialAddress?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'confirm', payload: { lat: number, lng: number, address: string }): void
}>()

declare var google: any

// Map State
const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = ref<any>(null)
const mapMarker = ref<any>(null)
const tempLocation = ref<{ lat: number, lng: number, address: string } | null>(null)

// Search State
const showSearch = ref(false)
const searchText = ref('')
const suggestions = ref<any[]>([])
const hasSearched = ref(false)
let autocompleteService: any = null
let placesLibrary: any = null
let debounceTimer: any = null

// Watch for visibility to initialize
watch(() => props.modelValue, (val) => {
    if (val) {
        openLocationHelper()
    } else {
        // Reset search state on close?
        // showSearch.value = false
    }
})

const getAddressFromCoords = (lat: number, lng: number): Promise<string | null> => {
    return new Promise((resolve) => {
        if (!window.google?.maps?.Geocoder) {
            resolve(null)
            return
        }
        const geocoder = new google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results.length > 0) {
                const best = pickBestFormattedAddress(results)
                resolve(best && !isPlusCodeAddress(best) ? best : null)
            } else {
                resolve(null)
            }
        })
    })
}

const openLocationHelper = () => {
    showSearch.value = false 
    nextTick(async () => {
        await loadGoogleMaps()
        initMap()
        initAutocomplete() // Initialize service
    })
}

const initMap = async () => {
    if (!mapContainer.value || !window.google?.maps) return

    const initialLat = props.initialLat || 37.5665
    const initialLng = props.initialLng || 126.9780
    const center = { lat: initialLat, lng: initialLng }

    if (!mapInstance.value) {
        mapInstance.value = new google.maps.Map(mapContainer.value, {
            center: center,
            zoom: 16,
            disableDefaultUI: true
        })
        
        mapMarker.value = new google.maps.Marker({
            position: center,
            map: mapInstance.value
        })

        mapInstance.value.addListener('click', (e: any) => {
            if (e.latLng) {
                updateTempLocation(e.latLng.lat(), e.latLng.lng())
            }
        })
    } else {
        google.maps.event.trigger(mapInstance.value, 'resize')
        mapInstance.value.setCenter(center)
        mapMarker.value?.setPosition(center)
    }

    // Set initial temp location
    const initialAddress = sanitizeAddress(props.initialAddress)
    const addr = initialAddress || await getAddressFromCoords(initialLat, initialLng)
    tempLocation.value = { lat: initialLat, lng: initialLng, address: addr || t('upload.no_address_info') }
}

const updateTempLocation = async (lat: number, lng: number, explicitAddress?: string) => {
    if (mapMarker.value && mapInstance.value) {
        const pos = { lat, lng }
        mapMarker.value.setPosition(pos)
        mapInstance.value.panTo(pos)
        
        const sanitized = sanitizeAddress(explicitAddress)
        const addr = sanitized || await getAddressFromCoords(lat, lng)
        tempLocation.value = { lat, lng, address: addr || t('upload.no_address_info') }
    }
}

// Search Logic
const toggleSearch = () => {
    showSearch.value = !showSearch.value
    if (showSearch.value) {
       searchText.value = ''
       suggestions.value = []
       hasSearched.value = false
       nextTick(() => {
           initAutocomplete()
       })
    }
}

const initAutocomplete = async () => {
    if (autocompleteService) return 

    try {
        const lib = await google.maps.importLibrary("places") as any
        placesLibrary = lib
        autocompleteService = new lib.AutocompleteService()
    } catch (e) {
        console.error('Failed to load Places Library', e)
    }
}

const triggerSearch = () => {
    if (!searchText.value || !autocompleteService) {
        suggestions.value = []
        return
    }
    
    autocompleteService.getPlacePredictions({
        input: searchText.value,
        language: (i18n.global.locale as any).value || i18n.global.locale,
    }, (predictions: any[], status: any) => {
        hasSearched.value = true
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
             suggestions.value = predictions.map(p => ({
                main_text: p.structured_formatting.main_text,
                secondary_text: p.structured_formatting.secondary_text,
                place_id: p.place_id,
                description: p.description
            }))
        } else {
            suggestions.value = []
        }
    })
}

const clearSearch = () => {
    searchText.value = ''
    suggestions.value = []
    hasSearched.value = false
}

// Watch for search text changes (Debounced Autocomplete)
watch(searchText, (newVal) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!newVal) {
        suggestions.value = []
        hasSearched.value = false
        return
    }
    
    debounceTimer = setTimeout(() => {
        triggerSearch()
    }, 300) // 300ms debounce
})

const handleSelect = async (item: any) => {
    if (!item || !item.place_id || !placesLibrary) return

    try {
        const PlaceClass = placesLibrary.Place
        if (PlaceClass) {
            const place = new PlaceClass({ id: item.place_id })
             await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] })
             
             const lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat
             const lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng
             const addr = sanitizeAddress(place.formattedAddress, item.description || place.displayName) || undefined

             // Update map logic
             updateTempLocation(lat, lng, addr)
             showSearch.value = false
        }
    } catch (e) {
        console.error('Failed to fetch place details', e)
        ElMessage.error(t('setup.error_geocode'))
    }
}

const confirmLocation = () => {
    if (tempLocation.value) {
        emit('confirm', {
            lat: tempLocation.value.lat,
            lng: tempLocation.value.lng,
            address: tempLocation.value.address
        })
        emit('update:modelValue', false)
    }
}

const handleClose = () => {
    emit('update:modelValue', false)
}
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        @update:model-value="handleClose"
        :title="$t('location_helper.title')"
        width="90%"
        style="max-width: 500px"
        append-to-body
        align-center
        class="photo-location-picker"
    >
        <div class="helper-header">
            <el-button v-if="!showSearch" type="primary" :icon="Search" @click="toggleSearch" class="search-toggle-btn">
                {{ $t('location_helper.search') }}
            </el-button>
            <el-button v-else @click="toggleSearch">{{ $t('common.cancel') }}</el-button>
            
            <p v-if="!showSearch && tempLocation" class="current-selected-addr">
                <el-icon><Location /></el-icon> {{ tempLocation.address || $t('location_helper.select_on_map') }}
            </p>
        </div>

        <div class="map-wrapper">
            <!-- Map Container -->
            <div ref="mapContainer" class="map-picker-container"></div>
            
            <!-- Search Overlay -->
            <div v-show="showSearch" class="postcode-overlay">
                 <div class="search-input-container" style="margin-bottom: 10px;">
                    <el-input
                        v-model="searchText"
                        :placeholder="$t('location_helper.search_placeholder')"
                        class="location-input"
                        size="large"
                        clearable
                        @keyup.enter="triggerSearch"
                        @clear="clearSearch"
                    >
                         <template #append>
                            <el-button :icon="Search" @click="triggerSearch" />
                        </template>
                    </el-input>
                </div>

                <!-- Search Results List -->
                <div v-if="suggestions.length > 0" class="search-results-list" style="margin-top: 5px;">
                    <div v-for="(item, index) in suggestions" :key="index" class="search-result-item">
                        <div class="result-info">
                            <span class="result-name">{{ item.main_text }}</span>
                            <span class="result-address">{{ item.secondary_text }}</span>
                        </div>
                        <el-button type="primary" size="small" @click="handleSelect(item)">
                            선택
                        </el-button>
                    </div>
                </div>
                 <div v-else-if="hasSearched && suggestions.length === 0" class="no-results">
                    검색 결과가 없습니다.
                </div>
            </div>
        </div>

        <div class="map-picker-footer">
            <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
            <el-button type="primary" @click="confirmLocation" :disabled="!tempLocation">{{ $t('location_helper.confirm') }}</el-button>
        </div>
    </el-dialog>
</template>

<style scoped>
.helper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 10px;
}
.current-selected-addr {
    margin: 0;
    font-size: 0.9rem;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: right;
}
.map-wrapper {
    position: relative;
    width: 100%;
    height: 400px;
    background-color: #eee;
    margin-bottom: 10px;
    border-radius: 4px;
    overflow: hidden;
}
.map-picker-container {
    width: 100%;
    height: 100%;
}
.postcode-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.95);
    z-index: 10;
    padding: 20px;
    box-sizing: border-box; /* Fix width overflow */
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

/* Enhanced Autocomplete Styling */
.location-input :deep(.el-input__wrapper) {
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); /* Enhanced shadow */
}

.search-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 250px;
    overflow-y: auto;
    margin-bottom: 15px;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 10px;
}

.search-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 6px;
    transition: background-color 0.2s;
}

.search-result-item:hover {
    background-color: #f0f0f0;
}

.result-info {
    display: flex;
    flex-direction: column;
    text-align: left;
    overflow: hidden;
    margin-right: 10px;
}

.result-name {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 2px;
}

.result-address {
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.no-results {
    text-align: center;
    color: #888;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
}

.map-picker-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>
