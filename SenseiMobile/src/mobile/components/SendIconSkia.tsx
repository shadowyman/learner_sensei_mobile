import React, { useMemo } from 'react';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';

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

export default SendIconSkia;
