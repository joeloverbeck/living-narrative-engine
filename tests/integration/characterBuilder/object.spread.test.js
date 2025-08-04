/**
 * @file Test to prove the object spread issue
 * @description Demonstrates how object spread breaks prototype methods
 */

import { describe, it, expect, jest } from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Object Spread Issue - CharacterBuilderService', () => {
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;
  let service;

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

    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  describe('original service methods', () => {
    it('should have initialize method on original service', () => {
      expect(service).toBeDefined();
      expect(typeof service.initialize).toBe('function');
    });

    it('should have all required methods on original service', () => {
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

  describe('object spread operation', () => {
    it('should lose prototype methods when spreading service', () => {
      // This simulates what the controller does
      const spreadService = {
        ...service,
        // Add missing methods expected by base class if not present
        getCharacterConcept:
          service.getCharacterConcept || (() => Promise.resolve(null)),
        generateThematicDirections:
          service.generateThematicDirections || (() => Promise.resolve([])),
      };

      console.log(
        'Original service initialize type:',
        typeof service.initialize
      );
      console.log(
        'Spread service initialize type:',
        typeof spreadService.initialize
      );

      // The spread service should NOT have the initialize method
      expect(typeof service.initialize).toBe('function');
      expect(typeof spreadService.initialize).toBe('undefined');
    });

    it('should preserve methods when using proper inheritance instead of spread', () => {
      // Create a proper wrapper that preserves prototype methods
      const wrappedService = Object.create(service);

      // Add additional methods if needed
      wrappedService.getCharacterConcept =
        service.getCharacterConcept || (() => Promise.resolve(null));
      wrappedService.generateThematicDirections =
        service.generateThematicDirections || (() => Promise.resolve([]));

      console.log(
        'Wrapped service initialize type:',
        typeof wrappedService.initialize
      );

      // The wrapped service should preserve all methods
      expect(typeof wrappedService.initialize).toBe('function');

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
        expect(wrappedService).toHaveProperty(methodName);
        expect(typeof wrappedService[methodName]).toBe('function');
      });
    });
  });
});
