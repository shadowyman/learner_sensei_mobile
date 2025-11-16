import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';

interface CodeEditorBadgeProps {
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
}

const DEFAULT_SIZE = 22;

export const CodeEditorBadge: React.FC<CodeEditorBadgeProps> = ({ size = DEFAULT_SIZE, onPress, disabled }) => {
  const svgObj = useMemo(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M7 15 3 12 7 9" stroke="#5eead4" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 9 21 12 17 15" stroke="#5eead4" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 5 8 19" stroke="#5eead4" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.5 4.8 8.5 19.2" stroke="#5eead4" stroke-opacity="0.95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
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
      {svgObj && (
        <Canvas style={{ width: size, height: size }}>
          <ImageSVG svg={svgObj} width={size - 10} height={size - 10} x={5} y={5} />
        </Canvas>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.65)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default CodeEditorBadge;
