import React, { useMemo } from 'react';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import { MenuIconSkia, MenuIconName } from './MenuIconSkia';

interface MenuIconSvgProps {
  name: Exclude<MenuIconName, 'debug' | 'fullscreen'>;
  size?: number;
  color?: string;
}

// AUTO-GENERATED: BEGIN WEB_ICON_DEFS (do not edit by hand)
const WEB_ICONS: Record<string, string> = {
  font: `

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-font-stroke, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 18l4-12 4 12"/>
      <path d="M6.8 13h6.4"/>
      <path d="M17 7v4" stroke="var(--icon-font-plus, #34d399)"/>
      <path d="M15 9h4" stroke="var(--icon-font-plus, #34d399)"/>
    </svg>
  `,
  theme: `

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--icon-palette-stroke, currentColor)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3c-4.97 0-9 3.58-9 8 0 2.5 2 4 4 4h1c1.1 0 2 .9 2 2s.9 2 2 2c4.2 0 8-3.1 8-8s-4.03-8-9-8z"/>
      <circle cx="8.5" cy="9" r="2.6" fill="var(--icon-palette-s1, #60a5fa)"/>
      <circle cx="11.6" cy="7.6" r="2.6" fill="var(--icon-palette-s2, #f472b6)"/>
      <circle cx="15.6" cy="10.6" r="2.6" fill="var(--icon-palette-s4, #fde047)"/>
      <circle cx="9.4" cy="13.6" r="2.6" fill="var(--icon-palette-s3, #34d399)"/>
      <circle cx="12.9" cy="12.9" r="2.2" fill="var(--icon-palette-s5, #f97316)"/>
    </svg>
  `,
  note: `

    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <g transform=\"translate(12,12) scale(1.28) translate(-12,-12)\">
      <!-- Page base with fold -->
      <path d=\"M8 5h7l3 3v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z\" fill=\"var(--icon-notepad-base, #f59e0b)\" stroke=\"currentColor\" stroke-width=\"0.6\"/>
      <path d=\"M15 5v3h3\" fill=\"var(--icon-notepad-fold, #fde68a)\"/>
      <!-- Ruled lines -->
      <path d=\"M11 10h7M11 13h7M11 16h5\" stroke=\"var(--icon-notepad-lines, rgba(255,255,255,0.9))\" stroke-width=\"1.2\"/>
      <!-- Ring holes -->
      <circle cx=\"7\" cy=\"9\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <circle cx=\"7\" cy=\"12\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <circle cx=\"7\" cy=\"15\" r=\"0.7\" fill=\"var(--icon-notepad-rings, rgba(255,255,255,0.98))\"/>
      <!-- Pencil overlay (rotated) -->
      <g transform=\"rotate(-35 17 17)\">
        <rect x=\"13.2\" y=\"16\" width=\"7.2\" height=\"2.1\" rx=\"0.6\" fill=\"var(--icon-notepad-pencil, #fb923c)\"/>
        <rect x=\"20.4\" y=\"16\" width=\"1.2\" height=\"2.1\" fill=\"var(--icon-notepad-ferrule, #9ca3af)\"/>
        <path d=\"M21.6 16l1.5 1.05-1.5 1.05-0.4-0.52z\" fill=\"var(--icon-notepad-tip, #fde68a)\"/>
      </g>
      </g>
    </svg>
  `,
  save: `

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- Body -->
      <path d="M5 5h11l3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" fill="var(--icon-save-body, #0ea5e9)" stroke="currentColor" stroke-width="0.6"/>
      <!-- Label area -->
      <rect x="8" y="6" width="6" height="4" rx="0.8" fill="var(--icon-save-label, #1e293b)"/>
      <!-- Slot / LED -->
      <rect x="9" y="15" width="6" height="2.6" rx="0.8" fill="var(--icon-save-slot, #93c5fd)"/>
      <circle cx="16.5" cy="8" r="0.9" fill="var(--icon-save-slot, #93c5fd)"/>
    </svg>
  `,
  load: `

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- Folder base -->
      <path d="M3.5 7.5h6l1.8 2H20a1.8 1.8 0 0 1 1.8 1.8v6.4A2.3 2.3 0 0 1 19.5 20H6.2A2.7 2.7 0 0 1 3.5 17.3V7.5z" fill="var(--icon-load-folder, #8b5cf6)" stroke="currentColor" stroke-width="0.6"/>
      <!-- Tab -->
      <path d="M3.5 7.5V6.6A2.1 2.1 0 0 1 5.6 4.5h4.2l1.4 1.8H20" fill="var(--icon-load-tab, #a78bfa)"/>
      <!-- Down arrow -->
      <path d="M12 9v6" stroke="var(--icon-load-arrow, #22c55e)" stroke-width="1.8"/>
      <path d="M9.5 13.5L12 16l2.5-2.5" fill="none" stroke="var(--icon-load-arrow, #22c55e)" stroke-width="1.8"/>
    </svg>
  `,
  telemetry: `

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1.6" fill="var(--icon-telemetry-dot, #22c55e)" stroke="none"/>
      <path d="M8.2 9.8a4 4 0 0 0 0 4.4"/>
      <path d="M15.8 9.8a4 4 0 0 1 0 4.4"/>
      <path d="M6 8a7 7 0 0 0 0 8"/>
      <path d="M18 8a7 7 0 0 1 0 8"/>
    </svg>
  `,
};
// AUTO-GENERATED: END WEB_ICON_DEFS

const VAR_OVERRIDES: Record<string, string> = {
  // Notepad (from src/index.css default state)
  'icon-notepad-base': '#f59e0b',
  'icon-notepad-fold': '#fde68a',
  'icon-notepad-lines': 'rgba(255,255,255,0.92)',
  'icon-notepad-rings': 'rgba(255,255,255,0.98)',
  'icon-notepad-pencil': '#22c55e',
  'icon-notepad-ferrule': '#9ca3af',
  'icon-notepad-tip': '#bbf7d0',
  // Save
  'icon-save-body': '#0ea5e9',
  'icon-save-label': '#0b1220',
  'icon-save-slot': '#93c5fd',
  // Load
  'icon-load-folder': '#8b5cf6',
  'icon-load-tab': '#a78bfa',
  'icon-load-arrow': '#22c55e',
};

function sanitize(svg: string, color: string): string {
  let s = svg;
  s = s.replace(/var\(\s*--([^,\s\)]+)\s*,\s*([^\)]+)\)/g, (_m, name: string, fallback: string) => {
    const key = String(name);
    const mapped = VAR_OVERRIDES[key];
    return mapped ? mapped : fallback;
  });
  s = s.replace(/currentColor/g, color);
  return s;
}

const DEFAULT_COLOR: Record<MenuIconSvgProps['name'], string> = {
  font: '#34d399',
  theme: '#f59e0b',
  note: '#fbbf24',
  save: '#38bdf8',
  load: '#a78bfa',
  telemetry: '#22c55e',
};

export const MenuIconSvg: React.FC<MenuIconSvgProps> = ({ name, size = 27, color }) => {
  const raw = WEB_ICONS[name] || null;
  const resolvedColor = color || DEFAULT_COLOR[name] || '#e2e8f0';
  const svgObj = useMemo(() => {
    if (!raw) return null;
    const str = sanitize(raw, resolvedColor);
    try {
      return Skia.SVG.MakeFromString(str) || null;
    } catch {
      return null;
    }
  }, [name, resolvedColor]);

  if (!svgObj) {
    return <MenuIconSkia name={name as MenuIconName} size={size} color={resolvedColor} />;
  }

  return (
    <Canvas style={{ width: size, height: size }}>
      <ImageSVG svg={svgObj} width={size} height={size} x={0} y={0} />
    </Canvas>
  );
};

export default MenuIconSvg;
