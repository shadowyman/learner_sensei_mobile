import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
 

const brandLogo = require('../../assets/brand.png');

const SEGMENT_BACKGROUND = 'rgba(6,19,29,0.7)';
const SEGMENT_BORDER = 'rgba(255,255,255,0.04)';
const WRAPPER_PADDING_V = 10;
 
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
                                onToggleDebug,
                                onToggleFullscreen,
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
                        () => { restartAutoClose(); onToggleDebug(); },
                        () => { restartAutoClose(); onToggleFullscreen(); },
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

const renderControlRows = (
    onToggleFontSize: () => void,
    onToggleTheme: () => void,
    onToggleDebug: () => void,
    onToggleFullscreen: () => void,
    onOpenNotepad: () => void,
    onSave: () => void,
    onLoad: () => void
) => (
    <>
        <View style={styles.controlsRow}>
            <ControlButton label="Toggle font size" onPress={onToggleFontSize} text="A↕" />
            <ControlButton label="Theme" onPress={onToggleTheme} text="🎨" />
            <ControlButton label="Debug" onPress={onToggleDebug} text="🐞" />
            <ControlButton label="Fullscreen" onPress={onToggleFullscreen} text="⤢" />
        </View>
        <View style={styles.controlsRow}>
            <ControlButton label="Notepad" onPress={onOpenNotepad} text="📝" />
            <ControlButton label="Save" onPress={onSave} text="💾" />
            <ControlButton label="Load" onPress={onLoad} text="📂" />
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
    return (
        <View style={styles.navCluster}>
            <NavButton
                label={isPrev ? 'Previous concept' : 'Next concept'}
                text={isPrev ? '⟪' : '⟫'}
                onPress={onConcept}
            />
            <NavButton
                label={isPrev ? 'Previous part' : 'Next part'}
                text={isPrev ? '‹' : '›'}
                onPress={onChunk}
            />
        </View>
    );
};

interface NavButtonProps {
    label: string;
    text: string;
    onPress: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ label, text, onPress }) => (
    <TouchableOpacity
        style={styles.navButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
    >
        <Text style={styles.navIcon}>{text}</Text>
    </TouchableOpacity>
);

interface ControlButtonProps {
    label: string;
    text: string;
    onPress: () => void;
}

const ControlButton: React.FC<ControlButtonProps> = ({ label, text, onPress }) => (
    <TouchableOpacity
        style={styles.controlButton}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
    >
        <Text style={styles.controlButtonText}>{text}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: WRAPPER_PADDING_V,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
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
        flexDirection: 'column',
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
        paddingVertical: 4,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: 'transparent'
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
        paddingVertical: 6,
        backgroundColor: 'transparent',
        flexDirection: 'column',
        gap: 6
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
        gap: 8,
        justifyContent: 'flex-end',
        marginBottom: 4,
        flexWrap: 'nowrap'
    },
    controlButton: {
        minWidth: 38,
        minHeight: 32,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: 'rgba(4,12,20,0.8)'
    },
    controlButtonText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '600'
    }
});

export default SenseiHeader;
