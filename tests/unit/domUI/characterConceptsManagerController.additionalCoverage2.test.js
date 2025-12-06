/**
 * @file Additional coverage tests for CharacterConceptsManagerController
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
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createMockCharacterBuilderService,
  createMockLogger,
  createMockEventBus,
} from './characterConceptsManagerController.testUtils.js';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';

describe('CharacterConceptsManagerController - targeted coverage', () => {
  describe('constructor compatibility shims', () => {
    let logger;
    let eventBus;
    let schemaValidator;
    let container;
    let controllerDependencies;

    beforeEach(async () => {
      logger = createMockLogger();
      eventBus = createMockEventBus();
      schemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
        validateAgainstSchema: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [] }),
      };

      container = await createTestContainer();
      controllerDependencies = resolveControllerDependencies(container);
    });

    it('wraps characterBuilderService to provide generateThematicDirections when missing', async () => {
      const service = createMockCharacterBuilderService();
      delete service.generateThematicDirections;

      const controller = new CharacterConceptsManagerController({
        logger,
        characterBuilderService: service,
        eventBus,
        schemaValidator,
        ...controllerDependencies,
      });

      expect(controller.characterBuilderService).not.toBe(service);
      await expect(
        controller.characterBuilderService.generateThematicDirections(
          'concept-id'
        )
      ).resolves.toEqual([]);
    });

    it('provides a fallback schemaValidator when one is not supplied', () => {
      const controller = new CharacterConceptsManagerController({
        logger,
        characterBuilderService: createMockCharacterBuilderService(),
        eventBus,
        schemaValidator: undefined,
        ...controllerDependencies,
      });

      expect(controller.schemaValidator.validate()).toEqual({
        isValid: true,
        errors: [],
      });
      expect(controller.schemaValidator.validateAgainstSchema()).toEqual({
        isValid: true,
        errors: [],
      });
      expect(controller.schemaValidator.listSchemas()).toEqual([]);
      expect(controller.schemaValidator.getSchema()).toBeNull();
    });

    it('remaps missing characterBuilderService errors to the legacy message', () => {
      expect(
        () =>
          new CharacterConceptsManagerController({
            logger,
            characterBuilderService: null,
            eventBus,
            schemaValidator,
            ...controllerDependencies,
          })
      ).toThrow('Missing required dependency: CharacterBuilderService');
    });

    it('remaps missing eventBus errors to the legacy message', () => {
      expect(
        () =>
          new CharacterConceptsManagerController({
            logger,
            characterBuilderService: createMockCharacterBuilderService(),
            eventBus: null,
            schemaValidator,
            ...controllerDependencies,
          })
      ).toThrow('Missing required dependency: ISafeEventDispatcher');
    });
  });

  describe('UI behaviors and test exports', () => {
    const testBase = new CharacterConceptsManagerTestBase();

    beforeEach(async () => {
      await testBase.setup();
    });

    afterEach(async () => {
      await testBase.cleanup();
    });

    it('allows round-trip access to exposed private state for tests', () => {
      const controller = testBase.createController();
      controller._cacheElements();
      const testExports = controller._testExports;

      const deletedCard = document.createElement('div');
      testExports.deletedCard = deletedCard;
      expect(testExports.deletedCard).toBe(deletedCard);

      testExports.pendingUIState = 'results';
      expect(testExports.pendingUIState).toBe('results');

      testExports.editingConceptId = 'concept-42';
      expect(testExports.editingConceptId).toBe('concept-42');

      testExports.originalConceptText = 'Original draft';
      expect(testExports.originalConceptText).toBe('Original draft');

      const lastEdit = { id: 'edit-1' };
      testExports.lastEdit = lastEdit;
      expect(testExports.lastEdit).toBe(lastEdit);

      testExports.isLeaderTab = true;
      expect(testExports.isLeaderTab).toBe(true);

      const broadcastChannel = { name: 'channel' };
      testExports.broadcastChannel = broadcastChannel;
      expect(testExports.broadcastChannel).toBe(broadcastChannel);
    });

    it('defaults to showing the empty state when no pending UI state exists', async () => {
      const controller = testBase.createController();
      controller._cacheElements();
      const showEmptySpy = jest.spyOn(controller, '_showEmpty');

      await controller._initializeUIState();

      expect(showEmptySpy).toHaveBeenCalled();
      showEmptySpy.mockRestore();
    });

    it('logs an error when the create modal element is missing', () => {
      const controller = testBase.createController();
      controller._cacheElements();

      const originalGetElement = controller._getElement.bind(controller);
      const getElementMock = jest
        .spyOn(controller, '_getElement')
        .mockImplementation((key) => {
          if (key === 'conceptModal') {
            return null;
          }
          return originalGetElement(key);
        });
      const setupValidationSpy = jest
        .spyOn(controller, '_setupConceptFormValidation')
        .mockImplementation(() => {});

      controller._showCreateModal();

      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        'Error showing create modal',
        expect.objectContaining({ message: 'Modal element not found' })
      );

      getElementMock.mockRestore();
      setupValidationSpy.mockRestore();
    });
  });
});
