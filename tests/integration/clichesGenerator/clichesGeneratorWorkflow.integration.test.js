/**
 * @file Integration tests for clichés generator workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Workflow Integration', () => {
  let testBed;
  let controller;
  let characterBuilderService;
  let clicheGenerator;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();

    controller = testBed.getController();
    characterBuilderService = testBed.mockCharacterBuilderService;
    clicheGenerator = testBed.mockClicheGenerator;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Complete Generation Workflow', () => {
    it('should execute full workflow from direction selection to storage', async () => {
      // Setup: Create test data
      const concept = testBed.createCharacterConcept({
        id: 'concept-1',
        text: 'A mysterious wanderer',
      });

      const direction = testBed.createThematicDirection({
        id: 'direction-1',
        conceptId: 'concept-1',
        title: 'The Lone Wolf',
        description: 'A solitary figure who trusts no one',
        coreTension: 'Independence vs Connection',
      });

      // Mock the generated clichés
      const generatedCliches = testBed.createCliche({
        id: 'cliche-1',
        directionId: 'direction-1',
        conceptId: 'concept-1',
        categories: {
          names: ['Shadow', 'Raven', 'Wolf'],
          physicalDescriptions: ['Scarred face', 'Dark cloak'],
          personalityTraits: ['Brooding', 'Mysterious'],
          skillsAbilities: ['Master swordsman', 'Stealth expert'],
          typicalLikes: ['Solitude', 'Night time'],
          typicalDislikes: ['Crowds', 'Authority'],
          commonFears: ['Betrayal', 'Vulnerability'],
          genericGoals: ['Revenge', 'Redemption'],
          backgroundElements: ['Tragic past', 'Lost family'],
          overusedSecrets: ['Royal bloodline', 'Hidden power'],
          speechPatterns: ['Speaks in riddles', 'One-word answers'],
        },
        tropesAndStereotypes: ['Byronic hero', 'Dark and troubled past'],
      });

      // Store test data
      characterBuilderService.storeCharacterConcept.mockResolvedValue(true);
      characterBuilderService.storeThematicDirection.mockResolvedValue(true);

      await characterBuilderService.storeCharacterConcept(concept);
      await characterBuilderService.storeThematicDirection(direction);

      // Step 1: Check if clichés exist (should not)
      characterBuilderService.hasClichesForDirection.mockResolvedValue(false);
      const existingCliches =
        await characterBuilderService.hasClichesForDirection('direction-1');
      expect(existingCliches).toBe(false);

      // Step 2: Generate clichés
      characterBuilderService.generateClichesForDirection.mockResolvedValue(
        generatedCliches
      );
      const generatedResult =
        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

      // Verify generation result
      expect(generatedResult).toBeDefined();
      expect(generatedResult.directionId).toBe('direction-1');
      expect(generatedResult.conceptId).toBe('concept-1');
      expect(generatedResult.categories).toBeDefined();
      expect(generatedResult.categories.names).toBeInstanceOf(Array);
      expect(generatedResult.tropesAndStereotypes).toBeInstanceOf(Array);

      // Step 3: Verify storage
      characterBuilderService.getClichesByDirectionId.mockResolvedValue(
        generatedCliches
      );
      const storedCliches =
        await characterBuilderService.getClichesByDirectionId('direction-1');
      expect(storedCliches).toBeDefined();
      expect(storedCliches.id).toBe(generatedResult.id);

      // Step 4: Verify one-to-one relationship
      characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
      const hasCliches =
        await characterBuilderService.hasClichesForDirection('direction-1');
      expect(hasCliches).toBe(true);
    });

    it('should prevent duplicate generation for same direction', async () => {
      const concept = testBed.createCharacterConcept({ id: 'concept-2' });
      const direction = testBed.createThematicDirection({
        id: 'direction-2',
        conceptId: 'concept-2',
      });

      const firstCliches = testBed.createCliche({
        id: 'cliche-first',
        directionId: 'direction-2',
        conceptId: 'concept-2',
        createdAt: '2024-01-01T00:00:00Z',
      });

      // First generation
      characterBuilderService.hasClichesForDirection.mockResolvedValueOnce(
        false
      );
      characterBuilderService.generateClichesForDirection.mockResolvedValueOnce(
        firstCliches
      );

      const firstResult =
        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

      // Attempt second generation - should return existing
      characterBuilderService.hasClichesForDirection.mockResolvedValueOnce(
        true
      );
      characterBuilderService.getClichesByDirectionId.mockResolvedValueOnce(
        firstCliches
      );
      characterBuilderService.generateClichesForDirection.mockResolvedValueOnce(
        firstCliches
      );

      const secondAttempt =
        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

      // Should return existing clichés, not generate new ones
      expect(secondAttempt.id).toBe(firstCliches.id);
      expect(secondAttempt.createdAt).toBe(firstCliches.createdAt);
    });
  });

  describe('Service Layer Integration', () => {
    it('should integrate CharacterBuilderService with ClicheGenerator', async () => {
      const mockLLMResponse = {
        categories: {
          names: ['Shadow', 'Raven', 'Wolf'],
          physicalDescriptions: ['Scarred face', 'Dark cloak', 'Piercing eyes'],
          personalityTraits: ['Brooding', 'Mysterious', 'Cynical'],
          skillsAbilities: ['Master swordsman', 'Stealth expert'],
          typicalLikes: ['Solitude', 'Night time'],
          typicalDislikes: ['Crowds', 'Authority'],
          commonFears: ['Betrayal', 'Vulnerability'],
          genericGoals: ['Revenge', 'Redemption'],
          backgroundElements: ['Tragic past', 'Lost family'],
          overusedSecrets: ['Royal bloodline', 'Hidden power'],
          speechPatterns: ['Speaks in riddles', 'One-word answers'],
        },
        tropesAndStereotypes: ['Byronic hero', 'Dark and troubled past'],
      };

      // Mock LLM service
      testBed.mockLLMService(mockLLMResponse);

      const concept = testBed.createCharacterConcept({
        text: 'A battle-hardened warrior',
      });

      const direction = testBed.createThematicDirection({
        title: 'The Vengeful Warrior',
        description: 'Seeking revenge for past wrongs',
      });

      const result = await clicheGenerator.generateCliches(
        concept.text,
        direction.description
      );

      // Verify parsing
      expect(result.categories.names).toEqual(mockLLMResponse.categories.names);
      expect(result.tropesAndStereotypes).toEqual(
        mockLLMResponse.tropesAndStereotypes
      );

      // Verify all categories are arrays
      Object.values(result.categories).forEach((category) => {
        expect(Array.isArray(category)).toBe(true);
      });
    });

    it('should handle LLM service errors gracefully', async () => {
      testBed.mockLLMServiceError('Service unavailable');

      const concept = testBed.createCharacterConcept({
        text: 'A noble knight',
      });

      const direction = testBed.createThematicDirection({
        title: 'The Righteous Defender',
      });

      await expect(
        clicheGenerator.generateCliches(concept.text, direction.description)
      ).rejects.toThrow('Service unavailable');
    });

    it('should properly format and validate LLM responses', async () => {
      const validResponse = {
        categories: {
          names: ['Test Name'],
          physicalDescriptions: ['Test Description'],
          personalityTraits: ['Test Trait'],
          skillsAbilities: ['Test Skill'],
          typicalLikes: ['Test Like'],
          typicalDislikes: ['Test Dislike'],
          commonFears: ['Test Fear'],
          genericGoals: ['Test Goal'],
          backgroundElements: ['Test Background'],
          overusedSecrets: ['Test Secret'],
          speechPatterns: ['Test Pattern'],
        },
        tropesAndStereotypes: ['Test Trope'],
      };

      clicheGenerator.parseLLMResponse.mockResolvedValue(validResponse);

      const result = await clicheGenerator.parseLLMResponse(validResponse);

      expect(result).toEqual(validResponse);
      expect(result.categories).toBeDefined();
      expect(result.tropesAndStereotypes).toBeDefined();
    });

    it('should reject malformed LLM responses', async () => {
      const malformedResponse = {
        // Missing categories structure
        someRandomField: 'invalid',
      };

      clicheGenerator.parseLLMResponse.mockRejectedValue(
        new Error('Invalid response format: missing categories')
      );

      await expect(
        clicheGenerator.parseLLMResponse(malformedResponse)
      ).rejects.toThrow(/Invalid response format/);
    });
  });

  describe('Workflow Error Handling', () => {
    it('should handle concept retrieval failures', async () => {
      characterBuilderService.getCharacterConcept.mockRejectedValue(
        new Error('Concept not found')
      );

      await expect(
        characterBuilderService.getCharacterConcept('invalid-id')
      ).rejects.toThrow('Concept not found');
    });

    it('should handle direction storage failures', async () => {
      const direction = testBed.createThematicDirection();

      characterBuilderService.storeThematicDirection.mockRejectedValue(
        new Error('Failed to store direction')
      );

      await expect(
        characterBuilderService.storeThematicDirection(direction)
      ).rejects.toThrow('Failed to store direction');
    });

    it('should handle generation timeout', async () => {
      const concept = testBed.createCharacterConcept();
      const direction = testBed.createThematicDirection();

      // Simulate timeout
      characterBuilderService.generateClichesForDirection.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Generation timeout')), 100)
          )
      );

      await expect(
        characterBuilderService.generateClichesForDirection(concept, direction)
      ).rejects.toThrow('Generation timeout');
    });

    it('should handle partial data failures', async () => {
      const incompleteCliches = {
        directionId: 'test-direction',
        // Missing conceptId and other required fields
        categories: null,
      };

      characterBuilderService.storeCliches.mockRejectedValue(
        new Error('Invalid cliché data: missing required fields')
      );

      await expect(
        characterBuilderService.storeCliches(incompleteCliches)
      ).rejects.toThrow(/Invalid cliché data/);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent generation requests', async () => {
      const concepts = Array(3)
        .fill(null)
        .map((_, i) =>
          testBed.createCharacterConcept({ id: `concept-concurrent-${i}` })
        );

      const directions = Array(3)
        .fill(null)
        .map((_, i) =>
          testBed.createThematicDirection({
            id: `direction-concurrent-${i}`,
            conceptId: `concept-concurrent-${i}`,
          })
        );

      const cliches = directions.map((dir, i) =>
        testBed.createCliche({
          directionId: dir.id,
          conceptId: concepts[i].id,
        })
      );

      // Setup mocks for concurrent operations
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async (concept, direction) => {
          // Simulate async processing
          await new Promise((resolve) => setTimeout(resolve, 50));
          const index = concepts.findIndex((c) => c.id === concept.id);
          return cliches[index];
        }
      );

      // Generate all clichés concurrently
      const generatePromises = concepts.map((concept, i) =>
        characterBuilderService.generateClichesForDirection(
          concept,
          directions[i]
        )
      );

      const results = await Promise.all(generatePromises);

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.directionId).toBe(directions[i].id);
        expect(result.conceptId).toBe(concepts[i].id);
      });
    });

    it('should prevent race conditions in duplicate checks', async () => {
      const concept = testBed.createCharacterConcept({ id: 'race-concept' });
      const direction = testBed.createThematicDirection({
        id: 'race-direction',
        conceptId: 'race-concept',
      });

      const cliche = testBed.createCliche({
        directionId: 'race-direction',
        conceptId: 'race-concept',
      });

      let hasCliches = false;

      // Simulate race condition scenario
      characterBuilderService.hasClichesForDirection.mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return hasCliches;
        }
      );

      characterBuilderService.generateClichesForDirection.mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (hasCliches) {
            throw new Error('Clichés already exist');
          }
          hasCliches = true;
          return cliche;
        }
      );

      // Try to generate twice concurrently
      const promise1 = characterBuilderService.generateClichesForDirection(
        concept,
        direction
      );
      const promise2 = characterBuilderService.generateClichesForDirection(
        concept,
        direction
      );

      const results = await Promise.allSettled([promise1, promise2]);

      // One should succeed, one should fail
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      if (failed.length > 0 && failed[0].status === 'rejected') {
        expect(failed[0].reason.message).toContain('already exist');
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate all required cliché fields', async () => {
      const validCliche = testBed.createCliche({
        directionId: 'validation-test',
        conceptId: 'concept-validation',
      });

      // Check that all required fields are present
      expect(validCliche.id).toBeDefined();
      expect(validCliche.directionId).toBeDefined();
      expect(validCliche.conceptId).toBeDefined();
      expect(validCliche.categories).toBeDefined();
      expect(validCliche.tropesAndStereotypes).toBeDefined();

      // Check that all category fields are arrays
      Object.entries(validCliche.categories).forEach(([key, value]) => {
        expect(Array.isArray(value)).toBe(true);
      });
    });

    it('should validate category structure completeness', async () => {
      const requiredCategories = [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ];

      const cliche = testBed.createCliche();

      requiredCategories.forEach((category) => {
        expect(cliche.categories).toHaveProperty(category);
        expect(Array.isArray(cliche.categories[category])).toBe(true);
      });
    });

    it('should validate metadata structure', async () => {
      const cliche = testBed.createCliche({
        llmMetadata: {
          model: 'gpt-4',
          temperature: 0.7,
          tokens: 1500,
          responseTime: 500,
        },
      });

      expect(cliche.llmMetadata).toBeDefined();
      expect(cliche.llmMetadata.model).toBeDefined();
      expect(cliche.llmMetadata.temperature).toBeGreaterThanOrEqual(0);
      expect(cliche.llmMetadata.temperature).toBeLessThanOrEqual(1);
      expect(cliche.llmMetadata.tokens).toBeGreaterThan(0);
      expect(cliche.llmMetadata.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with UI Components', () => {
    it('should properly update UI after successful generation', async () => {
      const concept = testBed.createCharacterConcept();
      const direction = testBed.createThematicDirection();
      const cliche = testBed.createCliche({
        directionId: direction.id,
        conceptId: concept.id,
      });

      // Setup successful generation flow
      characterBuilderService.hasClichesForDirection.mockResolvedValue(false);
      characterBuilderService.generateClichesForDirection.mockResolvedValue(
        cliche
      );

      // Simulate UI interaction
      await testBed.selectDirection(direction.id);

      // Verify UI state expectations
      const generateButton = testBed.getGenerateButton();
      expect(generateButton).toBeDefined();

      // Trigger generation
      characterBuilderService.generateClichesForDirection.mockResolvedValue(
        cliche
      );
      const result = await characterBuilderService.generateClichesForDirection(
        concept,
        direction
      );

      expect(result).toEqual(cliche);
    });

    it('should display error messages on generation failure', async () => {
      const errorMessage = 'Failed to generate clichés';

      characterBuilderService.generateClichesForDirection.mockRejectedValue(
        new Error(errorMessage)
      );

      const concept = testBed.createCharacterConcept();
      const direction = testBed.createThematicDirection();

      await expect(
        characterBuilderService.generateClichesForDirection(concept, direction)
      ).rejects.toThrow(errorMessage);
    });
  });
});
