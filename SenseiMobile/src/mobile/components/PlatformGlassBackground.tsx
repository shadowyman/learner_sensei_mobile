import React, { useEffect, type PropsWithChildren } from 'react';
import {
    Platform,
    StyleSheet,
    View,
    type ColorValue,
    type StyleProp,
    type ViewStyle
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
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
    iosFallbackBlurType?: string;
    iosFallbackBlurAmount?: number;
    testID?: string;
}

const DEFAULT_FALLBACK_COLOR = 'rgba(8,12,20,0.72)';
const DEFAULT_TINT_COLOR = 'rgba(8,12,20,0.28)';
const loggedFallbackSurfaces = new Set<string>();

export const PlatformGlassBackground: React.FC<PropsWithChildren<PlatformGlassBackgroundProps>> = ({
    style,
    borderRadius = 16,
    fallbackColor = DEFAULT_FALLBACK_COLOR,
    tintColor = DEFAULT_TINT_COLOR,
    effect = 'regular',
    colorScheme = 'dark',
    iosFallbackBlurType = 'systemMaterialDark',
    iosFallbackBlurAmount = 24,
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
        logger.warn('[MOBILE_PORT_GLASS] liquid glass unsupported, using blur fallback', {
            surface,
            fallbackColor: String(fallbackColor),
            tintColor: String(tintColor),
            iosFallbackBlurType,
            iosFallbackBlurAmount
        });
    }, [fallbackColor, iosFallbackBlurAmount, iosFallbackBlurType, surface, tintColor]);

    const glassStyle = [
        { borderRadius },
        style
    ];
    const containerStyle = [
        { borderRadius, backgroundColor: fallbackColor },
        style
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

    if (Platform.OS === 'ios') {
        return (
            <View testID={testID} collapsable={false} style={containerStyle}>
                <BlurView
                    pointerEvents="none"
                    style={[styles.absoluteFill, { borderRadius }]}
                    blurType={iosFallbackBlurType as any}
                    blurAmount={iosFallbackBlurAmount}
                    reducedTransparencyFallbackColor={String(fallbackColor)}
                />
                <View
                    pointerEvents="none"
                    style={[styles.absoluteFill, { borderRadius, backgroundColor: tintColor }]}
                />
                {children}
            </View>
        );
    }

    return <View testID={testID} collapsable={false} style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
    absoluteFill: {
        ...StyleSheet.absoluteFillObject
    }
});
