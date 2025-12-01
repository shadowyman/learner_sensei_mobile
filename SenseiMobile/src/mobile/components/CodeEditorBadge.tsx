import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';

interface CodeEditorBadgeProps {
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  themeColors?: ThemeColors;
  borderColorOverride?: string;
}

const DEFAULT_SIZE = 22;
type ThemeColors = {
  linear: [string, string, string];
  radialA: string;
  radialB: string;
  radialC: string;
};

const DEFAULT_THEME_COLORS: ThemeColors = {
  linear: ['#0a0a0a', '#1a1a2e', '#16213e'],
  radialA: 'rgba(0,212,255,0.18)',
  radialB: 'rgba(0,212,255,0.08)',
  radialC: 'rgba(196,229,56,0.08)'
};

const DEFAULT_BADGE_BG = 'rgba(15,23,42,0.95)';
function withAlpha(color: string, minAlpha: number): string {
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

function luminance(color: string): number {
  const parsed = parseColor(color);
  if (!parsed) return 0;
  const norm = ['r', 'g', 'b'].map(k => {
    const v = (parsed as any)[k] / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function ensureReadable(color: string, fallback: string): string {
  return luminance(color) < 0.05 ? fallback : color;
}

function addAlpha(color: string, alpha: number, fallback: string): string {
  const hexMatch = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const raw = hexMatch[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some(v => Number.isNaN(v))) return fallback;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgbaMatch = color.match(/rgba?\s*\(([^)]+)\)/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(p => p.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some(v => Number.isNaN(v))) return fallback;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return fallback;
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

function lightenColor(color: string, amount: number, fallback: string): string {
  const parsed = parseColor(color);
  if (!parsed) return fallback;
  const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const nextL = Math.min(1, Math.max(0, amount >= 0 ? l + (1 - l) * amount : l + amount));
  const { r, g, b } = hslToRgb(h, s, nextL);
  return `rgba(${r},${g},${b},1)`;
}

export const CodeEditorBadge: React.FC<CodeEditorBadgeProps> = ({ size = DEFAULT_SIZE, onPress, disabled, themeColors, borderColorOverride }) => {
  const resolvedTheme = themeColors ?? DEFAULT_THEME_COLORS;
  const base = resolvedTheme.linear?.[1] ?? '#34c759';
  const computedBorder = ensureReadable(withAlpha(lightenColor(base, 0.12, 'rgba(94,234,212,0.65)'), 0.8), 'rgba(94,234,212,0.65)');
  const borderColor = borderColorOverride ? borderColorOverride : computedBorder;
  const backgroundColor = ensureReadable(lightenColor(base, -0.08, DEFAULT_BADGE_BG), DEFAULT_BADGE_BG);
  const gradientColors = useMemo(() => {
    const primary = ensureReadable(lightenColor(base, 0.6, '#6ee7b7'), '#6ee7b7');
    const secondary = ensureReadable(lightenColor(base, 0.4, '#4ade80'), '#4ade80');
    const tertiary = ensureReadable(lightenColor(base, 0.22, '#22c55e'), '#22c55e');
    return [primary, secondary, tertiary];
  }, [base, resolvedTheme]);
  const radius = size / 2;
  const circleStyle = { borderRadius: radius };

  const svgObj = useMemo(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M7 15 3 12 7 9" stroke="#ffffff" stroke-opacity="1" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 9 21 12 17 15" stroke="#ffffff" stroke-opacity="1" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 5 8 19" stroke="#ffffff" stroke-opacity="1" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 4.8 8.5 19.2" stroke="#ffffff" stroke-opacity="1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    try {
      return Skia.SVG.MakeFromString(svg) || null;
    } catch {
      return null;
    }
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Open code editor"
      style={[
        styles.button,
        {
          width: size,
          height: size,
          opacity: disabled ? 0.5 : 1,
          borderColor,
          backgroundColor: 'transparent',
          borderRadius: radius
        }
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[styles.layerBase, circleStyle, { backgroundColor, borderColor }]} />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.layerGradient, circleStyle]}
      />
      {svgObj && (
        <Canvas style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
          <ImageSVG svg={svgObj} width={size - 10} height={size - 10} x={5} y={5} />
        </Canvas>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOpacity: 0.7,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowColor: '#000000'
  },
  layerBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1
  },
  layerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }
});

export default CodeEditorBadge;
