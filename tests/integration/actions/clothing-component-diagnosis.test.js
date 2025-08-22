/**
 * @file Simple test to diagnose clothing component differences
 * @description Directly checks clothing equipment for Jon vs Silvia
 */

import { describe, it, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';

describe('Clothing Component Diagnosis', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
  });

  it('should examine actual character clothing components', async () => {
    // Arrange - Create entities matching the trace characters
    const silviaId = 'p_erotica:silvia_instance';
    const jonId = 'p_erotica:jon_urena_instance';

    // Add clothing equipment components (this will create the entities automatically)
    const basicClothingSetup = {
      equipped: {
        torso_lower: {
          base: 'clothing:pants',
        },
        torso_upper: {
          base: 'clothing:shirt',
        },
      },
    };

    entityManager.addComponent(
      silviaId,
      'clothing:equipment',
      basicClothingSetup
    );
    entityManager.addComponent(jonId, 'clothing:equipment', basicClothingSetup);

    // Act - Retrieve clothing components
    const silviaClothing = entityManager.getComponentData(
      silviaId,
      'clothing:equipment'
    );
    const jonClothing = entityManager.getComponentData(
      jonId,
      'clothing:equipment'
    );

    // Assert and log for diagnosis
    console.log(
      'Silvia clothing component:',
      JSON.stringify(silviaClothing, null, 2)
    );
    console.log(
      'Jon clothing component:',
      JSON.stringify(jonClothing, null, 2)
    );

    expect(silviaClothing).toBeDefined();
    expect(jonClothing).toBeDefined();

    // Check torso_lower specifically
    expect(silviaClothing.equipped.torso_lower).toBeDefined();
    expect(jonClothing.equipped.torso_lower).toBeDefined();

    expect(silviaClothing.equipped.torso_lower.base).toBe('clothing:pants');
    expect(jonClothing.equipped.torso_lower.base).toBe('clothing:pants');
  });

  it('should test clothing scope resolution manually', async () => {
    // Arrange - Set up clothing for testing the actual scope resolution
    const jonId = 'p_erotica:jon_urena_instance';
    entityManager.addComponent(jonId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          base: 'clothing:pants',
        },
      },
    });

    // Act - Simulate the scope resolution: target.topmost_clothing.torso_lower
    const clothingComponent = entityManager.getComponentData(
      jonId,
      'clothing:equipment'
    );

    console.log(
      'Jon clothing component for scope test:',
      JSON.stringify(clothingComponent, null, 2)
    );

    // This simulates what ClothingStepResolver does
    const equipped = clothingComponent?.equipped;
    const torsoLowerSlot = equipped?.torso_lower;

    // This simulates what SlotAccessResolver does with LAYER_PRIORITY.topmost
    const layerPriority = ['outer', 'base', 'underwear'];
    let foundItem = null;

    for (const layer of layerPriority) {
      if (torsoLowerSlot?.[layer]) {
        foundItem = torsoLowerSlot[layer];
        break;
      }
    }

    console.log('Resolved clothing item:', foundItem);

    // Assert - The scope should find the clothing item
    expect(clothingComponent).toBeDefined();
    expect(equipped).toBeDefined();
    expect(torsoLowerSlot).toBeDefined();
    expect(foundItem).toBe('clothing:pants');
  });

  it('should check if the actual trace characters exist in the system', async () => {
    // This test will help us understand if the characters exist in the real system
    // We can't access the real EntityManager here, but we can at least check
    // if the entity creation follows expected patterns

    const silviaId = 'p_erotica:silvia_instance';
    const jonId = 'p_erotica:jon_urena_instance';

    // Create entities as they might exist in the system (using addComponent will create them)

    // Add typical components that should exist
    entityManager.addComponent(silviaId, 'core:actor', {
      name: 'Silvia',
      description: 'Female character',
    });

    entityManager.addComponent(jonId, 'core:actor', {
      name: 'Jon Ureña',
      description: 'Male character',
    });

    // Check if they can be retrieved
    const silviaActor = entityManager.getComponentData(silviaId, 'core:actor');
    const jonActor = entityManager.getComponentData(jonId, 'core:actor');

    console.log('Silvia actor component:', silviaActor);
    console.log('Jon actor component:', jonActor);

    expect(silviaActor).toBeDefined();
    expect(jonActor).toBeDefined();
  });
});
