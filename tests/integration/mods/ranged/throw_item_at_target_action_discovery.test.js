/**
 * @file Integration tests for throw_item_at_target action discovery
 * Tests action structure, scope configuration, and chanceBased configuration
 */

import { describe, it, expect } from '@jest/globals';
import { readFile } from 'fs/promises';
import actionJson from '../../../../data/mods/ranged/actions/throw_item_at_target.action.json' assert { type: 'json' };
import conditionJson from '../../../../data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json' assert { type: 'json' };

describe('throw_item_at_target action definition', () => {
  describe('Action Structure', () => {
    it('should have correct action ID', () => {
      expect(actionJson.id).toBe('ranged:throw_item_at_target');
    });

    it('should have correct name', () => {
      expect(actionJson.name).toBe('Throw at Target');
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
        'throw {throwable} at {target} ({chance}% chance)'
      );
    });

    it('should include {chance} in template for probability display', () => {
      expect(actionJson.template).toContain('{chance}');
    });
  });

  describe('Required Components', () => {
    it('should have no required actor components (empty array)', () => {
      expect(actionJson.required_components).toBeDefined();
      expect(actionJson.required_components.actor).toEqual([]);
    });

    it('should require primary target to have items-core:portable component', () => {
      expect(actionJson.required_components.primary).toContain(
        'items-core:portable'
      );
    });

    it('should only require items-core:portable on primary (no weapon requirement)', () => {
      expect(actionJson.required_components.primary).toHaveLength(1);
      expect(actionJson.required_components.primary).not.toContain(
        'weapons:weapon'
      );
      expect(actionJson.required_components.primary).not.toContain(
        'damage-types:damage_capabilities'
      );
    });
  });

  describe('Forbidden Components', () => {
    it('should have forbidden_components defined for actor', () => {
      expect(actionJson.forbidden_components).toBeDefined();
      expect(actionJson.forbidden_components.actor).toBeDefined();
      expect(Array.isArray(actionJson.forbidden_components.actor)).toBe(true);
    });

    it('should forbid hugging state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
    });

    it('should forbid bending over state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'bending-states:bending_over'
      );
    });

    it('should forbid being restrained state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
    });

    it('should forbid restraining state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
    });

    it('should forbid fallen state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'recovery-states:fallen'
      );
    });

    it('should forbid giving_blowjob state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('should forbid doing_complex_performance state', () => {
      expect(actionJson.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Target Configuration', () => {
    it('should have primary target defined', () => {
      expect(actionJson.targets).toBeDefined();
      expect(actionJson.targets.primary).toBeDefined();
    });

    it('should use throwable_items scope for primary target', () => {
      expect(actionJson.targets.primary.scope).toBe('ranged:throwable_items');
    });

    it('should use "throwable" placeholder for primary target', () => {
      expect(actionJson.targets.primary.placeholder).toBe('throwable');
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

    it('should reference skills:ranged_skill for actor skill', () => {
      expect(actionJson.chanceBased.actorSkill).toBeDefined();
      expect(actionJson.chanceBased.actorSkill.component).toBe(
        'skills:ranged_skill'
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

    it('should specify secondary target role for target skill', () => {
      expect(actionJson.chanceBased.targetSkill.targetRole).toBe('secondary');
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

  describe('Visual Properties', () => {
    it('should have visual properties defined', () => {
      expect(actionJson.visual).toBeDefined();
    });

    it('should have correct background color (#2a4a3f)', () => {
      expect(actionJson.visual.backgroundColor).toBe('#2a4a3f');
    });

    it('should have correct text color (#e8f5f0)', () => {
      expect(actionJson.visual.textColor).toBe('#e8f5f0');
    });

    it('should have correct hover background color (#3a5f52)', () => {
      expect(actionJson.visual.hoverBackgroundColor).toBe('#3a5f52');
    });

    it('should have correct hover text color (#ffffff)', () => {
      expect(actionJson.visual.hoverTextColor).toBe('#ffffff');
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

describe('throwable_items scope definition', () => {
  it('should combine wielded items and inventory items', async () => {
    const scopeContent = await readFile(
      new URL(
        '../../../../data/mods/ranged/scopes/throwable_items.scope',
        import.meta.url
      ),
      'utf-8'
    );

    // Should reference wielding component for wielded items
    expect(scopeContent).toContain('item-handling-states:wielding');
    expect(scopeContent).toContain('wielded_item_ids');

    // Should reference inventory component
    expect(scopeContent).toContain('items:inventory');

    // Should filter by portable component
    expect(scopeContent).toContain('items-core:portable');

    // Should use union operator
    expect(scopeContent).toMatch(/\|/);
  });
});

describe('event-is-action-throw-item-at-target condition', () => {
  describe('Condition Structure', () => {
    it('should have correct condition ID', () => {
      expect(conditionJson.id).toBe(
        'ranged:event-is-action-throw-item-at-target'
      );
    });

    it('should have description', () => {
      expect(conditionJson.description).toBeDefined();
      expect(typeof conditionJson.description).toBe('string');
    });

    it('should use JSON Logic format', () => {
      expect(conditionJson.logic).toBeDefined();
    });

    it('should check for throw_item_at_target action ID', () => {
      expect(conditionJson.logic['==']).toBeDefined();
      expect(conditionJson.logic['=='][1]).toBe('ranged:throw_item_at_target');
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
