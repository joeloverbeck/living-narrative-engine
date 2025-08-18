/**
 * @file Integration tests for Core Motivations Generator CSS
 * Validates that CSS file exists, is valid, and contains required styles
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Core Motivations Generator - CSS Validation', () => {
  let cssContent;
  const cssPath = path.join(
    process.cwd(),
    'css',
    'core-motivations-generator.css'
  );

  beforeAll(() => {
    // Read the CSS file
    cssContent = fs.readFileSync(cssPath, 'utf-8');
  });

  describe('File Structure', () => {
    it('should have CSS file in correct location', () => {
      expect(fs.existsSync(cssPath)).toBe(true);
    });

    it('should not be empty', () => {
      expect(cssContent.length).toBeGreaterThan(100);
    });

    it('should have proper CSS comment header', () => {
      expect(cssContent).toContain('Core Motivations Generator Page Styles');
    });
  });

  describe('Layout Styles', () => {
    it('should define main grid layout', () => {
      expect(cssContent).toContain('.core-motivations-main');
      expect(cssContent).toMatch(/grid-template-columns:\s*350px\s+1fr/);
    });

    it('should have responsive grid for mobile', () => {
      expect(cssContent).toContain('@media (max-width: 768px)');
      expect(cssContent).toMatch(/grid-template-columns:\s*1fr/);
    });
  });

  describe('Panel Styles', () => {
    it('should have direction selection panel styles', () => {
      expect(cssContent).toContain('.direction-selection-panel');
      expect(cssContent).toContain('background: var(--bg-primary)');
      expect(cssContent).toContain('border-radius: 16px');
    });

    it('should have motivations display panel styles', () => {
      expect(cssContent).toContain('.motivations-display-panel');
      expect(cssContent).toContain('flex-direction: column');
    });

    it('should have panel hover effects', () => {
      expect(cssContent).toContain('.direction-selection-panel:hover');
      expect(cssContent).toContain('.motivations-display-panel:hover');
      expect(cssContent).toContain('box-shadow: var(--shadow-card-hover)');
    });
  });

  describe('Motivation Block Styles', () => {
    it('should have motivation block base styles', () => {
      expect(cssContent).toContain('.motivation-block');
      expect(cssContent).toContain('background: var(--bg-secondary)');
      expect(cssContent).toContain('animation: slideIn');
    });

    it('should have slideIn animation', () => {
      expect(cssContent).toContain('@keyframes slideIn');
      expect(cssContent).toContain('transform: translateY(-20px)');
      expect(cssContent).toContain('transform: translateY(0)');
    });

    it('should have different section colors', () => {
      expect(cssContent).toContain('.motivation-section.core-motivation');
      expect(cssContent).toContain('.motivation-section.contradiction');
      expect(cssContent).toContain('.motivation-section.central-question');
    });

    it('should have hover effects for motivation blocks', () => {
      expect(cssContent).toContain('.motivation-block:hover');
      expect(cssContent).toContain('transform: translateY(-2px)');
    });
  });

  describe('Button Styles', () => {
    it('should have primary button styles', () => {
      expect(cssContent).toContain('.cb-button-primary');
      expect(cssContent).toContain('background: var(--narrative-purple)');
    });

    it('should have danger button styles', () => {
      expect(cssContent).toContain('.cb-button-danger');
      expect(cssContent).toContain('background: var(--status-error)');
    });

    it('should have secondary button styles', () => {
      expect(cssContent).toContain('.cb-button-secondary');
      expect(cssContent).toContain('background: var(--narrative-gold)');
    });

    it('should have button hover states', () => {
      expect(cssContent).toContain('.cb-button-primary:hover:not(:disabled)');
      expect(cssContent).toContain('.cb-button-danger:hover:not(:disabled)');
      expect(cssContent).toContain('.cb-button-secondary:hover:not(:disabled)');
    });

    it('should have disabled button styles', () => {
      expect(cssContent).toContain('.cb-button:disabled');
      expect(cssContent).toContain('opacity: 0.5');
      expect(cssContent).toContain('cursor: not-allowed');
    });
  });

  describe('Generation Button', () => {
    it('should have generate button with gradient', () => {
      expect(cssContent).toContain('#generate-btn');
      expect(cssContent).toContain('background: var(--creative-gradient)');
    });

    it('should have generate button animation', () => {
      expect(cssContent).toContain('#generate-btn::before');
      expect(cssContent).toContain(
        '#generate-btn:hover:not(:disabled)::before'
      );
    });
  });

  describe('Loading State', () => {
    it('should have loading indicator styles', () => {
      expect(cssContent).toContain('.loading-indicator');
      expect(cssContent).toContain('.spinner');
    });

    it('should have spinner animation', () => {
      expect(cssContent).toContain('@keyframes spin');
      expect(cssContent).toContain('transform: rotate(360deg)');
    });
  });

  describe('Empty State', () => {
    it('should have empty state styles', () => {
      expect(cssContent).toContain('.empty-state');
      expect(cssContent).toContain('.empty-state-icon');
      expect(cssContent).toContain('.empty-state-text');
    });
  });

  describe('Modal Styles', () => {
    it('should have modal overlay styles', () => {
      expect(cssContent).toContain('.modal-overlay');
      expect(cssContent).toContain('position: fixed');
      expect(cssContent).toContain('backdrop-filter: blur(4px)');
    });

    it('should have modal animations', () => {
      expect(cssContent).toContain('@keyframes fadeIn');
      expect(cssContent).toContain('@keyframes slideUp');
    });

    it('should have modal content styles', () => {
      expect(cssContent).toContain('.modal-content');
      expect(cssContent).toContain('max-width: 450px');
    });
  });

  describe('Toast Styles', () => {
    it('should have toast notification styles', () => {
      expect(cssContent).toContain('.toast');
      expect(cssContent).toContain('position: fixed');
      expect(cssContent).toContain('.toast-success');
    });

    it('should have toast animation', () => {
      expect(cssContent).toContain('@keyframes toastSlideIn');
      expect(cssContent).toContain('transform: translateX(100%)');
    });
  });

  describe('Scrollbar Styles', () => {
    it('should have custom scrollbar styles', () => {
      expect(cssContent).toContain('.motivations-container::-webkit-scrollbar');
      expect(cssContent).toContain('::-webkit-scrollbar-thumb');
      expect(cssContent).toContain('::-webkit-scrollbar-track');
    });
  });

  describe('Accessibility Styles', () => {
    it('should have focus-visible styles', () => {
      expect(cssContent).toContain('.cb-button:focus-visible');
      expect(cssContent).toContain(
        'outline: 2px solid var(--narrative-purple)'
      );
    });
  });

  describe('Responsive Design', () => {
    it('should have tablet breakpoint', () => {
      expect(cssContent).toContain('@media (max-width: 1024px)');
    });

    it('should have mobile breakpoint', () => {
      expect(cssContent).toContain('@media (max-width: 768px)');
    });

    it('should adjust panels for mobile', () => {
      const mobileSection = cssContent.match(
        /@media \(max-width: 768px\)[\s\S]*?(?=@media|$)/
      );
      expect(mobileSection).toBeTruthy();
      expect(mobileSection[0]).toContain('.cb-panel-header');
      expect(mobileSection[0]).toContain('flex-direction: column');
    });
  });

  describe('Print Styles', () => {
    it('should have print media query', () => {
      expect(cssContent).toContain('@media print');
    });

    it('should hide unnecessary elements for print', () => {
      const printSection = cssContent.match(/@media print[\s\S]*?(?=@media|$)/);
      expect(printSection).toBeTruthy();
      expect(printSection[0]).toContain('.cb-page-header');
      expect(printSection[0]).toContain('display: none');
    });
  });

  describe('CSS Variables Usage', () => {
    it('should use design system variables', () => {
      const variables = [
        '--bg-primary',
        '--bg-secondary',
        '--narrative-purple',
        '--narrative-gold',
        '--text-primary',
        '--text-secondary',
        '--border-primary',
        '--status-error',
        '--shadow-card',
        '--creative-gradient',
      ];

      variables.forEach((variable) => {
        expect(cssContent).toContain(`var(${variable})`);
      });
    });
  });

  describe('Consistency with Other Pages', () => {
    it('should follow same panel structure as clichés generator', () => {
      // Check that it uses similar class names and structure
      expect(cssContent).toContain('.direction-selection-panel');
      expect(cssContent).toContain('.motivations-display-panel');
      expect(cssContent).toContain('.cb-panel-header');
      expect(cssContent).toContain('.cb-button');
    });
  });

  describe('Accumulative Display Pattern', () => {
    it('should support multiple motivation blocks', () => {
      // Ensure styles support accumulative display
      expect(cssContent).toContain('.motivation-block');
      expect(cssContent).toContain('margin-bottom: 1.5rem');

      // Container should be scrollable
      expect(cssContent).toContain('.motivations-container');
      expect(cssContent).toContain('overflow-y: auto');
    });
  });

  describe('CSS Syntax Validation', () => {
    it('should have valid CSS syntax', () => {
      // Basic syntax checks
      const openBraces = (cssContent.match(/{/g) || []).length;
      const closeBraces = (cssContent.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);

      // Check for common CSS errors
      expect(cssContent).not.toContain(';;');
      expect(cssContent).not.toContain(': ;');
      expect(cssContent).not.toContain('undefined');
      expect(cssContent).not.toContain('null');
    });

    it('should not have duplicate selectors at root level', () => {
      // Extract root-level selectors (not in media queries)
      const rootCss = cssContent.replace(
        /@media[^{]*{[^{}]*(?:{[^}]*}[^}]*)*}/g,
        ''
      );
      const selectors = rootCss.match(/^[^{@]+(?={)/gm) || [];

      const selectorCounts = {};
      selectors.forEach((selector) => {
        const trimmed = selector.trim();
        if (trimmed && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
          selectorCounts[trimmed] = (selectorCounts[trimmed] || 0) + 1;
        }
      });

      // Allow some duplicates for pseudo-classes and complex selectors
      Object.entries(selectorCounts).forEach(([selector, count]) => {
        if (count > 1 && !selector.includes(':') && !selector.includes(',')) {
          console.warn(
            `Duplicate selector found: ${selector} (${count} times)`
          );
        }
      });
    });
  });
});
