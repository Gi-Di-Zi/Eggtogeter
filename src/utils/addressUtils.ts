const PLUS_CODE_PATTERN = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}(?:\b|$)/i

type GeocodeLike = {
    formatted_address?: string
    types?: string[]
}

const hasType = (result: GeocodeLike, type: string) => {
    return Array.isArray(result.types) && result.types.includes(type)
}

export const isPlusCodeAddress = (address?: string | null): boolean => {
    const raw = (address || '').trim()
    if (!raw) return false

    const firstToken = raw.split(/[,\s]/)[0] || raw
    return PLUS_CODE_PATTERN.test(firstToken)
}

const scoreGeocodeResult = (result: GeocodeLike): number => {
    const address = (result.formatted_address || '').trim()
    if (!address) return Number.NEGATIVE_INFINITY

    let score = 0

    if (isPlusCodeAddress(address)) score -= 100
    if (hasType(result, 'street_address')) score += 40
    if (hasType(result, 'premise')) score += 30
    if (hasType(result, 'subpremise')) score += 20
    if (hasType(result, 'route')) score += 20
    if (hasType(result, 'establishment')) score += 15
    if (hasType(result, 'neighborhood')) score += 10
    if (hasType(result, 'sublocality')) score += 10
    if (hasType(result, 'locality')) score += 8
    if (hasType(result, 'administrative_area_level_1')) score += 6
    if (hasType(result, 'country')) score += 4

    // Favor richer addresses over short generic strings.
    score += Math.min(address.length, 80) / 20

    return score
}

export const pickBestFormattedAddress = (results: GeocodeLike[] | null | undefined): string | null => {
    if (!Array.isArray(results) || results.length === 0) return null

    const ranked = results
        .filter((r) => typeof r?.formatted_address === 'string' && r.formatted_address.trim().length > 0)
        .sort((a, b) => scoreGeocodeResult(b) - scoreGeocodeResult(a))

    if (ranked.length === 0) return null

    const best = ranked[0]?.formatted_address?.trim() || ''
    return best || null
}

export const sanitizeAddress = (
    primary?: string | null,
    fallback?: string | null
): string | null => {
    const first = (primary || '').trim()
    const second = (fallback || '').trim()

    if (first && !isPlusCodeAddress(first)) return first
    if (second && !isPlusCodeAddress(second)) return second
    if (first) return first
    if (second) return second
    return null
}

