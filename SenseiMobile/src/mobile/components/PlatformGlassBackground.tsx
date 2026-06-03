import React, { useEffect, type PropsWithChildren } from 'react';
import {
    Platform,
    View,
    type ColorValue,
    type StyleProp,
    type ViewStyle
} from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { logger } from '../../logger';

type LiquidGlassEffect = 'clear' | 'regular' | 'none';
type LiquidGlassColorScheme = 'light' | 'dark' | 'system';

interface PlatformGlassBackgroundProps {
    style?: StyleProp<ViewStyle>;
    borderRadius?: number;
    fallbackColor?: ColorValue;
    tintColor?: ColorValue;
    effect?: LiquidGlassEffect;
    colorScheme?: LiquidGlassColorScheme;
    testID?: string;
}

const DEFAULT_FALLBACK_COLOR = 'rgba(0,0,0,0.70)';
const DEFAULT_TINT_COLOR = 'rgba(8,12,20,0.28)';
const loggedFallbackSurfaces = new Set<string>();

export const PlatformGlassBackground: React.FC<PropsWithChildren<PlatformGlassBackgroundProps>> = ({
    style,
    borderRadius = 16,
    fallbackColor = DEFAULT_FALLBACK_COLOR,
    tintColor = DEFAULT_TINT_COLOR,
    effect = 'regular',
    colorScheme = 'dark',
    testID,
    children
}) => {
    const surface = testID ?? 'platform-glass-background';
    useEffect(() => {
        if (Platform.OS !== 'ios') {
            return;
        }
        if (isLiquidGlassSupported) {
            return;
        }
        if (loggedFallbackSurfaces.has(surface)) {
            return;
        }
        loggedFallbackSurfaces.add(surface);
        logger.warn('[MOBILE_PORT_GLASS] liquid glass unsupported, using color fallback', {
            surface,
            fallbackColor: String(fallbackColor),
            tintColor: String(tintColor)
        });
    }, [fallbackColor, surface, tintColor]);

    const baseSurfaceStyle = {
        position: 'relative' as const,
        overflow: 'hidden' as const,
        borderRadius
    };
    const glassStyle = [
        style,
        baseSurfaceStyle
    ];
    const containerStyle = [
        style,
        baseSurfaceStyle,
        { backgroundColor: fallbackColor }
    ];

    if (Platform.OS === 'ios' && isLiquidGlassSupported) {
        return (
            <LiquidGlassView
                testID={testID}
                collapsable={false}
                style={glassStyle}
                effect={effect}
                colorScheme={colorScheme}
                tintColor={tintColor}
            >
                {children}
            </LiquidGlassView>
        );
    }

    return <View testID={testID} collapsable={false} style={containerStyle}>{children}</View>;
};
