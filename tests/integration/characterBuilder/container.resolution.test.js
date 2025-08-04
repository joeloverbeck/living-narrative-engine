/**
 * @file Direct container resolution test to isolate the issue
 * @description Tests the container resolution without bootstrap complexity
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Container Resolution - CharacterBuilderService', () => {
  let container;

  beforeEach(async () => {
    // Mock fetch for schema loading
    global.fetch = jest.fn((url) => {
      if (url.includes('.schema.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              type: 'object',
              properties: {},
              required: [],
            }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    container = new AppContainer();
    await configureMinimalContainer(container, {
      includeCharacterBuilder: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('direct service resolution', () => {
    it('should resolve CharacterBuilderService with correct token', () => {
      console.log('Token value:', tokens.CharacterBuilderService);

      const service = container.resolve(tokens.CharacterBuilderService);

      console.log('Resolved service:', !!service);
      console.log('Service type:', typeof service);
      console.log('Service constructor name:', service?.constructor?.name);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CharacterBuilderService);
    });

    it('should have initialize method on resolved service', () => {
      const service = container.resolve(tokens.CharacterBuilderService);

      console.log(
        'Service methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      );
      console.log('Has initialize:', 'initialize' in service);
      console.log('Initialize type:', typeof service.initialize);

      expect(service).toBeDefined();
      expect(typeof service.initialize).toBe('function');
    });

    it('should have all required methods', () => {
      const service = container.resolve(tokens.CharacterBuilderService);

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
        console.log(`${methodName}:`, typeof service[methodName]);
        expect(service).toHaveProperty(methodName);
        expect(typeof service[methodName]).toBe('function');
      });
    });

    it('should successfully initialize the service', async () => {
      const service = container.resolve(tokens.CharacterBuilderService);

      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('container registration verification', () => {
    it('should have registered CharacterBuilderService with correct token', () => {
      // Check if the service is actually registered
      const isRegistered =
        container._registrations?.has?.(tokens.CharacterBuilderService) ||
        container.registrations?.has?.(tokens.CharacterBuilderService) ||
        container.services?.has?.(tokens.CharacterBuilderService);

      console.log('Service is registered:', isRegistered);

      // Try to resolve it
      expect(() =>
        container.resolve(tokens.CharacterBuilderService)
      ).not.toThrow();
    });

    it('should resolve dependencies for CharacterBuilderService', () => {
      // Check if all dependencies can be resolved
      const logger = container.resolve(tokens.ILogger);
      const storageService = container.resolve(tokens.CharacterStorageService);
      const directionGenerator = container.resolve(
        tokens.ThematicDirectionGenerator
      );
      const eventBus = container.resolve(tokens.ISafeEventDispatcher);

      expect(logger).toBeDefined();
      expect(storageService).toBeDefined();
      expect(directionGenerator).toBeDefined();
      expect(eventBus).toBeDefined();

      console.log('All dependencies resolved successfully');
    });
  });
});
