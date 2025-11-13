import React, { useMemo } from 'react';
import { Canvas, Group, Path, Skia, Circle } from '@shopify/react-native-skia';

export type MenuIconName = 'font' | 'theme' | 'debug' | 'fullscreen' | 'note' | 'save' | 'load';

interface MenuIconSkiaProps {
  name: MenuIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const MenuIconSkia: React.FC<MenuIconSkiaProps> = ({
  name,
  size = 27,
  color = '#e2e8f0',
  strokeWidth = 2.25,
}) => {
  const scale = (n: number) => (n / 24) * size;

  const buildPath = (pts: [number, number][]) => {
    const p = Skia.Path.Make();
    if (pts.length === 0) return p;
    p.moveTo(scale(pts[0][0]), scale(pts[0][1]));
    for (let i = 1; i < pts.length; i++) p.lineTo(scale(pts[i][0]), scale(pts[i][1]));
    return p;
  };

  const paths = useMemo(() => {
    switch (name) {
      case 'fullscreen':
        return [
          buildPath([[5, 9], [5, 5], [9, 5]]),
          buildPath([[15, 5], [19, 5], [19, 9]]),
          buildPath([[5, 15], [5, 19], [9, 19]]),
          buildPath([[15, 19], [19, 19], [19, 15]]),
        ];
      case 'save':
        return [
          buildPath([[6, 6], [18, 6], [18, 18], [6, 18], [6, 6]]),
          buildPath([[8, 7], [16, 7], [16, 11], [8, 11], [8, 7]]),
        ];
      case 'load':
        return [
          buildPath([[5, 9], [9, 9], [11, 7], [19, 7], [19, 18], [5, 18], [5, 9]]),
          buildPath([[12, 16], [12, 11]]),
          buildPath([[10, 13], [12, 11], [14, 13]]),
        ];
      case 'note':
        return [
          buildPath([[8, 6], [18, 6], [18, 18], [8, 18], [8, 6]]),
          buildPath([[10, 10], [16, 10]]),
          buildPath([[10, 13], [16, 13]]),
        ];
      case 'debug':
        return [
          buildPath([[6, 9], [3, 7]]),
          buildPath([[18, 9], [21, 7]]),
          buildPath([[6, 15], [3, 17]]),
          buildPath([[18, 15], [21, 17]]),
          buildPath([[8, 12], [16, 12]]),
        ];
      case 'theme':
        return [
          buildPath([[12, 5], [12, 19]]),
        ];
      case 'font':
        return [
          buildPath([[7, 18], [11, 6], [15, 18]]),
          buildPath([[9.5, 13], [12.5, 13]]),
          buildPath([[16, 6], [20, 6]]),
          buildPath([[18, 4], [18, 8]]),
        ];
      default:
        return [] as any[];
    }
  }, [name, size]);

  const extras = useMemo(() => {
    if (name === 'debug') {
      return (
        <Circle cx={scale(12)} cy={scale(12)} r={scale(4)} color={color} style="stroke" strokeWidth={strokeWidth} />
      );
    }
    if (name === 'theme') {
      return (
        <>
          <Circle cx={scale(12)} cy={scale(12)} r={scale(7)} color={color} style="stroke" strokeWidth={strokeWidth} />
          <Circle cx={scale(15)} cy={scale(12)} r={scale(3)} color={color} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    }
    if (name === 'note') {
      return (
        <>
          <Circle cx={scale(8)} cy={scale(9)} r={scale(0.8)} color={color} />
          <Circle cx={scale(8)} cy={scale(12)} r={scale(0.8)} color={color} />
          <Circle cx={scale(8)} cy={scale(15)} r={scale(0.8)} color={color} />
        </>
      );
    }
    if (name === 'save') {
      return <Circle cx={scale(12)} cy={scale(15)} r={scale(1.8)} color={color} style="stroke" strokeWidth={strokeWidth} />;
    }
    if (name === 'font') {
      return (
        <>
          <Circle cx={scale(17)} cy={scale(16)} r={scale(2)} color={color} style="stroke" strokeWidth={strokeWidth} />
          <Path path={buildPath([[18.8, 16], [18.8, 18]])} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
        </>
      );
    }
    return null;
  }, [name, size, color, strokeWidth]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {extras}
        {paths.map((p, i) => (
          <Path key={i} path={p} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
        ))}
      </Group>
    </Canvas>
  );
};

export default MenuIconSkia;
