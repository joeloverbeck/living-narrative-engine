/**
 * @file Integration test for character description pipeline
 * Tests the complete flow: Entity with anatomy → ActorState → ActorPromptData → Description in prompt
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import {
  DESCRIPTION_COMPONENT_ID,
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Creates a mock EmotionCalculatorService for testing.
 *
 * @returns {object} Mock emotion calculator service
 */
function createMockEmotionCalculatorService() {
  return {
    calculateSexualArousal: jest.fn().mockReturnValue(0.15),
    calculateEmotions: jest.fn().mockReturnValue(new Map([['calm', 0.5]])),
    calculateSexualStates: jest.fn().mockReturnValue(new Map()),
    formatEmotionsForPrompt: jest.fn().mockReturnValue('calm: moderate'),
    getTopEmotions: jest.fn().mockReturnValue([]),
    formatSexualStatesForPrompt: jest.fn().mockReturnValue(''),
    getTopSexualStates: jest.fn().mockReturnValue([]),
  };
}

describe('Character Description Pipeline Integration', () => {
  let testBed;
  let actorStateProvider;
  let actorDataExtractor;
  let mockEmotionCalculatorService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    // Initialize providers
    actorStateProvider = new ActorStateProvider();
    mockEmotionCalculatorService = createMockEmotionCalculatorService();
    actorDataExtractor = new ActorDataExtractor({
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      entityFinder: testBed.entityManager,
      emotionCalculatorService: mockEmotionCalculatorService,
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

      // Add required emotional components for the ActorDataExtractor
      testBed.entityManager.addComponent(actorId, MOOD_COMPONENT_ID, {
        valence: 50,
        arousal: 30,
        agency_control: 40,
        threat: -20,
        engagement: 60,
        future_expectancy: 25,
        self_evaluation: 35,
      });
      testBed.entityManager.addComponent(actorId, SEXUAL_STATE_COMPONENT_ID, {
        sex_excitation: 20,
        sex_inhibition: 10,
        baseline_libido: 5,
      });

      // Act: Run through the complete pipeline

      // Step 1: Build actor state from entity (re-fetch to include newly added components)
      const updatedEntity = testBed.entityManager.getEntityInstance(actorId);
      const actorState = actorStateProvider.build(updatedEntity, { debug: () => {} });
      expect(actorState).toBeTruthy();
      expect(actorState.id).toBe(actorId);

      // Note: ActorStateProvider doesn't extract emotional components to top-level actorState,
      // they remain in actorState.components[X]. For ActorDataExtractor validation to pass,
      // we manually add them to actorState (matching how unit tests work).
      actorState[MOOD_COMPONENT_ID] = actorState.components[MOOD_COMPONENT_ID];
      actorState[SEXUAL_STATE_COMPONENT_ID] =
        actorState.components[SEXUAL_STATE_COMPONENT_ID];

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

      // Add required emotional components
      testBed.entityManager.addComponent(mockEntity.id, MOOD_COMPONENT_ID, {
        valence: 50,
        arousal: 30,
        agency_control: 40,
        threat: -20,
        engagement: 60,
        future_expectancy: 25,
        self_evaluation: 35,
      });
      testBed.entityManager.addComponent(
        mockEntity.id,
        SEXUAL_STATE_COMPONENT_ID,
        {
          sex_excitation: 20,
          sex_inhibition: 10,
          baseline_libido: 5,
        }
      );

      // Get the actual entity instance
      const entity = testBed.entityManager.getEntityInstance(mockEntity.id);

      // Act: Run through pipeline
      const actorState = actorStateProvider.build(entity, { debug: () => {} });

      // Note: ActorStateProvider doesn't extract emotional components to top-level actorState,
      // they remain in actorState.components[X]. For ActorDataExtractor validation to pass,
      // we manually add them to actorState (matching how unit tests work).
      actorState[MOOD_COMPONENT_ID] = actorState.components[MOOD_COMPONENT_ID];
      actorState[SEXUAL_STATE_COMPONENT_ID] =
        actorState.components[SEXUAL_STATE_COMPONENT_ID];

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

      // Add required emotional components (description pipeline still needs emotional data)
      testBed.entityManager.addComponent(mockEntity.id, MOOD_COMPONENT_ID, {
        valence: 50,
        arousal: 30,
        agency_control: 40,
        threat: -20,
        engagement: 60,
        future_expectancy: 25,
        self_evaluation: 35,
      });
      testBed.entityManager.addComponent(
        mockEntity.id,
        SEXUAL_STATE_COMPONENT_ID,
        {
          sex_excitation: 20,
          sex_inhibition: 10,
          baseline_libido: 5,
        }
      );

      // Get the actual entity instance
      const entity = testBed.entityManager.getEntityInstance(mockEntity.id);

      // Act: Run through pipeline
      const actorState = actorStateProvider.build(entity, { debug: () => {} });

      // Note: ActorStateProvider doesn't extract emotional components to top-level actorState,
      // they remain in actorState.components[X]. For ActorDataExtractor validation to pass,
      // we manually add them to actorState (matching how unit tests work).
      actorState[MOOD_COMPONENT_ID] = actorState.components[MOOD_COMPONENT_ID];
      actorState[SEXUAL_STATE_COMPONENT_ID] =
        actorState.components[SEXUAL_STATE_COMPONENT_ID];

      const promptData = actorDataExtractor.extractPromptData(
        actorState,
        entity.id
      );

      // Assert: Should fall back to default
      expect(promptData.description).toBe('No description available.');
    });
  });
});
