import type { PhotoNode } from '@/composables/useAlbumAnimation'

export const generateMockPhotos = (count: number, startLat: number = 37.5665, startLng: number = 126.9780): PhotoNode[] => {
    const photos: PhotoNode[] = []

    // Simulate a route spiraling out or moving in a direction
    // For simplicity: A meandering path eastward
    let currentLat = startLat
    let currentLng = startLng

    const startTime = new Date().getTime()

    for (let i = 0; i < count; i++) {
        // Random small movement (approx 500m - 2km)
        // 0.01 deg lat approx 1.1km
        const deltaLat = (Math.random() - 0.5) * 0.01
        const deltaLng = (Math.random() - 0.1) * 0.01 // Bias east

        currentLat += deltaLat
        currentLng += deltaLng

        photos.push({
            id: `mock_${i}`,
            latitude: currentLat,
            longitude: currentLng,
            taken_at: new Date(startTime + i * 3600000).toISOString(), // 1 hour apart
            description: `Mock Photo ${i + 1}`,
            storage_path: '', // Valid but empty
            publicUrl: `https://picsum.photos/seed/${i}/400/300`, // Random placeholder
            address: `Test Location ${i + 1}`,
            transportMode: i % 5 === 0 ? 'car' : 'walk' // Mix modes
        })
    }

    return photos
}
