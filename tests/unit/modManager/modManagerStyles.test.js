/**
 * @file Tests for mod-manager.css stylesheet
 * @description Validates that the Mod Manager CSS file exists, follows the design system,
 * and includes all required selectors, states, and accessibility features.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('mod-manager.css', () => {
  let cssContent;
  const cssPath = path.join(process.cwd(), 'css', 'mod-manager.css');

  beforeAll(() => {
    cssContent = fs.readFileSync(cssPath, 'utf-8');
  });

  describe('File Structure', () => {
    it('should exist and be non-empty', () => {
      expect(fs.existsSync(cssPath)).toBe(true);
      expect(cssContent.length).toBeGreaterThan(0);
    });

    it('should have proper comment header', () => {
      expect(cssContent).toMatch(/\/\* css\/mod-manager\.css/);
    });
  });

  describe('Layout Selectors', () => {
    it('should define .mod-manager-container', () => {
      expect(cssContent).toMatch(/\.mod-manager-container\s*\{/);
    });

    it('should define .mod-manager-header', () => {
      expect(cssContent).toMatch(/\.mod-manager-header\s*\{/);
    });

    it('should define .mod-manager-main', () => {
      expect(cssContent).toMatch(/\.mod-manager-main\s*\{/);
    });

    it('should define .mod-manager-footer', () => {
      expect(cssContent).toMatch(/\.mod-manager-footer\s*\{/);
    });
  });

  describe('Panel Selectors', () => {
    it('should define .mod-list-panel', () => {
      expect(cssContent).toMatch(/\.mod-list-panel\s*\{/);
    });

    it('should define .panel-header', () => {
      expect(cssContent).toMatch(/\.panel-header\s*\{/);
    });

    it('should define .side-panel', () => {
      expect(cssContent).toMatch(/\.side-panel\s*\{/);
    });

    it('should define .world-panel', () => {
      expect(cssContent).toMatch(/\.world-panel/);
    });

    it('should define .summary-panel', () => {
      expect(cssContent).toMatch(/\.summary-panel/);
    });
  });

  describe('Mod Card Selectors', () => {
    it('should define .mod-card', () => {
      expect(cssContent).toMatch(/\.mod-card\s*\{/);
    });

    it('should define mod card state classes', () => {
      expect(cssContent).toMatch(/\.mod-card\.active-explicit/);
      expect(cssContent).toMatch(/\.mod-card\.active-dependency/);
      expect(cssContent).toMatch(/\.mod-card\.active-core/);
      expect(cssContent).toMatch(/\.mod-card\.inactive/);
      expect(cssContent).toMatch(/\.mod-card\.conflict/);
      expect(cssContent).toMatch(/\.mod-card\.version-warning/);
    });

    it('should define mod card content selectors', () => {
      expect(cssContent).toMatch(/\.mod-card-checkbox/);
      expect(cssContent).toMatch(/\.mod-card-content/);
      expect(cssContent).toMatch(/\.mod-card-header/);
      expect(cssContent).toMatch(/\.mod-card-name/);
      expect(cssContent).toMatch(/\.mod-card-version/);
      expect(cssContent).toMatch(/\.mod-card-description/);
    });

    it('should define mod badge selectors', () => {
      expect(cssContent).toMatch(/\.mod-badge\s*\{/);
      expect(cssContent).toMatch(/\.mod-badge\.core/);
      expect(cssContent).toMatch(/\.mod-badge\.auto/);
      expect(cssContent).toMatch(/\.mod-badge\.conflict/);
      expect(cssContent).toMatch(/\.mod-badge\.warning/);
    });
  });

  describe('World Selection Selectors', () => {
    it('should define .world-list', () => {
      expect(cssContent).toMatch(/\.world-list\s*\{/);
    });

    it('should define .world-option', () => {
      expect(cssContent).toMatch(/\.world-option\s*\{/);
    });

    it('should define .world-option.selected state', () => {
      expect(cssContent).toMatch(/\.world-option\.selected/);
    });
  });

  describe('Button Selectors', () => {
    it('should define .save-button', () => {
      expect(cssContent).toMatch(/\.save-button\s*\{/);
    });

    it('should define save button states', () => {
      expect(cssContent).toMatch(/\.save-button:disabled/);
      expect(cssContent).toMatch(/\.save-button\.saving/);
      expect(cssContent).toMatch(/\.save-button\.saved/);
    });

    it('should define .menu-button styling', () => {
      expect(cssContent).toMatch(/\.menu-button/);
    });

    it('should define .button-secondary', () => {
      expect(cssContent).toMatch(/\.button-secondary/);
    });
  });

  describe('Other UI Elements', () => {
    it('should define .search-container', () => {
      expect(cssContent).toMatch(/\.search-container\s*\{/);
    });

    it('should define .mod-list', () => {
      expect(cssContent).toMatch(/\.mod-list\s*\{/);
    });

    it('should define .summary-content', () => {
      expect(cssContent).toMatch(/\.summary-content\s*\{/);
    });

    it('should define .status-message', () => {
      expect(cssContent).toMatch(/\.status-message\s*\{/);
    });

    it('should define .loading-indicator', () => {
      expect(cssContent).toMatch(/\.loading-indicator\s*\{/);
    });
  });

  describe('Design System Variable Usage', () => {
    it('should use primary background color variable', () => {
      expect(cssContent).toMatch(/var\(--primary-bg-color/);
    });

    it('should use secondary background color variable', () => {
      expect(cssContent).toMatch(/var\(--secondary-bg-color/);
    });

    it('should use panel background color variable', () => {
      expect(cssContent).toMatch(/var\(--panel-bg-color/);
    });

    it('should use panel border color variable', () => {
      expect(cssContent).toMatch(/var\(--panel-border-color/);
    });

    it('should use primary text color variable', () => {
      expect(cssContent).toMatch(/var\(--primary-text-color/);
    });

    it('should use secondary text color variable', () => {
      expect(cssContent).toMatch(/var\(--secondary-text-color/);
    });

    it('should use accent color primary variable', () => {
      expect(cssContent).toMatch(/var\(--accent-color-primary/);
    });

    it('should use spacing variables', () => {
      expect(cssContent).toMatch(/var\(--spacing-/);
    });

    it('should use border radius variables', () => {
      expect(cssContent).toMatch(/var\(--border-radius-/);
    });

    it('should use font family variables', () => {
      expect(cssContent).toMatch(/var\(--font-ui/);
    });

    it('should use button variables', () => {
      expect(cssContent).toMatch(/var\(--button-bg-color/);
      expect(cssContent).toMatch(/var\(--button-text-color/);
    });

    it('should use shadow variables', () => {
      expect(cssContent).toMatch(/var\(--shadow-/);
    });

    it('should use error and success color variables', () => {
      expect(cssContent).toMatch(/var\(--error-text-color/);
      expect(cssContent).toMatch(/var\(--success-text-color/);
    });
  });

  describe('Interactive States', () => {
    it('should define hover states for mod-card', () => {
      expect(cssContent).toMatch(/\.mod-card:hover/);
    });

    it('should define hover states for world-option', () => {
      expect(cssContent).toMatch(/\.world-option:hover/);
    });

    it('should define hover states for save-button', () => {
      expect(cssContent).toMatch(/\.save-button:hover/);
    });

    it('should define focus states for mod-card', () => {
      expect(cssContent).toMatch(/\.mod-card:focus/);
    });

    it('should define focus states for world-option', () => {
      expect(cssContent).toMatch(/\.world-option:focus/);
    });

    it('should define focus states for save-button', () => {
      expect(cssContent).toMatch(/\.save-button:focus/);
    });

    it('should define focus states for search input', () => {
      expect(cssContent).toMatch(/\.search-container input:focus/);
    });
  });

  describe('Animations', () => {
    it('should define pulse keyframes', () => {
      expect(cssContent).toMatch(/@keyframes pulse/);
    });

    it('should define cascadeIn keyframes', () => {
      expect(cssContent).toMatch(/@keyframes cascadeIn/);
    });

    it('should define shake keyframes', () => {
      expect(cssContent).toMatch(/@keyframes shake/);
    });

    it('should define cascade-in animation class', () => {
      expect(cssContent).toMatch(/\.mod-card\.cascade-in/);
    });

    it('should define shake animation class', () => {
      expect(cssContent).toMatch(/\.mod-card\.shake/);
    });
  });

  describe('Responsive Design', () => {
    it('should define 1024px breakpoint', () => {
      expect(cssContent).toMatch(/@media\s*\(\s*max-width:\s*1024px\s*\)/);
    });

    it('should define 768px breakpoint', () => {
      expect(cssContent).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)/);
    });

    it('should adjust grid layout at 1024px breakpoint', () => {
      // Check that .mod-manager-main is modified within a media query
      const mediaQueryMatch = cssContent.match(
        /@media\s*\(\s*max-width:\s*1024px\s*\)[\s\S]*?\.mod-manager-main/
      );
      expect(mediaQueryMatch).toBeTruthy();
    });
  });

  describe('Accessibility Features', () => {
    it('should support prefers-reduced-motion', () => {
      expect(cssContent).toMatch(/prefers-reduced-motion/);
    });

    it('should support prefers-contrast: high', () => {
      expect(cssContent).toMatch(/prefers-contrast:\s*high/);
    });

    it('should use focus-visible for keyboard navigation', () => {
      expect(cssContent).toMatch(/:focus-visible/);
    });

    it('should use accent-color for checkbox styling', () => {
      expect(cssContent).toMatch(/accent-color/);
    });
  });

  describe('Status Message States', () => {
    it('should define error state', () => {
      expect(cssContent).toMatch(/\.status-message\.error/);
    });

    it('should define success state', () => {
      expect(cssContent).toMatch(/\.status-message\.success/);
    });

    it('should define info state', () => {
      expect(cssContent).toMatch(/\.status-message\.info/);
    });
  });

  describe('No Hardcoded Colors', () => {
    it('should not use hardcoded hex colors for main backgrounds', () => {
      // Check that background-color uses variables (except for rgba and known exceptions)
      const backgroundColorMatches = cssContent.match(
        /background-color:\s*#[0-9a-fA-F]{3,6}/g
      );
      // The only exceptions should be in specific fallbacks or comments
      expect(backgroundColorMatches).toBeNull();
    });

    it('should not use hardcoded hex colors for text colors (except in badges)', () => {
      // Main text colors should use variables
      // Badges may use "white" which is acceptable
      const colorDeclarations = cssContent.match(
        /(?<!background-)color:\s*#[0-9a-fA-F]{3,6}/g
      );
      expect(colorDeclarations).toBeNull();
    });
  });
});
