/**
 * @file Integration tests for swing_at_target action discovery
 * Tests action structure, scope configuration, and chanceBased configuration
 */

import { describe, it, expect } from '@jest/globals';
import { readFile } from 'fs/promises';
import actionJson from '../../../../data/mods/weapons/actions/swing_at_target.action.json' assert { type: 'json' };
import conditionJson from '../../../../data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json' assert { type: 'json' };

describe('swing_at_target action definition', () => {
  describe('Action Structure', () => {
    it('should have correct action ID', () => {
      expect(actionJson.id).toBe('weapons:swing_at_target');
    });

    it('should have correct name', () => {
      expect(actionJson.name).toBe('Swing at Target');
    });

    it('should have description', () => {
      expect(actionJson.description).toBeDefined();
      expect(typeof actionJson.description).toBe('string');
      expect(actionJson.description.length).toBeGreaterThan(0);
    });

    it('should enable combination generation', () => {
      expect(actionJson.generateCombinations).toBe(true);
    });

    it('should have template with chance placeholder', () => {
      expect(actionJson.template).toBe(
        'swing {weapon} at {target} ({chance}% chance)'
      );
    });

    it('should include {chance} in template for probability display', () => {
      expect(actionJson.template).toContain('{chance}');
    });
  });

  describe('Required Components', () => {
    it('should require actor to have item-handling-states:wielding component', () => {
      expect(actionJson.required_components).toBeDefined();
      expect(actionJson.required_components.actor).toContain(
        'item-handling-states:wielding'
      );
    });

    it('should require primary target to have weapons:weapon component', () => {
      expect(actionJson.required_components.primary).toContain(
        'weapons:weapon'
      );
    });

    it('should require primary target to have damage-types:damage_capabilities component', () => {
      expect(actionJson.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });
  });

  describe('Target Configuration', () => {
    it('should have primary target defined', () => {
      expect(actionJson.targets).toBeDefined();
      expect(actionJson.targets.primary).toBeDefined();
    });

    it('should use wielded_cutting_weapons scope for primary target', () => {
      expect(actionJson.targets.primary.scope).toBe(
        'weapons:wielded_cutting_weapons'
      );
    });

    it('should use "weapon" placeholder for primary target', () => {
      expect(actionJson.targets.primary.placeholder).toBe('weapon');
    });

    it('should have secondary target defined', () => {
      expect(actionJson.targets.secondary).toBeDefined();
    });

    it('should use actors_in_location scope for secondary target', () => {
      expect(actionJson.targets.secondary.scope).toBe(
        'core:actors_in_location'
      );
    });

    it('should use "target" placeholder for secondary target', () => {
      expect(actionJson.targets.secondary.placeholder).toBe('target');
    });

    it('should have descriptions for both targets', () => {
      expect(actionJson.targets.primary.description).toBeDefined();
      expect(actionJson.targets.secondary.description).toBeDefined();
    });
  });

  describe('chanceBased Configuration', () => {
    it('should have chanceBased enabled', () => {
      expect(actionJson.chanceBased).toBeDefined();
      expect(actionJson.chanceBased.enabled).toBe(true);
    });

    it('should use opposed contest type', () => {
      expect(actionJson.chanceBased.contestType).toBe('opposed');
    });

    it('should reference skills:melee_skill for actor skill', () => {
      expect(actionJson.chanceBased.actorSkill).toBeDefined();
      expect(actionJson.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
    });

    it('should reference skills:defense_skill for target skill', () => {
      expect(actionJson.chanceBased.targetSkill).toBeDefined();
      expect(actionJson.chanceBased.targetSkill.component).toBe(
        'skills:defense_skill'
      );
    });

    it('should use value property for skills', () => {
      expect(actionJson.chanceBased.actorSkill.property).toBe('value');
      expect(actionJson.chanceBased.targetSkill.property).toBe('value');
    });

    it('should have default values for missing skills', () => {
      expect(actionJson.chanceBased.actorSkill.default).toBe(10);
      expect(actionJson.chanceBased.targetSkill.default).toBe(0);
    });

    it('should use ratio formula', () => {
      expect(actionJson.chanceBased.formula).toBe('ratio');
    });

    it('should have probability bounds of 5-95%', () => {
      expect(actionJson.chanceBased.bounds).toBeDefined();
      expect(actionJson.chanceBased.bounds.min).toBe(5);
      expect(actionJson.chanceBased.bounds.max).toBe(95);
    });

    it('should have critical thresholds configured', () => {
      expect(actionJson.chanceBased.outcomes).toBeDefined();
      expect(actionJson.chanceBased.outcomes.criticalSuccessThreshold).toBe(5);
      expect(actionJson.chanceBased.outcomes.criticalFailureThreshold).toBe(95);
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
    });
  });
});

describe('wielded_cutting_weapons scope definition', () => {
  it('should filter wielded items to slashing-capable weapons', async () => {
    const scopeContent = await readFile(
      new URL(
        '../../../../data/mods/weapons/scopes/wielded_cutting_weapons.scope',
        import.meta.url
      ),
      'utf-8'
    );

    expect(scopeContent).toContain('weapons:weapon');
    expect(scopeContent).toContain('damage-types:damage_capabilities');
    expect(scopeContent).toContain('has_damage_capability');
    expect(scopeContent).toContain('"slashing"');
  });
});

describe('event-is-action-swing-at-target condition', () => {
  describe('Condition Structure', () => {
    it('should have correct condition ID', () => {
      expect(conditionJson.id).toBe('weapons:event-is-action-swing-at-target');
    });

    it('should have description', () => {
      expect(conditionJson.description).toBeDefined();
      expect(typeof conditionJson.description).toBe('string');
    });

    it('should use JSON Logic format', () => {
      expect(conditionJson.logic).toBeDefined();
    });

    it('should check for swing_at_target action ID', () => {
      expect(conditionJson.logic['==']).toBeDefined();
      expect(conditionJson.logic['=='][1]).toBe('weapons:swing_at_target');
    });

    it('should reference event.payload.actionId', () => {
      expect(conditionJson.logic['=='][0]).toEqual({
        var: 'event.payload.actionId',
      });
    });
  });

  describe('Schema Compliance', () => {
    it('should reference correct schema', () => {
      expect(conditionJson.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
    });
  });
});
