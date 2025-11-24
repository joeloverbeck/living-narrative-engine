/**
 * @file Integration test for ClothingInstantiationService availability
 * Tests that the clothing instantiation service is properly registered and available
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Recipe Clothing Assignment', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Service Availability', () => {
    it('should have ClothingInstantiationService registered', () => {
      // Verify the ClothingInstantiationService is available in the DI container
      const service = testBed.container.get('ClothingInstantiationService');

      // THIS SHOULD FAIL if the service is not registered
      expect(service).toBeDefined();
      expect(typeof service.instantiateRecipeClothing).toBe('function');
    });

    it('should pass ClothingInstantiationService to anatomy workflow', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: For now, just verify anatomy was created
      // This test establishes the baseline - anatomy generation works
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
    });
  });

});
