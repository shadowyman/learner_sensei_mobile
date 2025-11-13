import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavIconSkia } from './NavIconSkia';
import { MenuIconSvg } from './MenuIconSvg';
 

const brandLogo = require('../../assets/brand.png');

const SEGMENT_BACKGROUND = 'rgba(6,19,29,0.7)';
const SEGMENT_BORDER = 'rgba(255,255,255,0.04)';
const WRAPPER_PADDING_V = 10;
const HEADER_OVERLAY_TINT_RGB = '255,255,255';
const HEADER_OVERLAY_INTENSITY = 0.003;
 
const HEADER_AUTO_CLOSE_MS = 3500;
const THRESHOLD_FRACTION = 0.70;
const EXPAND_DURATION_MS = 1000;
const COLLAPSE_DURATION_MS = 500;
const FADE_IN_DURATION_MS = 1000;
const FADE_OUT_DURATION_MS = 400;
const FADE_IN_START_FRACTION = 0.70;
const FADE_IN_END_FRACTION = 1.00;
 

interface SenseiHeaderProps {
    statusText: string;
    onConceptPrev: () => void;
    onConceptNext: () => void;
    onChunkPrev: () => void;
    onChunkNext: () => void;
    onToggleFontSize: () => void;
    onToggleTheme: () => void;
    onToggleDebug: () => void;
    onToggleFullscreen: () => void;
    onOpenNotepad: () => void;
    onSave: () => void;
    onLoad: () => void;
    onLayoutRect?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export const SenseiHeader: React.FC<SenseiHeaderProps> = ({
    statusText,
    onConceptPrev,
    onConceptNext,
    onChunkPrev,
    onChunkNext,
    onToggleFontSize,
    onToggleTheme,
    onToggleDebug,
    onToggleFullscreen,
    onOpenNotepad,
    onSave,
    onLoad,
    onLayoutRect
}) => {
    const [controlsExpanded, setControlsExpanded] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [showEllipsis, setShowEllipsis] = useState(true);
    const widthAnim = useRef(new Animated.Value(ELLIPSIS_WIDTH)).current;
    const [targetWidth, setTargetWidth] = useState(EXPANDED_WIDTH);
    const collapseOpacity = useRef(new Animated.Value(1)).current;
    const ellipsisOpacity = useRef(new Animated.Value(1)).current;
    const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 
    const controlsOpacityBase = useMemo(
        () =>
            widthAnim.interpolate({
                inputRange: [targetWidth * FADE_IN_START_FRACTION, targetWidth * FADE_IN_END_FRACTION],
                outputRange: [0, 1],
                extrapolate: 'clamp'
            }),
        [widthAnim, targetWidth]
    );
    const controlsOpacity = Animated.multiply(controlsOpacityBase, collapseOpacity);

    useEffect(() => {
        if (controlsExpanded) {
            if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current as any);
            autoCloseTimerRef.current = setTimeout(() => setControlsExpanded(false), HEADER_AUTO_CLOSE_MS);
        } else {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current as any);
                autoCloseTimerRef.current = null;
            }
        }
        return () => {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current as any);
                autoCloseTimerRef.current = null;
            }
        };
    }, [controlsExpanded]);

    const restartAutoClose = () => {
        if (!controlsExpanded) return;
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current as any);
        autoCloseTimerRef.current = setTimeout(() => setControlsExpanded(false), HEADER_AUTO_CLOSE_MS);
    };

    useEffect(() => {
        let listenerId: string | null = null;
        if (controlsExpanded) {
            setShowControls(false);
            setShowEllipsis(false);
            collapseOpacity.setValue(1);
            ellipsisOpacity.setValue(0);
            const startThreshold = targetWidth * FADE_IN_START_FRACTION;
            let mounted = false;
            listenerId = widthAnim.addListener(({ value }) => {
                if (!mounted && value >= startThreshold) {
                    mounted = true;
                    setShowControls(true);
                    if (listenerId) {
                        try { widthAnim.removeListener(listenerId); } catch (_) {}
                        listenerId = null;
                    }
                }
            });
            Animated.timing(widthAnim, {
                toValue: targetWidth,
                duration: EXPAND_DURATION_MS,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false
            }).start();
        } else {
            Animated.timing(collapseOpacity, {
                toValue: 0,
                duration: FADE_OUT_DURATION_MS,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false
            }).start(() => {
                setShowControls(false);
                ellipsisOpacity.setValue(1);
                setShowEllipsis(true);
                Animated.timing(widthAnim, {
                    toValue: ELLIPSIS_WIDTH,
                    duration: COLLAPSE_DURATION_MS,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false
                }).start();
            });
        }
        return () => {
            if (listenerId) {
                try { widthAnim.removeListener(listenerId); } catch (_) {}
            }
        };
    }, [controlsExpanded, widthAnim, targetWidth, collapseOpacity]);

    const statusLines = useMemo(() => {
        if (!statusText) {
            return [] as string[];
        }
        return statusText
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
    }, [statusText]);

    const onFlyoutTouchStart = () => {
        // Any interaction inside the flyout resets auto-close timer
        restartAutoClose();
    };

    return (
        <View
            style={styles.wrapper}
            onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                onLayoutRect?.(layout);
            }}
        >
            {HEADER_OVERLAY_INTENSITY > 0 ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${HEADER_OVERLAY_TINT_RGB}, ${HEADER_OVERLAY_INTENSITY})` }]} />
            ) : null}
            <View
                style={styles.brandSegment}
            >
                <Image source={brandLogo} style={styles.brandImage} resizeMode="contain" />
                <Text style={styles.brandLabel}>Recursive Sensei</Text>
                <Text style={styles.brandTagline}>Mentor Mode</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statusSegment}>
                <NavCluster
                    variant="prev"
                    onConcept={onConceptPrev}
                    onChunk={onChunkPrev}
                />
                <View style={styles.statusContent}>
                    <Text style={styles.statusLabel}>Current Focus</Text>
                    {statusLines.length > 0 ? (
                        <>
                            <Text style={styles.statusModule} numberOfLines={1}>{statusLines[0]}</Text>
                            {statusLines.slice(1).map(line => (
                                <Text key={line} style={styles.statusPhase} numberOfLines={1}>
                                    {line}
                                </Text>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.statusPhase}>Loading curriculum…</Text>
                    )}
                </View>
                <NavCluster
                    variant="next"
                    onConcept={onConceptNext}
                    onChunk={onChunkNext}
                />
            </View>
            <View style={styles.divider} />
            <Animated.View style={[styles.controlsSegment, { width: widthAnim }]} onTouchStart={onFlyoutTouchStart}> 
                {showControls && (
                    <View style={styles.controlsExpandedShell} pointerEvents={'auto'}>
                        <Animated.View style={{ opacity: controlsOpacity }}>
                            {renderControlRows(
                                onToggleFontSize,
                                onToggleTheme,
                                onOpenNotepad,
                                onSave,
                                onLoad
                            )}
                        </Animated.View>
                    </View>
                )}
                {showEllipsis && (
                    <Animated.View style={{ opacity: ellipsisOpacity }} pointerEvents={showEllipsis ? 'auto' : 'none'}>
                        <TouchableOpacity
                            style={styles.ellipsisButton}
                            onPress={() => setControlsExpanded(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Show header controls"
                        >
                            <Text style={styles.ellipsisText}>···</Text>
                            <Text style={styles.plusIcon}>＋</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>
            <View
                style={styles.measureContainer}
                pointerEvents="none"
                collapsable={false}
                onLayout={(e) => {
                    const w = Math.ceil(e.nativeEvent.layout.width);
                    if (w > 0 && Math.abs(w - targetWidth) > 0) {
                        setTargetWidth(w);
                    }
                }}
            >
                <View style={styles.controlsExpandedShell}>
                    {renderControlRows(
                        () => { restartAutoClose(); onToggleFontSize(); },
                        () => { restartAutoClose(); onToggleTheme(); },
                        () => { restartAutoClose(); onOpenNotepad(); },
                        () => { restartAutoClose(); onSave(); },
                        () => { restartAutoClose(); onLoad(); }
                    )}
                </View>
            </View>
        </View>
    );
};

const ELLIPSIS_WIDTH = 70;
const EXPANDED_WIDTH = 240;
const CONTROL_BUTTON_SIZE = 32;
const CONTROL_BUTTON_GAP = 8;
const CONTROL_ROW_COLUMNS = 3;
const CONTROL_ROW_WIDTH = CONTROL_BUTTON_SIZE * CONTROL_ROW_COLUMNS + CONTROL_BUTTON_GAP * (CONTROL_ROW_COLUMNS - 1);
const CONTROL_ROW_VERTICAL_GAP = 20;

const renderControlRows = (
    onToggleFontSize: () => void,
    onToggleTheme: () => void,
    onOpenNotepad: () => void,
    onSave: () => void,
    onLoad: () => void
) => (
    <>
        <View style={[styles.controlsRow, styles.controlsRowTop]}>
            <ControlButton label="Toggle font size" onPress={onToggleFontSize} icon="font" />
            <ControlButton label="Theme" onPress={onToggleTheme} icon="theme" />
        </View>
        <View style={styles.controlsRowSpacer} />
        <View style={[styles.controlsRow, styles.controlsRowBottom]}>
            <ControlButton label="Notepad" onPress={onOpenNotepad} icon="note" />
            <ControlButton label="Save" onPress={onSave} icon="save" />
            <ControlButton label="Load" onPress={onLoad} icon="load" />
        </View>
    </>
);

interface NavClusterProps {
    variant: 'prev' | 'next';
    onConcept: () => void;
    onChunk: () => void;
}

const NavCluster: React.FC<NavClusterProps> = ({ variant, onConcept, onChunk }) => {
    const isPrev = variant === 'prev';
    const conceptBtn = (
        <NavButton
            key="concept"
            label={isPrev ? 'Previous concept' : 'Next concept'}
            icon={{ variant: 'double', dir: isPrev ? 'left' : 'right' }}
            onPress={onConcept}
        />
    );
    const chunkBtn = (
        <NavButton
            key="chunk"
            label={isPrev ? 'Previous part' : 'Next part'}
            icon={{ variant: 'single', dir: isPrev ? 'left' : 'right' }}
            onPress={onChunk}
        />
    );
    const children = isPrev ? [conceptBtn, chunkBtn] : [chunkBtn, conceptBtn];
    return <View style={styles.navCluster}>{children}</View>;
};

interface NavButtonProps {
    label: string;
    icon: { variant: 'single' | 'double'; dir: 'left' | 'right' };
    onPress: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ label, icon, onPress }) => (
    <TouchableOpacity
        style={styles.navButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
    >
        <NavIconSkia dir={icon.dir} variant={icon.variant} size={16} color={'#1d3421'} strokeWidth={2} />
    </TouchableOpacity>
);

interface ControlButtonProps {
    label: string;
    icon: 'font' | 'theme' | 'debug' | 'fullscreen' | 'note' | 'save' | 'load';
    onPress: () => void;
}

const ControlButton: React.FC<ControlButtonProps> = ({ label, icon, onPress }) => (
    <TouchableOpacity
        style={styles.controlButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
    >
        <MenuIconSvg name={icon as any} size={27} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: WRAPPER_PADDING_V,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        gap: 12,
        alignItems: 'stretch',
        position: 'relative'
    },
    
    
    brandSegment: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        minWidth: 76
    },
    brandImage: {
        width: 58,
        height: 58,
        borderRadius: 14,
        marginBottom: 6
    },
    brandLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#d9f99d',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        textAlign: 'center'
    },
    brandTagline: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94a3b8',
        textAlign: 'center'
    },
    statusSegment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        gap: 12
    },
    statusContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2
    },
    statusLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: '#d9f99d'
    },
    statusModule: {
        fontSize: 14,
        fontWeight: '700',
        color: '#bef264',
        maxWidth: '100%'
    },
    statusPhase: {
        fontSize: 13,
        fontWeight: '500',
        color: '#facc15',
        maxWidth: '100%'
    },
    navCluster: {
        flexDirection: 'row',
        gap: 6
    },
    navButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(226,242,162,0.85)',
        borderWidth: 1,
        borderColor: 'rgba(248,255,203,0.7)',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 }
    },
    navIcon: {
        fontSize: 16,
        color: '#1d3421',
        fontWeight: '600'
    },
    controlsSegment: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
        paddingVertical: 0,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        minHeight: CONTROL_BUTTON_SIZE * 2 + CONTROL_ROW_VERTICAL_GAP
    },
    ellipsisButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 12
    },
    ellipsisText: {
        fontSize: 20,
        letterSpacing: 2,
        color: '#e2e8f0'
    },
    plusIcon: {
        fontSize: 14,
        color: '#e2e8f0'
    },
    controlsExpandedShell: {
        paddingHorizontal: 12,
        paddingVertical: 0,
        backgroundColor: 'transparent',
        flexDirection: 'column'
    },
    divider: {
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginVertical: -WRAPPER_PADDING_V
    },
    measureContainer: {
        position: 'absolute',
        left: -9999,
        top: 0,
        opacity: 0
    },
    controlsRow: {
        flexDirection: 'row',
        width: CONTROL_ROW_WIDTH,
        gap: CONTROL_BUTTON_GAP,
        marginBottom: 0,
        flexWrap: 'nowrap'
    },
    controlsRowTop: {
        justifyContent: 'center'
    },
    controlsRowBottom: {
        justifyContent: 'space-between'
    },
    controlsRowSpacer: {
        height: CONTROL_ROW_VERTICAL_GAP
    },
    controlButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00353c'
    },
    controlButtonText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '600'
    }
});

export default SenseiHeader;
