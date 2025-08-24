/**
 * @file Test for CharacterBuilderService method existence and functionality
 * @description Verifies that expected methods exist and function correctly
 */

import { describe, it, expect, jest } from '@jest/globals';

describe('CharacterBuilderService - Method Existence Tests', () => {
  it('should verify that getAllThematicDirections method exists', async () => {
    // Arrange: Create comprehensive mock dependencies matching production requirements
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const mockEventBus = { dispatch: jest.fn() };
    const mockStorageService = {
      // Required methods from validateDependency check
      initialize: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn().mockResolvedValue({ id: 'concept1' }),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      // Method actually used by getAllThematicDirections
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
    };
    const mockDirectionGenerator = { generateDirections: jest.fn() };

    // Import and create CharacterBuilderService
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    const service = new CharacterBuilderService({
      logger: mockLogger,
      eventBus: mockEventBus,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
    });

    // Act & Assert: The method should exist and be a function
    expect(service.getAllThematicDirections).toBeDefined();
    expect(typeof service.getAllThematicDirections).toBe('function');
  });

  it('should verify that getAllThematicDirectionsWithConcepts method exists', async () => {
    // Arrange: Create comprehensive mock dependencies
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const mockEventBus = { dispatch: jest.fn() };
    const mockStorageService = {
      initialize: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn().mockResolvedValue({ id: 'concept1' }),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
    };
    const mockDirectionGenerator = { generateDirections: jest.fn() };

    // Import and create CharacterBuilderService
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    const service = new CharacterBuilderService({
      logger: mockLogger,
      eventBus: mockEventBus,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
    });

    // Act & Assert: The actual method should exist
    expect(service.getAllThematicDirectionsWithConcepts).toBeDefined();
    expect(typeof service.getAllThematicDirectionsWithConcepts).toBe(
      'function'
    );
  });

  it('should successfully call getAllThematicDirections and return data from storage', async () => {
    // Arrange: Create mock dependencies with test data
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const mockEventBus = { dispatch: jest.fn() };
    const testDirections = [
      { id: 'dir1', title: 'Direction 1' },
      { id: 'dir2', title: 'Direction 2' },
    ];
    const mockStorageService = {
      initialize: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn().mockResolvedValue({ id: 'concept1' }),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      getAllThematicDirections: jest.fn().mockResolvedValue(testDirections),
    };
    const mockDirectionGenerator = { generateDirections: jest.fn() };

    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    const service = new CharacterBuilderService({
      logger: mockLogger,
      eventBus: mockEventBus,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
    });

    // Act: Call the method
    const result = await service.getAllThematicDirections();

    // Assert: Should return data from storage service
    expect(result).toEqual(testDirections);
    expect(mockStorageService.getAllThematicDirections).toHaveBeenCalledTimes(
      1
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterBuilderService: Retrieved 2 thematic directions'
    );
  });
});
