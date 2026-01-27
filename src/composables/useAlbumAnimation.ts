import { ref, computed } from 'vue'
import * as turf from '@turf/turf'
import { calculateRoute } from '@/utils/routeCalculator'

export interface PhotoNode {
    id: string
    latitude: number
    longitude: number
    taken_at: string
    description?: string
    storage_path?: string
    publicUrl?: string
    transportMode?: 'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' // Derived from transition
}

export interface RouteSegment {
    fromIndex: number
    toIndex: number
    geometry: any // GeoJSON LineString
    distance: number // km
    mode: 'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'none'
    startIndexInFullRoute: number
}

export type AnimationState = 'idle' | 'showing_start_date' | 'showing_new_date' | 'moving' | 'paused_for_photo'

export function useAlbumAnimation() {
    // State
    const photos = ref<PhotoNode[]>([])
    const isPlaying = ref(false)
    const progress = ref(0) // 0.0 to 100.0
    const speedMultiplier = ref(1.0)
    const animationState = ref<AnimationState>('idle')

    // Derived State
    const isPausedForPhoto = computed(() => animationState.value === 'paused_for_photo')

    // Route Data
    const routeLine = ref<any>(null) // Full Turf LineString
    const fullCoordinates = ref<number[][]>([])
    const totalDistance = ref(0)
    const segments = ref<RouteSegment[]>([])
    const photoArrivalPoints = ref<number[]>([]) // Progress % where each photo is located

    // Status
    const currentPhotoIndex = ref(0)
    const currentTransportMode = ref<'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'none'>('car')

    // Internal Animation
    let animationFrameId: number | null = null
    let lastFrameTime = 0

    // Weights (km/h)
    const SPEED_WALK = 10
    const SPEED_BICYCLE = 25
    const SPEED_CAR = 120
    const SPEED_BUS = 80
    const SPEED_SUBWAY = 150
    const SPEED_SHIP = 40
    const SPEED_AIRPLANE = 800
    const SPEED_BASE = 100

    // --- Initialization ---
    const initializeRoute = async (rawPhotos: any[], transitions: any[]) => {
        photos.value = rawPhotos
        if (photos.value.length < 2) {
            // Handle single photo or no photos case
            if (photos.value.length === 1) {
                const p0 = photos.value[0]
                if (p0) {
                    fullCoordinates.value = [[p0.longitude, p0.latitude]]
                    const firstCoord = fullCoordinates.value[0]
                    if (firstCoord) {
                        routeLine.value = turf.point(firstCoord)
                    }
                }
                totalDistance.value = 0
                segments.value = []
                photoArrivalPoints.value = [0]
            } else {
                fullCoordinates.value = []
                routeLine.value = null
                totalDistance.value = 0
                segments.value = []
                photoArrivalPoints.value = []
            }
            return
        }

        let coords: number[][] = []
        let segs: RouteSegment[] = []
        let currentDist = 0
        let arrivalPoints: number[] = [0] // First photo is at 0%

        // 1. Build Route Segments
        for (let i = 0; i < photos.value.length - 1; i++) {
            const from = photos.value[i]
            const to = photos.value[i + 1]

            if (!from || !to) continue; // Safety check for TS

            // Determine Mode
            const trans = transitions.find((t: any) => t.from === from.id && t.to === to.id)
            const mode = trans?.mode || 'car'

            let segmentGeo: number[][] = []

            if (mode === 'none') {
                // Instant transition logic: straight line but will be skipped
                segmentGeo = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
            } else if (mode === 'airplane') {
                // Great Circle (Arc)
                const line = turf.greatCircle(
                    [from.longitude, from.latitude],
                    [to.longitude, to.latitude],
                    { npoints: 20 }
                )
                segmentGeo = line.geometry.coordinates as number[][]
            } else {
                // Standard Route (OSRM/GraphHopper via util) or Straight Line fallback
                try {
                    const routeResult = await calculateRoute([
                        { lat: from.latitude, lng: from.longitude },
                        { lat: to.latitude, lng: to.longitude }
                    ])
                    if (routeResult && routeResult.type === 'LineString') {
                        segmentGeo = routeResult.coordinates as number[][]
                    } else {
                        segmentGeo = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
                    }
                } catch (e) {
                    console.warn('[Animation] Route calculation failed, fallback to straight line', e)
                    segmentGeo = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
                }
            }

            // Stitching
            if (coords.length > 0 && segmentGeo.length > 0) {
                // Avoid duplicate point at joint
                segmentGeo.shift()
            }

            const startIdx = coords.length
            coords = coords.concat(segmentGeo)

            // Calc Segment Distance
            const segLine = turf.lineString(segmentGeo.length > 0 ? segmentGeo : [[0, 0], [0, 0]])
            const segDist = turf.length(segLine, { units: 'kilometers' })

            segs.push({
                fromIndex: i,
                toIndex: i + 1,
                geometry: segLine,
                distance: segDist,
                mode,
                startIndexInFullRoute: startIdx
            })

            currentDist += segDist
            // Store cumulative distance for now, convert to % later
            arrivalPoints.push(currentDist)
        }

        fullCoordinates.value = coords
        routeLine.value = turf.lineString(coords.length > 1 ? coords : [[0, 0], [1, 1]]) // Ensure valid LineString for turf.along
        totalDistance.value = currentDist
        segments.value = segs

        // Normalize arrival points to 0-100%
        if (currentDist > 0) {
            photoArrivalPoints.value = arrivalPoints.map(d => (d / currentDist) * 100)
        } else {
            // If total distance is 0 (e.g., all photos at same spot), all arrival points are 0
            photoArrivalPoints.value = photos.value.map(() => 0)
        }

        console.log('[Animation] Initialized. Total Dist:', totalDistance.value.toFixed(2), 'km', 'Transitions:', transitions.length)
    }

    // --- Animation Loop ---
    const loop = (timestamp: number) => {
        if (!isPlaying.value) return

        if (animationState.value !== 'moving') {
            // If not moving, just keep the loop alive but don't advance progress
            lastFrameTime = timestamp
            animationFrameId = requestAnimationFrame(loop)
            return
        }

        if (!lastFrameTime) lastFrameTime = timestamp
        const delta = (timestamp - lastFrameTime) / 1000 // seconds
        lastFrameTime = timestamp

        // Calculate Speed based on current Mode
        let speedKmh = SPEED_BASE
        if (currentTransportMode.value === 'walk') speedKmh = SPEED_WALK
        else if (currentTransportMode.value === 'bicycle') speedKmh = SPEED_BICYCLE
        else if (currentTransportMode.value === 'car') speedKmh = SPEED_CAR
        else if (currentTransportMode.value === 'bus') speedKmh = SPEED_BUS
        else if (currentTransportMode.value === 'subway') speedKmh = SPEED_SUBWAY
        else if (currentTransportMode.value === 'ship') speedKmh = SPEED_SHIP
        else if (currentTransportMode.value === 'airplane') speedKmh = SPEED_AIRPLANE
        else if (currentTransportMode.value === 'none') speedKmh = 999999 // Instant transition

        // Virtual distance traveled in this frame
        const distTraveledKm = (speedKmh * speedMultiplier.value * delta) / 3600

        // Convert to % progress
        let progressDelta = 0
        if (totalDistance.value > 0) {
            progressDelta = (distTraveledKm / totalDistance.value) * 100
        }

        let newProgress = progress.value + progressDelta

        // Check for Photo Arrival
        // Find next photo point
        const nextPhotoIdx = currentPhotoIndex.value + 1
        if (nextPhotoIdx < photos.value.length) {
            const targetProgress = photoArrivalPoints.value[nextPhotoIdx] ?? 100

            // If we crossed the target
            if (newProgress >= targetProgress) {
                newProgress = targetProgress // Snap to photo
                handlePhotoArrival(nextPhotoIdx)
            }
        } else {
            // End of route
            if (newProgress >= 100) {
                newProgress = 100
                isPlaying.value = false
                animationState.value = 'idle'
            }
        }

        progress.value = newProgress
        updateCurrentState(newProgress)

        if (isPlaying.value && animationState.value === 'moving') {
            animationFrameId = requestAnimationFrame(loop)
        }
    }

    const handlePhotoArrival = (photoIdx: number) => {
        console.log('[Animation] Arrived at photo', photoIdx + 1)
        // 1. Pause Moving
        animationState.value = 'paused_for_photo'
        currentPhotoIndex.value = photoIdx

        // 2. Wait 5 seconds (Photo display)
        setTimeout(() => {
            if (!isPlaying.value) return // manual pause check

            // 3. Check Date Change
            // We are currently AT photoIdx. We are about to move to photoIdx + 1.
            let nextIdx = photoIdx + 1
            if (nextIdx < photos.value.length) {
                const photoAtIdx = photos.value[photoIdx]
                const photoAtNext = photos.value[nextIdx]
                if (photoAtIdx && photoAtNext) {
                    const thisDate = new Date(photoAtIdx.taken_at).toLocaleDateString()
                    const nextDate = new Date(photoAtNext.taken_at).toLocaleDateString()

                    if (thisDate !== nextDate) {
                        animationState.value = 'showing_new_date'
                        setTimeout(() => {
                            if (isPlaying.value) {
                                resumeMoving()
                            }
                        }, 3000) // 3 seconds new date
                        return
                    }
                }
            }

            resumeMoving()
        }, 5000)
    }

    const resumeMoving = () => {
        animationState.value = 'moving'
        lastFrameTime = 0 // Reset lastFrameTime to prevent large delta after pause
        loop(performance.now())
    }

    const updateCurrentState = (prog: number) => {
        // 1. Determine current segment & mode
        // Find segment where current dist is between start and end
        const points = photoArrivalPoints.value
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i]
            const p2 = points[i + 1]
            if (p1 !== undefined && p2 !== undefined && prog >= p1 - 0.0001 && prog < p2) {
                const seg = segments.value[i]
                if (seg) {
                    currentTransportMode.value = seg.mode
                }
                break
            }
        }
    }

    // --- Controls ---
    const play = () => {
        if (isPlaying.value) return
        isPlaying.value = true

        if (progress.value >= 100) {
            progress.value = 0
            currentPhotoIndex.value = 0
            animationState.value = 'idle'
        }

        // Start Logic
        if (progress.value === 0 && currentPhotoIndex.value === 0) {
            animationState.value = 'showing_start_date'
            setTimeout(() => {
                if (isPlaying.value) resumeMoving()
            }, 3000) // 3 seconds for start date
        } else {
            resumeMoving()
        }
    }

    const pause = () => {
        isPlaying.value = false
        animationState.value = 'idle'
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }

    const seekTo = (prog: number) => {
        progress.value = Math.max(0, Math.min(prog, 100))
        // Update index based on progress
        let newPhotoIndex = 0
        const points = photoArrivalPoints.value
        for (let i = 0; i < points.length; i++) {
            if (progress.value >= (points[i] ?? 0)) {
                newPhotoIndex = i
            } else {
                break // Points are sorted, so we can stop early
            }
        }
        currentPhotoIndex.value = newPhotoIndex
        updateCurrentState(progress.value)
    }

    const getCurrentPosition = () => {
        if (!routeLine.value || totalDistance.value === 0) {
            // If no route or 0 distance, return the first photo's location if available
            const firstPhoto = photos.value[0]
            if (firstPhoto) {
                return turf.point([firstPhoto.longitude, firstPhoto.latitude])
            }
            return null
        }
        const dist = (progress.value / 100) * totalDistance.value
        return turf.along(routeLine.value, dist, { units: 'kilometers' })
    }

    return {
        // State
        photos,
        segments,
        isPlaying,
        animationState,
        isPausedForPhoto, // Exposed
        progress,
        speedMultiplier,
        currentPhotoIndex,
        currentTransportMode,
        routeLine,
        photoArrivalPoints,

        // Methods
        initializeRoute,
        play,
        pause,
        seekTo,
        getCurrentPosition
    }
}
