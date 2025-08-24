/**
 * @file Unit test for CharacterBuilderService thematic directions methods
 * @description Tests to verify the presence and functionality of thematic direction methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createMockLogger,
  createEventBus,
} from '../../../common/mockFactories/index.js';

describe('CharacterBuilderService - Thematic Directions Methods', () => {
  let mockDependencies;
  let characterBuilderService;

  beforeEach(async () => {
    // Create mock dependencies
    mockDependencies = {
      logger: createMockLogger(),
      eventBus: createEventBus(),
      storageService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        storeCharacterConcept: jest.fn(),
        listCharacterConcepts: jest.fn().mockResolvedValue([]),
        getCharacterConcept: jest
          .fn()
          .mockResolvedValue({ id: 'concept1', title: 'Test Concept' }),
        deleteCharacterConcept: jest.fn(),
        storeThematicDirections: jest.fn(),
        getThematicDirections: jest.fn().mockResolvedValue([]),
        getAllThematicDirections: jest.fn().mockResolvedValue([]),
        getThematicDirection: jest.fn(),
      },
      directionGenerator: {
        generateDirections: jest.fn().mockResolvedValue([]),
      },
    };

    // Import and create actual CharacterBuilderService
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    characterBuilderService = new CharacterBuilderService({
      logger: mockDependencies.logger,
      eventBus: mockDependencies.eventBus,
      storageService: mockDependencies.storageService,
      directionGenerator: mockDependencies.directionGenerator,
    });
  });

  describe('Method Availability Verification', () => {
    it('should verify that getAllThematicDirections method DOES exist', () => {
      // Act & Assert: The method should exist and be a function
      expect(characterBuilderService.getAllThematicDirections).toBeDefined();
      expect(typeof characterBuilderService.getAllThematicDirections).toBe(
        'function'
      );
    });

    it('should verify that getAllThematicDirectionsWithConcepts method DOES exist', () => {
      // Act & Assert: The actual method should exist
      expect(
        typeof characterBuilderService.getAllThematicDirectionsWithConcepts
      ).toBe('function');
    });

    it('should demonstrate that both thematic direction methods work correctly', async () => {
      // Arrange: Mock storage service to return directions
      mockDependencies.storageService.getAllThematicDirections.mockResolvedValue(
        [
          { id: 'dir1', title: 'Direction 1', conceptId: 'concept1' },
          { id: 'dir2', title: 'Direction 2', conceptId: 'concept2' },
        ]
      );

      // Act: Test that getAllThematicDirections works
      const allDirections =
        await characterBuilderService.getAllThematicDirections();
      expect(allDirections).toBeDefined();
      expect(allDirections).toHaveLength(2);

      // Act: Test that getAllThematicDirectionsWithConcepts also works
      const directionsWithConcepts =
        await characterBuilderService.getAllThematicDirectionsWithConcepts();
      expect(directionsWithConcepts).toBeDefined();
    });

    it('should verify TraitsGeneratorController can call getAllThematicDirections successfully', async () => {
      // What TraitsGeneratorController.js:213 is calling:
      const methodUsedByController = 'getAllThematicDirections';

      // Verify the method exists and is callable
      expect(characterBuilderService[methodUsedByController]).toBeDefined();
      expect(typeof characterBuilderService[methodUsedByController]).toBe(
        'function'
      );

      // Mock data for testing
      mockDependencies.storageService.getAllThematicDirections.mockResolvedValue(
        [{ id: 'dir1', title: 'Direction 1', conceptId: 'concept1' }]
      );

      // Verify it can be called successfully
      const result = await characterBuilderService[methodUsedByController]();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Method Functionality Verification', () => {
    it('should successfully call getAllThematicDirections as used by TraitsGeneratorController', async () => {
      // Arrange: This mimics what TraitsGeneratorController.js:213 does
      mockDependencies.storageService.getAllThematicDirections.mockResolvedValue(
        [{ id: 'dir1', title: 'Test Direction', conceptId: 'concept1' }]
      );

      // Act: Call the method exactly as TraitsGeneratorController does
      const allDirections =
        await characterBuilderService.getAllThematicDirections();

      // Assert: Should work without errors
      expect(allDirections).toBeDefined();
      expect(Array.isArray(allDirections)).toBe(true);
      expect(allDirections).toHaveLength(1);
      expect(allDirections[0].title).toBe('Test Direction');
    });

    it('should handle empty directions array gracefully', async () => {
      // Arrange: Mock empty response
      mockDependencies.storageService.getAllThematicDirections.mockResolvedValue(
        []
      );

      // Act
      const result = await characterBuilderService.getAllThematicDirections();

      // Assert
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
