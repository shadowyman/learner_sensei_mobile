import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import {
    BackdropFilter,
    Canvas,
    Fill,
    ImageFilter,
    BlendMode,
    LinearGradient,
    RadialGradient,
    Rect,
    Group,
    Skia,
    TileMode,
    convertToColumnMajor3,
    processTransform2d,
    vec,
    processUniforms,
} from '@shopify/react-native-skia';

import { headerRefractiveRibbon } from './shaders/headerRefractiveRibbon';
import { logger } from '../../logger';
// no additional background shader; using built-in Skia dithering via <Group dither>

interface SenseiBackdropCanvasProps {
    headerRect: { x: number; y: number; width: number; height: number } | null;
    inputBarRect?: { x: number; y: number; width: number; height: number } | null;
    inputFieldRect?: { x: number; y: number; width: number; height: number } | null;
    drawBackground?: boolean;
    includeHeaderFilter?: boolean;
    enableInputBlur?: boolean;
    colors?: {
        linear: [string, string, string];
        radialA: string;
        radialB: string;
        radialC: string;
    };
}

const HEADER_RADIUS = 30;
const DEFAULT_HEADER_RECT = { x: 0, y: 0, width: 0, height: 0 } as const;

// Built-in Skia dithering is enabled via <Group dither>

const DEFAULT_COLORS = {
    linear: ['#0a0a0a', '#1a1a2e', '#16213e'] as [string, string, string],
    radialA: 'rgba(0,212,255,0.18)',
    radialB: 'rgba(0,212,255,0.08)',
    radialC: 'rgba(196,229,56,0.08)'
};

export const SenseiBackdropCanvas: React.FC<SenseiBackdropCanvasProps> = ({ headerRect, inputBarRect, inputFieldRect, drawBackground = true, includeHeaderFilter = true, enableInputBlur = true, colors = DEFAULT_COLORS }) => {
    const { width, height } = useWindowDimensions();
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) setReduceMotion(enabled);
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);
    const shaderSupported = Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 30);
    const useShader = !!headerRect && shaderSupported && !reduceMotion;
    const hasHeaderRect = !!headerRect;
    const hasInputBarRect = !!inputBarRect;
    const hasInputFieldRect = !!inputFieldRect;
    const resolvedHeaderRect = headerRect ?? DEFAULT_HEADER_RECT;

    useEffect(() => {
        logger.info('Sensei(debug)', {
            tag: 'backdrop.headerRect',
            hasHeaderRect,
            useShader,
            headerRect: headerRect ?? null
        });
    }, [hasHeaderRect, useShader, headerRect]);

    // No background runtime shader; gradients are drawn directly

    const shaderFilter = useMemo(() => {
        if (!useShader) {
            return null;
        }
        const { x, y, width: rectWidth, height: rectHeight } = resolvedHeaderRect;
        if (rectWidth === 0 || rectHeight === 0) {
            return null;
        }
        const builder = Skia.RuntimeShaderBuilder(headerRefractiveRibbon);
        const localMatrix = processTransform2d([{ translateX: x }, { translateY: y }]);
        const topRadius = HEADER_RADIUS;
        const bottomRadius = 0;
        processUniforms(
            headerRefractiveRibbon,
            {
                transform: convertToColumnMajor3(localMatrix.get()),
                resolution: [width, height],
                box: [0, 0, rectWidth, rectHeight],
                radii: [topRadius, topRadius, bottomRadius, bottomRadius],
            },
            builder
        );
        const blurChild = Skia.ImageFilter.MakeBlur(8, 8, TileMode.Clamp);
        return Skia.ImageFilter.MakeRuntimeShaderWithChildren(builder, 0, ['blurredImage'], [blurChild]);
    }, [height, resolvedHeaderRect, useShader, width]);

    const fallbackFilter = useMemo(() => {
        if (!headerRect) {
            return null;
        }
        const { x, y, width: rectWidth, height: rectHeight } = resolvedHeaderRect;
        if (rectWidth === 0 || rectHeight === 0) {
            return null;
        }
        const blur = Skia.ImageFilter.MakeBlur(12, 12, TileMode.Clamp);
        const tintShader = Skia.Shader.MakeColor(Skia.Color('rgba(255,255,255,0.28)'));
        const tint = Skia.ImageFilter.MakeShader(tintShader);
        const maskEffect = Skia.RuntimeEffect.Make(
            `uniform vec4 box; uniform vec4 radii; half4 main(vec2 xy) {
               vec2 halfSize = box.zw * 0.5; vec2 local = xy - box.xy - halfSize;
               float rx;
               if (local.y < 0.0) { rx = (local.x >= 0.0) ? radii.y : radii.x; } else { rx = (local.x >= 0.0) ? radii.z : radii.w; }
               vec2 q = abs(local) - halfSize + rx;
               float d = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rx;
               if (d > 0.0) { return vec4(0.0); }
               return vec4(1.0);
            }`
        );
        if (!maskEffect) {
            return Skia.ImageFilter.MakeBlend(BlendMode.SrcOver, blur, tint);
        }
        const localMatrix = processTransform2d([{ translateX: x }, { translateY: y }]);
        const topRadius = HEADER_RADIUS;
        const bottomRadius = 0;
        const maskUniforms = processUniforms(
            maskEffect,
            { box: [0, 0, rectWidth, rectHeight], radii: [topRadius, topRadius, bottomRadius, bottomRadius] }
        );
        const maskShaderInst = maskEffect.makeShader(maskUniforms, localMatrix);
        const tinted = Skia.ImageFilter.MakeBlend(BlendMode.SrcOver, blur, tint);
        if (!maskShaderInst) {
            return tinted;
        }
        return Skia.ImageFilter.MakeBlend(BlendMode.SrcIn, tinted, Skia.ImageFilter.MakeShader(maskShaderInst));
    }, [headerRect, resolvedHeaderRect]);

    const filter = hasHeaderRect ? (shaderFilter ?? fallbackFilter) : null;

    // removed inputBarFilter pass to ensure only the input field chip is frosted

    // Build a reusable frosted filter (blur + light screen) and clip it to the input field rrect
    const inputFieldFrostFilter = useMemo(() => {
        const blur = Skia.ImageFilter.MakeBlur(24, 24, TileMode.Clamp);
        const whiteShader = Skia.Shader.MakeColor(Skia.Color('rgba(255,255,255,0.07)'));
        const whiteAsFilter = Skia.ImageFilter.MakeShader(whiteShader);
        return Skia.ImageFilter.MakeBlend(BlendMode.Screen, blur, whiteAsFilter);
    }, []);

    const inputFieldClip = useMemo(() => {
        if (!hasInputFieldRect || !inputFieldRect) return null;
        const { x, y, width: rectWidth, height: rectHeight } = inputFieldRect;
        if (rectWidth === 0 || rectHeight === 0) return null;
        return Skia.RRectXY(Skia.XYWHRect(x, y, rectWidth, rectHeight), 16, 16);
    }, [hasInputFieldRect, inputFieldRect]);

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group dither>
                {drawBackground && (
                    <>
                        <Fill>
                            <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={colors.linear} />
                        </Fill>
                        <Rect x={0} y={0} width={width} height={height}>
                            <RadialGradient c={vec(width * 0.2, height * 0.2)} r={Math.max(width, height) * 0.45} colors={[colors.radialA, 'rgba(0,0,0,0)']} positions={[0, 1]} />
                        </Rect>
                        <Rect x={0} y={0} width={width} height={height}>
                            <RadialGradient c={vec(width * 0.8, height * 0.8)} r={Math.max(width, height) * 0.40} colors={[colors.radialB, 'rgba(0,0,0,0)']} positions={[0, 1]} />
                        </Rect>
                        <Rect x={0} y={0} width={width} height={height}>
                            <RadialGradient c={vec(width * 0.55, height * 0.5)} r={Math.max(width, height) * 0.44} colors={[colors.radialC, 'rgba(0,0,0,0)']} positions={[0, 1]} />
                        </Rect>
                    </>
                )}
                {filter && includeHeaderFilter && (
                    <BackdropFilter filter={<ImageFilter filter={filter} />} />
                )}
                {enableInputBlur && inputFieldClip && (
                    <Group clip={inputFieldClip} layer>
                        <BackdropFilter filter={<ImageFilter filter={inputFieldFrostFilter} />} />
                    </Group>
                )}
            </Group>
        </Canvas>
    );
};
