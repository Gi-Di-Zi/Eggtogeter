import { ref, computed, toRaw } from 'vue'
import { supabase } from '@/lib/supabase'
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
    address?: string // Added address
    transportMode?: 'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'boat' | 'ferry' // Derived from transition
}

export interface RouteSegment {
    fromIndex: number
    toIndex: number
    geometry: any // GeoJSON LineString
    distance: number // km
    mode: 'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'boat' | 'ferry' | 'none'
    startIndexInFullRoute: number
}

export type AnimationState = 'idle' | 'showing_start_date' | 'showing_new_date' | 'moving' | 'paused_for_photo' | 'dissolving'

export function useAlbumAnimation() {
    // State
    const photos = ref<PhotoNode[]>([])
    const isPlaying = ref(false)
    const progress = ref(0) // 0.0 to 100.0
    const speedMultiplier = ref(1.0)
    const animationState = ref<AnimationState>('idle')
    const isRouteReady = ref(false)

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
    const currentTransportMode = ref<'walk' | 'car' | 'airplane' | 'bicycle' | 'bus' | 'subway' | 'ship' | 'boat' | 'ferry' | 'none'>('car')

    // Internal Animation
    let animationFrameId: number | null = null
    let lastFrameTime = 0


    // Weights (km/h)
    const SPEED_WALK = 80 // Increased for snappier animation
    const SPEED_BICYCLE = 120
    const SPEED_CAR = 200
    const SPEED_BUS = 180
    const SPEED_SUBWAY = 250
    const SPEED_SHIP = 150
    const SPEED_AIRPLANE = 800
    const SPEED_BASE = 100
    const SPEED_INSTANT = 20000 // Very fast for 'none' mode (effectively instant)
    const DATE_DISPLAY_DURATION_MS = 3000 // 3 seconds for date overlay
    let dateDisplayTimer: ReturnType<typeof setTimeout> | null = null
    // Watchdog State
    const lastStateChangeTime = ref(0)
    let watchdogInterval: ReturnType<typeof setInterval> | null = null

    // Helper to update state safely
    const setAnimationState = (newState: AnimationState) => {
        animationState.value = newState
        lastStateChangeTime.value = Date.now()
    }

    // Watchdog: Runs every 1s to check for stuck states
    const startWatchdog = () => {
        if (watchdogInterval) clearInterval(watchdogInterval)
        watchdogInterval = setInterval(() => {
            if (!isPlaying.value) return

            const now = Date.now()
            const elapsed = now - lastStateChangeTime.value

            // Rule 1: Stuck in 'paused_for_photo' > 8s (Expected 5s + buffer)
            if (animationState.value === 'paused_for_photo' && elapsed > 8000) {
                console.warn('[Animation] Watchdog: Recovering from stuck paused_for_photo')
                resumeMoving()
            }

            // Rule 2: Stuck in 'showing_new_date' > 5s (Expected 3s + buffer)
            if (animationState.value === 'showing_new_date' && elapsed > 5000) {
                console.warn('[Animation] Watchdog: Recovering from stuck showing_new_date')
                resumeMoving()
            }

            // Rule 3: Stuck in 'showing_start_date' > 5s (Expected 3s + buffer)
            if (animationState.value === 'showing_start_date' && elapsed > 5000) {
                console.warn('[Animation] Watchdog: Recovering from stuck showing_start_date')
                resumeMoving()
            }

        }, 1000)
    }

    // --- Initialization ---
    const initializeRoute = async (rawPhotos: any[], transitions: any[]) => {
        isRouteReady.value = false
        if (!rawPhotos || rawPhotos.length === 0) {
            isRouteReady.value = true
            return
        }

        // [FIX] Ensure photos are sorted by TIME to match transition logic
        const sortedPhotos = [...rawPhotos].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime())

        // 0. Pre-process photos (get publicUrl)
        photos.value = sortedPhotos.map(p => {
            let url = p.publicUrl
            if (!url && p.storage_path) {
                const { data } = supabase.storage.from('photos').getPublicUrl(p.storage_path)
                url = data.publicUrl
            }
            return {
                ...p,
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
                address: p.address || '', // Ensure address is mapped
                publicUrl: url
            }
        })
        if (photos.value.length < 2) {
            // [Existing One Photo logic...]
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
            isRouteReady.value = true // Ensure ready is set
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
            let trans = transitions.find((t: any) => t.from === from.id && t.to === to.id)

            // [FIX] Fallback to positional index if strict ID match fails
            if (!trans && transitions[i]) {
                const legacy = transitions[i]
                if (legacy.mode && legacy.mode !== 'car') {
                    console.warn(`[Animation] ID mismatch for ${from.id}->${to.id}. Using positional fallback index ${i} (${legacy.mode}).`)
                    trans = legacy
                }
            }

            const mode = trans?.mode || 'car'

            if (!trans) {
                console.warn(`[Animation] Missing transition for ${from.id} -> ${to.id}. Defaulting to 'car'.`)
            } else {
                // console.log(`[Animation] Match: ${mode}`)
            }


            let segmentGeo: number[][] = []

            if (mode === 'none') {
                // For 'none' mode, we still want the REAL route geometry for visual "dotted line"
                // but we will skip the animation movement visibly.
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
                    segmentGeo = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
                }
            } else if (mode === 'airplane' || mode === 'ship' || mode === 'boat' || mode === 'ferry') {
                // FORCE STRAIGHT LINE (User Request)
                segmentGeo = [[from.longitude, from.latitude], [to.longitude, to.latitude]]
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


            // Stitching: Avoid duplicate point at joint
            // BUT only if we have enough points remaining after shift
            if (coords.length > 0 && segmentGeo.length > 2) {
                segmentGeo.shift()
            }

            // Skip if segmentGeo is invalid (should not happen after above fix)
            if (segmentGeo.length < 2) {
                console.warn(`[Animation] Segment ${i} has insufficient coordinates, skipping`)
                continue
            }


            const startIdx = coords.length
            coords = coords.concat(segmentGeo)

            // Calc Segment Distance
            const segLine = turf.lineString(segmentGeo)
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

        // Sanitize Coordinates: Filter invalid AND remove consecutive duplicates
        const validCoords: number[][] = []
        coords.forEach((c) => {
            // Check validity
            if (!Array.isArray(c) || c.length < 2 ||
                typeof c[0] !== 'number' || isNaN(c[0]) ||
                typeof c[1] !== 'number' || isNaN(c[1])) {
                return
            }

            // Check duplicate with last added to avoid zero-length segments
            // Simple equality check for lat/lng
            if (validCoords.length > 0) {
                const last = validCoords[validCoords.length - 1]
                if (last && last[0] !== undefined && last[1] !== undefined &&
                    Math.abs(last[0] - c[0]) < 0.000001 && Math.abs(last[1] - c[1]) < 0.000001) {
                    return // Skip duplicate
                }
            }
            validCoords.push(c)
        })

        fullCoordinates.value = validCoords

        // Ensure valid LineString
        if (validCoords.length > 1) {
            routeLine.value = turf.lineString(validCoords)
        } else if (validCoords.length === 1) {
            // Handle case: Multiple photos but all at effectively same location
            const p = validCoords[0]
            if (p && typeof p[0] === 'number' && typeof p[1] === 'number') {
                routeLine.value = turf.lineString([p, [p[0] + 0.000001, p[1] + 0.000001]])
            } else {
                routeLine.value = null
            }
        } else {
            // Fallback dummy line
            routeLine.value = turf.lineString([[127.0, 37.5], [127.0001, 37.5001]])
        }
        totalDistance.value = currentDist
        segments.value = segs

        // Normalize arrival points to 0-100%
        if (currentDist > 0) {
            photoArrivalPoints.value = arrivalPoints.map(d => (d / currentDist) * 100)
        } else {
            // If total distance is 0
            photoArrivalPoints.value = photos.value.map(() => 0)
        }

        console.log('[Animation] Initialized. Total Dist:', totalDistance.value.toFixed(2), 'km', 'Transitions:', transitions.length)
        isRouteReady.value = true
        startWatchdog() // START WATCHDOG
    }

    // --- Animation Loop ---
    const loop = (timestamp: number) => {
        if (animationState.value !== 'moving') {
            return;
        }

        if (!lastFrameTime) lastFrameTime = timestamp
        const deltaTime = timestamp - lastFrameTime // milliseconds
        lastFrameTime = timestamp

        // Safety cap for delta time (e.g. if tab was backgrounded)
        const safeDelta = Math.min(deltaTime, 100); // to 100ms

        // Convert safeDelta to seconds for calculations
        const deltaSeconds = safeDelta / 1000;

        // Calculate Speed based on current Mode
        let speedKmh = SPEED_BASE
        // [Existing Speed Logic...]
        if (currentTransportMode.value === 'none') speedKmh = SPEED_INSTANT * 2 // Make it visibly instant
        else if (currentTransportMode.value === 'walk') speedKmh = SPEED_WALK
        else if (currentTransportMode.value === 'bicycle') speedKmh = SPEED_BICYCLE
        else if (currentTransportMode.value === 'car') speedKmh = SPEED_CAR
        else if (currentTransportMode.value === 'bus') speedKmh = SPEED_BUS
        else if (currentTransportMode.value === 'subway') speedKmh = SPEED_SUBWAY
        else if (currentTransportMode.value === 'ship' || currentTransportMode.value === 'boat' || currentTransportMode.value === 'ferry') speedKmh = SPEED_SHIP
        else if (currentTransportMode.value === 'airplane') speedKmh = SPEED_AIRPLANE

        // Apply Multiplier
        speedKmh *= speedMultiplier.value

        // Virtual distance traveled in this frame
        const distTraveledKm = (speedKmh * deltaSeconds) / 3600
        let progressDelta = 0

        if (totalDistance.value > 0) {
            progressDelta = (distTraveledKm / totalDistance.value) * 100
        }

        let newProgress = progress.value + progressDelta

        // Check for Photo Arrival
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
                setAnimationState('idle') // Use helper
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
        setAnimationState('paused_for_photo') // Use helper
        currentPhotoIndex.value = photoIdx

        // 2. Wait 5 seconds (Photo display)
        setTimeout(() => {
            if (!isPlaying.value) return // manual pause check

            // 3. Check Date Change
            let nextIdx = photoIdx + 1
            if (nextIdx < photos.value.length) {
                const photoAtIdx = photos.value[photoIdx]
                const photoAtNext = photos.value[nextIdx]
                if (photoAtIdx && photoAtNext) {
                    const thisDate = new Date(photoAtIdx.taken_at).toLocaleDateString()
                    const nextDate = new Date(photoAtNext.taken_at).toLocaleDateString()

                    if (thisDate !== nextDate) {
                        setAnimationState('showing_new_date') // Use helper
                        setTimeout(() => {
                            if (isPlaying.value) {
                                resumeMoving()
                            }
                        }, DATE_DISPLAY_DURATION_MS)
                        return
                    }
                }
            }

            resumeMoving()
        }, 5000)
    }

    const resumeMoving = () => {
        setAnimationState('moving') // Use helper
        lastFrameTime = 0
        loop(performance.now())
    }

    // [updateCurrentState is same...]
    const updateCurrentState = (prog: number) => {
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
        startWatchdog()

        if (progress.value >= 100) {
            progress.value = 0
            currentPhotoIndex.value = 0
            setAnimationState('idle')
        }

        // Start Logic
        if (progress.value === 0 && currentPhotoIndex.value === 0) {
            // New Sequence: Photo -> Date -> Move
            setAnimationState('paused_for_photo')

            setTimeout(() => {
                if (!isPlaying.value) return

                setAnimationState('showing_start_date')

                setTimeout(() => {
                    if (!isPlaying.value) return
                    resumeMoving()
                }, DATE_DISPLAY_DURATION_MS)
            }, 3000) // 3 seconds for first photo
        } else {
            resumeMoving()
        }
    }

    const pause = () => {
        isPlaying.value = false
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = null
        }
        if (dateDisplayTimer) {
            clearTimeout(dateDisplayTimer)
            dateDisplayTimer = null
        }
        if (watchdogInterval) {
            clearInterval(watchdogInterval)
            watchdogInterval = null
        }
    }

    // [rest of seekTo, getCurrentPosition, jumpToPhoto same...]
    const seekTo = (prog: number) => {
        progress.value = Math.max(0, Math.min(prog, 100))
        let newPhotoIndex = 0
        const points = photoArrivalPoints.value
        for (let i = 0; i < points.length; i++) {
            if (progress.value >= (points[i] ?? 0)) {
                newPhotoIndex = i
            } else {
                break
            }
        }
        currentPhotoIndex.value = newPhotoIndex
        updateCurrentState(progress.value)
    }

    const getCurrentPosition = () => {
        try {
            if (!routeLine.value || totalDistance.value === 0) {
                const firstPhoto = photos.value[0]
                if (firstPhoto &&
                    typeof firstPhoto.longitude === 'number' &&
                    typeof firstPhoto.latitude === 'number') {
                    return turf.point([firstPhoto.longitude, firstPhoto.latitude])
                }
                return null
            }

            const rawRoute = toRaw(routeLine.value)
            // Added check for non-empty coordinates
            if (!rawRoute || !rawRoute.geometry ||
                !rawRoute.geometry.coordinates ||
                rawRoute.geometry.coordinates.length < 2) {
                return null
            }

            const actualLength = turf.length(rawRoute, { units: 'kilometers' })
            const dist = Math.max(0, Math.min((progress.value / 100) * actualLength, actualLength))

            if (typeof dist !== 'number' || isNaN(dist)) {
                return null
            }

            return turf.along(rawRoute, dist, { units: 'kilometers' })
        } catch (e) {
            console.error('[Animation] getCurrentPosition Error', e)
            return null
        }
    }

    const jumpToPhoto = (idx: number) => {
        if (idx < 0 || idx >= photos.value.length) return
        const targetP = photoArrivalPoints.value[idx] ?? 0
        seekTo(targetP)
        isPlaying.value = true
        startWatchdog()
        handlePhotoArrival(idx)
    }

    return {
        photos,
        segments,
        isPlaying,
        animationState,
        isRouteReady,
        isPausedForPhoto,
        progress,
        speedMultiplier,
        currentPhotoIndex,
        currentTransportMode,
        routeLine,
        photoArrivalPoints,
        initializeRoute,
        play,
        pause,
        seekTo,
        getCurrentPosition,
        jumpToPhoto
    }
}
