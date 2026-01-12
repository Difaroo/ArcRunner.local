/**
 * Utility functions for handling Comma-Separated Values (CSV) used in legacy data fields.
 * Centralizes logic to prevent fragmentation and ensure consistent edge-case handling.
 */

/**
 * Parses a CSV string into an array of trimmed, non-empty strings.
 * Handles null, undefined, empty strings, and trailing commas gracefully.
 * 
 * @param input The CSV string (e.g., "url1, url2, ")
 * @returns Array of strings (e.g., ["url1", "url2"])
 */
export const parseStringList = (input: string | null | undefined): string[] => {
    if (!input) return [];
    // Split by comma, trim whitespace, and filter out empty entries
    return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Joins an array of strings into a CSV string.
 * Filters out empty/null/undefined values before joining.
 * 
 * @param inputs Array of strings (e.g., ["url1", "url2"])
 * @returns CSV string (e.g., "url1,url2")
 */
export const joinStringList = (inputs: (string | null | undefined)[]): string => {
    if (!inputs) return '';
    return inputs
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map(s => s.trim())
        .join(',');
}
