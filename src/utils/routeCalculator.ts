export interface RoutePoint {
    lat: number
    lng: number
}

// OSRM Driving profile endpoint
const OSRM_API_BASE = 'https://router.project-osrm.org/route/v1/driving'

export async function calculateRoute(points: RoutePoint[]): Promise<any> {
    if (points.length < 2) return null

    // Format coordinates for OSRM: lon,lat;lon,lat;...
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';')
    const url = `${OSRM_API_BASE}/${coords}?overview=full&geometries=geojson`

    try {
        const response = await fetch(url)
        const data = await response.json()

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return data.routes[0].geometry
        }
        return null
    } catch (error) {
        console.error('OSRM API Error:', error)
        return null
    }
}
