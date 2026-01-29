import { useI18n } from 'vue-i18n'
import { ref } from 'vue'

const LOCALE_KEY = 'user_locale'

export function useLocale() {
    const { locale } = useI18n({ useScope: 'global' })
    const isLoading = ref(false)

    const setLocale = (newLocale: string) => {
        locale.value = newLocale
        localStorage.setItem(LOCALE_KEY, newLocale)
        document.documentElement.lang = newLocale
    }

    const detectLocale = async () => {
        // 1. Check LocalStorage
        const saved = localStorage.getItem(LOCALE_KEY)
        if (saved) {
            setLocale(saved)
            return
        }

        // 2. IP-based Detection
        isLoading.value = true
        try {
            const response = await fetch('https://ipapi.co/json/')
            if (!response.ok) throw new Error('IP API failed')

            const data = await response.json()
            const country = data.country_code

            // Simple mapping: KR -> ko, Others -> en
            const detected = country === 'KR' ? 'ko' : 'en'

            setLocale(detected)
            console.log(`[Locale] Detected country: ${country} -> Set locale: ${detected}`)

        } catch (error) {
            console.warn('[Locale] IP detection failed, falling back to browser/default:', error)
            // 3. Fallback to Browser Language
            const nav = navigator as any
            const browserLang = nav.language || nav.userLanguage || 'en'

            if (browserLang.toLowerCase().includes('ko')) {
                setLocale('ko')
            } else {
                setLocale('en')
            }
        } finally {
            isLoading.value = false
        }
    }

    const initLocale = () => {
        detectLocale()
    }

    return {
        locale,
        setLocale,
        initLocale,
        isLoading
    }
}
