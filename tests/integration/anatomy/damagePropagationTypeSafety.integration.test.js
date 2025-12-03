/**
 * @file Integration tests for DamagePropagationService type safety fix
 * Verifies that #resolveSocketToEntityId correctly handles Entity objects
 * from getEntitiesWithComponent() which returns Entity[] not string[].
 * @see src/anatomy/services/damagePropagationService.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('DamagePropagationService - Entity vs String ID Type Safety', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventBus = {
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('#resolveSocketToEntityId handles Entity objects', () => {
    it('should correctly resolve socket when getEntitiesWithComponent returns Entity objects with id property', () => {
      // Simulate Entity objects (what EntityManager actually returns)
      const entityObjects = [
        { id: 'child-part-1', components: new Map() },
        { id: 'child-part-2', components: new Map() },
        { id: 'child-part-3', components: new Map() },
      ];

      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'child-part-2') {
              return {
                parentId: 'parent-torso',
                socketId: 'heart_socket',
              };
            }
            return { parentId: 'other-parent', socketId: 'other_socket' };
          }
          return null;
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => entityObjects),
      };

      service = new DamagePropagationService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      // Test propagation with socket-based rules (new format)
      const rules = [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1.0,
          damageFraction: 0.5,
        },
      ];

      const results = service.propagateDamage(
        'parent-torso',
        100,
        'slashing',
        'owner-entity',
        rules
      );

      // Should successfully resolve child-part-2 via socket
      expect(results).toHaveLength(1);
      expect(results[0].childPartId).toBe('child-part-2');
      expect(results[0].damageApplied).toBe(50); // 100 * 0.5

      // Verify getComponentData was called with string IDs, not Entity objects
      const getComponentDataCalls = mockEntityManager.getComponentData.mock.calls;
      for (const call of getComponentDataCalls) {
        expect(typeof call[0]).toBe('string');
      }
    });

    it('should correctly resolve socket when getEntitiesWithComponent returns string IDs (backwards compatibility)', () => {
      // Simulate string IDs (legacy format that should still work)
      const stringIds = ['child-part-1', 'child-part-2', 'child-part-3'];

      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'child-part-2') {
              return {
                parentId: 'parent-torso',
                socketId: 'heart_socket',
              };
            }
            return { parentId: 'other-parent', socketId: 'other_socket' };
          }
          return null;
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => stringIds),
      };

      service = new DamagePropagationService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      const rules = [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1.0,
          damageFraction: 0.5,
        },
      ];

      const results = service.propagateDamage(
        'parent-torso',
        100,
        'slashing',
        'owner-entity',
        rules
      );

      // Should successfully resolve child-part-2 via socket
      expect(results).toHaveLength(1);
      expect(results[0].childPartId).toBe('child-part-2');
    });

    it('should skip entities with null or undefined id property', () => {
      // Simulate mixed Entity objects including malformed ones
      const mixedEntities = [
        { id: 'valid-child', components: new Map() },
        { id: null, components: new Map() }, // null id
        { components: new Map() }, // missing id
        { id: '', components: new Map() }, // empty string id
        { id: 'another-valid', components: new Map() },
      ];

      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (entityId === 'valid-child') {
              return {
                parentId: 'parent-torso',
                socketId: 'heart_socket',
              };
            }
            return { parentId: 'other-parent', socketId: 'other_socket' };
          }
          return null;
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => mixedEntities),
      };

      service = new DamagePropagationService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      const rules = [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1.0,
          damageFraction: 0.5,
        },
      ];

      // Should not throw, should skip malformed entities
      const results = service.propagateDamage(
        'parent-torso',
        100,
        'slashing',
        'owner-entity',
        rules
      );

      expect(results).toHaveLength(1);
      expect(results[0].childPartId).toBe('valid-child');

      // Should not have attempted to call getComponentData with invalid IDs
      const getComponentDataCalls = mockEntityManager.getComponentData.mock.calls;
      const entityIdArgs = getComponentDataCalls.map((call) => call[0]);
      expect(entityIdArgs).not.toContain(null);
      expect(entityIdArgs).not.toContain(undefined);
      expect(entityIdArgs).not.toContain('');
    });

    it('should not generate validation errors that could trigger recursion', () => {
      // This test ensures the fix prevents the validation error chain
      // that was causing EventBus recursion warnings
      const entityObjects = [
        { id: 'child-part-1', components: new Map() },
      ];

      let validationErrorLogged = false;
      const trackingLogger = {
        ...mockLogger,
        error: jest.fn((...args) => {
          validationErrorLogged = true;
          mockLogger.error(...args);
        }),
      };

      mockEntityManager = {
        getComponentData: jest.fn(() => {
          return { parentId: 'parent-torso', socketId: 'heart_socket' };
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => entityObjects),
      };

      service = new DamagePropagationService({
        logger: trackingLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      const rules = [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1.0,
          damageFraction: 0.5,
        },
      ];

      // Execute propagation
      service.propagateDamage(
        'parent-torso',
        100,
        'slashing',
        'owner-entity',
        rules
      );

      // Should not have logged any errors (which would trigger recursion chain)
      expect(validationErrorLogged).toBe(false);
    });
  });

  describe('Legacy object format propagation rules', () => {
    it('should still work with object format rules using entity IDs directly', () => {
      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            return { parentId: 'parent-torso', parentEntityId: 'parent-torso' };
          }
          return null;
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => []),
      };

      service = new DamagePropagationService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      // Legacy object format with entity IDs as keys
      const legacyRules = {
        'child-heart': {
          probability: 0.8,
          damage_fraction: 0.6,
          damage_types: ['piercing', 'slashing'],
        },
      };

      const results = service.propagateDamage(
        'parent-torso',
        100,
        'piercing',
        'owner-entity',
        legacyRules
      );

      // With probability 0.8, results may vary - just ensure no errors
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Event dispatching', () => {
    it('should dispatch anatomy:internal_damage_propagated event with correct payload', () => {
      const entityObjects = [{ id: 'child-part', components: new Map() }];

      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:joint') {
            return { parentId: 'parent-torso', socketId: 'heart_socket' };
          }
          return null;
        }),
        hasComponent: jest.fn(() => true),
        getEntitiesWithComponent: jest.fn(() => entityObjects),
      };

      service = new DamagePropagationService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
      });

      const rules = [
        {
          childSocketId: 'heart_socket',
          baseProbability: 1.0,
          damageFraction: 0.5,
        },
      ];

      service.propagateDamage(
        'parent-torso',
        100,
        'slashing',
        'owner-entity',
        rules
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:internal_damage_propagated',
        expect.objectContaining({
          ownerEntityId: 'owner-entity',
          sourcePartId: 'parent-torso',
          targetPartId: 'child-part',
          damageAmount: 50,
          damageTypeId: 'slashing',
          timestamp: expect.any(Number),
        })
      );
    });
  });
});
