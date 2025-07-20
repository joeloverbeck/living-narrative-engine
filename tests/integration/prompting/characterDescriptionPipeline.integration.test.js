/**
 * @file Integration test for character description pipeline
 * Tests the complete flow: Entity with anatomy → ActorState → ActorPromptData → Description in prompt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Character Description Pipeline Integration', () => {
  let testBed;
  let actorStateProvider;
  let actorDataExtractor;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    // Initialize providers
    actorStateProvider = new ActorStateProvider();
    actorDataExtractor = new ActorDataExtractor({
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      entityFinder: testBed.entityManager,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('End-to-end description pipeline', () => {
    it('should extract character description through complete pipeline: entity → actorState → promptData', async () => {
      // Arrange: Create a character with anatomy
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_female_balanced',
      });
      const actorId = actor.id;

      console.log(`[TEST] Created actor with ID: ${actorId}`);

      // Generate anatomy (this should create core:description component)
      const anatomyGenerated =
        await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actorId);
      expect(anatomyGenerated).toBe(true);

      // Verify the entity has the description component
      const entity = testBed.entityManager.getEntityInstance(actorId);
      expect(entity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(true);

      const descComponent = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
      expect(descComponent).toBeTruthy();
      expect(descComponent.text).toBeTruthy();
      expect(descComponent.text.trim()).not.toBe('');

      console.log(`[TEST] Entity has description: "${descComponent.text}"`);

      // Act: Run through the complete pipeline

      // Step 1: Build actor state from entity
      const actorState = actorStateProvider.build(entity, { debug: () => {} });
      expect(actorState).toBeTruthy();
      expect(actorState.id).toBe(actorId);

      console.log(`[TEST] ActorState created for: ${actorState.id}`);
      console.log(
        `[TEST] ActorState has description component: ${!!actorState[DESCRIPTION_COMPONENT_ID]}`
      );
      if (actorState[DESCRIPTION_COMPONENT_ID]) {
        console.log(
          `[TEST] ActorState description: "${actorState[DESCRIPTION_COMPONENT_ID].text}"`
        );
      }

      // Step 2: Extract prompt data from actor state
      const promptData = actorDataExtractor.extractPromptData(
        actorState,
        actorId
      );
      expect(promptData).toBeTruthy();

      console.log(`[TEST] PromptData description: "${promptData.description}"`);

      // Assert: Verify description is properly extracted
      expect(promptData.description).toBeTruthy();
      expect(promptData.description.trim()).not.toBe('');
      expect(promptData.description).not.toBe('No description available.');
      expect(promptData.description).not.toBe('No description available');

      // Should contain actual physical description content
      expect(promptData.description.length).toBeGreaterThan(20);
    });

    it('should fall back to component description when anatomy service fails', async () => {
      // Arrange: Create an entity with direct description component (no anatomy)
      const mockEntity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', {
        instanceId: mockEntity.id,
      });

      // Add description component directly
      const testDescription =
        'A tall figure with striking features and confident posture.';
      testBed.entityManager.addComponent(
        mockEntity.id,
        DESCRIPTION_COMPONENT_ID,
        {
          text: testDescription,
        }
      );

      // Get the actual entity instance
      const entity = testBed.entityManager.getEntityInstance(mockEntity.id);

      // Act: Run through pipeline
      const actorState = actorStateProvider.build(entity, { debug: () => {} });
      const promptData = actorDataExtractor.extractPromptData(
        actorState,
        entity.id
      );

      // Assert: Should use the component description
      expect(promptData.description).toBe(testDescription);
    });

    it('should gracefully handle missing descriptions', async () => {
      // Arrange: Create entity without anatomy or description
      const mockEntity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', {
        instanceId: mockEntity.id,
      });

      // Get the actual entity instance
      const entity = testBed.entityManager.getEntityInstance(mockEntity.id);

      // Act: Run through pipeline
      const actorState = actorStateProvider.build(entity, { debug: () => {} });
      const promptData = actorDataExtractor.extractPromptData(
        actorState,
        entity.id
      );

      // Assert: Should fall back to default
      expect(promptData.description).toBe('No description available.');
    });
  });
});
