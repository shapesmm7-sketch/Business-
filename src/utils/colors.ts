/**
 * Color utilities and brand accent palettes for Brivu PDF & UI rendering
 */
import { CSSProperties } from 'react';
import { TemplateThemeDef, getTemplateConfig } from './templates';
import { ReceiptTemplateId } from '../types';

export interface BrandColorPreset {
  id: string;
  name: string;
  hex: string;
  category: 'classic' | 'modern' | 'vibrant' | 'warm';
}

export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { id: 'emerald', name: 'Emerald Green', hex: '#059669', category: 'classic' },
  { id: 'slate-navy', name: 'Slate Navy', hex: '#0f172a', category: 'classic' },
  { id: 'royal-blue', name: 'Royal Blue', hex: '#2563eb', category: 'modern' },
  { id: 'indigo', name: 'Tech Indigo', hex: '#4f46e5', category: 'modern' },
  { id: 'teal', name: 'Ocean Teal', hex: '#0891b2', category: 'modern' },
  { id: 'forest', name: 'Forest Green', hex: '#166534', category: 'classic' },
  { id: 'crimson', name: 'Crimson Ruby', hex: '#e11d48', category: 'vibrant' },
  { id: 'burgundy', name: 'Burgundy Wine', hex: '#881337', category: 'classic' },
  { id: 'violet', name: 'Deep Violet', hex: '#7c3aed', category: 'vibrant' },
  { id: 'amber', name: 'Warm Amber', hex: '#d97706', category: 'warm' },
  { id: 'espresso', name: 'Dark Espresso', hex: '#3e2723', category: 'warm' },
  { id: 'charcoal', name: 'Charcoal Black', hex: '#18181b', category: 'classic' },
];

export const COLOR_AND_GRADIENT_PRESETS: string[] = [
  // --- Solid Colors (40+) ---
  '#0F172A', '#020617', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#F8FAFC', '#FFFFFF',
  '#FFFBEB', '#FEF3C7', '#FEF08A', '#064E3B', '#047857', '#059669', '#10B981', '#34D399', '#A7F3D0', '#166534',
  '#14532D', '#1E1B4B', '#1E40AF', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#0284C7', '#0891B2', '#06B6D4',
  '#22D3EE', '#4F46E5', '#6366F1', '#818CF8', '#7C3AED', '#8B5CF6', '#A855F7', '#C084FC', '#4C0519', '#881337',
  '#BE123C', '#E11D48', '#F43F5E', '#EF4444', '#F97316', '#FB923C', '#D97706', '#B45309', '#F59E0B', '#FCD34D',
  '#78350F', '#3E2723', '#713F12', '#EC4899', '#F472B6',

  // --- Gradient Swatches (20+) ---
  'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  'linear-gradient(135deg, #064E3B 0%, #059669 100%)',
  'linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)',
  'linear-gradient(135deg, #4C0519 0%, #E11D48 100%)',
  'linear-gradient(135deg, #7C3AED 0%, #C084FC 100%)',
  'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)',
  'linear-gradient(135deg, #0F172A 0%, #059669 100%)',
  'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #000000 0%, #434343 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
  'linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)',
  'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
  'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
  'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
  'linear-gradient(135deg, #30CFD0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)',
];

export function isValidColorOrGradient(val: string | undefined): boolean {
  if (!val) return false;
  const s = val.trim();
  if (s.toLowerCase().includes('gradient')) return true;
  return isValidHex(s);
}

export function formatBgStyle(val: string | undefined): CSSProperties {
  if (!val) return {};
  const s = val.trim();
  if (s.toLowerCase().includes('gradient')) {
    return { background: s };
  }
  return { background: isValidHex(s) ? normalizeHex(s) : s };
}

export function formatTextStyle(val: string | undefined): CSSProperties {
  if (!val) return {};
  const s = val.trim();
  if (s.toLowerCase().includes('gradient')) {
    return {
      background: s,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    };
  }
  return { color: isValidHex(s) ? normalizeHex(s) : s };
}

/**
 * Container-safe text color helper (never sets background-clip: text on wrapper elements
 * that also carry a background fill or hold child boxes).
 */
export function formatSolidTextStyle(val: string | undefined): CSSProperties {
  if (!val) return {};
  const s = val.trim();
  if (s.toLowerCase().includes('gradient')) {
    const hex = extractPrimaryHex(s);
    return hex ? { color: hex } : {};
  }
  return { color: isValidHex(s) ? normalizeHex(s) : s };
}

/**
 * Validates a 3 or 6 digit hex color code
 */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex.trim());
}

/**
 * Normalizes hex string with leading '#'
 */
export function normalizeHex(hex: string): string {
  let clean = hex.trim();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  if (clean.length === 4) {
    clean = '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  return clean.toUpperCase();
}

/**
 * Converts Hex string to [R, G, B] tuple (0-255)
 */
export function hexToRgb(hex: string): [number, number, number] {
  const norm = normalizeHex(hex);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(norm);
  if (!result) {
    return [5, 150, 105]; // fallback emerald
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * Converts RGB tuple to Hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Extracts a primary 6-digit hex color from a solid hex, rgb()/rgba(), or CSS gradient string
 */
export function extractPrimaryHex(val?: string): string | null {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  if (isValidHex(s)) return normalizeHex(s);

  const hexMatch = s.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/);
  if (hexMatch) {
    return normalizeHex(hexMatch[0]);
  }

  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return rgbToHex(
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10)
    );
  }

  return null;
}

/**
 * Calculates relative luminance according to WCAG formula
 */
export function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Returns light [255, 255, 255] or dark [15, 23, 42] based on background contrast
 */
export function getContrastTextColor(rgb: [number, number, number]): [number, number, number] {
  const lum = getLuminance(rgb[0], rgb[1], rgb[2]);
  return lum > 0.45 ? [15, 23, 42] : [255, 255, 255];
}

/**
 * Returns white '#ffffff' or dark '#0f172a' based on background contrast
 */
export function getContrastTextHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = getLuminance(r, g, b);
  return lum > 0.45 ? '#0f172a' : '#ffffff';
}

/**
 * Adjusts color brightness (factor < 0 darkens, factor > 0 lightens)
 */
export function adjustRgbBrightness(
  rgb: [number, number, number],
  factor: number
): [number, number, number] {
  const adjust = (channel: number) => {
    if (factor > 0) {
      return Math.round(channel + (255 - channel) * factor);
    } else {
      return Math.round(channel * (1 + factor));
    }
  };
  return [adjust(rgb[0]), adjust(rgb[1]), adjust(rgb[2])];
}

import { TemplateCustomization } from '../types';

/**
 * Generates an adjusted TemplateThemeDef using custom accent color or full customTheme overrides
 */
export function resolveEffectiveTheme(
  templateId: ReceiptTemplateId = 'modern',
  customAccentColor?: string,
  customTheme?: TemplateCustomization
): TemplateThemeDef {
  const baseConfig = getTemplateConfig(templateId);
  const resolvedAccentHex =
    extractPrimaryHex(customTheme?.accentColor) ||
    extractPrimaryHex(customAccentColor) ||
    extractPrimaryHex(customTheme?.headerBgColor);

  const pdfOverride = { ...baseConfig.pdf };
  let fontFamilyClass = baseConfig.fontFamily;

  if (resolvedAccentHex) {
    const rgb = hexToRgb(resolvedAccentHex);
    const textRgb = getContrastTextColor(rgb);
    const isDarkAccent = getLuminance(rgb[0], rgb[1], rgb[2]) <= 0.45;
    const customHeaderHex = extractPrimaryHex(customTheme?.headerBgColor);
    const headerRgb = customHeaderHex
      ? hexToRgb(customHeaderHex)
      : (isDarkAccent ? rgb : adjustRgbBrightness(rgb, -0.6));

    pdfOverride.accentColor = rgb;
    pdfOverride.badgeBg = rgb;
    pdfOverride.badgeText = textRgb;

    pdfOverride.headerBg = headerRgb;
    pdfOverride.headerText = getContrastTextColor(headerRgb);
    pdfOverride.subText = adjustRgbBrightness(headerRgb, 0.7);

    const customTotalBgHex = extractPrimaryHex(customTheme?.totalBgColor);
    const totalBgSource = customTotalBgHex ? hexToRgb(customTotalBgHex) : rgb;
    pdfOverride.totalBg = totalBgSource;
    pdfOverride.totalText = getContrastTextColor(totalBgSource);
  }

  if (customTheme) {
    const hBgHex = extractPrimaryHex(customTheme.headerBgColor);
    if (hBgHex) {
      const hRgb = hexToRgb(hBgHex);
      pdfOverride.headerBg = hRgb;
      pdfOverride.headerText = getContrastTextColor(hRgb);
      pdfOverride.subText = adjustRgbBrightness(hRgb, 0.7);
    }
    const hTextHex = extractPrimaryHex(customTheme.headerTextColor);
    if (hTextHex) {
      pdfOverride.headerText = hexToRgb(hTextHex);
    }
    const tBgHex = extractPrimaryHex(customTheme.totalBgColor);
    if (tBgHex) {
      const tRgb = hexToRgb(tBgHex);
      pdfOverride.totalBg = tRgb;
      pdfOverride.totalText = getContrastTextColor(tRgb);
    }
    const tTextHex = extractPrimaryHex(customTheme.totalTextColor);
    if (tTextHex) {
      pdfOverride.totalText = hexToRgb(tTextHex);
    }
    const pBgHex = extractPrimaryHex(customTheme.paperBgColor);
    if (pBgHex) {
      pdfOverride.pageBg = hexToRgb(pBgHex);
    }
    const bBgHex = extractPrimaryHex(customTheme.badgeBgColor);
    if (bBgHex) {
      const bRgb = hexToRgb(bBgHex);
      pdfOverride.badgeBg = bRgb;
      const bTextHex = extractPrimaryHex(customTheme.badgeTextColor);
      pdfOverride.badgeText = bTextHex ? hexToRgb(bTextHex) : getContrastTextColor(bRgb);
    }
    if (customTheme.fontFamily) {
      if (customTheme.fontFamily === 'times') {
        pdfOverride.font = 'times';
        fontFamilyClass = 'font-serif';
      } else if (customTheme.fontFamily === 'courier') {
        pdfOverride.font = 'courier';
        fontFamilyClass = 'font-mono';
      } else if (customTheme.fontFamily === 'playfair') {
        pdfOverride.font = 'times';
        fontFamilyClass = 'font-serif';
      } else if (customTheme.fontFamily === 'geist') {
        pdfOverride.font = 'helvetica';
        fontFamilyClass = 'font-sans';
      } else {
        pdfOverride.font = 'helvetica';
        fontFamilyClass = 'font-sans';
      }
    }
  }

  // Automatic contrast validation: ensure badgeBg stands out prominently against headerBg
  if (pdfOverride.headerBg && pdfOverride.badgeBg) {
    const hRgb = pdfOverride.headerBg;
    const bRgb = pdfOverride.badgeBg;
    const hLum = getLuminance(hRgb[0], hRgb[1], hRgb[2]);
    const bLum = getLuminance(bRgb[0], bRgb[1], bRgb[2]);
    const colorDist = Math.abs(bRgb[0] - hRgb[0]) + Math.abs(bRgb[1] - hRgb[1]) + Math.abs(bRgb[2] - hRgb[2]);

    // If badge background is too close to header background (e.g. dark on dark or identical)
    if (Math.abs(bLum - hLum) < 0.25 || colorDist < 80) {
      if (hLum < 0.45) {
        // Dark header (like Modern Slate, Bold, Cyber, Luxury, Vintage)
        if (templateId === 'modern' || !templateId) {
          pdfOverride.badgeBg = [16, 185, 129]; // Signature Emerald-500
          pdfOverride.badgeText = [255, 255, 255];
        } else {
          pdfOverride.badgeBg = [255, 255, 255];
          pdfOverride.badgeText = [15, 23, 42];
        }
      } else {
        // Light header
        pdfOverride.badgeBg = [15, 23, 42];
        pdfOverride.badgeText = [255, 255, 255];
      }
    }
  }

  return {
    ...baseConfig,
    fontFamily: fontFamilyClass,
    badge: customTheme?.badgeText || baseConfig.badge,
    pdf: pdfOverride,
  };
}
