import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { PlatformGlassBackground } from '../PlatformGlassBackground';
import { logger } from '../../../logger';

jest.mock('../../../logger', () => ({
    logger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
        debug: jest.fn()
    }
}));

describe('PlatformGlassBackground', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the fallback surface and preserves children without crashing', () => {
        let tree: ReactTestRenderer.ReactTestRenderer | undefined;

        ReactTestRenderer.act(() => {
            tree = ReactTestRenderer.create(
                <PlatformGlassBackground testID="glass-bg-test">
                    <View testID="glass-child" />
                </PlatformGlassBackground>
            );
        });

        expect(tree?.toJSON()).toBeTruthy();
        expect(tree?.root.findAllByProps({ testID: 'glass-bg-test' }).length).toBeGreaterThan(0);
        expect(tree?.root.findAllByProps({ testID: 'glass-child' }).length).toBeGreaterThan(0);
    });

    test('uses a deterministic fallback color surface without legacy blur layers', () => {
        let tree: ReactTestRenderer.ReactTestRenderer | undefined;

        ReactTestRenderer.act(() => {
            tree = ReactTestRenderer.create(
                <PlatformGlassBackground testID="glass-bg-test" />
            );
        });

        const surface = tree?.root.findAllByProps({ testID: 'glass-bg-test' }).at(-1);
        expect(StyleSheet.flatten(surface?.props.style).backgroundColor).toBe('rgba(0,0,0,0.70)');
        expect(tree?.root.findAllByProps({ pointerEvents: 'none' })).toHaveLength(0);
        expect(tree?.root.findAll(node => Boolean(node.props.interactive))).toHaveLength(0);
    });

    test('fallback color cannot be overridden by caller transparent background', () => {
        let tree: ReactTestRenderer.ReactTestRenderer | undefined;

        ReactTestRenderer.act(() => {
            tree = ReactTestRenderer.create(
                <PlatformGlassBackground
                    testID="glass-bg-test"
                    style={{ backgroundColor: 'transparent' }}
                >
                    <View testID="glass-child" />
                </PlatformGlassBackground>
            );
        });

        const surface = tree?.root.findAllByProps({ testID: 'glass-bg-test' }).at(-1);
        expect(StyleSheet.flatten(surface?.props.style).backgroundColor).toBe('rgba(0,0,0,0.70)');
    });

    test('logs when iOS falls back because liquid glass is unsupported', () => {
        ReactTestRenderer.act(() => {
            ReactTestRenderer.create(
                <PlatformGlassBackground testID="glass-bg-log-test" />
            );
        });

        expect(logger.warn).toHaveBeenCalledWith(
            '[MOBILE_PORT_GLASS] liquid glass unsupported, using color fallback',
            expect.objectContaining({
                surface: 'glass-bg-log-test',
                fallbackColor: 'rgba(0,0,0,0.70)'
            })
        );
    });
});
