/**
 * @file Unit tests for CharacterBuilderService initialization issue reproduction
 * Tests the specific issue where CharacterBuilderService is missing the initialize method
 * @see src/characterBuilder/services/characterBuilderService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterBuilderService } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('CharacterBuilderService - Initialize Method Issue', () => {
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };
  });

  describe('initialize method existence and functionality', () => {
    it('should have an initialize method', () => {
      const service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

      expect(typeof service.initialize).toBe('function');
    });

    it('should successfully initialize when all dependencies are valid', async () => {
      const service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

      await expect(service.initialize()).resolves.not.toThrow();
      expect(mockStorageService.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Successfully initialized'
      );
    });

    it('should throw CharacterBuilderError when storage service initialization fails', async () => {
      const initError = new Error('Storage initialization failed');
      mockStorageService.initialize.mockRejectedValue(initError);

      const service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

      await expect(service.initialize()).rejects.toThrow(
        'Failed to initialize character builder service: Storage initialization failed'
      );
    });
  });

  describe('all required methods existence', () => {
    let service;

    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    const requiredMethods = [
      'initialize',
      'getAllCharacterConcepts',
      'createCharacterConcept',
      'updateCharacterConcept',
      'deleteCharacterConcept',
      'getCharacterConcept',
      'generateThematicDirections',
      'getThematicDirections',
    ];

    requiredMethods.forEach((methodName) => {
      it(`should have ${methodName} method`, () => {
        expect(typeof service[methodName]).toBe('function');
      });
    });
  });

  describe('dependency validation compatibility', () => {
    it('should pass BaseCharacterBuilderController dependency validation', () => {
      const service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

      // These are the methods that BaseCharacterBuilderController expects
      const requiredMethods = [
        'initialize',
        'getAllCharacterConcepts',
        'createCharacterConcept',
        'updateCharacterConcept',
        'deleteCharacterConcept',
        'getCharacterConcept',
        'generateThematicDirections',
        'getThematicDirections',
      ];

      requiredMethods.forEach((methodName) => {
        expect(service).toHaveProperty(methodName);
        expect(typeof service[methodName]).toBe('function');
      });
    });
  });
});
