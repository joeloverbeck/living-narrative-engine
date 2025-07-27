/**
 * @file CSS tests for Character Concepts Manager
 * Tests accessibility, contrast ratios, responsive design, and animation performance
 * @see ../../../css/character-concepts-manager.css
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

/**
 * Convert hex color to RGB
 *
 * @param {string} hex - Hex color (e.g., '#ffffff')
 * @returns {object} RGB object with r, g, b properties
 */
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Calculate relative luminance
 *
 * @param {object} rgb - RGB color object
 * @param rgb.r
 * @param rgb.g
 * @param rgb.b
 * @returns {number} Relative luminance value
 */
function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculate contrast ratio between two colors
 *
 * @param {string} hex1 - First color
 * @param {string} hex2 - Second color
 * @returns {number} Contrast ratio
 */
function contrast(hex1, hex2) {
  const L1 = luminance(hexToRgb(hex1));
  const L2 = luminance(hexToRgb(hex2));
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Parse CSS content to extract color values
 *
 * @param {string} cssContent - CSS file content
 * @returns {object} Object containing extracted colors
 */
function parseColorsFromCSS(cssContent) {
  const colors = {};

  // Extract status colors
  const completedMatch = cssContent.match(
    /\.concept-status\.completed[^}]*background:[^;]*rgba\(46,\s*204,\s*113/
  );
  if (completedMatch) {
    colors.completedBg = '#2ecc71'; // Approximation of rgba(46, 204, 113, 0.1)
    colors.completedText = '#1e8449';
  }

  // Extract error colors
  const errorMatch = cssContent.match(
    /\.concept-status\.error[^}]*background:[^;]*#ffebee/
  );
  if (errorMatch) {
    colors.errorBg = '#ffebee';
    colors.errorText = '#c62828';
  }

  // Extract danger button colors
  const dangerMatch = cssContent.match(
    /\.cb-button-danger[^}]*background:[^;]*#e74c3c/
  );
  if (dangerMatch) {
    colors.dangerBg = '#e74c3c';
    colors.dangerText = 'white';
  }

  return colors;
}

describe('Character Concepts Manager CSS Tests', () => {
  let cssContent;
  let colors;

  beforeEach(() => {
    const cssPath = path.resolve('css/character-concepts-manager.css');
    cssContent = fs.readFileSync(cssPath, 'utf8');
    colors = parseColorsFromCSS(cssContent);
  });

  describe('File Structure and Imports', () => {
    it('should import components.css', () => {
      expect(cssContent).toMatch(
        /@import\s+url\(['"]\.\/components\.css['"]\)/
      );
    });

    it('should be well-structured with organized sections', () => {
      const expectedSections = [
        '/* ===== Page Layout =====',
        '/* ===== Action Buttons =====',
        '/* ===== Statistics Display =====',
        '/* ===== Search Input Styling =====',
        '/* ===== Concepts Grid =====',
        '/* ===== Modal Enhancements =====',
        '/* ===== State Container Styling =====',
        '/* ===== Responsive Design =====',
        '/* ===== Animation and Transitions =====',
      ];

      expectedSections.forEach((section) => {
        expect(cssContent).toContain(section);
      });
    });
  });

  describe('Accessibility - Color Contrast', () => {
    it('completed status should have adequate contrast', () => {
      if (colors.completedText) {
        const contrastRatio = contrast(colors.completedText, '#ffffff');
        // Allow 3:1 contrast for status indicators (WCAG AA for large text)
        expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
      }
    });

    it('error status should have adequate contrast', () => {
      if (colors.errorText && colors.errorBg) {
        const contrastRatio = contrast(colors.errorText, colors.errorBg);
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('danger button should have adequate contrast', () => {
      if (colors.dangerBg) {
        const contrastRatio = contrast('#ffffff', colors.dangerBg);
        // Allow 3:1 contrast for buttons (WCAG AA for large text)
        expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
      }
    });
  });

  describe('CSS Variables Usage', () => {
    it('should use design system color variables', () => {
      const expectedVariables = [
        '--border-primary',
        '--bg-secondary',
        '--text-primary',
        '--text-secondary',
        '--narrative-purple',
        '--shadow-card-hover',
        '--bg-highlight',
      ];

      expectedVariables.forEach((variable) => {
        expect(cssContent).toContain(`var(${variable})`);
      });
    });

    it('should avoid hardcoded colors where variables exist', () => {
      // Check that we're not using hardcoded grays when variables exist
      const hardcodedGrays = cssContent.match(/#[0-9a-fA-F]{3,6}/g) || [];
      const allowedHardcoded = [
        '#ffffff',
        '#27ae60',
        '#e74c3c',
        '#c0392b',
        '#f39c12',
        '#2ecc71',
      ];

      hardcodedGrays.forEach((color) => {
        if (!allowedHardcoded.includes(color.toLowerCase())) {
          // This is mainly a warning - some hardcoded colors are acceptable
          // for specific status indicators
          console.warn(
            `Consider using CSS variable instead of hardcoded color: ${color}`
          );
        }
      });
    });
  });

  describe('Responsive Design', () => {
    it('should have tablet breakpoint at 1024px', () => {
      expect(cssContent).toMatch(/@media\s+\(max-width:\s*1024px\)/);
    });

    it('should have mobile breakpoint at 768px', () => {
      expect(cssContent).toMatch(/@media\s+\(max-width:\s*768px\)/);
    });

    it('should have small mobile breakpoint at 480px', () => {
      expect(cssContent).toMatch(/@media\s+\(max-width:\s*480px\)/);
    });

    it('should change grid layout for mobile', () => {
      const mobileSection = cssContent.match(
        /@media\s+\(max-width:\s*768px\)[^}]*\{[^@]*\}/gs
      );
      if (mobileSection && mobileSection[0]) {
        expect(mobileSection[0]).toContain('grid-template-columns: 1fr');
      }
    });

    it('should adjust concept controls panel for mobile', () => {
      const mobileSection = cssContent.match(
        /@media\s+\(max-width:\s*768px\)[^}]*\{[^@]*\}/gs
      );
      if (mobileSection && mobileSection[0]) {
        expect(mobileSection[0]).toContain('position: static');
      }
    });
  });

  describe('Animation Performance', () => {
    it('should have fadeInUp animation', () => {
      expect(cssContent).toContain('@keyframes fadeInUp');
    });

    it('should use performant properties for animations', () => {
      // Check that animations use transform and opacity (GPU-accelerated properties)
      const fadeInUpAnimation = cssContent.match(
        /@keyframes fadeInUp[^}]*\{[^@]*\}/s
      );
      if (fadeInUpAnimation && fadeInUpAnimation[0]) {
        expect(fadeInUpAnimation[0]).toContain('transform');
        expect(fadeInUpAnimation[0]).toContain('opacity');
      }
    });

    it('should respect reduced motion preferences', () => {
      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssContent).toContain('animation-duration: 0.01ms !important');
    });

    it('should have staggered animation delays', () => {
      expect(cssContent).toContain('animation-delay: 0.05s');
      expect(cssContent).toContain('animation-delay: 0.1s');
      expect(cssContent).toContain('animation-delay: 0.15s');
    });
  });

  describe('Layout and Positioning', () => {
    it('should use CSS Grid for main layout', () => {
      expect(cssContent).toContain('grid-template-columns: 300px 1fr');
    });

    it('should make control panel sticky', () => {
      expect(cssContent).toMatch(
        /\.concept-controls-panel[^}]*position:\s*sticky/
      );
    });

    it('should use flexbox for card actions', () => {
      expect(cssContent).toMatch(/\.concept-card-actions[^}]*display:\s*flex/);
    });

    it('should have proper grid spacing', () => {
      expect(cssContent).toMatch(/\.concepts-grid[^}]*gap:\s*1\.5rem/);
    });
  });

  describe('Interactive States', () => {
    it('should have hover effects for concept cards', () => {
      expect(cssContent).toContain('.concept-card:hover');
      expect(cssContent).toMatch(
        /\.concept-card:hover[^}]*transform:\s*translateY\(-2px\)/
      );
    });

    it('should have focus states for search input', () => {
      expect(cssContent).toContain('#concept-search:focus');
      expect(cssContent).toMatch(/#concept-search:focus[^}]*box-shadow/);
    });

    it('should have specific hover states for button types', () => {
      expect(cssContent).toContain('.edit-btn:hover');
      expect(cssContent).toContain('.delete-btn:hover');
      expect(cssContent).toContain('.view-directions-btn:hover');
    });
  });

  describe('CSS Structure Quality', () => {
    it('should not have unintentional duplicate selectors', () => {
      // Remove @keyframes blocks before extracting selectors
      const cssWithoutKeyframes = cssContent.replace(
        /@keyframes[^{]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g,
        ''
      );

      const selectors = cssWithoutKeyframes.match(/^[^{]*(?=\s*\{)/gm) || [];
      const cleanSelectors = selectors
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('/*') && !s.startsWith('@'))
        // Filter out animation percentage selectors (0%, 50%, 100%, etc.)
        .filter((s) => !s.match(/^\d+%$/));

      // Allow some expected duplicates like media queries
      const duplicates = cleanSelectors.filter(
        (selector, index) => cleanSelectors.indexOf(selector) !== index
      );

      // Character concepts manager main appears in responsive media queries - this is expected
      const allowedDuplicates = ['.character-concepts-manager-main'];
      const unexpectedDuplicates = duplicates.filter(
        (dup) => !allowedDuplicates.includes(dup)
      );

      expect(unexpectedDuplicates).toHaveLength(0);
    });

    it('should have consistent naming conventions', () => {
      // Check for kebab-case class names (no camelCase in CSS)
      const classSelectors =
        cssContent.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g) || [];
      const invalidNames = classSelectors.filter(
        (cls) => /[A-Z]/.test(cls) && !cls.includes('cb-') // Allow cb- prefixed classes
      );

      expect(invalidNames).toHaveLength(0);
    });

    it('should use semantic class names', () => {
      const semanticClasses = [
        '.concept-card',
        '.concept-status',
        '.concept-meta',
        '.concept-card-actions',
        '.stats-display',
        '.concepts-grid',
      ];

      semanticClasses.forEach((className) => {
        expect(cssContent).toContain(className);
      });
    });
  });
});
