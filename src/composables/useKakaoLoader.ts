const kakaoPromise: { map: Promise<void> | null; postcode: Promise<void> | null } = {
    map: null,
    postcode: null
}

export const useKakaoLoader = () => {
    const loadKakaoMap = (): Promise<void> => {
        if (kakaoPromise.map) return kakaoPromise.map

        kakaoPromise.map = new Promise((resolve, reject) => {
            // Check if already loaded with services
            if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                resolve()
                return
            }

            const script = document.createElement('script')
            const apiKey = import.meta.env.VITE_KAKAO_MAP_KEY

            if (!apiKey) {
                reject(new Error('Kakao Map API Key is missing'))
                return
            }

            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`
            script.onload = () => {
                window.kakao.maps.load(() => {
                    if (window.kakao.maps.services) {
                        resolve()
                    } else {
                        reject(new Error('Kakao Maps loaded but "services" library is missing.'))
                    }
                })
            }
            script.onerror = () => {
                kakaoPromise.map = null // Reset on error so we can try again
                reject(new Error('Failed to load Kakao Map script'))
            }
            document.head.appendChild(script)
        })

        return kakaoPromise.map
    }

    const loadDaumPostcode = (): Promise<void> => {
        if (kakaoPromise.postcode) return kakaoPromise.postcode

        kakaoPromise.postcode = new Promise((resolve, reject) => {
            if (window.daum && window.daum.Postcode) {
                resolve()
                return
            }
            const script = document.createElement('script')
            script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
            script.onload = () => resolve()
            script.onerror = () => {
                kakaoPromise.postcode = null
                reject(new Error('Failed to load Daum Postcode'))
            }
            document.head.appendChild(script)
        })

        return kakaoPromise.postcode
    }

    return {
        loadKakaoMap,
        loadDaumPostcode
    }
}

// Add types for global window extensions
declare global {
    interface Window {
        kakao: any
        daum: any
    }
}
