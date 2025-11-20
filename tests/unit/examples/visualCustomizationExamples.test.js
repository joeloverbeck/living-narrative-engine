/**
 * @file Tests for visual customization example mods
 * Verifies that example mods load correctly and visual properties are present
 */

const {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} = require('@jest/globals');
const { IntegrationTestBed } = require('../../common/integrationTestBed.js');
const fs = require('fs');
const path = require('path');

describe('Visual Customization Examples', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Combat Actions Example Mod', () => {
    it('should have valid mod manifest', () => {
      const manifestPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'mod-manifest.json'
      );

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.id).toBe('visual_combat_actions');
      expect(manifest.name).toBe('Visual Combat Actions Example');
      expect(manifest.dependencies).toContain('core');
    });

    it('should have power_attack action with red visual theme', () => {
      const actionPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'actions',
        'power_attack.action.json'
      );

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      expect(action.id).toBe('visual_combat_actions:power_attack');
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#d32f2f');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#c62828');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have defensive_stance action with green visual theme', () => {
      const actionPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'actions',
        'defensive_stance.action.json'
      );

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      expect(action.id).toBe('visual_combat_actions:defensive_stance');
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#2e7d32');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#2e7d32');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have magic_missile action with purple visual theme', () => {
      const actionPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'actions',
        'magic_missile.action.json'
      );

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      expect(action.id).toBe('visual_combat_actions:magic_missile');
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#7b1fa2');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#9c27b0');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Social Actions Example Mod', () => {
    it('should have valid mod manifest', () => {
      const manifestPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-social-actions',
        'mod-manifest.json'
      );

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.id).toBe('visual_social_actions');
      expect(manifest.name).toBe('Visual Social Actions Example');
      expect(manifest.dependencies).toContain('core');
    });

    it('should have friendly_greeting action with green visual theme', () => {
      const actionPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-social-actions',
        'actions',
        'friendly_greeting.action.json'
      );

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      expect(action.id).toBe('visual_social_actions:friendly_greeting');
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#2e7d32');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#1b5e20');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have intimidate action with dark red visual theme', () => {
      const actionPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-social-actions',
        'actions',
        'intimidate.action.json'
      );

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      expect(action.id).toBe('visual_social_actions:intimidate');
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#bf360c');
      expect(action.visual.textColor).toBe('#ffffff');
      expect(action.visual.hoverBackgroundColor).toBe('#bf360c');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Visual Properties Validation', () => {
    it('should validate all example actions have valid CSS colors', () => {
      const colorRegex =
        /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-z]+)$/i;

      const validateAction = (actionPath) => {
        const actionContent = fs.readFileSync(actionPath, 'utf8');
        const action = JSON.parse(actionContent);

        if (action.visual) {
          if (action.visual.backgroundColor) {
            expect(action.visual.backgroundColor).toMatch(colorRegex);
          }
          if (action.visual.textColor) {
            expect(action.visual.textColor).toMatch(colorRegex);
          }
          if (action.visual.hoverBackgroundColor) {
            expect(action.visual.hoverBackgroundColor).toMatch(colorRegex);
          }
          if (action.visual.hoverTextColor) {
            expect(action.visual.hoverTextColor).toMatch(colorRegex);
          }
        }
      };

      // Test combat actions
      const combatActionsDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'actions'
      );
      const combatActions = fs.readdirSync(combatActionsDir);
      combatActions.forEach((file) => {
        if (file.endsWith('.action.json')) {
          validateAction(path.join(combatActionsDir, file));
        }
      });

      // Test social actions
      const socialActionsDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-social-actions',
        'actions'
      );
      const socialActions = fs.readdirSync(socialActionsDir);
      socialActions.forEach((file) => {
        if (file.endsWith('.action.json')) {
          validateAction(path.join(socialActionsDir, file));
        }
      });
    });

    it('should ensure all color combinations meet basic contrast requirements', () => {
      // Simple luminance calculation for basic contrast checking
      const getLuminance = (hexColor) => {
        const rgb = hexColor.match(
          /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
        );
        if (!rgb) return 0;

        const r = parseInt(rgb[1], 16) / 255;
        const g = parseInt(rgb[2], 16) / 255;
        const b = parseInt(rgb[3], 16) / 255;

        const sRGB = [r, g, b].map((val) => {
          if (val <= 0.03928) {
            return val / 12.92;
          }
          return Math.pow((val + 0.055) / 1.055, 2.4);
        });

        return sRGB[0] * 0.2126 + sRGB[1] * 0.7152 + sRGB[2] * 0.0722;
      };

      const getContrastRatio = (hex1, hex2) => {
        const lum1 = getLuminance(hex1);
        const lum2 = getLuminance(hex2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      };

      const checkActionContrast = (actionPath) => {
        const actionContent = fs.readFileSync(actionPath, 'utf8');
        const action = JSON.parse(actionContent);

        if (action.visual) {
          // Check main colors
          if (action.visual.backgroundColor && action.visual.textColor) {
            // Only check if both are hex colors
            if (
              action.visual.backgroundColor.startsWith('#') &&
              action.visual.textColor.startsWith('#')
            ) {
              const ratio = getContrastRatio(
                action.visual.backgroundColor,
                action.visual.textColor
              );
              // WCAG AA requires 4.5:1 for normal text
              if (ratio < 4.5) {
                console.log(
                  `Main contrast fail for ${action.id}: ${action.visual.backgroundColor} vs ${action.visual.textColor} = ${ratio}`
                );
              }
              expect(ratio).toBeGreaterThanOrEqual(4.5);
            }
          }

          // Check hover colors
          if (
            action.visual.hoverBackgroundColor &&
            action.visual.hoverTextColor
          ) {
            if (
              action.visual.hoverBackgroundColor.startsWith('#') &&
              action.visual.hoverTextColor.startsWith('#')
            ) {
              const ratio = getContrastRatio(
                action.visual.hoverBackgroundColor,
                action.visual.hoverTextColor
              );
              if (ratio < 4.5) {
                console.log(
                  `Hover contrast fail for ${action.id}: ${action.visual.hoverBackgroundColor} vs ${action.visual.hoverTextColor} = ${ratio}`
                );
              }
              expect(ratio).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      };

      // Test combat actions
      const combatActionsDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-combat-actions',
        'actions'
      );
      const combatActions = fs.readdirSync(combatActionsDir);
      combatActions.forEach((file) => {
        if (file.endsWith('.action.json')) {
          checkActionContrast(path.join(combatActionsDir, file));
        }
      });

      // Test social actions
      const socialActionsDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'examples',
        'visual-social-actions',
        'actions'
      );
      const socialActions = fs.readdirSync(socialActionsDir);
      socialActions.forEach((file) => {
        if (file.endsWith('.action.json')) {
          checkActionContrast(path.join(socialActionsDir, file));
        }
      });
    });
  });
});
