/**
 * Unified Mermaid Configuration Manager
 * Handles all Mermaid initialization, theming, and rendering
 */
import { logger, DEBUG_FLAGS } from './logger';
import type { Mermaid } from 'mermaid';

interface MermaidThemeConfig {
    name: string;
    description: string;
    displayName: string;  // Display name with emoji
    config: {
        theme: string;
        themeVariables: Record<string, string | boolean | number>;
    };
}

interface MermaidThemes {
    [key: string]: MermaidThemeConfig;
}

// Default theme to use when no preference is stored
export const DEFAULT_MERMAID_THEME = 'warm';

// Import theme configurations directly to avoid module resolution issues
const MERMAID_THEMES: MermaidThemes = {
    glass: {
        name: 'Glass Morphism',
        description: 'Translucent elegance matching your glass aesthetic',
        displayName: '✨ Glass Morphism',
        config: {
            theme: 'base',
            themeVariables: {
                darkMode: true,
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                background: '#1a1a2e',
                primaryColor: '#C4E538',
                primaryTextColor: '#1a1a2e',
                primaryBorderColor: '#A6C92E',
                secondaryColor: '#2a2a3e',
                secondaryTextColor: '#e2e8f0',
                secondaryBorderColor: '#3a3a4e',
                tertiaryColor: '#00d4ff',
                tertiaryTextColor: '#1a1a2e',
                tertiaryBorderColor: '#00a8cc',
                noteBkgColor: '#2a2a3e',
                noteTextColor: '#e2e8f0',
                noteBorderColor: '#3a3a4e',
                lineColor: '#e2e8f0',
                textColor: '#e2e8f0',
                mainBkg: '#1f1f33',
                nodeBkg: '#1f1f33',
                nodeBorder: '#3a3a4e',
                clusterBkg: '#252538',
                clusterBorder: '#A6C92E',
                edgeLabelBackground: '#1a1a2e',
                nodeTextColor: '#e2e8f0',
                defaultLinkColor: '#e2e8f0',
                titleColor: '#e2e8f0',
                actorBkg: '#1f1f33',
                actorBorder: '#A6C92E',
                actorTextColor: '#1a1a2e',
                actorLineColor: '#e2e8f0'
            }
        }
    },
    neon: {
        name: 'Neon Cyberpunk',
        description: 'Electric vibes with glowing edges and signature colors',
        displayName: '⚡ Neon Cyberpunk',
        config: {
            theme: 'base',
            themeVariables: {
                darkMode: true,
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: '600',
                background: '#0a0a0a',
                primaryColor: '#C4E538',
                primaryTextColor: '#0a0a0a',
                primaryBorderColor: '#C4E538',
                secondaryColor: '#ff6b6b',
                secondaryTextColor: '#0a0a0a',
                secondaryBorderColor: '#ff6b6b',
                tertiaryColor: '#4ecdc4',
                tertiaryTextColor: '#0a0a0a',
                tertiaryBorderColor: '#4ecdc4',
                noteBkgColor: '#1a1a1a',
                noteTextColor: '#C4E538',
                noteBorderColor: '#C4E538',
                lineColor: '#00d4ff',
                textColor: '#C4E538',
                mainBkg: '#0a0a0a',
                nodeBkg: '#0a0a0a',
                nodeBorder: '#C4E538',
                clusterBkg: '#0f0f0f',
                clusterBorder: '#C4E538',
                edgeLabelBackground: '#0a0a0a',
                nodeTextColor: '#C4E538',
                defaultLinkColor: '#00d4ff',
                titleColor: '#C4E538',
                actorBkg: '#0a0a0a',
                actorBorder: '#C4E538',
                actorTextColor: '#0a0a0a',
                actorLineColor: '#00d4ff'
            }
        }
    },
    minimal: {
        name: 'Minimalist Professional',
        description: 'Clean, modern styling with subtle elegance',
        displayName: '🎯 Minimalist Professional',
        config: {
            theme: 'base',
            themeVariables: {
                darkMode: true,
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: '500',
                background: '#1a1a2e',
                primaryColor: '#e2e8f0',
                primaryTextColor: '#1a1a2e',
                primaryBorderColor: '#c5ced9',
                secondaryColor: '#C4E538',
                secondaryTextColor: '#1a1a2e',
                secondaryBorderColor: '#A6C92E',
                tertiaryColor: '#5BA3D9',
                tertiaryTextColor: '#ffffff',
                tertiaryBorderColor: '#4A92C8',
                noteBkgColor: '#2a2a3e',
                noteTextColor: '#e2e8f0',
                noteBorderColor: '#3a3a4e',
                lineColor: '#9ca3af',
                textColor: '#e2e8f0',
                mainBkg: '#222236',
                nodeBkg: '#222236',
                nodeBorder: '#3a3a4e',
                clusterBkg: '#1f1f33',
                clusterBorder: '#3a3a4e',
                edgeLabelBackground: '#1a1a2e',
                nodeTextColor: '#e2e8f0',
                defaultLinkColor: '#9ca3af',
                titleColor: '#e2e8f0',
                actorBkg: '#222236',
                actorBorder: '#c5ced9',
                actorTextColor: '#1a1a2e',
                actorLineColor: '#9ca3af'
            }
        }
    },
    warm: {
        name: 'Warm Educational',
        description: 'Friendly, approachable colors for learning',
        displayName: '🌟 Warm Educational',
        config: {
            theme: 'base',
            themeVariables: {
                darkMode: true,
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: '500',
                background: '#1a1a2e',
                primaryColor: '#ffd93d',
                primaryTextColor: '#1a1a2e',
                primaryBorderColor: '#e6c235',
                secondaryColor: '#81c784',
                secondaryTextColor: '#1a1a2e',
                secondaryBorderColor: '#6fb473',
                tertiaryColor: '#64b5f6',
                tertiaryTextColor: '#1a1a2e',
                tertiaryBorderColor: '#5aa3e3',
                noteBkgColor: '#2a2a3e',
                noteTextColor: '#ffd93d',
                noteBorderColor: '#3a3a4e',
                lineColor: '#ff8a65',
                textColor: '#ffd93d',
                mainBkg: '#252538',
                nodeBkg: '#252538',
                nodeBorder: '#665522',
                clusterBkg: '#1f1f33',
                clusterBorder: '#6fb473',
                edgeLabelBackground: '#1a1a2e',
                nodeTextColor: '#ffd93d',
                defaultLinkColor: '#ff8a65',
                titleColor: '#ffd93d',
                actorBkg: '#252538',
                actorBorder: '#e6c235',
                actorTextColor: '#1a1a2e',
                actorLineColor: '#ff8a65'
            }
        }
    },
    space: {
        name: 'Deep Space',
        description: 'Cosmic elegance with purple and teal accents',
        displayName: '🌌 Deep Space',
        config: {
            theme: 'base',
            themeVariables: {
                darkMode: true,
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: '500',
                background: '#0a0a1a',
                primaryColor: '#bb86fc',
                primaryTextColor: '#0a0a1a',
                primaryBorderColor: '#9966cc',
                secondaryColor: '#cf6679',
                secondaryTextColor: '#ffffff',
                secondaryBorderColor: '#b85567',
                tertiaryColor: '#ffd93d',
                tertiaryTextColor: '#0a0a1a',
                tertiaryBorderColor: '#e6c235',
                noteBkgColor: '#1a1a2e',
                noteTextColor: '#bb86fc',
                noteBorderColor: '#3a3a4e',
                lineColor: '#03dac6',
                textColor: '#bb86fc',
                mainBkg: '#15152a',
                nodeBkg: '#15152a',
                nodeBorder: '#6644aa',
                clusterBkg: '#0f0f1f',
                clusterBorder: '#03dac6',
                edgeLabelBackground: '#0a0a1a',
                nodeTextColor: '#bb86fc',
                defaultLinkColor: '#03dac6',
                titleColor: '#bb86fc',
                actorBkg: '#15152a',
                actorBorder: '#9966cc',
                actorTextColor: '#0a0a1a',
                actorLineColor: '#03dac6'
            }
        }
    }
};

class MermaidManager {
    private mermaidInstance: Mermaid | null = null;
    private initializationPromise: Promise<void> | null = null;
    private currentTheme: string;
    private themes: MermaidThemes | null = null;
    private isInitialized: boolean = false;

    constructor() {
        // Load theme preference from localStorage
        this.currentTheme = localStorage.getItem('mermaid-theme') || DEFAULT_MERMAID_THEME;
    }

    /**
     * Initialize Mermaid with the current theme
     * This is idempotent - multiple calls will reuse the same promise
     */
    private async initializeMermaid(): Promise<void> {
        // If already initializing, return the existing promise
        if (this.initializationPromise && !this.isInitialized) {
            return this.initializationPromise;
        }

        // If already initialized, return immediately
        if (this.isInitialized) {
            return Promise.resolve();
        }

        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    private async performInitialization(): Promise<void> {
        try {
            // Import mermaid if not already loaded
            if (!this.mermaidInstance) {
                const mermaidModule = await import('mermaid');
                this.mermaidInstance = mermaidModule.default;
            }

            // Use local theme configurations
            if (!this.themes) {
                this.themes = MERMAID_THEMES;
            }

            // Get the theme configuration
            const theme = this.themes[this.currentTheme];
            if (!theme) {
                logger.warn(`Theme "${this.currentTheme}" not found. Using ${DEFAULT_MERMAID_THEME} theme.`);
                this.currentTheme = DEFAULT_MERMAID_THEME;
            }

            // Initialize mermaid with the theme configuration
            // Use 'base' theme to allow custom theme variables
            this.mermaidInstance.initialize({
                startOnLoad: false,
                securityLevel: 'loose',
                theme: 'base', // Use base theme for custom variables
                themeVariables: {
                    ...this.themes[this.currentTheme].config.themeVariables
                },
                flowchart: {
                    htmlLabels: true,
                    curve: 'basis',
                    defaultRenderer: 'elk'
                }
            });

            this.isInitialized = true;
        } catch (error) {
            if (DEBUG_FLAGS.mermaid_debug) {
                logger.error('Failed to initialize Mermaid:', error);
            }
            this.initializationPromise = null;
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Render a Mermaid diagram
     * Ensures initialization before rendering
     */
    async render(id: string, code: string): Promise<{ svg: string }> {
        // Ensure mermaid is initialized
        await this.initializeMermaid();

        if (!this.mermaidInstance) {
            throw new Error('Mermaid failed to initialize');
        }

        try {
            // Use mermaid.render with the provided code
            const result = await this.mermaidInstance.render(id, code);
            return result;
        } catch (error) {
            // Preserve error structure for error recovery system
            throw error;
        }
    }

    /**
     * Change the current theme
     * Forces re-initialization with new theme
     */
    async setTheme(themeName: string): Promise<void> {
        if (themeName === this.currentTheme && this.isInitialized) {
            return; // No change needed
        }

        this.currentTheme = themeName;
        this.isInitialized = false; // Force re-initialization
        this.initializationPromise = null;

        // Save theme preference
        localStorage.setItem('mermaid-theme', themeName);

        // Re-initialize with new theme
        await this.initializeMermaid();
    }

    /**
     * Get the current theme name
     */
    getCurrentTheme(): string {
        return this.currentTheme;
    }

    /**
     * Get available themes
     */
    async getAvailableThemes(): Promise<MermaidThemes> {
        if (!this.themes) {
            this.themes = MERMAID_THEMES;
        }
        return this.themes;
    }
}

// Export singleton instance
export const mermaidManager = new MermaidManager();

// Also export the class for testing
export { MermaidManager };
