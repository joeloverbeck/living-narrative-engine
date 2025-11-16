/**
 * @file Additional coverage tests for TraitsGeneratorController
 * @description Exercises uncovered branches related to UI controls, error handling, and filtering logic
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsGeneratorController } from '../../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { TraitsGeneratorTestBed } from '../../../common/traitsGeneratorTestBed.js';

describe('TraitsGeneratorController (additional coverage)', () => {
  let testBed;
  let controller;
  let container;
  let originalURL;
  let originalLocation;

  beforeEach(() => {
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();

    container = document.createElement('div');
    container.innerHTML = createMockHTML();
    document.body.appendChild(container);

    originalURL = global.URL;
    global.URL = {
      createObjectURL: jest.fn(() => 'mock-url'),
      revokeObjectURL: jest.fn(),
    };

    originalLocation = window.location.href;

    Element.prototype.scrollIntoView = jest.fn();

    controller = createController();
  });

  afterEach(async () => {
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }

    if (originalURL) {
      global.URL = originalURL;
    }

    if (originalLocation) {
      window.history.replaceState(null, '', originalLocation);
    }

    jest.clearAllMocks();
    await testBed.cleanup();
  });

  it('clears the selected direction and inputs when the clear button is pressed', async () => {
    const direction = createDirectionWithConcept({
      id: 'dir-clear',
      conceptName: 'Resolute Path',
      createdAt: '2024-01-01T00:00:00Z',
    });

    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      direction,
    ]);
    testBed.services.characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue([
      testBed.createValidCoreMotivation(),
    ]);

    await controller.initialize();

    const selector = document.getElementById('direction-selector');
    selector.value = direction.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsync();

    document.getElementById('core-motivation-input').value =
      'A compelling motivation that passes validation.';
    document.getElementById('internal-contradiction-input').value =
      'An internal contradiction with sufficient detail.';
    document.getElementById('central-question-input').value =
      'A central question longer than ten characters.';

    document.getElementById('clear-btn').dispatchEvent(new Event('click'));
    await flushAsync();

    expect(selector.value).toBe('');
    expect(document.getElementById('selected-direction-display').style.display).toBe('none');
    expect(document.getElementById('core-motivation-input').value).toBe('');
    expect(document.getElementById('internal-contradiction-input').value).toBe('');
    expect(document.getElementById('central-question-input').value).toBe('');
    expect(testBed.services.logger.debug).toHaveBeenCalledWith('Cleared direction selection');
  });

  it('navigates back to the main menu when the back button is clicked', async () => {
    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      createDirectionWithConcept({ id: 'dir-back', createdAt: '2024-02-01T00:00:00Z' }),
    ]);
    testBed.services.characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue([
      testBed.createValidCoreMotivation(),
    ]);

    await controller.initialize();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    document.getElementById('back-btn').dispatchEvent(new Event('click'));

    expect(errorSpy).toHaveBeenCalled();
    const [[navigationError]] = errorSpy.mock.calls;
    const navigationMessage =
      navigationError instanceof Error ? navigationError.message : String(navigationError);
    expect(navigationMessage).toContain('navigation');

    errorSpy.mockRestore();
  });

  it('logs a warning when the direction selector element is unavailable', async () => {
    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([]);
    testBed.services.characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue([]);

    await controller.initialize();

    controller._refreshElement('directionSelector', '#non-existent-selector');
    testBed.services.logger.warn.mockClear();

    await controller._loadInitialData();

    expect(testBed.services.logger.warn).toHaveBeenCalledWith(
      'Direction selector element not found'
    );
  });

  it('creates grouped options with optgroups sorted by newest direction first', async () => {
    const sharedConcept = {
      id: 'concept-shared',
      concept: 'Shared concept',
      name: 'Shared Concept',
    };

    const olderDirection = {
      direction: {
        id: 'dir-old',
        title: 'Old Direction',
        description: 'Older entry',
        conceptId: 'concept-shared',
        createdAt: '2023-01-01T00:00:00Z',
      },
      concept: sharedConcept,
    };

    const newerDirection = {
      direction: {
        id: 'dir-new',
        title: 'New Direction',
        description: 'Newer entry',
        conceptId: 'concept-shared',
        createdAt: '2024-05-01T00:00:00Z',
      },
      concept: sharedConcept,
    };

    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      olderDirection,
      newerDirection,
    ]);
    testBed.services.characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue([
      testBed.createValidCoreMotivation(),
    ]);

    await controller.initialize();

    const selector = document.getElementById('direction-selector');
    const optgroup = selector.querySelector('optgroup[label="Shared Concept"]');
    expect(optgroup).toBeTruthy();

    const optionValues = Array.from(optgroup.querySelectorAll('option')).map((option) => option.value);
    expect(optionValues).toEqual(['dir-new', 'dir-old']);
  });

  it('recovers from unexpected errors thrown inside the direction selector handler', async () => {
    const directionSelector = document.getElementById('direction-selector');
    const addEventListenerSpy = jest.spyOn(
      controller.eventRegistry,
      'addEventListener'
    );
    const handleServiceErrorSpy = jest.spyOn(controller, '_handleServiceError');

    await controller.initialize();
    handleServiceErrorSpy.mockClear();

    const originalPromiseResolve = Promise.resolve;
    const catchCallbacks = [];
    Promise.resolve = jest.fn(() => ({
      then: () => ({
        catch: (catchCallback) => {
          catchCallbacks.push(catchCallback);
          return null;
        },
      }),
    }));

    const changeCall = addEventListenerSpy.mock.calls.find(
      ([target, eventName]) => target === directionSelector && eventName === 'change'
    );
    expect(changeCall).toBeDefined();
    const [, changeHandler] = changeCall;

    try {
      changeHandler({ target: { value: 'dir-simulated' } });
      expect(catchCallbacks).toHaveLength(1);

      const simulatedError = new Error('simulated failure');
      let thrownError;
      try {
        catchCallbacks[0](simulatedError);
      } catch (error) {
        thrownError = error;
      }

      expect(handleServiceErrorSpy).toHaveBeenCalledWith(
        simulatedError,
        'select direction',
        'Failed to load direction data. Please try selecting another direction.'
      );
      expect(thrownError).toBe(simulatedError);
    } finally {
      Promise.resolve = originalPromiseResolve;
      addEventListenerSpy.mockRestore();
      handleServiceErrorSpy.mockRestore();
    }
  });

  it('routes selection failures through the service error handler', async () => {
    const direction = createDirectionWithConcept({
      id: 'dir-error',
      conceptName: 'Errant Path',
      createdAt: '2024-03-01T00:00:00Z',
    });

    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      direction,
    ]);
    testBed.services.characterBuilderService.hasClichesForDirection.mockResolvedValue(true);
    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue([
      testBed.createValidCoreMotivation(),
    ]);

    const directionSelector = document.getElementById('direction-selector');
    const addEventListenerSpy = jest.spyOn(
      controller.eventRegistry,
      'addEventListener'
    );
    const handleServiceErrorSpy = jest.spyOn(controller, '_handleServiceError');

    await controller.initialize();
    handleServiceErrorSpy.mockClear();

    const originalPromiseResolve = Promise.resolve;
    const thenCallbacks = [];
    const catchCallbacks = [];
    Promise.resolve = jest.fn(() => ({
      then: (thenCallback) => {
        thenCallbacks.push(thenCallback);
        return {
          catch: (catchCallback) => {
            catchCallbacks.push(catchCallback);
            return null;
          },
        };
      },
    }));

    const originalGetElement = controller._getElement.bind(controller);
    const getElementSpy = jest
      .spyOn(controller, '_getElement')
      .mockImplementation((key) => {
        if (key === 'selectedDirectionDisplay') {
          throw new Error('render failure');
        }
        return originalGetElement(key);
      });

    const changeCall = addEventListenerSpy.mock.calls.find(
      ([target, eventName]) => target === directionSelector && eventName === 'change'
    );
    expect(changeCall).toBeDefined();
    const [, changeHandler] = changeCall;

    try {
      changeHandler({ target: { value: direction.direction.id } });

      expect(thenCallbacks).toHaveLength(1);
      expect(catchCallbacks).toHaveLength(1);

      let capturedError;
      try {
        await thenCallbacks[0]();
      } catch (error) {
        capturedError = error;
      }

      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError?.message).toBe('render failure');

      let rethrownError;
      try {
        catchCallbacks[0](capturedError);
      } catch (error) {
        rethrownError = error;
      }

      expect(handleServiceErrorSpy).toHaveBeenCalledWith(
        capturedError,
        'select direction',
        'Failed to load direction data. Please try selecting another direction.'
      );
      expect(rethrownError).toBe(capturedError);
    } finally {
      Promise.resolve = originalPromiseResolve;
      addEventListenerSpy.mockRestore();
      getElementSpy.mockRestore();
      handleServiceErrorSpy.mockRestore();
    }
  });

  it('logs filtering diagnostics for invalid data while retaining valid directions', async () => {
    const invalidConcept = {
      direction: {
        id: 'dir-invalid',
        title: 'Invalid Concept Direction',
        description: 'Missing concept fields',
      },
      concept: { id: '', concept: '' },
    };

    const noClichesDirection = createDirectionWithConcept({
      id: 'dir-no-cliches',
      conceptName: 'No Cliches',
      createdAt: '2024-03-01T00:00:00Z',
    });

    const noMotivationsDirection = createDirectionWithConcept({
      id: 'dir-no-motivations',
      conceptName: 'No Motivations',
      createdAt: '2024-03-02T00:00:00Z',
    });

    const validDirection = createDirectionWithConcept({
      id: 'dir-valid',
      conceptName: 'Valid Concept',
      createdAt: '2024-03-03T00:00:00Z',
    });

    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      invalidConcept,
      noClichesDirection,
      noMotivationsDirection,
      validDirection,
    ]);

    testBed.services.characterBuilderService.hasClichesForDirection
      .mockImplementationOnce(async () => {
        throw new Error('No clichés available');
      })
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(async () => true);

    testBed.services.characterBuilderService.getCoreMotivationsByDirectionId
      .mockImplementationOnce(async () => {
        throw new Error('No motivations available');
      })
      .mockImplementationOnce(async () => [testBed.createValidCoreMotivation()]);

    await controller.initialize();

    expect(testBed.services.logger.debug).toHaveBeenCalledWith(
      `Filtering out direction ${invalidConcept.direction.id}: concept missing required fields`
    );
    expect(testBed.services.logger.debug).toHaveBeenCalledWith(
      `No clichés found for direction ${noClichesDirection.direction.id}:`,
      expect.any(Error)
    );
    expect(testBed.services.logger.debug).toHaveBeenCalledWith(
      `No core motivations found for direction ${noMotivationsDirection.direction.id}:`,
      expect.any(Error)
    );
    expect(testBed.services.logger.info).toHaveBeenCalledWith(
      'Loaded 1 eligible directions with both clichés and core motivations'
    );
  });

  it('reports service errors when initial data loading fails', async () => {
    const loadError = new Error('Failed to fetch directions');
    testBed.services.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
      loadError
    );

    const handleServiceErrorSpy = jest.spyOn(controller, '_handleServiceError');

    await expect(controller.initialize()).rejects.toThrow('Failed to fetch directions');

    expect(handleServiceErrorSpy).toHaveBeenCalledWith(
      loadError,
      'load thematic directions',
      'Failed to load thematic directions. Please refresh the page.'
    );
  });

  function createController() {
    return new TraitsGeneratorController({
      logger: testBed.services.logger,
      characterBuilderService: testBed.services.characterBuilderService,
      eventBus: testBed.services.eventBus,
      uiStateManager: createMockUIStateManager(),
      schemaValidator: createMockSchemaValidator(),
      traitsDisplayEnhancer: createMockTraitsDisplayEnhancer(),
    });
  }

  function createMockUIStateManager() {
    return {
      showState: jest.fn(),
      hideState: jest.fn(),
      getCurrentState: jest.fn(),
    };
  }

  function createMockSchemaValidator() {
    return {
      validate: jest.fn(),
      validateAsync: jest.fn(),
      validateAgainstSchema: jest.fn(),
    };
  }

  function createMockTraitsDisplayEnhancer() {
    return {
      enhanceForDisplay: jest.fn(),
      generateExportFilename: jest.fn().mockReturnValue('traits.txt'),
      formatForExport: jest.fn().mockReturnValue('Formatted export'),
    };
  }

  function createMockHTML() {
    return `
      <select id="direction-selector">
        <option value="">-- Choose Direction --</option>
      </select>
      <div id="selected-direction-display" style="display: none;">
        <div id="direction-title"></div>
        <div id="direction-description"></div>
      </div>
      <div id="direction-selector-error"></div>

      <textarea id="core-motivation-input"></textarea>
      <textarea id="internal-contradiction-input"></textarea>
      <textarea id="central-question-input"></textarea>
      <div id="input-validation-error"></div>

      <div id="core-motivations-panel" style="display: none;">
        <div id="core-motivations-list"></div>
      </div>
      <div id="user-input-summary" style="display: none;"></div>

      <button id="generate-btn" disabled>Generate</button>
      <button id="export-btn" style="display: none;">Export</button>
      <button id="clear-btn">Clear</button>
      <button id="back-btn">Back</button>

      <div id="empty-state" style="display: block;"></div>
      <div id="loading-state" style="display: none;">
        <div id="loading-message">Loading...</div>
      </div>
      <div id="results-state" style="display: none;">
        <div id="traits-results"></div>
      </div>
      <div id="error-state" style="display: none;">
        <div id="error-message-text"></div>
      </div>

      <div id="screen-reader-announcement" aria-live="polite" class="sr-only"></div>
    `;
  }

  function createDirectionWithConcept({
    id = 'direction-default',
    conceptName = 'Default Concept',
    conceptText = 'Concept text',
    createdAt = '2024-01-01T00:00:00Z',
  } = {}) {
    return {
      direction: {
        id,
        title: `${conceptName} Title`,
        description: `${conceptName} Description`,
        conceptId: `concept-${id}`,
        createdAt,
      },
      concept: {
        id: `concept-${id}`,
        concept: conceptText,
        name: conceptName,
      },
    };
  }

  async function flushAsync() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});
