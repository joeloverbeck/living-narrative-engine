import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Explorer Cyan Theme WCAG Compliance', () => {
  // Helper function to calculate relative luminance
  const getLuminance = (hex) => {
    const rgb = hex
      .replace('#', '')
      .match(/.{2}/g)
      .map((x) => parseInt(x, 16) / 255);

    const [r, g, b] = rgb.map((x) => {
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Helper function to calculate contrast ratio
  const calculateContrastRatio = (backgroundColor, textColor) => {
    const bgLum = getLuminance(backgroundColor);
    const textLum = getLuminance(textColor);
    const lighter = Math.max(bgLum, textLum);
    const darker = Math.min(bgLum, textLum);
    return (lighter + 0.05) / (darker + 0.05);
  };

  // Helper to validate color contrast
  const validateColorContrast = (backgroundColor, textColor) => {
    const contrastRatio = calculateContrastRatio(backgroundColor, textColor);
    return {
      contrastRatio,
      meetsWCAG_AA: contrastRatio >= 4.5,
      meetsWCAG_AAA: contrastRatio >= 7,
    };
  };

  describe('Movement Action Color Contrast', () => {
    it('should meet WCAG AA Large Text for normal state', () => {
      const bg = '#006064'; // Explorer Cyan background
      const text = '#e0f7fa'; // Explorer Cyan text
      const contrast = calculateContrastRatio(bg, text);

      // WCAG AA for large text requires 3:1, AA normal requires 4.5:1
      // The actual contrast is ~6.6 which exceeds AA normal text requirement
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      // Expected value is around 6.6
      expect(contrast).toBeCloseTo(6.6, 1);
    });

    it('should meet WCAG AA for hover state', () => {
      const bg = '#00838f'; // Explorer Cyan hover background
      const text = '#ffffff'; // White text on hover
      const contrast = calculateContrastRatio(bg, text);

      // WCAG AA requires 4.5:1 for normal text
      // The actual contrast is ~4.52 which meets AA requirement
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      // Expected value is around 4.52
      expect(contrast).toBeCloseTo(4.52, 1);
    });

    it('should validate action visual properties', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Validate normal state
      const normalResult = validateColorContrast(
        action.visual.backgroundColor,
        action.visual.textColor
      );

      expect(normalResult.meetsWCAG_AA).toBe(true);
      expect(normalResult.meetsWCAG_AAA).toBe(false); // Actually ~6.6, not 7+
      expect(normalResult.contrastRatio).toBeGreaterThanOrEqual(4.5);

      // Validate hover state
      const hoverResult = validateColorContrast(
        action.visual.hoverBackgroundColor,
        action.visual.hoverTextColor
      );

      expect(hoverResult.meetsWCAG_AA).toBe(true);
      expect(hoverResult.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Explorer Cyan Theme Consistency', () => {
    it('should have consistent Explorer Cyan colors in go action', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Verify exact Explorer Cyan color values
      expect(action.visual.backgroundColor).toBe('#006064');
      expect(action.visual.textColor).toBe('#e0f7fa');
      expect(action.visual.hoverBackgroundColor).toBe('#00838f');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should meet WCAG standards for all visual states', () => {
      const states = [
        {
          name: 'normal',
          bg: '#006064',
          text: '#e0f7fa',
          requiredLevel: 'AA', // 4.5:1 (actual is ~6.6)
          requiredRatio: 4.5,
        },
        {
          name: 'hover',
          bg: '#00838f',
          text: '#ffffff',
          requiredLevel: 'AA', // 4.5:1
          requiredRatio: 4.5,
        },
      ];

      states.forEach((state) => {
        const result = validateColorContrast(state.bg, state.text);

        expect(result.contrastRatio).toBeGreaterThanOrEqual(
          state.requiredRatio,
          `${state.name} state should meet WCAG ${state.requiredLevel} (${state.requiredRatio}:1)`
        );

        expect(result.meetsWCAG_AA).toBe(true);
      });
    });
  });

  describe('Color Accessibility for Vision Impairments', () => {
    it('should have sufficient luminance difference', () => {
      const bg = '#006064';
      const text = '#e0f7fa';

      const bgLuminance = getLuminance(bg);
      const textLuminance = getLuminance(text);

      // There should be a significant luminance difference
      const luminanceDiff = Math.abs(textLuminance - bgLuminance);
      expect(luminanceDiff).toBeGreaterThan(0.5);
    });

    it('should work for common color blindness types', () => {
      // Explorer Cyan uses cyan/teal which is generally safe for color blindness
      // as it relies on lightness contrast rather than hue differentiation
      const bg = '#006064';
      const text = '#e0f7fa';

      const contrast = calculateContrastRatio(bg, text);

      // High contrast ratios work for all types of color blindness
      expect(contrast).toBeGreaterThanOrEqual(4.5); // Actually ~6.6
    });
  });

  describe('Visual Properties Validation', () => {
    it('should have all required visual properties', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBeDefined();
      expect(action.visual.textColor).toBeDefined();
      expect(action.visual.hoverBackgroundColor).toBeDefined();
      expect(action.visual.hoverTextColor).toBeDefined();
    });

    it('should use valid hex color codes', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      expect(action.visual.backgroundColor).toMatch(hexColorRegex);
      expect(action.visual.textColor).toMatch(hexColorRegex);
      expect(action.visual.hoverBackgroundColor).toMatch(hexColorRegex);
      expect(action.visual.hoverTextColor).toMatch(hexColorRegex);
    });
  });

  describe('Cross-Browser Color Rendering', () => {
    it('should use web-safe color values', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // All colors should be 6-digit hex codes for consistent rendering
      const colors = [
        action.visual.backgroundColor,
        action.visual.textColor,
        action.visual.hoverBackgroundColor,
        action.visual.hoverTextColor,
      ];

      colors.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.length).toBe(7); // # plus 6 digits
      });
    });
  });

  describe('Theme Migration Validation', () => {
    it('should have migrated from core mod with correct theme', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Should have migration metadata
      expect(action.metadata).toBeDefined();
      expect(action.metadata.migratedFrom).toBe('core:go');

      // Should have Explorer Cyan theme (not the old theme)
      expect(action.visual.backgroundColor).not.toBe('#1976d2'); // Old blue
      expect(action.visual.backgroundColor).toBe('#006064'); // Explorer Cyan
    });
  });
});
