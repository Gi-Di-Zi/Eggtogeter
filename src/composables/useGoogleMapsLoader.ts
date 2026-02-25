import { ref } from 'vue'
import i18n from '@/plugins/i18n'

const googleMapsPromise = ref<Promise<void> | null>(null)

export const useGoogleMapsLoader = () => {
    const loadGoogleMaps = (): Promise<void> => {
        if (googleMapsPromise.value) return googleMapsPromise.value

        if (window.google && window.google.maps) {
            googleMapsPromise.value = Promise.resolve()
            return googleMapsPromise.value
        }

        googleMapsPromise.value = new Promise((resolve, reject) => {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
            if (!apiKey) {
                // Warning only, to prevent crash if key is missing during dev
                console.warn('Google Maps API Key is missing. Check .env (VITE_GOOGLE_MAPS_API_KEY)')
                reject(new Error('Google Maps API Key is missing'))
                return
            }

            // Get current locale
            const locale = (i18n.global.locale as any).value || i18n.global.locale
            const region = locale === 'ko' ? 'KR' : 'US' // Simple region logic

            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${locale}&region=${region}`
            script.async = true
            script.defer = true

            script.onload = () => {
                resolve()
            }

            script.onerror = () => {
                googleMapsPromise.value = null
                reject(new Error('Failed to load Google Maps script'))
            }

            document.head.appendChild(script)
        })

        return googleMapsPromise.value
    }

    return {
        loadGoogleMaps
    }
}
