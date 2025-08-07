/**
 * @file Tests to validate INTMIG-003 Batch 2 touch actions migration
 * @description Ensures all 6 touch actions migrated correctly from scope to targets format
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('INTMIG-003 Touch Actions Migration Validation', () => {
  const ACTIONS_DIR = 'data/mods/intimacy/actions';
  const MIGRATED_ACTIONS = [
    'brush_hand',
    'feel_arm_muscles',
    'fondle_ass',
    'massage_back',
    'massage_shoulders',
    'place_hand_on_waist',
  ];

  const EXPECTED_TARGETS = {
    brush_hand: 'positioning:close_actors',
    feel_arm_muscles:
      'intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target',
    fondle_ass:
      'intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target',
    massage_back: 'intimacy:close_actors_facing_away',
    massage_shoulders:
      'intimacy:actors_with_arms_facing_each_other_or_behind_target',
    place_hand_on_waist: 'positioning:close_actors',
  };

  describe('Migration Completeness', () => {
    it.each(MIGRATED_ACTIONS)(
      'should have migrated %s from scope to targets',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        // Should not have scope property
        expect(content.scope).toBeUndefined();

        // Should have targets property
        expect(content.targets).toBeDefined();
        expect(typeof content.targets).toBe('string');

        // Should have correct targets value
        expect(content.targets).toBe(EXPECTED_TARGETS[actionName]);
      }
    );
  });

  describe('Cross-Mod Reference Preservation', () => {
    const crossModActions = ['brush_hand', 'place_hand_on_waist'];

    it.each(crossModActions)(
      'should preserve cross-mod positioning reference in %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
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
        const filePath = path.join(ACTIONS_DIR, `${name}.action.json`);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.targets).toBeDefined();
        expect(content.targets.length).toBeGreaterThan(minLength);
        expect(content.targets).toMatch(
          /^intimacy:actors_with_.*_facing_each_other_or_behind_target$/
        );
      }
    );
  });

  describe('Required Property Preservation', () => {
    it.each(MIGRATED_ACTIONS)(
      'should preserve all required properties in %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        // Required schema properties
        expect(content.id).toBeDefined();
        expect(content.id).toBe(`intimacy:${actionName}`);
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
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.required_components).toBeDefined();
        expect(content.required_components.actor).toContain(
          'positioning:closeness'
        );
      }
    );

    const actionsWithForbiddenComponents = [
      'brush_hand',
      'feel_arm_muscles',
      'massage_shoulders',
      'place_hand_on_waist',
    ];

    it.each(actionsWithForbiddenComponents)(
      'should preserve forbidden_components in %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
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
      fondle_ass: "fondle {target}'s ass",
      massage_back: "massage {target}'s back",
      massage_shoulders: "massage {target}'s shoulders",
      place_hand_on_waist: "place a hand on {target}'s waist",
    };

    it.each(MIGRATED_ACTIONS)(
      'should preserve correct template in %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
        const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

        expect(content.template).toBe(expectedTemplates[actionName]);
        expect(content.template).toMatch(/\{target\}/);
      }
    );
  });

  describe('JSON Schema Compliance', () => {
    it.each(MIGRATED_ACTIONS)(
      'should be valid JSON for %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
        const rawContent = await fs.readFile(filePath, 'utf8');

        // Should parse without error
        expect(() => JSON.parse(rawContent)).not.toThrow();
      }
    );

    it.each(MIGRATED_ACTIONS)(
      'should not have both scope and targets in %s',
      async (actionName) => {
        const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
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
