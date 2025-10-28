/**
 * @file Unit tests for CharacterConceptsManagerController - Constructor and Dependencies
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController - Constructor and Dependencies', () => {
  const testBase = new CharacterConceptsManagerTestBase();

  beforeEach(async () => {
    await testBase.setup();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Constructor Validation', () => {
    it('should create controller with valid dependencies', () => {
      const controller = testBase.createController();

      expect(controller).toBeInstanceOf(CharacterConceptsManagerController);
      expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
        'CharacterConceptsManagerController initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: null,
          characterBuilderService: testBase.mocks.characterBuilderService,
          eventBus: testBase.mocks.eventBus,
        });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing debug, warn, error

      expect(() => {
        new CharacterConceptsManagerController({
          logger: invalidLogger,
          characterBuilderService: testBase.mocks.characterBuilderService,
          eventBus: testBase.mocks.eventBus,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when characterBuilderService is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: null,
          eventBus: testBase.mocks.eventBus,
        });
      }).toThrow('Missing required dependency: CharacterBuilderService');
    });

    it('should throw error when characterBuilderService is missing required methods', () => {
      const invalidService = { getAllCharacterConcepts: jest.fn() }; // Missing other methods

      expect(() => {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: invalidService,
          eventBus: testBase.mocks.eventBus,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: testBase.mocks.characterBuilderService,
          eventBus: null,
        });
      }).toThrow('Missing required dependency: ISafeEventDispatcher');
    });

    it('should throw error when eventBus is missing required methods', () => {
      const invalidEventBus = { subscribe: jest.fn() }; // Missing unsubscribe, dispatch

      expect(() => {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: testBase.mocks.characterBuilderService,
          eventBus: invalidEventBus,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should add missing optional service methods while preserving existing ones', () => {
      const partialService = {
        initialize: jest.fn(),
        getAllCharacterConcepts: jest.fn(),
        createCharacterConcept: jest.fn(),
        updateCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        getCharacterConcept: jest.fn(),
        getThematicDirections: jest.fn(),
      };

      const controller = new CharacterConceptsManagerController({
        logger: testBase.mocks.logger,
        characterBuilderService: partialService,
        eventBus: testBase.mocks.eventBus,
        schemaValidator: testBase.mocks.schemaValidator,
      });

      expect(controller.characterBuilderService).not.toBe(partialService);
      expect(controller.characterBuilderService.getCharacterConcept).toBe(
        partialService.getCharacterConcept
      );
      expect(
        controller.characterBuilderService.generateThematicDirections
      ).toBeInstanceOf(Function);

      return expect(
        controller.characterBuilderService.generateThematicDirections()
      ).resolves.toEqual([]);
    });
  });

  describe('Backward compatibility error mapping', () => {
    it('should remap missing CharacterBuilderService errors to legacy format', () => {
      try {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: undefined,
          eventBus: testBase.mocks.eventBus,
        });
        throw new Error('Expected constructor to throw due to missing service');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('Error');
        expect(error.message).toBe(
          'Missing required dependency: CharacterBuilderService'
        );
      }
    });

    it('should remap missing event bus errors to legacy format', () => {
      try {
        new CharacterConceptsManagerController({
          logger: testBase.mocks.logger,
          characterBuilderService: testBase.mocks.characterBuilderService,
          eventBus: undefined,
        });
        throw new Error('Expected constructor to throw due to missing event bus');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('Error');
        expect(error.message).toBe(
          'Missing required dependency: ISafeEventDispatcher'
        );
      }
    });
  });

  describe('Base Class Integration', () => {
    it('should properly extend BaseCharacterBuilderController', () => {
      const controller = testBase.createController();

      // Verify inheritance chain
      expect(controller).toBeInstanceOf(CharacterConceptsManagerController);
      expect(controller.logger).toBe(testBase.mocks.logger);

      // The characterBuilderService is wrapped for backward compatibility
      expect(controller.characterBuilderService).toEqual(
        expect.objectContaining({
          initialize: testBase.mocks.characterBuilderService.initialize,
          getAllCharacterConcepts:
            testBase.mocks.characterBuilderService.getAllCharacterConcepts,
        })
      );

      expect(controller.eventBus).toBe(testBase.mocks.eventBus);
    });

    it('should have required abstract methods implemented', () => {
      const controller = testBase.createController();

      expect(typeof controller._cacheElements).toBe('function');
      expect(typeof controller._setupEventListeners).toBe('function');
    });
  });
});
