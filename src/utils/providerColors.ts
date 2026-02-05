import { dbService } from '../services/db.service';

// Default colors if provider not found
const DEFAULT_COLORS: Record<string, string> = {
    'Jerarquicos': '#3b82f6', // Blue
    'MercadoPago': '#fde047', // Yellow (bright)
    'Fiserv': '#f59e0b', // Orange
};

let providerColorsCache: Record<string, string> = {};
let cacheInitialized = false;

/**
 * Initialize the provider colors cache
 */
export async function initializeProviderColors(): Promise<void> {
    const providers = await dbService.getAllProviders();
    providerColorsCache = {};

    providers.forEach(provider => {
        providerColorsCache[provider.name] = provider.color;
    });

    cacheInitialized = true;
}

/**
 * Get the color for a provider by name
 */
export function getProviderColor(providerName: string): string {
    const normalizedName = providerName.toLowerCase();

    // Check cache (case insensitive)
    if (cacheInitialized) {
        const found = Object.entries(providerColorsCache).find(
            ([name]) => name.toLowerCase() === normalizedName
        );
        if (found) return found[1];
    }

    // Special handling for MercadoPago variants
    if (normalizedName.includes('mercadopago')) {
        return DEFAULT_COLORS['MercadoPago'];
    }

    // Fallback to default colors (exact or normalized)
    const exactDefault = DEFAULT_COLORS[providerName];
    if (exactDefault) return exactDefault;

    const fuzzyDefault = Object.entries(DEFAULT_COLORS).find(
        ([name]) => name.toLowerCase() === normalizedName
    );
    if (fuzzyDefault) return fuzzyDefault[1];

    return '#6b7280'; // Gray as ultimate fallback
}

/**
 * Get all provider colors
 */
export function getAllProviderColors(): Record<string, string> {
    return { ...providerColorsCache };
}
