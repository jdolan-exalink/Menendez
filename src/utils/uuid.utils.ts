/**
 * Generates a UUID v4 compliant identifier
 * Compatible with browsers that don't support crypto.randomUUID()
 */
export function generateUUID(): string {
    // Try to use native crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: Generate UUID v4 manually
    // Template: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
