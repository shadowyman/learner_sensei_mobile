import React, { useMemo } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Canvas, ImageSVG, Skia, LinearGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';

interface CodeEditorBadgeProps {
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
}

const DEFAULT_SIZE = 32;

export const CodeEditorBadge: React.FC<CodeEditorBadgeProps> = ({ size = DEFAULT_SIZE, onPress, disabled }) => {
  const svgObj = useMemo(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M7 15 3 12 7 9" stroke="#e2e8f0" stroke-opacity="0.9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 9 21 12 17 15" stroke="#e2e8f0" stroke-opacity="0.9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 5 8 19" stroke="#e2e8f0" stroke-opacity="0.9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 4.8 8.5 19.2" stroke="#e2e8f0" stroke-opacity="0.9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
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
      style={[styles.button, { width: size, height: size, opacity: disabled ? 0.5 : 1 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.inner}>
        <Canvas style={{ width: size - 6, height: size - 6 }}>
          <RoundedRect x={0} y={0} width={size - 6} height={size - 6} r={7}>
            <LinearGradient start={vec(0, 0)} end={vec(size - 6, size - 6)} colors={[
              'rgba(30,41,59,0.82)',
              'rgba(12,21,38,0.92)'
            ]} />
          </RoundedRect>
          {svgObj && (
            <ImageSVG svg={svgObj} width={size - 14} height={size - 14} x={7} y={7} />
          )}
        </Canvas>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default CodeEditorBadge;
