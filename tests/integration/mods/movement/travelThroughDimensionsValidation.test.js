/**
 * @file Integration test to reproduce and verify fix for dimensional travel validation issues
 * Tests rule and entity instance schema validation for the patrol mod
 */

import { describe, it, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

describe('Movement Mod - Travel Through Dimensions Validation', () => {
  describe('Rule Validation - handle_travel_through_dimensions', () => {
    it('should have event_type field after fix', () => {
      const rulePath = path.resolve(
        process.cwd(),
        'data/mods/movement/rules/handle_travel_through_dimensions.rule.json'
      );

      const ruleContent = JSON.parse(fs.readFileSync(rulePath, 'utf-8'));

      // After fix, should have event_type
      expect(ruleContent).toHaveProperty('event_type');
      expect(ruleContent.event_type).toBe('core:attempt_action');
    });

    it('should have actions array instead of operations', () => {
      const rulePath = path.resolve(
        process.cwd(),
        'data/mods/movement/rules/handle_travel_through_dimensions.rule.json'
      );

      const ruleContent = JSON.parse(fs.readFileSync(rulePath, 'utf-8'));

      // After fix, should have actions instead of operations
      expect(ruleContent).toHaveProperty('actions');
      expect(ruleContent).not.toHaveProperty('operations');
      expect(Array.isArray(ruleContent.actions)).toBe(true);
    });

    it('should use condition field with condition_ref', () => {
      const rulePath = path.resolve(
        process.cwd(),
        'data/mods/movement/rules/handle_travel_through_dimensions.rule.json'
      );

      const ruleContent = JSON.parse(fs.readFileSync(rulePath, 'utf-8'));

      // Should have condition object with condition_ref
      expect(ruleContent).toHaveProperty('condition');
      expect(ruleContent.condition).toHaveProperty('condition_ref');
      expect(ruleContent.condition.condition_ref).toBe(
        'movement:event-is-action-travel-through-dimensions'
      );
    });
  });

  describe('Entity Instance Validation - dimensional_rift_blocker', () => {
    it('should have instanceId field after fix', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/patrol/entities/instances/dimensional_rift_blocker.entity.json'
      );

      const entityContent = JSON.parse(fs.readFileSync(entityPath, 'utf-8'));

      // After fix, should have instanceId
      expect(entityContent).toHaveProperty('instanceId');
      expect(entityContent.instanceId).toBe(
        'patrol:dimensional_rift_blocker_instance'
      );
    });

    it('should have correct schema URL', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/patrol/entities/instances/dimensional_rift_blocker.entity.json'
      );

      const entityContent = JSON.parse(fs.readFileSync(entityPath, 'utf-8'));

      // Should have correct schema URL (though this is optional and may not be enforced)
      if (entityContent.$schema) {
        expect(entityContent.$schema).toBe(
          'schema://living-narrative-engine/entity-instance.schema.json'
        );
      }
    });

    it('should have definitionId field', () => {
      const entityPath = path.resolve(
        process.cwd(),
        'data/mods/patrol/entities/instances/dimensional_rift_blocker.entity.json'
      );

      const entityContent = JSON.parse(fs.readFileSync(entityPath, 'utf-8'));

      expect(entityContent).toHaveProperty('definitionId');
      expect(entityContent.definitionId).toBe(
        'patrol:dimensional_rift_blocker'
      );
    });
  });
});
