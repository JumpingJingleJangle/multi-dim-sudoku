/**
 * Utility functions for digit formatting and parsing.
 */

export function formatDigit(val) {
    if (val === null || val === undefined) return "";
    return String(val);
}

export function parseDigit(str, base) {
    if (str === null || str === undefined || str === '' || str === 'clear') return null;
    if (base === 4) {
        const hexChars = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
        if (typeof str === 'number' && hexChars[str] !== undefined) return hexChars[str];
        const strVal = String(str).toUpperCase();
        return hexChars.includes(strVal) ? strVal : null;
    }
    const num = parseInt(str);
    return isNaN(num) ? null : num;
}
