/**
 * @file Performance benchmarks for proximity validation system
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateProximityParameters } from '../../src/utils/proximityUtils.js';
import { ComponentStateValidator } from '../../src/utils/componentStateValidator.js';
import { StateConsistencyValidator } from '../../src/utils/stateConsistencyValidator.js';
import { createTestBed } from '../common/testBed.js';

describe('Proximity Validation Performance', () => {
  let testBed;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getComponentData',
      'getEntitiesWithComponent',
      'addComponent',
    ]);
  });

  describe('Parameter Validation Performance', () => {
    it('should validate parameters in <5ms for 1000 calls', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validateProximityParameters(
          'furniture:couch',
          'game:alice',
          1,
          mockLogger
        );
      }

      const duration = performance.now() - start;
      const avgTime = duration / 1000;

      expect(avgTime).toBeLessThan(5);
      expect(duration).toBeLessThan(50); // Total time for 1000 calls should be under 50ms
    });

    it('should handle validation errors efficiently', () => {
      const start = performance.now();

      // Test with invalid parameters to trigger validation errors
      for (let i = 0; i < 100; i++) {
        try {
          validateProximityParameters(
            'invalid-furniture-id', // Missing namespace
            'game:alice',
            1,
            mockLogger
          );
        } catch {
          // Expected error for invalid format
        }
      }

      const duration = performance.now() - start;
      const avgTime = duration / 100;

      expect(avgTime).toBeLessThan(2); // Even error cases should be fast
    });
  });

  describe('Component State Validation Performance', () => {
    let validator;

    beforeEach(() => {
      validator = new ComponentStateValidator({ logger: mockLogger });
    });

    it('should validate furniture components efficiently', () => {
      const furnitureComponent = {
        spots: [null, 'game:alice', null, 'npc:bob'],
      };

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validator.validateFurnitureComponent(
          'furniture:couch',
          furnitureComponent,
          'performance test'
        );
      }

      const duration = performance.now() - start;
      const avgTime = duration / 1000;

      expect(avgTime).toBeLessThan(2);
    });

    it('should validate closeness components efficiently', () => {
      const closenessComponent = {
        partners: ['game:alice', 'npc:bob', 'npc:charlie'],
      };

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validator.validateClosenessComponent(
          'game:player',
          closenessComponent,
          'performance test'
        );
      }

      const duration = performance.now() - start;
      const avgTime = duration / 1000;

      expect(avgTime).toBeLessThan(2);
    });
  });

  describe('System Consistency Validation Performance', () => {
    let validator;

    beforeEach(() => {
      validator = new StateConsistencyValidator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      // Mock entities for performance testing
      const mockEntities = [];
      for (let i = 0; i < 100; i++) {
        mockEntities.push({ id: `game:actor${i}` });
      }

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockEntities);
      mockEntityManager.getComponentData.mockReturnValue({
        partners: [`game:partner${Math.floor(Math.random() * 100)}`],
      });
    });

    it('should validate 100 entities in <100ms', () => {
      const start = performance.now();
      validator.performFullValidation();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should validate closeness relationships efficiently', () => {
      const start = performance.now();
      validator.validateAllClosenessRelationships();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should validate movement locks efficiently', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        Array.from({ length: 1000 }, (_, i) => ({ id: `game:actor${i}` }))
      );
      mockEntityManager.getComponentData.mockReturnValue({ locked: false });

      const start = performance.now();
      validator.validateMovementLocks();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should validate furniture occupancy efficiently', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        Array.from({ length: 50 }, (_, i) => ({ id: `furniture:item${i}` }))
      );
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'sitting:allows_sitting') {
            return { spots: [null, 'game:alice', null, 'npc:bob'] };
          }
          if (componentType === 'positioning:sitting_on') {
            return { furniture_id: entityId, spot_index: 1 };
          }
          return null;
        }
      );

      const start = performance.now();
      validator.validateFurnitureOccupancy();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Overall Performance Benchmarks', () => {
    it('should meet performance requirements for typical game scenarios', () => {
      // Simulate typical game scenario: 10 actors, 5 furniture pieces
      const validator = new ComponentStateValidator({ logger: mockLogger });
      const start = performance.now();

      // Validate 10 operations (typical for one game action)
      for (let i = 0; i < 10; i++) {
        validateProximityParameters(
          'furniture:couch',
          `game:actor${i}`,
          i % 4,
          mockLogger
        );

        validator.validateFurnitureComponent(
          'furniture:couch',
          { spots: [null, `game:actor${i}`, null] },
          'performance test'
        );
      }

      const duration = performance.now() - start;

      // Total validation overhead should be under 10ms for typical scenarios
      expect(duration).toBeLessThan(10);
    });

    it('should handle high-load scenarios efficiently', () => {
      const validator = new ComponentStateValidator({ logger: mockLogger });
      const start = performance.now();

      // Simulate high-load scenario: 50 simultaneous proximity operations
      for (let i = 0; i < 50; i++) {
        validateProximityParameters(
          `furniture:item${i % 10}`,
          `game:actor${i}`,
          i % 4,
          mockLogger
        );

        validator.validateClosenessComponent(
          `game:actor${i}`,
          { partners: [`game:partner${i}`] },
          'high load test'
        );
      }

      const duration = performance.now() - start;

      // Even high-load scenarios should complete quickly
      expect(duration).toBeLessThan(50);
    });
  });
});
