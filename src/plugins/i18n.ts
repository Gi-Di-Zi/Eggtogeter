import { createI18n } from 'vue-i18n'
import ko from '../locales/ko.json'
import en from '../locales/en.json'

const i18n = createI18n({
    legacy: false, // Composition API
    locale: 'ko', // Default locale
    fallbackLocale: 'en',
    globalInjection: true, // Use $t globally
    messages: {
        ko,
        en
    }
})

export default i18n
