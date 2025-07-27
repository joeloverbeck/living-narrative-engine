/**
 * @file Tests for TargetManager class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import TargetManager from '../../../../src/entities/multiTarget/targetManager.js';

describe('TargetManager', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  describe('Construction and Basic Operations', () => {
    it('should create empty target manager', () => {
      const manager = new TargetManager({ logger });

      expect(manager.getTargetCount()).toBe(0);
      expect(manager.isMultiTarget()).toBe(false);
      expect(manager.getPrimaryTarget()).toBe(null);
    });

    it('should create target manager with initial targets', () => {
      const targets = {
        item: 'knife_123',
        target: 'goblin_456',
      };

      const manager = new TargetManager({ targets, logger });

      expect(manager.getTargetCount()).toBe(2);
      expect(manager.isMultiTarget()).toBe(true);
      expect(manager.getTarget('item')).toBe('knife_123');
      expect(manager.getTarget('target')).toBe('goblin_456');
    });

    it('should add targets individually', () => {
      const manager = new TargetManager({ logger });

      manager.addTarget('primary', 'entity_123');
      manager.addTarget('secondary', 'entity_456');

      expect(manager.getTargetCount()).toBe(2);
      expect(manager.getPrimaryTarget()).toBe('entity_123');
      expect(manager.getTarget('secondary')).toBe('entity_456');
    });

    it('should remove targets', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      const removed = manager.removeTarget('item');

      expect(removed).toBe(true);
      expect(manager.getTargetCount()).toBe(1);
      expect(manager.hasTarget('item')).toBe(false);
      expect(manager.hasTarget('target')).toBe(true);
    });

    it('should return false when removing non-existent target', () => {
      const manager = new TargetManager({ logger });

      const removed = manager.removeTarget('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('Primary Target Management', () => {
    it('should determine primary target automatically', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      // Should prefer 'target' over 'item' based on patterns
      expect(manager.getPrimaryTarget()).toBe('goblin_456');
    });

    it('should use explicit primary target', () => {
      const manager = new TargetManager({
        targets: { primary: 'primary_123', secondary: 'secondary_456' },
        logger,
      });

      expect(manager.getPrimaryTarget()).toBe('primary_123');
    });

    it('should allow setting primary target explicitly', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      manager.setPrimaryTarget('knife_123');

      expect(manager.getPrimaryTarget()).toBe('knife_123');
    });

    it('should throw error when setting invalid primary target', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });

      expect(() => {
        manager.setPrimaryTarget('nonexistent_entity');
      }).toThrow('Entity ID "nonexistent_entity" not found in targets');
    });

    it('should update primary target when removed', () => {
      const manager = new TargetManager({
        targets: { primary: 'primary_123', secondary: 'secondary_456' },
        logger,
      });

      // Remove primary target
      manager.removeTarget('primary');

      // Should fallback to determining new primary
      expect(manager.getPrimaryTarget()).toBe('secondary_456');
    });

    it('should set primary target to null when all targets removed', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });

      manager.removeTarget('item');

      expect(manager.getPrimaryTarget()).toBe(null);
    });
  });

  describe('Target Queries', () => {
    let manager;

    beforeEach(() => {
      manager = new TargetManager({
        targets: {
          item: 'knife_123',
          target: 'goblin_456',
          tool: 'hammer_789',
        },
        logger,
      });
    });

    it('should get target by name', () => {
      expect(manager.getTarget('item')).toBe('knife_123');
      expect(manager.getTarget('nonexistent')).toBe(null);
    });

    it('should check target existence', () => {
      expect(manager.hasTarget('item')).toBe(true);
      expect(manager.hasTarget('nonexistent')).toBe(false);
    });

    it('should check entity ID existence', () => {
      expect(manager.hasEntityId('knife_123')).toBe(true);
      expect(manager.hasEntityId('nonexistent')).toBe(false);
    });

    it('should get target names and entity IDs', () => {
      expect(manager.getTargetNames()).toEqual(['item', 'target', 'tool']);
      expect(manager.getEntityIds()).toEqual([
        'knife_123',
        'goblin_456',
        'hammer_789',
      ]);
    });

    it('should get targets as object', () => {
      expect(manager.getTargetsObject()).toEqual({
        item: 'knife_123',
        target: 'goblin_456',
        tool: 'hammer_789',
      });
    });
  });

  describe('Validation', () => {
    it('should validate correct targets', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty targets', () => {
      const manager = new TargetManager({ logger });

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No targets defined');
    });

    it('should warn about duplicate entity IDs', () => {
      const manager = new TargetManager({ logger });
      manager.addTarget('item', 'same_entity');
      manager.addTarget('target', 'same_entity');

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Duplicate entity IDs found in targets'
      );
    });

    it('should warn about invalid target names', () => {
      const manager = new TargetManager({ logger });
      manager.addTarget('123invalid', 'entity_123'); // Invalid name starts with number

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Target name "123invalid" does not follow conventions'
      );
    });

    it('should warn about invalid entity IDs', () => {
      const manager = new TargetManager({ logger });
      manager.addTarget('item', 'invalid@entity'); // Invalid character

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Entity ID "invalid@entity" does not follow conventions'
      );
    });

    it('should detect when no targets are defined', () => {
      const manager = new TargetManager({ logger });

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No targets defined');
    });
  });

  describe('Utility Methods', () => {
    it('should clone target manager', () => {
      const original = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      const clone = original.clone();

      expect(clone.getTargetsObject()).toEqual(original.getTargetsObject());
      expect(clone.getPrimaryTarget()).toBe(original.getPrimaryTarget());
      expect(clone).not.toBe(original); // Different instances
    });

    it('should merge with another target manager', () => {
      const manager1 = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });

      const manager2 = new TargetManager({
        targets: { target: 'goblin_456', tool: 'sword_789' },
        logger,
      });

      manager1.merge(manager2);

      expect(manager1.getTargetCount()).toBe(3);
      expect(manager1.hasTarget('target')).toBe(true);
      expect(manager1.hasTarget('tool')).toBe(true);
    });

    it('should merge with overwrite option', () => {
      const manager1 = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger,
      });

      const manager2 = new TargetManager({
        targets: { item: 'sword_789' }, // Different item
        logger,
      });

      manager1.merge(manager2, { overwrite: true });

      expect(manager1.getTarget('item')).toBe('sword_789');
    });

    it('should merge with updatePrimary option', () => {
      const manager1 = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });

      const manager2 = new TargetManager({
        targets: { tool: 'hammer_456' },
        primaryTarget: 'hammer_456',
        logger,
      });

      manager1.merge(manager2, { updatePrimary: true });

      expect(manager1.getPrimaryTarget()).toBe('hammer_456');
    });

    it('should throw error when merging with non-TargetManager', () => {
      const manager = new TargetManager({ logger });

      expect(() => {
        manager.merge({ targets: {} });
      }).toThrow('Can only merge with another TargetManager instance');
    });
  });

  describe('JSON Serialization', () => {
    it('should convert to JSON', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123',
        logger,
      });

      const json = manager.toJSON();

      expect(json).toEqual({
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123',
        targetCount: 2,
        isMultiTarget: true,
      });
    });

    it('should create from JSON', () => {
      const json = {
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123',
      };

      const manager = TargetManager.fromJSON(json, logger);

      expect(manager.getTargetsObject()).toEqual(json.targets);
      expect(manager.getPrimaryTarget()).toBe(json.primaryTarget);
    });

    it('should handle empty JSON gracefully', () => {
      const json = {};

      const manager = TargetManager.fromJSON(json, logger);

      expect(manager.getTargetCount()).toBe(0);
      expect(manager.getPrimaryTarget()).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid targets object in constructor', () => {
      expect(() => {
        new TargetManager({ targets: 'invalid', logger });
      }).toThrow('Targets must be an object');
    });

    it('should throw error for array targets in setTargets', () => {
      const manager = new TargetManager({ logger });

      expect(() => {
        manager.setTargets(['invalid']);
      }).toThrow('Targets must be an object');
    });

    it('should throw error for missing target name', () => {
      const manager = new TargetManager({ logger });

      expect(() => {
        manager.addTarget('', 'entity_123');
      }).toThrow();
    });

    it('should throw error for missing entity ID', () => {
      const manager = new TargetManager({ logger });

      expect(() => {
        manager.addTarget('item', '');
      }).toThrow();
    });

    it('should throw error for null targets in setTargets', () => {
      const manager = new TargetManager({ logger });

      expect(() => {
        manager.setTargets(null);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single target scenarios', () => {
      const manager = new TargetManager({
        targets: { item: 'knife_123' },
        logger,
      });

      expect(manager.isMultiTarget()).toBe(false);
      expect(manager.getPrimaryTarget()).toBe('knife_123');
    });

    it('should handle target name priority correctly', () => {
      const manager = new TargetManager({ logger });

      // Add in reverse priority order
      manager.addTarget('item', 'knife_123');
      manager.addTarget('self', 'actor_456');
      manager.addTarget('target', 'goblin_789');
      manager.addTarget('primary', 'sword_101');

      // Should prioritize 'primary' as the primary target
      expect(manager.getPrimaryTarget()).toBe('sword_101');
    });

    it('should handle first target as primary when no priority names', () => {
      const manager = new TargetManager({ logger });

      manager.addTarget('weapon', 'sword_123');
      manager.addTarget('armor', 'shield_456');

      expect(manager.getPrimaryTarget()).toBe('sword_123');
    });
  });
});
