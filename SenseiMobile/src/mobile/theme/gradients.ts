export type ThemeColors = {
    linear: [string, string, string];
    radialA: string;
    radialB: string;
    radialC: string;
};

export const DEFAULT_THEME_COLORS: ThemeColors = {
    linear: ['#0a0a0a', '#1a1a2e', '#16213e'],
    radialA: 'rgba(0,212,255,0.18)',
    radialB: 'rgba(0,212,255,0.08)',
    radialC: 'rgba(196,229,56,0.08)'
};

export const DEFAULT_SEND_GRADIENT = ['#19c88f', '#0fb981', '#0ca672'];

export function withAlpha(color: string, minAlpha: number): string {
    const match = color.match(/rgba?\s*\(([^)]+)\)/i);
    if (!match) return color;
    const parts = match[1].split(',').map(part => part.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some(v => Number.isNaN(v))) return color;
    const alpha = Math.max(minAlpha, parts[3] !== undefined ? parseFloat(parts[3]) : 1);
    return `rgba(${r},${g},${b},${alpha})`;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
    const hex = color.trim();
    const hexMatch = hex.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
        const raw = hexMatch[1];
        if (raw.length === 3 || raw.length === 4) {
            const r = parseInt(raw[0] + raw[0], 16);
            const g = parseInt(raw[1] + raw[1], 16);
            const b = parseInt(raw[2] + raw[2], 16);
            return { r, g, b };
        }
        if (raw.length >= 6) {
            const r = parseInt(raw.slice(0, 2), 16);
            const g = parseInt(raw.slice(2, 4), 16);
            const b = parseInt(raw.slice(4, 6), 16);
            if ([r, g, b].some(v => Number.isNaN(v))) return null;
            return { r, g, b };
        }
    }
    const rgbaMatch = color.match(/rgba?\s*\(([^)]+)\)/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(p => p.trim());
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        if ([r, g, b].some(v => Number.isNaN(v))) return null;
        return { r, g, b };
    }
    return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
        case rn:
            h = (gn - bn) / d + (gn < bn ? 6 : 0);
            break;
        case gn:
            h = (bn - rn) / d + 2;
            break;
        default:
            h = (rn - gn) / d + 4;
            break;
    }
    h /= 6;
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue(p, q, h) * 255);
    const b = Math.round(hue(p, q, h - 1 / 3) * 255);
    return { r, g, b };
}

export function lightenColor(color: string, amount: number, fallback: string): string {
    const parsed = parseColor(color);
    if (!parsed) return fallback;
    const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
    const nextL = Math.min(1, Math.max(0, amount >= 0 ? l + (1 - l) * amount : l + amount));
    const { r, g, b } = hslToRgb(h, s, nextL);
    return `rgba(${r},${g},${b},1)`;
}

export function luminance(color: string): number {
    const parsed = parseColor(color);
    if (!parsed) return 0;
    const norm = ['r', 'g', 'b'].map(k => {
        const v = (parsed as any)[k] / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

export function ensureReadable(color: string, fallback: string): string {
    return luminance(color) < 0.05 ? fallback : color;
}

export function shiftHue(color: string, delta: number, fallback: string): string {
    const parsed = parseColor(color);
    if (!parsed) return fallback;
    const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
    let hh = h + delta;
    if (hh < 0) hh += 1;
    if (hh > 1) hh -= 1;
    const { r, g, b } = hslToRgb(hh, s, l);
    return `rgba(${r},${g},${b},1)`;
}

export function deriveSendGradient(themeColors?: ThemeColors): string[] {
    const resolved = themeColors ?? DEFAULT_THEME_COLORS;
    const base = resolved.linear?.[1] ?? DEFAULT_SEND_GRADIENT[1];
    const primary = ensureReadable(lightenColor(base, 0.55, DEFAULT_SEND_GRADIENT[0]), DEFAULT_SEND_GRADIENT[0]);
    const secondary = ensureReadable(lightenColor(base, 0.35, DEFAULT_SEND_GRADIENT[1]), DEFAULT_SEND_GRADIENT[1]);
    const tertiary = ensureReadable(lightenColor(base, 0.2, DEFAULT_SEND_GRADIENT[2]), DEFAULT_SEND_GRADIENT[2]);
    return [primary, secondary, tertiary];
}

export function isDefaultTheme(themeColors?: ThemeColors): boolean {
    if (!themeColors) return true;
    const resolved = themeColors;
    const def = DEFAULT_THEME_COLORS;
    return (
        resolved.linear[0] === def.linear[0] &&
        resolved.linear[1] === def.linear[1] &&
        resolved.linear[2] === def.linear[2] &&
        resolved.radialA === def.radialA &&
        resolved.radialB === def.radialB &&
        resolved.radialC === def.radialC
    );
}

