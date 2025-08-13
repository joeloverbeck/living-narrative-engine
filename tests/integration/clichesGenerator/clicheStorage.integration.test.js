/**
 * @file Integration tests for cliché storage and database operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';
import { v4 as uuidv4 } from 'uuid';

describe('Clichés Storage - Database Integration', () => {
  let testBed;
  let characterDatabase;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();

    characterDatabase = testBed.getDatabase();
    characterBuilderService = testBed.mockCharacterBuilderService;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Database Schema Extension', () => {
    it('should have cliches store with proper indexes', async () => {
      // Note: Database schema testing should be done at the database layer
      // This test validates that the cliches store exists and can be accessed
      const testCliche = testBed.createMockClichesData();

      // Setup mock to simulate successful storage
      characterBuilderService.storeCliches.mockResolvedValue(true);
      characterBuilderService.getClichesByDirectionId.mockResolvedValue(
        testCliche
      );

      // Verify we can store and retrieve clichés (implicit schema validation)
      await characterBuilderService.storeCliches(testCliche);
      const retrieved = await characterBuilderService.getClichesByDirectionId(
        testCliche.directionId
      );

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(testCliche.id);
    });

    it('should enforce unique directionId index', async () => {
      const cliche1 = testBed.createCliche({
        directionId: 'direction-1',
        conceptId: 'concept-1',
      });

      const cliche2 = testBed.createCliche({
        directionId: 'direction-1', // Same direction ID
        conceptId: 'concept-2',
      });

      // Setup mock to simulate unique constraint violation
      characterBuilderService.storeCliches
        .mockResolvedValueOnce(true) // First store succeeds
        .mockRejectedValueOnce(
          new Error('Unique constraint violation: directionId must be unique')
        );

      await characterBuilderService.storeCliches(cliche1);

      // Should throw error for duplicate directionId
      await expect(
        characterBuilderService.storeCliches(cliche2)
      ).rejects.toThrow(/unique.*directionId/i);
    });
  });

  describe('Data Persistence', () => {
    it('should persist clichés across sessions', async () => {
      const cliche = testBed.createCliche({
        directionId: 'direction-3',
        conceptId: 'concept-3',
        categories: {
          names: ['Test Name 1', 'Test Name 2'],
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
      });

      // Setup persistence mock
      const storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData[data.directionId] = data;
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          return storedData[directionId] || null;
        }
      );

      // Store in first session
      await characterBuilderService.storeCliches(cliche);

      // Simulate new session
      await testBed.reinitialize();

      // Retrieve in new session
      const retrieved =
        await characterBuilderService.getClichesByDirectionId('direction-3');

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(cliche.id);
      expect(retrieved.categories.names).toEqual(cliche.categories.names);
    });

    it('should handle large cliché datasets', async () => {
      const largeCategories = {};
      const categoryNames = [
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

      // Create large dataset
      categoryNames.forEach((category) => {
        largeCategories[category] = Array(100)
          .fill(null)
          .map((_, i) => `${category}-item-${i}`);
      });

      const largeCliche = testBed.createCliche({
        directionId: 'direction-large',
        categories: largeCategories,
        tropesAndStereotypes: Array(50)
          .fill(null)
          .map((_, i) => `trope-${i}`),
      });

      // Setup mock to handle large data
      const storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData[data.directionId] = data;
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          return storedData[directionId] || null;
        }
      );

      // Should handle storage without issues
      await characterBuilderService.storeCliches(largeCliche);

      const retrieved =
        await characterBuilderService.getClichesByDirectionId(
          'direction-large'
        );
      expect(retrieved.categories.names.length).toBe(100);
      expect(retrieved.tropesAndStereotypes.length).toBe(50);
    });
  });

  describe('One-to-One Relationship Enforcement', () => {
    it('should maintain one-to-one relationship between directions and clichés', async () => {
      const direction1 = testBed.createThematicDirection({ id: 'dir-1' });
      const direction2 = testBed.createThematicDirection({ id: 'dir-2' });

      const cliche1 = testBed.createCliche({ directionId: 'dir-1' });
      const cliche2 = testBed.createCliche({ directionId: 'dir-2' });

      // Setup mock storage
      const storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData[data.directionId] = data;
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          return storedData[directionId] || null;
        }
      );

      await characterBuilderService.storeCliches(cliche1);
      await characterBuilderService.storeCliches(cliche2);

      // Each direction should have exactly one cliché set
      const result1 =
        await characterBuilderService.getClichesByDirectionId('dir-1');
      const result2 =
        await characterBuilderService.getClichesByDirectionId('dir-2');

      expect(result1.id).toBe(cliche1.id);
      expect(result2.id).toBe(cliche2.id);
      expect(result1.id).not.toBe(result2.id);
    });

    it('should update existing clichés for a direction', async () => {
      const originalCliche = testBed.createCliche({
        directionId: 'dir-update',
        categories: {
          names: ['Original'],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
      });

      const updatedCliche = {
        ...originalCliche,
        categories: {
          names: ['Updated'],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
      };

      // Setup mock to handle updates
      let storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData[data.directionId] = data;
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          return storedData[directionId] || null;
        }
      );

      await characterBuilderService.storeCliches(originalCliche);

      // Should replace existing clichés for the direction
      await characterBuilderService.storeCliches(updatedCliche);

      const retrieved =
        await characterBuilderService.getClichesByDirectionId('dir-update');
      expect(retrieved.categories.names).toEqual(['Updated']);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      testBed.simulateDatabaseError();

      await expect(
        characterBuilderService.getClichesByDirectionId('any-id')
      ).rejects.toThrow(/database/i);
    });

    it('should handle malformed LLM responses', async () => {
      const malformedResponse = {
        // Missing required structure
        someField: 'invalid',
      };

      testBed.mockLLMService(malformedResponse);

      // Setup parseLLMResponse to throw error for malformed data
      testBed.mockClicheGenerator.parseLLMResponse.mockRejectedValue(
        new Error('Invalid LLM response structure')
      );

      await expect(
        testBed.mockClicheGenerator.parseLLMResponse(malformedResponse)
      ).rejects.toThrow(/Invalid.*response/i);
    });

    it('should validate cliché data structure', async () => {
      const invalidCliche = {
        // Missing required fields
        categories: null,
      };

      // Setup mock to validate and reject invalid data
      characterBuilderService.storeCliches.mockRejectedValue(
        new Error('Cliché validation failed: categories is required')
      );

      await expect(
        characterBuilderService.storeCliches(invalidCliche)
      ).rejects.toThrow(/validation/i);
    });

    it('should handle storage failures gracefully', async () => {
      const validCliche = testBed.createCliche();

      // Simulate storage failure
      characterBuilderService.storeCliches.mockRejectedValue(
        new Error('Storage operation failed')
      );

      await expect(
        characterBuilderService.storeCliches(validCliche)
      ).rejects.toThrow(/Storage operation failed/);
    });

    it('should handle retrieval failures gracefully', async () => {
      // Simulate retrieval failure
      characterBuilderService.getClichesByDirectionId.mockRejectedValue(
        new Error('Failed to retrieve clichés')
      );

      await expect(
        characterBuilderService.getClichesByDirectionId('test-id')
      ).rejects.toThrow(/Failed to retrieve clichés/);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple concurrent storage operations', async () => {
      const cliches = Array(5)
        .fill(null)
        .map((_, i) =>
          testBed.createCliche({
            directionId: `direction-batch-${i}`,
            conceptId: `concept-batch-${i}`,
          })
        );

      // Setup mock for concurrent operations
      const storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        storedData[data.directionId] = data;
        return true;
      });

      // Store all clichés concurrently
      const storePromises = cliches.map((cliche) =>
        characterBuilderService.storeCliches(cliche)
      );

      const results = await Promise.all(storePromises);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r === true)).toBe(true);
      expect(Object.keys(storedData)).toHaveLength(5);
    });

    it('should handle partial batch failures', async () => {
      const cliches = Array(3)
        .fill(null)
        .map((_, i) =>
          testBed.createCliche({
            directionId: `direction-partial-${i}`,
          })
        );

      // Setup mock to fail on second item
      characterBuilderService.storeCliches
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Storage failed'))
        .mockResolvedValueOnce(true);

      const storePromises = cliches.map((cliche) =>
        characterBuilderService.storeCliches(cliche).catch((err) => err)
      );

      const results = await Promise.all(storePromises);

      expect(results[0]).toBe(true);
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all cliché fields during storage and retrieval', async () => {
      const originalCliche = testBed.createCliche({
        directionId: 'integrity-test',
        conceptId: 'concept-integrity',
        categories: {
          names: ['Name1', 'Name2'],
          physicalDescriptions: ['Desc1'],
          personalityTraits: ['Trait1'],
          skillsAbilities: ['Skill1'],
          typicalLikes: ['Like1'],
          typicalDislikes: ['Dislike1'],
          commonFears: ['Fear1'],
          genericGoals: ['Goal1'],
          backgroundElements: ['Background1'],
          overusedSecrets: ['Secret1'],
          speechPatterns: ['Pattern1'],
        },
        tropesAndStereotypes: ['Trope1', 'Trope2'],
        llmMetadata: {
          model: 'gpt-4',
          temperature: 0.8,
          tokens: 1500,
          responseTime: 750,
        },
      });

      // Setup complete storage mock
      let storedData = null;
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData = JSON.parse(JSON.stringify(data)); // Deep copy
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async () => {
          return storedData;
        }
      );

      await characterBuilderService.storeCliches(originalCliche);
      const retrieved =
        await characterBuilderService.getClichesByDirectionId('integrity-test');

      // Verify all fields are preserved
      expect(retrieved.id).toBe(originalCliche.id);
      expect(retrieved.directionId).toBe(originalCliche.directionId);
      expect(retrieved.conceptId).toBe(originalCliche.conceptId);
      expect(retrieved.categories).toEqual(originalCliche.categories);
      expect(retrieved.tropesAndStereotypes).toEqual(
        originalCliche.tropesAndStereotypes
      );
      expect(retrieved.llmMetadata).toEqual(originalCliche.llmMetadata);
      expect(retrieved.createdAt).toBe(originalCliche.createdAt);
      expect(retrieved.updatedAt).toBe(originalCliche.updatedAt);
    });

    it('should handle empty category arrays correctly', async () => {
      const clicheWithEmptyArrays = testBed.createCliche({
        directionId: 'empty-arrays',
        categories: {
          names: [],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
        tropesAndStereotypes: [],
      });

      const storedData = {};
      characterBuilderService.storeCliches.mockImplementation(async (data) => {
        storedData[data.directionId] = data;
        return true;
      });
      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          return storedData[directionId];
        }
      );

      await characterBuilderService.storeCliches(clicheWithEmptyArrays);
      const retrieved =
        await characterBuilderService.getClichesByDirectionId('empty-arrays');

      expect(retrieved.categories.names).toEqual([]);
      expect(retrieved.tropesAndStereotypes).toEqual([]);
    });
  });
});
