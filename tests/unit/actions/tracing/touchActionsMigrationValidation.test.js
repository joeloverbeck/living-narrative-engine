/**
 * @file Tests to validate INTMIG-003 Batch 2 touch actions migration
 * @description Ensures all 6 touch actions migrated correctly from scope to targets format
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('INTMIG-003 Touch Actions Migration Validation', () => {
  // Actions now split between affection and caressing mods after intimacy mod migration
  const ACTION_LOCATIONS = {
    brush_hand: 'data/mods/affection/actions',
    feel_arm_muscles: 'data/mods/caressing/actions',
    fondle_ass: 'data/mods/caressing/actions',
    massage_back: 'data/mods/affection/actions',
    massage_shoulders: 'data/mods/affection/actions',
    place_hand_on_waist: 'data/mods/affection/actions',
  };

  const MIGRATED_ACTIONS = Object.keys(ACTION_LOCATIONS);

  const EXPECTED_TARGETS = {
    brush_hand: 'positioning:close_actors',
    feel_arm_muscles:
      'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target',
    fondle_ass: {
      primary: {
        scope:
          'caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target',
        placeholder: 'primary',
        description: 'Person whose ass to fondle',
      },
      secondary: {
        scope: 'clothing:target_topmost_torso_lower_clothing_no_accessories',
        placeholder: 'secondary',
        description: 'Clothing item over which to fondle',
        contextFrom: 'primary',
      },
    },
    massage_back: 'affection:close_actors_facing_away',
    massage_shoulders:
      'positioning:close_actors_or_entity_kneeling_before_actor',
    place_hand_on_waist: 'positioning:close_actors',
  };

  describe('Migration Completeness', () => {
    it.each(MIGRATED_ACTIONS)(
      'should have migrated %s from scope to targets',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        // Should not have scope property
        expect(content.scope).toBeUndefined();

        // Should have targets property
        expect(content.targets).toBeDefined();

        // Handle both string and object formats
        if (actionName === 'fondle_ass') {
          // fondle_ass uses multi-target format
          expect(typeof content.targets).toBe('object');
          expect(content.targets.primary).toBeDefined();
          expect(content.targets.secondary).toBeDefined();
          expect(content.targets.primary.scope).toBe(
            EXPECTED_TARGETS[actionName].primary.scope
          );
          expect(content.targets.secondary.scope).toBe(
            EXPECTED_TARGETS[actionName].secondary.scope
          );
        } else {
          // Other actions use simple string format
          expect(typeof content.targets).toBe('string');
          expect(content.targets).toBe(EXPECTED_TARGETS[actionName]);
        }
      }
    );
  });

  describe('Cross-Mod Reference Preservation', () => {
    const crossModActions = ['brush_hand', 'place_hand_on_waist'];

    it.each(crossModActions)(
      'should preserve cross-mod positioning reference in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.targets).toBe('positioning:close_actors');
        expect(content.targets).toMatch(/^positioning:/);
      }
    );
  });

  describe('Complex Scope Name Preservation', () => {
    const complexScopeActions = [
      { name: 'feel_arm_muscles', minLength: 60 },
      { name: 'fondle_ass', minLength: 60 },
      { name: 'massage_shoulders', minLength: 55 },
    ];

    it.each(complexScopeActions)(
      'should preserve long scope name for $name',
      async ({ name, minLength }) => {
        const filePath = path.join(
          ACTION_LOCATIONS[name],
          `${name}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.targets).toBeDefined();

        // Handle both formats
        if (name === 'fondle_ass') {
          // fondle_ass uses multi-target format - check primary target's scope
          expect(content.targets.primary).toBeDefined();
          expect(content.targets.primary.scope.length).toBeGreaterThan(
            minLength
          );
          expect(content.targets.primary.scope).toMatch(
            /^caressing:actors_with_.*_facing_each_other_or_behind_target$/
          );
        } else {
          // Other actions use string format
          expect(content.targets.length).toBeGreaterThan(minLength);
          // massage_shoulders uses positioning mod with kneeling support, feel_arm_muscles uses caressing mod
          if (name === 'massage_shoulders') {
            expect(content.targets).toBe('positioning:close_actors_or_entity_kneeling_before_actor');
          } else if (name === 'feel_arm_muscles') {
            expect(content.targets).toMatch(
              /^caressing:actors_with_.*_facing_each_other_or_behind_target$/
            );
          }
        }
      }
    );
  });

  describe('Required Property Preservation', () => {
    it.each(MIGRATED_ACTIONS)(
      'should preserve all required properties in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        // Required schema properties
        expect(content.id).toBeDefined();
        // Action IDs now use the new mod names (affection or caressing)
        const expectedMod = ACTION_LOCATIONS[actionName].includes('affection')
          ? 'affection'
          : 'caressing';
        expect(content.id).toBe(`${expectedMod}:${actionName}`);
        expect(content.name).toBeDefined();
        expect(content.description).toBeDefined();
        expect(content.template).toBeDefined();

        // Should have targets instead of scope
        expect(content.targets).toBeDefined();
        expect(content.scope).toBeUndefined();
      }
    );
  });

  describe('Component Configuration Preservation', () => {
    it.each(MIGRATED_ACTIONS)(
      'should preserve required_components in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.required_components).toBeDefined();
        expect(content.required_components.actor).toContain(
          'positioning:closeness'
        );
      }
    );

    const actionsWithForbiddenComponents = [
      'brush_hand',
      'massage_shoulders',
      'place_hand_on_waist',
    ];

    it.each(actionsWithForbiddenComponents)(
      'should preserve forbidden_components in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.forbidden_components).toBeDefined();
        expect(content.forbidden_components.actor).toBeDefined();
        expect(Array.isArray(content.forbidden_components.actor)).toBe(true);
      }
    );
  });

  describe('Template Preservation', () => {
    const expectedTemplates = {
      brush_hand: "brush {target}'s hand with your own",
      feel_arm_muscles: "feel the hard swell of {target}'s muscles",
      fondle_ass: "fondle {primary}'s ass over the {secondary}",
      massage_back: "massage {target}'s back",
      massage_shoulders: "massage {target}'s shoulders",
      place_hand_on_waist: "place a hand on {target}'s waist",
    };

    it.each(MIGRATED_ACTIONS)(
      'should preserve correct template in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.template).toBe(expectedTemplates[actionName]);

        // Check for appropriate placeholder based on action format
        if (actionName === 'fondle_ass') {
          expect(content.template).toMatch(/\{primary\}/);
          expect(content.template).toMatch(/\{secondary\}/);
        } else {
          expect(content.template).toMatch(/\{target\}/);
        }
      }
    );
  });

  describe('Multi-Target Validation', () => {
    it('should have proper multi-target structure for fondle_ass', async () => {
      const filePath = path.join(
        ACTION_LOCATIONS.fondle_ass,
        'fondle_ass.action.json'
      );
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

      // Validate multi-target structure
      expect(typeof content.targets).toBe('object');
      expect(content.targets.primary).toBeDefined();
      expect(content.targets.secondary).toBeDefined();

      // Validate primary target
      expect(content.targets.primary.scope).toBe(
        'caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target'
      );
      expect(content.targets.primary.placeholder).toBe('primary');
      expect(content.targets.primary.description).toBe(
        'Person whose ass to fondle'
      );

      // Validate secondary target
      expect(content.targets.secondary.scope).toBe(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );
      expect(content.targets.secondary.placeholder).toBe('secondary');
      expect(content.targets.secondary.description).toBe(
        'Clothing item over which to fondle'
      );
      expect(content.targets.secondary.contextFrom).toBe('primary');
    });

    it('should maintain legacy single-target format for other actions', async () => {
      const singleTargetActions = MIGRATED_ACTIONS.filter(
        (a) => a !== 'fondle_ass'
      );

      for (const actionName of singleTargetActions) {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(typeof content.targets).toBe('string');
        expect(content.targets).toMatch(/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/);
      }
    });
  });

  describe('JSON Schema Compliance', () => {
    it.each(MIGRATED_ACTIONS)(
      'should be valid JSON for %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const rawContent = await fs.readFile(filePath, 'utf8');

        // Should parse without error
        expect(() => JSON.parse(rawContent)).not.toThrow();
      }
    );

    it.each(MIGRATED_ACTIONS)(
      'should not have both scope and targets in %s',
      async (actionName) => {
        const filePath = path.join(
          ACTION_LOCATIONS[actionName],
          `${actionName}.action.json`
        );
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        const hasScope = content.scope !== undefined;
        const hasTargets = content.targets !== undefined;

        // Cannot have both (schema violation)
        expect(hasScope && hasTargets).toBe(false);

        // Must have exactly one
        expect(hasScope || hasTargets).toBe(true);

        // Should have targets (migrated format)
        expect(hasTargets).toBe(true);
        expect(hasScope).toBe(false);
      }
    );
  });
});
