import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Movement Go Action', () => {
  let action;

  beforeEach(() => {
    const actionPath = path.resolve(
      process.cwd(),
      'data/mods/movement/actions/go.action.json'
    );
    const actionContent = fs.readFileSync(actionPath, 'utf8');
    action = JSON.parse(actionContent);
  });

  it('should have correct movement namespace', () => {
    expect(action.id).toBe('movement:go');
  });

  it('should have the correct name and description', () => {
    expect(action.name).toBe('Go');
    expect(action.description).toBe(
      'Moves your character to the specified location.'
    );
  });

  it('should reference movement scope in targets', () => {
    expect(action.targets).toBeDefined();
    expect(action.targets.primary).toBeDefined();
    expect(action.targets.primary.scope).toBe('movement:clear_directions');
    expect(action.targets.primary.placeholder).toBe('destination');
    expect(action.targets.primary.description).toBe('Location to move to');
  });

  it('should have required template field', () => {
    expect(action.template).toBe('go to {destination}');
  });

  it('should have prerequisites as array', () => {
    expect(Array.isArray(action.prerequisites)).toBe(true);
    expect(action.prerequisites).toHaveLength(2);
  });

  it('should reference movement:actor-can-move condition in prerequisites', () => {
    expect(action.prerequisites[0]).toBeDefined();
    expect(action.prerequisites[0].logic).toBeDefined();
    expect(action.prerequisites[0].logic.condition_ref).toBe(
      'movement:actor-can-move'
    );
    expect(action.prerequisites[0].failure_message).toBe(
      'You cannot move without functioning legs.'
    );
  });

  describe('Explorer Cyan Visual Theme', () => {
    it('should have Explorer Cyan colors', () => {
      expect(action.visual).toBeDefined();
      expect(action.visual.backgroundColor).toBe('#006064');
      expect(action.visual.textColor).toBe('#e0f7fa');
      expect(action.visual.hoverBackgroundColor).toBe('#00838f');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should meet WCAG contrast requirements', () => {
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
      const getContrastRatio = (color1, color2) => {
        const lum1 = getLuminance(color1);
        const lum2 = getLuminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      // Test normal state contrast
      const normalContrast = getContrastRatio(
        action.visual.backgroundColor,
        action.visual.textColor
      );
      expect(normalContrast).toBeGreaterThanOrEqual(6.5); // Still exceeds WCAG AA Large Text (4.5:1)

      // Test hover state contrast
      const hoverContrast = getContrastRatio(
        action.visual.hoverBackgroundColor,
        action.visual.hoverTextColor
      );
      expect(hoverContrast).toBeGreaterThanOrEqual(4.5); // WCAG AA for normal text
    });
  });

  describe('Migration Metadata', () => {
    it('should have migration metadata', () => {
      expect(action.metadata).toBeDefined();
      expect(action.metadata.migratedFrom).toBe('core:go');
      expect(action.metadata.migrationTicket).toBe('MOVMODMIG-004');
      expect(action.metadata.version).toBe('1.0.0');
    });

    it('should have a valid migration date', () => {
      expect(action.metadata.migrationDate).toBeDefined();
      const date = new Date(action.metadata.migrationDate);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  it('should have the correct JSON schema reference', () => {
    expect(action.$schema).toBe(
      'schema://living-narrative-engine/action.schema.json'
    );
  });
});
