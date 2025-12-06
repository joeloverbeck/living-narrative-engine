/**
 * @file Integration tests for wield_threateningly action discovery
 * Tests action structure, scope configuration, and discoverability
 */

import { describe, it, expect } from '@jest/globals';
import actionJson from '../../../../data/mods/weapons/actions/wield_threateningly.action.json' assert { type: 'json' };

describe('wield_threateningly action definition', () => {
  describe('Action Structure', () => {
    it('should have correct action ID', () => {
      expect(actionJson.id).toBe('weapons:wield_threateningly');
    });

    it('should have correct name', () => {
      expect(actionJson.name).toBe('Wield Threateningly');
    });

    it('should have description', () => {
      expect(actionJson.description).toBeDefined();
      expect(typeof actionJson.description).toBe('string');
      expect(actionJson.description.length).toBeGreaterThan(0);
    });

    it('should enable combination generation', () => {
      expect(actionJson.generateCombinations).toBe(true);
    });

    it('should have correct template', () => {
      expect(actionJson.template).toBe('wield {target} threateningly');
    });
  });

  describe('Required Components', () => {
    it('should require actor to have inventory component', () => {
      expect(actionJson.required_components).toBeDefined();
      expect(actionJson.required_components.actor).toEqual(['items:inventory']);
    });
  });

  describe('Forbidden Components', () => {
    it('should have forbidden_components defined for actor', () => {
      expect(actionJson.forbidden_components).toBeDefined();
      expect(actionJson.forbidden_components.actor).toBeInstanceOf(Array);
    });

    it('should include positioning:closeness in forbidden list', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });
  });

  describe('Target Configuration', () => {
    it('should have primary target defined', () => {
      expect(actionJson.targets).toBeDefined();
      expect(actionJson.targets.primary).toBeDefined();
    });

    it('should use grabbable_weapons_in_inventory scope for primary target', () => {
      expect(actionJson.targets.primary.scope).toBe(
        'weapons:grabbable_weapons_in_inventory'
      );
    });

    it('should use "target" placeholder for primary target', () => {
      expect(actionJson.targets.primary.placeholder).toBe('target');
    });

    it('should have description for primary target', () => {
      expect(actionJson.targets.primary.description).toBeDefined();
      expect(typeof actionJson.targets.primary.description).toBe('string');
    });

    it('should not have secondary or tertiary targets', () => {
      expect(actionJson.targets.secondary).toBeUndefined();
      expect(actionJson.targets.tertiary).toBeUndefined();
    });
  });

  describe('Visual Configuration - Arctic Steel Color Scheme', () => {
    it('should have visual properties defined', () => {
      expect(actionJson.visual).toBeDefined();
      expect(typeof actionJson.visual).toBe('object');
    });

    it('should use Arctic Steel background color (#112a46)', () => {
      expect(actionJson.visual.backgroundColor).toBe('#112a46');
    });

    it('should use Arctic Steel text color (#e6f1ff)', () => {
      expect(actionJson.visual.textColor).toBe('#e6f1ff');
    });

    it('should use Arctic Steel hover background color (#0b3954)', () => {
      expect(actionJson.visual.hoverBackgroundColor).toBe('#0b3954');
    });

    it('should use Arctic Steel hover text color (#f0f4f8)', () => {
      expect(actionJson.visual.hoverTextColor).toBe('#f0f4f8');
    });
  });

  describe('Schema Compliance', () => {
    it('should reference correct schema', () => {
      expect(actionJson.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });

    it('should have all required action properties', () => {
      expect(actionJson).toHaveProperty('$schema');
      expect(actionJson).toHaveProperty('id');
      expect(actionJson).toHaveProperty('name');
      expect(actionJson).toHaveProperty('description');
      expect(actionJson).toHaveProperty('template');
      expect(actionJson).toHaveProperty('targets');
      expect(actionJson).toHaveProperty('visual');
    });
  });
});
