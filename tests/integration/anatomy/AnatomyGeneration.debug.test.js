/**
 * @file tests/integration/anatomy/AnatomyGeneration.debug.test.js
 * @description Integration tests for debugging anatomy generation and parts map building
 */

import { AnatomyGenerationWorkflow } from '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('Anatomy Generation Debug Integration Tests', () => {
  let workflow;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };

    // Mock data registry
    mockDataRegistry = {
      get: jest.fn(),
    };

    // Mock body blueprint factory
    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };

    workflow = new AnatomyGenerationWorkflow({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
    });
  });

  describe('Human Male Anatomy Generation', () => {
    it('should generate all expected parts for human male blueprint', async () => {
      // Arrange - Setup human male recipe
      const recipeId = 'anatomy:human_male';
      const blueprintId = 'anatomy:human_male';
      const ownerId = 'test-owner-id';

      mockDataRegistry.get.mockReturnValue({
        blueprintId: blueprintId,
      });

      // Create mock entities for all expected body parts
      const bodyParts = [
        { id: 'torso-1', name: 'torso', type: 'torso' },
        { id: 'head-1', name: 'head', type: 'head' },
        { id: 'left-arm-1', name: 'left_arm', type: 'arm' },
        { id: 'right-arm-1', name: 'right_arm', type: 'arm' },
        { id: 'left-leg-1', name: 'left_leg', type: 'leg' },
        { id: 'right-leg-1', name: 'right_leg', type: 'leg' },
        { id: 'left-eye-1', name: 'left_eye', type: 'eye' },
        { id: 'right-eye-1', name: 'right_eye', type: 'eye' },
        { id: 'left-ear-1', name: 'left_ear', type: 'ear' },
        { id: 'right-ear-1', name: 'right_ear', type: 'ear' },
        { id: 'nose-1', name: 'nose', type: 'nose' },
        { id: 'mouth-1', name: 'mouth', type: 'mouth' },
        { id: 'hair-1', name: 'hair', type: 'hair' },
        { id: 'penis-1', name: 'penis', type: 'penis' },
        { id: 'left-testicle-1', name: 'left_testicle', type: 'testicle' },
        { id: 'right-testicle-1', name: 'right_testicle', type: 'testicle' },
        { id: 'asshole-1', name: 'asshole', type: 'asshole' },
        { id: 'left-hand-1', name: 'left_hand', type: 'hand' },
        { id: 'right-hand-1', name: 'right_hand', type: 'hand' },
      ];

      const partEntities = bodyParts.map((part) => ({
        id: part.id,
        hasComponent: jest.fn((component) => component === 'core:name'),
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') {
            return { text: part.name, name: part.name }; // Include both for compatibility
          }
          if (component === 'anatomy:part') {
            return { subType: part.type };
          }
          return null;
        }),
      }));

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = partEntities.find((e) => e.id === id);
        return entity || null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'torso-1',
        entities: bodyParts.map((p) => p.id),
      });

      // Act
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Assert
      expect(result.rootId).toBe('torso-1');
      expect(result.entities).toHaveLength(19); // 19 parts total
      expect(result.partsMap.size).toBe(19); // All parts should be in the map

      // Verify all expected parts are in the map
      const expectedParts = [
        'torso',
        'head',
        'left_arm',
        'right_arm',
        'left_leg',
        'right_leg',
        'left_eye',
        'right_eye',
        'left_ear',
        'right_ear',
        'nose',
        'mouth',
        'hair',
        'penis',
        'left_testicle',
        'right_testicle',
        'asshole',
        'left_hand',
        'right_hand',
      ];

      for (const partName of expectedParts) {
        expect(result.partsMap.has(partName)).toBe(true);
        expect(result.partsMap.get(partName)).toMatch(/-1$/); // All IDs end with -1
      }

      // Verify logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built parts map with 19 named parts')
      );
    });

    it('should handle parts without names gracefully', async () => {
      // Arrange
      const recipeId = 'anatomy:test';
      const blueprintId = 'anatomy:test';
      const ownerId = 'test-owner-id';

      mockDataRegistry.get.mockReturnValue({
        blueprintId: blueprintId,
      });

      // Create entities with some missing names
      const partEntities = [
        {
          id: 'torso-1',
          hasComponent: jest.fn(() => true),
          getComponentData: jest.fn((component) => {
            if (component === 'core:name') return { text: 'torso' };
            return null;
          }),
        },
        {
          id: 'unnamed-1',
          hasComponent: jest.fn(() => false), // No name component
          getComponentData: jest.fn(() => null),
        },
        {
          id: 'empty-name-1',
          hasComponent: jest.fn(() => true),
          getComponentData: jest.fn((component) => {
            if (component === 'core:name') return { text: '' }; // Empty name
            return null;
          }),
        },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return partEntities.find((e) => e.id === id) || null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'torso-1',
        entities: ['torso-1', 'unnamed-1', 'empty-name-1'],
      });

      // Act
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Assert
      expect(result.entities).toHaveLength(3);
      expect(result.partsMap.size).toBe(1); // Only torso has a valid name
      expect(result.partsMap.get('torso')).toBe('torso-1');
    });

    it('should verify the text field is used instead of name field', async () => {
      // Arrange
      const recipeId = 'anatomy:test';
      const blueprintId = 'anatomy:test';
      const ownerId = 'test-owner-id';

      mockDataRegistry.get.mockReturnValue({
        blueprintId: blueprintId,
      });

      // Create entity with both text and name fields
      const partEntity = {
        id: 'part-1',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((component) => {
          if (component === 'core:name') {
            return {
              text: 'correct_name', // This should be used
              name: 'wrong_name', // This should NOT be used
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(partEntity);

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'part-1',
        entities: ['part-1'],
      });

      // Act
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Assert
      expect(result.partsMap.get('correct_name')).toBe('part-1');
      expect(result.partsMap.has('wrong_name')).toBe(false);
    });
  });

  describe('Recipe Validation', () => {
    it('should validate recipe exists and has blueprintId', () => {
      // Arrange
      const recipeId = 'anatomy:valid_recipe';
      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'anatomy:test_blueprint',
      });

      // Act
      const blueprintId = workflow.validateRecipe(recipeId);

      // Assert
      expect(blueprintId).toBe('anatomy:test_blueprint');
    });

    it('should throw error for missing recipe', () => {
      // Arrange
      const recipeId = 'anatomy:missing_recipe';
      mockDataRegistry.get.mockReturnValue(null);

      // Act & Assert
      expect(() => workflow.validateRecipe(recipeId)).toThrow(
        `Recipe '${recipeId}' not found`
      );
    });

    it('should throw error for recipe without blueprintId', () => {
      // Arrange
      const recipeId = 'anatomy:invalid_recipe';
      mockDataRegistry.get.mockReturnValue({
        // No blueprintId field
      });

      // Act & Assert
      expect(() => workflow.validateRecipe(recipeId)).toThrow(
        `Recipe '${recipeId}' does not specify a blueprintId`
      );
    });
  });
});
