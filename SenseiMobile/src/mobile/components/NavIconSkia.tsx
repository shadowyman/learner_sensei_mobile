import React, { useMemo } from 'react';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';

interface NavIconSkiaProps {
  dir: 'left' | 'right';
  variant: 'single' | 'double';
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const NavIconSkia: React.FC<NavIconSkiaProps> = ({
  dir,
  variant,
  size = 16,
  color = '#1d3421',
  strokeWidth = 2,
}) => {
  const paths = useMemo(() => {
    const scale = (n: number) => (n / 24) * size;
    const makePoly = (pts: [number, number][]) => {
      const p = Skia.Path.Make();
      if (pts.length === 0) return p;
      p.moveTo(scale(pts[0][0]), scale(pts[0][1]));
      for (let i = 1; i < pts.length; i++) {
        p.lineTo(scale(pts[i][0]), scale(pts[i][1]));
      }
      return p;
    };

    if (variant === 'double') {
      if (dir === 'left') {
        // Web SVG: (19,4)-(12,12)-(19,20) and (12,4)-(5,12)-(12,20)
        return [
          makePoly([
            [19, 4],
            [12, 12],
            [19, 20],
          ]),
          makePoly([
            [12, 4],
            [5, 12],
            [12, 20],
          ]),
        ];
      } else {
        // Web SVG: (5,4)-(12,12)-(5,20) and (12,4)-(19,12)-(12,20)
        return [
          makePoly([
            [5, 4],
            [12, 12],
            [5, 20],
          ]),
          makePoly([
            [12, 4],
            [19, 12],
            [12, 20],
          ]),
        ];
      }
    } else {
      if (dir === 'left') {
        // Web SVG: (15,6)-(9,12)-(15,18)
        return [makePoly([[15, 6], [9, 12], [15, 18]])];
      } else {
        // Web SVG: (9,6)-(15,12)-(9,18)
        return [makePoly([[9, 6], [15, 12], [9, 18]])];
      }
    }
  }, [dir, variant, size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {paths.map((p, idx) => (
          <Path
            key={idx}
            path={p}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
      </Group>
    </Canvas>
  );
};

export default NavIconSkia;

