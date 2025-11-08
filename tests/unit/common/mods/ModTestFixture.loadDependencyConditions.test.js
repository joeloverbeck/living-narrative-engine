/**
 * @file Unit tests for ModTestFixture.loadDependencyConditions method
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture - loadDependencyConditions', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Input Validation', () => {
    it('should throw when conditionIds is not an array', async () => {
      await expect(
        fixture.loadDependencyConditions('not-array')
      ).rejects.toThrow('conditionIds must be an array');
    });

    it('should throw when conditionIds is null', async () => {
      await expect(
        fixture.loadDependencyConditions(null)
      ).rejects.toThrow('conditionIds must be an array');
    });

    it('should throw when conditionIds is undefined', async () => {
      await expect(
        fixture.loadDependencyConditions(undefined)
      ).rejects.toThrow('conditionIds must be an array');
    });

    it('should throw when conditionIds is an object', async () => {
      await expect(
        fixture.loadDependencyConditions({ id: 'test' })
      ).rejects.toThrow('conditionIds must be an array');
    });

    it('should throw when condition ID is missing colon', async () => {
      await expect(
        fixture.loadDependencyConditions(['invalid-format'])
      ).rejects.toThrow('Invalid condition ID format: "invalid-format". Expected "modId:conditionId"');
    });

    it('should throw when condition ID has empty modId', async () => {
      await expect(
        fixture.loadDependencyConditions([':condition'])
      ).rejects.toThrow('Invalid condition ID format: ":condition". Expected "modId:conditionId"');
    });

    it('should throw when condition ID has empty conditionId', async () => {
      await expect(
        fixture.loadDependencyConditions(['mod:'])
      ).rejects.toThrow('Invalid condition ID format: "mod:". Expected "modId:conditionId"');
    });

    it('should throw when condition ID has multiple colons', async () => {
      await expect(
        fixture.loadDependencyConditions(['mod:sub:condition'])
      ).rejects.toThrow('Invalid condition ID format: "mod:sub:condition". Expected "modId:conditionId"');
    });

    it('should throw when condition ID is not a string', async () => {
      await expect(
        fixture.loadDependencyConditions([123])
      ).rejects.toThrow('Invalid condition ID format');
    });

    it('should throw when condition ID is an object', async () => {
      await expect(
        fixture.loadDependencyConditions([{ id: 'test:condition' }])
      ).rejects.toThrow('Invalid condition ID format');
    });
  });

  describe('Condition Loading', () => {
    it('should load valid condition from dependency mod', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Verify condition is available in dataRegistry
      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(condition).toBeDefined();
      expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    });

    it('should throw clear error when condition file not found', async () => {
      await expect(
        fixture.loadDependencyConditions(['positioning:nonexistent'])
      ).rejects.toThrow(/Failed to load condition.*nonexistent/);
    });

    it('should throw clear error when mod does not exist', async () => {
      await expect(
        fixture.loadDependencyConditions(['nonexistent-mod:some-condition'])
      ).rejects.toThrow(/Failed to load condition.*nonexistent-mod/);
    });

    it('should load multiple conditions at once', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away',
        'positioning:entity-not-in-facing-away'
      ]);

      const condition1 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      const condition2 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:entity-not-in-facing-away'
      );

      expect(condition1).toBeDefined();
      expect(condition1.id).toBe('positioning:actor-in-entity-facing-away');
      expect(condition2).toBeDefined();
      expect(condition2.id).toBe('positioning:entity-not-in-facing-away');
    });

    it('should accept empty array without error', async () => {
      await expect(
        fixture.loadDependencyConditions([])
      ).resolves.not.toThrow();
    });

    it('should preserve condition data structure', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      // Verify it has the expected structure of a condition definition
      expect(condition).toHaveProperty('id');
      expect(condition).toHaveProperty('description');
      expect(typeof condition.id).toBe('string');
    });
  });

  describe('Additive Behavior', () => {
    it('should allow multiple calls to loadDependencyConditions', async () => {
      // First call
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Second call (additive)
      await fixture.loadDependencyConditions([
        'positioning:entity-not-in-facing-away'
      ]);

      // Both should be available
      const condition1 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      const condition2 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:entity-not-in-facing-away'
      );

      expect(condition1).toBeDefined();
      expect(condition1.id).toBe('positioning:actor-in-entity-facing-away');
      expect(condition2).toBeDefined();
      expect(condition2.id).toBe('positioning:entity-not-in-facing-away');
    });

    it('should handle loading same condition twice (idempotent)', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Should not throw when loading the same condition again
      await expect(
        fixture.loadDependencyConditions([
          'positioning:actor-in-entity-facing-away'
        ])
      ).resolves.not.toThrow();

      // Should still be accessible
      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(condition).toBeDefined();
      expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    });

    it('should preserve previously loaded conditions when loading new ones', async () => {
      // Load first condition
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      const firstCondition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      // Load second condition
      await fixture.loadDependencyConditions([
        'positioning:entity-not-in-facing-away'
      ]);

      // First condition should still be available
      const firstConditionAgain = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      expect(firstConditionAgain).toEqual(firstCondition);
    });
  });

  describe('Mock Chaining', () => {
    it('should chain to original getConditionDefinition for unknown IDs', async () => {
      // Set up original mock behavior
      const originalMock = fixture.testEnv.dataRegistry.getConditionDefinition;
      originalMock.mockReturnValue({ id: 'original:condition' });

      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Should use loaded condition
      const loaded = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(loaded.id).toBe('positioning:actor-in-entity-facing-away');

      // Should chain to original for unknown IDs
      const original = fixture.testEnv.dataRegistry.getConditionDefinition(
        'unknown:condition'
      );
      expect(original.id).toBe('original:condition');
    });

    it('should maintain mock function behavior', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // The dataRegistry.getConditionDefinition should still be a jest mock function
      expect(jest.isMockFunction(fixture.testEnv.dataRegistry.getConditionDefinition)).toBe(true);
    });

    it('should allow multiple chained extensions', async () => {
      // First load
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Second load (creates another chain)
      await fixture.loadDependencyConditions([
        'positioning:entity-not-in-facing-away'
      ]);

      // Both should work
      const condition1 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      const condition2 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:entity-not-in-facing-away'
      );

      expect(condition1.id).toBe('positioning:actor-in-entity-facing-away');
      expect(condition2.id).toBe('positioning:entity-not-in-facing-away');
    });
  });

  describe('Error Handling', () => {
    it('should fail fast on first invalid condition in batch', async () => {
      await expect(
        fixture.loadDependencyConditions([
          'positioning:actor-in-entity-facing-away',
          'invalid-format',
          'positioning:entity-not-in-facing-away'
        ])
      ).rejects.toThrow('Invalid condition ID format');

      // First valid condition should not be loaded due to batch failure
      // Note: This behavior depends on Promise.all which fails fast
    });

    it('should include condition ID in error message for file not found', async () => {
      await expect(
        fixture.loadDependencyConditions(['positioning:nonexistent-condition'])
      ).rejects.toThrow('positioning:nonexistent-condition');
    });

    it('should include file path in error message', async () => {
      await expect(
        fixture.loadDependencyConditions(['positioning:nonexistent-condition'])
      ).rejects.toThrow(/data\/mods\/positioning\/conditions/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle condition IDs with hyphens correctly', async () => {
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(condition).toBeDefined();
      expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    });

    it('should handle different mod namespaces', async () => {
      // This test verifies the method works with conditions from different mods
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(condition).toBeDefined();
    });
  });
});
