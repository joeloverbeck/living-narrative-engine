/**
 * Unit tests to prevent regression of the Entity spread operator bug
 * where Entity class getters (especially 'id') are lost when using
 * the spread operator on Entity instances.
 */

import Entity from '../../../src/entities/entity.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Entity Spread Operator Bug Regression Tests', () => {
  let mockEntity;
  let mockEntityInstanceData;
  let mockEntityDefinition;

  beforeEach(() => {
    mockEntityDefinition = new EntityDefinition('test:entity_def', {
      name: 'Test Entity',
      components: {
        'core:name': { text: 'Test Entity Name' },
      },
    });

    mockEntityInstanceData = new EntityInstanceData(
      'test:entity_instance',
      mockEntityDefinition
    );

    mockEntity = new Entity(mockEntityInstanceData);
  });

  describe('Entity class getter preservation', () => {
    test('Entity instance should have valid getter properties', () => {
      // Verify the entity has all expected getters
      expect(mockEntity.id).toBe('test:entity_instance');
      expect(mockEntity.definitionId).toBe('test:entity_def');
      expect(Array.isArray(mockEntity.componentTypeIds)).toBe(true);
      expect(typeof mockEntity.id).toBe('string');
    });

    test('Spread operator loses Entity class getters (demonstrates the bug)', () => {
      // This test demonstrates the bug - spread operator loses getters
      const spreadEntity = { ...mockEntity };

      // The spread object loses the getter methods
      expect(spreadEntity.id).toBeUndefined();
      expect(spreadEntity.definitionId).toBeUndefined();
      expect(spreadEntity.componentTypeIds).toBeUndefined();

      // But private fields and getter properties are not preserved via spread
      // (this is the expected behavior that caused the bug)
      expect(Object.keys(spreadEntity).length).toBeGreaterThanOrEqual(0);
    });

    test('Correctly preserving Entity getters when spreading (the fix)', () => {
      // This test shows the correct way to preserve getters when spreading
      const fixedSpreadEntity = {
        ...mockEntity,
        id: mockEntity.id,
        definitionId: mockEntity.definitionId,
        componentTypeIds: mockEntity.componentTypeIds,
        // Add additional properties as needed
        customProperty: 'test value',
      };

      // All getter properties should be preserved
      expect(fixedSpreadEntity.id).toBe('test:entity_instance');
      expect(fixedSpreadEntity.definitionId).toBe('test:entity_def');
      expect(Array.isArray(fixedSpreadEntity.componentTypeIds)).toBe(true);
      expect(typeof fixedSpreadEntity.id).toBe('string');
      expect(fixedSpreadEntity.customProperty).toBe('test value');
    });
  });

  describe('targetResolutionService.js pattern validation', () => {
    test('actorWithComponents pattern should preserve Entity getters', () => {
      // Simulate the pattern used in targetResolutionService.js
      const components = {
        'core:name': { text: 'Test Name' },
        'core:position': { locationId: 'test:location' },
      };

      // The fixed pattern from targetResolutionService.js
      const actorWithComponents = {
        ...mockEntity,
        id: mockEntity.id, // Explicitly preserve the ID getter
        definitionId: mockEntity.definitionId, // Preserve other critical getters
        componentTypeIds: mockEntity.componentTypeIds,
        components,
      };

      // Verify all critical properties are preserved
      expect(actorWithComponents.id).toBe('test:entity_instance');
      expect(actorWithComponents.definitionId).toBe('test:entity_def');
      expect(Array.isArray(actorWithComponents.componentTypeIds)).toBe(true);
      expect(actorWithComponents.components).toEqual(components);
      expect(typeof actorWithComponents.id).toBe('string');
      expect(actorWithComponents.id).not.toBeUndefined();
    });
  });

  describe('entityHelpers.js pattern validation', () => {
    test('actor creation pattern should preserve Entity getters', () => {
      // Simulate the pattern used in entityHelpers.js
      const comps = {
        'core:inventory': { items: [] },
        'core:stats': { health: 100 },
      };

      // The fixed pattern from entityHelpers.js
      const actor = {
        ...mockEntity,
        id: mockEntity.id,
        definitionId: mockEntity.definitionId,
        componentTypeIds: mockEntity.componentTypeIds,
        components: comps,
      };

      // Verify all critical properties are preserved
      expect(actor.id).toBe('test:entity_instance');
      expect(actor.definitionId).toBe('test:entity_def');
      expect(Array.isArray(actor.componentTypeIds)).toBe(true);
      expect(actor.components).toEqual(comps);
      expect(typeof actor.id).toBe('string');
      expect(actor.id).not.toBeUndefined();
    });
  });

  describe('entityNameFallbackUtils.js pattern validation', () => {
    test('adaptedEntity pattern should preserve Entity getters', () => {
      // Simulate the pattern used in entityNameFallbackUtils.js
      const adaptedEntity = {
        ...mockEntity,
        // Preserve Entity class getters that are lost with spread operator
        id: mockEntity.id,
        definitionId: mockEntity.definitionId,
        componentTypeIds: mockEntity.componentTypeIds,
        getComponentData: (type) => mockEntity?.components?.[type],
      };

      // Verify all critical properties are preserved
      expect(adaptedEntity.id).toBe('test:entity_instance');
      expect(adaptedEntity.definitionId).toBe('test:entity_def');
      expect(Array.isArray(adaptedEntity.componentTypeIds)).toBe(true);
      expect(typeof adaptedEntity.getComponentData).toBe('function');
      expect(typeof adaptedEntity.id).toBe('string');
      expect(adaptedEntity.id).not.toBeUndefined();
    });
  });

  describe('FilterResolver validation error patterns', () => {
    test('should detect spread operator issue in error validation', () => {
      // Simulate an entity that looks like it lost its getters due to spread operator
      const corruptedEntity = {
        ...mockEntity,
        componentTypeIds: mockEntity.componentTypeIds,
        components: { 'core:test': {} },
        // Note: deliberately NOT preserving id, definitionId to simulate the bug
      };

      // This entity should be detected as having the spread operator issue
      const isPossibleSpreadIssue =
        !corruptedEntity.id &&
        typeof corruptedEntity === 'object' &&
        corruptedEntity !== null &&
        // Check if this looks like a spread Entity object that lost its getters
        ('componentTypeIds' in corruptedEntity ||
          'components' in corruptedEntity);

      expect(isPossibleSpreadIssue).toBe(true);
      expect(corruptedEntity.id).toBeUndefined();
      expect(corruptedEntity.componentTypeIds).toBeDefined();
    });

    test('should not false-positive on normal objects', () => {
      // Normal objects should not be detected as spread operator issues
      const normalObject = {
        someProperty: 'value',
        anotherProperty: 123,
      };

      const isPossibleSpreadIssue =
        !normalObject.id &&
        typeof normalObject === 'object' &&
        normalObject !== null &&
        // Check if this looks like a spread Entity object that lost its getters
        ('componentTypeIds' in normalObject || 'components' in normalObject);

      expect(isPossibleSpreadIssue).toBe(false);
    });
  });
});
