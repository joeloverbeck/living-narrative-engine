/**
 * @file Integration test for aim_item and lower_aim validation issues
 * @description Tests that condition and rule files for aim_item and lower_aim actions
 * have the correct structure required by their schemas. This test was created to
 * reproduce and prevent validation failures found during mod loading.
 *
 * Background: These files were previously using incorrect property names:
 * - Condition files used "condition" instead of "logic"
 * - Rule files were missing "event_type" and had empty "actions" arrays
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('Items Mod - Aim Item Validation', () => {
  describe('Condition Files Structure', () => {
    it('should have logic property instead of condition property', async () => {
      // Arrange
      const aimItemPath = path.resolve(
        process.cwd(),
        'data/mods/items/conditions/event-is-action-aim-item.condition.json'
      );
      const lowerAimPath = path.resolve(
        process.cwd(),
        'data/mods/items/conditions/event-is-action-lower-aim.condition.json'
      );

      const aimItemData = JSON.parse(await fs.readFile(aimItemPath, 'utf-8'));
      const lowerAimData = JSON.parse(await fs.readFile(lowerAimPath, 'utf-8'));

      // Assert - must have 'logic' property, not 'condition'
      expect(aimItemData).toHaveProperty('logic');
      expect(aimItemData).not.toHaveProperty('condition');
      expect(lowerAimData).toHaveProperty('logic');
      expect(lowerAimData).not.toHaveProperty('condition');

      // Assert - logic should check event.payload.actionId
      expect(aimItemData.logic).toBeDefined();
      expect(lowerAimData.logic).toBeDefined();
    });
  });

  describe('Rule Files Structure', () => {
    it('should have required event_type and non-empty actions', async () => {
      // Arrange
      const aimItemPath = path.resolve(
        process.cwd(),
        'data/mods/items/rules/handle_aim_item.rule.json'
      );
      const lowerAimPath = path.resolve(
        process.cwd(),
        'data/mods/items/rules/handle_lower_aim.rule.json'
      );

      const aimItemData = JSON.parse(await fs.readFile(aimItemPath, 'utf-8'));
      const lowerAimData = JSON.parse(await fs.readFile(lowerAimPath, 'utf-8'));

      // Assert - must have event_type (required by schema)
      expect(aimItemData).toHaveProperty('event_type');
      expect(aimItemData.event_type).toBe('core:attempt_action');
      expect(lowerAimData).toHaveProperty('event_type');
      expect(lowerAimData.event_type).toBe('core:attempt_action');

      // Assert - actions array must have at least one item (minItems: 1 in schema)
      expect(aimItemData.actions).toBeInstanceOf(Array);
      expect(aimItemData.actions.length).toBeGreaterThan(0);
      expect(lowerAimData.actions).toBeInstanceOf(Array);
      expect(lowerAimData.actions.length).toBeGreaterThan(0);

      // Assert - should have condition referencing the appropriate condition file
      expect(aimItemData).toHaveProperty('condition');
      expect(aimItemData.condition).toHaveProperty('condition_ref');
      expect(aimItemData.condition.condition_ref).toBe(
        'items:event-is-action-aim-item'
      );
      expect(lowerAimData).toHaveProperty('condition');
      expect(lowerAimData.condition).toHaveProperty('condition_ref');
      expect(lowerAimData.condition.condition_ref).toBe(
        'items:event-is-action-lower-aim'
      );
    });
  });
});
