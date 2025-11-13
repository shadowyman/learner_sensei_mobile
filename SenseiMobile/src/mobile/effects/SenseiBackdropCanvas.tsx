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
// no additional background shader; using built-in Skia dithering via <Group dither>

interface SenseiBackdropCanvasProps {
    headerRect: { x: number; y: number; width: number; height: number } | null;
}

const HEADER_RADIUS = 16;
const DEFAULT_HEADER_RECT = { x: 0, y: 0, width: 0, height: 0 } as const;

// Built-in Skia dithering is enabled via <Group dither>

export const SenseiBackdropCanvas: React.FC<SenseiBackdropCanvasProps> = ({ headerRect }) => {
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
    const FORCE_SHADER = true;
    const useShader = !!headerRect && (FORCE_SHADER || (shaderSupported && !reduceMotion));
    const hasHeaderRect = !!headerRect;
    const resolvedHeaderRect = headerRect ?? DEFAULT_HEADER_RECT;

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
        processUniforms(
            headerRefractiveRibbon,
            {
                transform: convertToColumnMajor3(localMatrix.get()),
                resolution: [width, height],
                box: [0, 0, rectWidth, rectHeight],
                r: HEADER_RADIUS,
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
            `uniform vec4 box; uniform float r; half4 main(vec2 xy) {
               vec2 halfSize = box.zw * 0.5; vec2 local = xy - box.xy - halfSize;
               vec2 q = abs(local) - halfSize + r;
               float d = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
               if (d > 0.0) { return vec4(0.0); }
               return vec4(1.0);
            }`
        );
        if (!maskEffect) {
            return Skia.ImageFilter.MakeBlend(BlendMode.SrcOver, blur, tint);
        }
        const localMatrix = processTransform2d([{ translateX: x }, { translateY: y }]);
        const maskUniforms = processUniforms(
            maskEffect,
            { box: [0, 0, rectWidth, rectHeight], r: HEADER_RADIUS }
        );
        const maskShaderInst = maskEffect.makeShader(maskUniforms, localMatrix);
        const tinted = Skia.ImageFilter.MakeBlend(BlendMode.SrcOver, blur, tint);
        if (!maskShaderInst) {
            return tinted;
        }
        return Skia.ImageFilter.MakeBlend(BlendMode.SrcIn, tinted, Skia.ImageFilter.MakeShader(maskShaderInst));
    }, [headerRect, resolvedHeaderRect]);

    const filter = hasHeaderRect ? (shaderFilter ?? fallbackFilter) : null;

    return (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group dither>
                <Fill>
                    <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={['#0a0a0a', '#1a1a2e', '#16213e']} />
                </Fill>
                <Rect x={0} y={0} width={width} height={height}>
                    <RadialGradient c={vec(width * 0.2, height * 0.2)} r={Math.max(width, height) * 0.45} colors={['rgba(0,212,255,0.18)', 'rgba(0,212,255,0)']} positions={[0, 1]} />
                </Rect>
                <Rect x={0} y={0} width={width} height={height}>
                    <RadialGradient c={vec(width * 0.8, height * 0.8)} r={Math.max(width, height) * 0.4} colors={['rgba(0,212,255,0.08)', 'rgba(0,212,255,0)']} positions={[0, 1]} />
                </Rect>
                <Rect x={0} y={0} width={width} height={height}>
                    <RadialGradient c={vec(width * 0.3, height * 0.6)} r={Math.max(width, height) * 0.35} colors={['rgba(196,229,56,0.05)', 'rgba(196,229,56,0)']} positions={[0, 1]} />
                </Rect>
            </Group>
            {filter && (
                <BackdropFilter filter={<ImageFilter filter={filter} />} />
            )}
        </Canvas>
    );
};
