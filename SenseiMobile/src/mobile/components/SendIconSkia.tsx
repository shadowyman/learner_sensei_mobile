import React, { useMemo } from 'react';
import { Canvas, Circle, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';

interface SendIconSkiaProps {
	size?: number;
	color?: string;
}

export const SendIconSkia: React.FC<SendIconSkiaProps> = ({ size = 14, color = 'rgba(255,255,255,0.95)' }) => {
	const path = useMemo(() => {
		const scale = size / 24;
		const p = Skia.Path.Make();
		p.moveTo(3 * scale, 21 * scale);
		p.lineTo(21 * scale, 12 * scale);
		p.lineTo(3 * scale, 3 * scale);
		p.close();
		return p;
	}, [size]);

	return (
		<Canvas style={{ width: size, height: size }}>
			<Group transform={[{ translateX: 1 }] }>
				<Path path={path} color={color} style="fill" />
			</Group>
		</Canvas>
	);
};

interface SendOrbRingSkiaProps {
	size: number;
	colors: string[];
	strokeWidth?: number;
}

export const SendOrbRingSkia: React.FC<SendOrbRingSkiaProps> = ({ size, colors, strokeWidth = 1.25 }) => (
	<Canvas style={{ width: size, height: size }}>
		<Circle cx={size / 2} cy={size / 2} r={(size - strokeWidth) / 2} style="stroke" strokeWidth={strokeWidth}>
			<LinearGradient start={vec(size * 0.18, size * 0.06)} end={vec(size * 0.88, size * 0.96)} colors={colors} />
		</Circle>
	</Canvas>
);

interface SendOrbSheenSkiaProps {
	size: number;
}

export const SendOrbSheenSkia: React.FC<SendOrbSheenSkiaProps> = ({ size }) => (
	<Canvas style={{ width: size, height: size }}>
		<Circle cx={size / 2} cy={size / 2} r={size / 2}>
			<LinearGradient
				start={vec(size * 0.12, size * 0.02)}
				end={vec(size * 0.78, size * 0.82)}
				colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0)']}
			/>
		</Circle>
	</Canvas>
);

export default SendIconSkia;
