/**
 * @file Integration test for clothing coverage mapping slot resolution
 * @description Tests that items equipped to one slot but covering another slot
 * are correctly discovered through coverage mapping during scope resolution
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';

describe('Coverage Mapping Slot Resolution', () => {
  let entityManager;
  let clothingStepResolver;
  let slotAccessResolver;
  let entitiesGateway;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Create entities gateway wrapper
    entitiesGateway = {
      getComponentData: (entityId, componentId) => {
        return entityManager.getComponentData(entityId, componentId);
      },
    };

    // Create resolvers
    clothingStepResolver = createClothingStepResolver({ entitiesGateway });
    slotAccessResolver = createSlotAccessResolver({ entitiesGateway });
  });

  describe('Direct Equipment Resolution', () => {
    it('should resolve items directly equipped to the requested slot', () => {
      const characterId = 'test:character';
      const pantsId = 'clothing:jeans';

      // Setup: Pants directly equipped to torso_lower
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: pantsId,
          },
        },
      });

      // Resolve topmost_clothing_no_accessories
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];
      expect(clothingAccess).toBeDefined();
      expect(clothingAccess.__clothingSlotAccess).toBe(true);

      // Resolve torso_lower slot
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing_no_accessories',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const resolvedItem = Array.from(slotResult)[0];
      expect(resolvedItem).toBe(pantsId);
    });
  });

  describe('Coverage Mapping Resolution', () => {
    it('should resolve items from other slots via coverage mapping', () => {
      const characterId = 'test:garazi';
      const leggingsId = 'clothing:high_compression_leggings';

      // Setup: Leggings equipped to legs slot but covering torso_lower
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          legs: {
            base: leggingsId,
          },
          // Note: torso_lower is NOT directly equipped
        },
      });

      // Add coverage mapping component to the leggings
      entityManager.addComponent(leggingsId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Resolve topmost_clothing_no_accessories
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];
      expect(clothingAccess).toBeDefined();
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.entityId).toBe(characterId);

      // Resolve torso_lower slot (should find leggings via coverage mapping)
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing_no_accessories',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: (level, message, source, data) => {
              logger[level](`[${source}] ${message}`, data);
            },
          },
        }
      );

      const resolvedItem = Array.from(slotResult)[0];
      expect(resolvedItem).toBe(leggingsId);
    });

    it('should prioritize direct equipment over coverage mapping', () => {
      const characterId = 'test:character';
      const underwearId = 'clothing:panties';
      const leggingsId = 'clothing:leggings';

      // Setup: Underwear directly in torso_lower, leggings in legs covering torso_lower
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            underwear: underwearId,
          },
          legs: {
            base: leggingsId,
          },
        },
      });

      // Add coverage mapping to leggings
      entityManager.addComponent(leggingsId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Resolve topmost_clothing
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];

      // Resolve torso_lower slot
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const resolvedItem = Array.from(slotResult)[0];
      // Should prioritize the item with coverage from base layer (leggings) over underwear
      // based on layer priority
      expect(resolvedItem).toBe(leggingsId);
    });

    it('should handle multiple items with coverage mapping', () => {
      const characterId = 'test:character';
      const leggingsId = 'clothing:leggings';
      const jacketId = 'clothing:jacket';

      // Setup: Leggings in legs, jacket in torso_upper, both covering torso_lower
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          legs: {
            base: leggingsId,
          },
          torso_upper: {
            outer: jacketId,
          },
        },
      });

      // Add coverage mapping to both items
      entityManager.addComponent(leggingsId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      entityManager.addComponent(jacketId, 'clothing:coverage_mapping', {
        covers: ['torso_lower', 'torso_upper'],
        coveragePriority: 'outer',
      });

      // Resolve topmost_clothing
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];

      // Resolve torso_lower slot
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const resolvedItem = Array.from(slotResult)[0];
      // Should prioritize outer layer (jacket) over base layer (leggings)
      expect(resolvedItem).toBe(jacketId);
    });

    it('should respect mode exclusions with coverage mapping', () => {
      const characterId = 'test:character';
      const beltId = 'clothing:belt';
      const leggingsId = 'clothing:leggings';

      // Setup: Belt as accessory, leggings as base, both covering torso_lower
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {
          torso_lower: {
            accessories: beltId,
          },
          legs: {
            base: leggingsId,
          },
        },
      });

      // Add coverage mapping to leggings only
      entityManager.addComponent(leggingsId, 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Resolve topmost_clothing_no_accessories (should exclude belt)
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];

      // Resolve torso_lower slot
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing_no_accessories',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const resolvedItem = Array.from(slotResult)[0];
      // Should resolve to leggings (belt excluded due to no_accessories mode)
      expect(resolvedItem).toBe(leggingsId);
    });

    it('should handle empty slots with coverage mapping', () => {
      const characterId = 'test:character';

      // Setup: No equipment at all
      entityManager.addComponent(characterId, 'clothing:equipment', {
        equipped: {},
      });

      // Resolve topmost_clothing
      const clothingAccessResult = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([characterId]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      const clothingAccess = Array.from(clothingAccessResult)[0];

      // Resolve torso_lower slot
      const slotResult = slotAccessResolver.resolve(
        {
          type: 'Step',
          field: 'torso_lower',
          parent: {
            type: 'Step',
            field: 'topmost_clothing',
          },
        },
        {
          dispatcher: {
            resolve: () => new Set([clothingAccess]),
          },
          trace: {
            addLog: jest.fn(),
          },
        }
      );

      // Should return empty set when no items found
      expect(slotResult.size).toBe(0);
    });
  });
});