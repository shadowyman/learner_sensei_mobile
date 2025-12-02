import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import LinearGradient from 'react-native-linear-gradient';
import { ThemeColors, DEFAULT_THEME_COLORS, withAlpha, lightenColor, ensureReadable } from '../theme/gradients';

interface CodeEditorBadgeProps {
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  themeColors?: ThemeColors;
  borderColorOverride?: string;
}

const DEFAULT_SIZE = 22;

const DEFAULT_BADGE_BG = 'rgba(15,23,42,0.95)';

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
