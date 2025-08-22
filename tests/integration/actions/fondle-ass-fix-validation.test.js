/**
 * @file Integration test to validate the fondle_ass action fix
 * @description Tests the fix for fondle_ass action not being available for Silvia→Jon
 * due to accessories layer not being included in topmost clothing resolution.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';

describe('FondleAss Action Fix Validation', () => {
  let entityManager;
  let entitiesGateway;
  let clothingStepResolver;
  let slotAccessResolver;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();

    // Create entities gateway wrapper
    entitiesGateway = {
      getComponentData: (entityId, componentId) => {
        return entityManager.getComponentData(entityId, componentId);
      },
    };

    clothingStepResolver = createClothingStepResolver({ entitiesGateway });
    slotAccessResolver = createSlotAccessResolver({ entitiesGateway });
  });

  it('should find accessories layer items in topmost clothing resolution', () => {
    // Arrange - Set up Jon with belt in accessories layer
    const jonId = 'p_erotica:jon_urena_instance';

    entityManager.addComponent(jonId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: 'clothing:dark_brown_leather_belt', // Belt in accessories layer
        },
      },
    });

    // Act - Test clothing resolution through the resolvers
    const clothingAccessObject = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([jonId]),
        },
        trace: null,
      }
    );

    // The clothing access object should be in the result set
    const clothingAccess = Array.from(clothingAccessObject)[0];
    expect(clothingAccess).toBeDefined();
    expect(clothingAccess.__clothingSlotAccess).toBe(true);

    // Test slot access resolution
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
        trace: null,
      }
    );

    // Should find the belt in the accessories layer
    const resolvedItems = Array.from(slotResult);
    expect(resolvedItems).toHaveLength(1);
    expect(resolvedItems[0]).toBe('clothing:dark_brown_leather_belt');
  });

  it('should prioritize layers correctly: outer > base > underwear > accessories', () => {
    // Arrange - Set up clothing in multiple layers
    const testId = 'test:character';

    entityManager.addComponent(testId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          outer: 'clothing:outer_garment',
          base: 'clothing:base_garment',
          underwear: 'clothing:underwear_garment',
          accessories: 'clothing:accessories_garment',
        },
      },
    });

    // Act
    const clothingAccessObject = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([testId]),
        },
        trace: null,
      }
    );

    const clothingAccess = Array.from(clothingAccessObject)[0];

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
        trace: null,
      }
    );

    // Should find the outer layer item (highest priority)
    const resolvedItems = Array.from(slotResult);
    expect(resolvedItems).toHaveLength(1);
    expect(resolvedItems[0]).toBe('clothing:outer_garment');
  });

  it('should fall back to accessories when higher layers are empty', () => {
    // Arrange - Only accessories layer has an item
    const testId = 'test:character';

    entityManager.addComponent(testId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: 'clothing:belt_only',
        },
      },
    });

    // Act
    const clothingAccessObject = clothingStepResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([testId]),
        },
        trace: null,
      }
    );

    const clothingAccess = Array.from(clothingAccessObject)[0];

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
        trace: null,
      }
    );

    // Should find the accessories item when it's the only one available
    const resolvedItems = Array.from(slotResult);
    expect(resolvedItems).toHaveLength(1);
    expect(resolvedItems[0]).toBe('clothing:belt_only');
  });

  it('should reproduce the original issue scenario', () => {
    // Arrange - Recreate the exact scenario from the trace
    const silviaId = 'p_erotica:silvia_instance';
    const jonId = 'p_erotica:jon_urena_instance';

    // Silvia has a skirt in torso_lower/base
    entityManager.addComponent(silviaId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          base: 'clothing:pink_short_flared_skirt',
        },
      },
    });

    // Jon has a belt in torso_lower/accessories (this was the issue)
    entityManager.addComponent(jonId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: 'clothing:dark_brown_leather_belt',
        },
        legs: {
          base: 'clothing:dark_indigo_denim_jeans',
        },
      },
    });

    // Helper function to simulate the full scope resolution
    const resolveTopMostTorsoLower = (targetId) => {
      const clothingAccessObject = clothingStepResolver.resolve(
        {
          type: 'Step',
          field: 'topmost_clothing',
          parent: { type: 'Variable', name: 'target' },
        },
        {
          dispatcher: {
            resolve: () => new Set([targetId]),
          },
          trace: null,
        }
      );

      const clothingAccess = Array.from(clothingAccessObject)[0];
      if (!clothingAccess) return null;

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
          trace: null,
        }
      );

      const resolvedItems = Array.from(slotResult);
      return resolvedItems.length > 0 ? resolvedItems[0] : null;
    };

    // Act - Test both directions

    // Jon → Silvia (this always worked)
    const jonTargetingSilvia = resolveTopMostTorsoLower(silviaId);
    expect(jonTargetingSilvia).toBe('clothing:pink_short_flared_skirt');

    // Silvia → Jon (this was broken, now should work)
    const silviaTargetingJon = resolveTopMostTorsoLower(jonId);
    expect(silviaTargetingJon).toBe('clothing:dark_brown_leather_belt');
  });
});
