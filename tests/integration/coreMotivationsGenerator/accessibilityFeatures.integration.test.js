import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CoreMotivationsGeneratorController,
} from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import {
  CoreMotivationsDisplayEnhancer,
} from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import EventBus from '../../../src/events/eventBus.js';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createMotivation = (overrides = {}) => ({
  id: overrides.id || 'motivation-1',
  directionId: overrides.directionId || 'direction-1',
  conceptId: overrides.conceptId || 'concept-1',
  coreDesire: overrides.coreDesire || 'Protect the realm',
  internalContradiction:
    overrides.internalContradiction || 'Struggles with self-doubt',
  centralQuestion:
    overrides.centralQuestion || 'Will they rise above their fears?',
  createdAt: overrides.createdAt || new Date().toISOString(),
});

const createControllerDependencies = ({ logger, eventBus, schemaValidator }) => {
  const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({ logger });
  const domElementManager = new DOMElementManager({
    logger,
    documentRef: document,
    performanceRef: globalThis.performance,
    elementsRef: {},
    contextName: 'CoreMotivationsTestDOM',
  });
  const eventListenerRegistry = new EventListenerRegistry({
    logger,
    asyncUtilities: asyncUtilitiesToolkit,
    contextName: 'CoreMotivationsTestEventRegistry',
  });
  const performanceMonitor = new PerformanceMonitor({
    logger,
    eventBus,
    contextName: 'CoreMotivationsTestPerformanceMonitor',
    threshold: 2500,
  });
  const memoryManager = new MemoryManager({
    logger,
    contextName: 'CoreMotivationsTestMemoryManager',
  });
  const errorHandlingStrategy = new ErrorHandlingStrategy({
    logger,
    eventBus,
    controllerName: 'CoreMotivationsGeneratorController',
    errorCategories: ERROR_CATEGORIES,
    errorSeverity: ERROR_SEVERITY,
  });
  const validationService = new ValidationService({
    schemaValidator,
    logger,
    handleError: (error, context) =>
      logger.error('Validation error', error, context),
    errorCategories: ERROR_CATEGORIES,
  });
  const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
    logger,
    eventBus,
  });

  return {
    asyncUtilitiesToolkit,
    domElementManager,
    eventListenerRegistry,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
    controllerLifecycleOrchestrator,
  };
};

describe('Core Motivations accessibility integration', () => {
  let controller;
  let logger;
  let characterBuilderService;
  let coreMotivationsGenerator;
  let schemaValidator;
  let displayEnhancer;
  let eventBus;
  let resolveConcept;
  let conceptData;

  const setupDOM = () => {
    document.body.innerHTML = '';

    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);

    const directionSelector = document.createElement('select');
    directionSelector.id = 'direction-selector';
    directionSelector.innerHTML =
      '<option value="">-- Choose a thematic direction --</option>';
    main.appendChild(directionSelector);

    const noDirections = document.createElement('div');
    noDirections.id = 'no-directions-message';
    noDirections.style.display = 'none';
    main.appendChild(noDirections);

    const generateBtn = document.createElement('button');
    generateBtn.id = 'generate-btn';
    generateBtn.type = 'button';
    main.appendChild(generateBtn);

    const clearAllBtn = document.createElement('button');
    clearAllBtn.id = 'clear-all-btn';
    clearAllBtn.type = 'button';
    main.appendChild(clearAllBtn);

    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.type = 'button';
    main.appendChild(exportBtn);

    const backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.type = 'button';
    main.appendChild(backBtn);

    const searchInput = document.createElement('input');
    searchInput.id = 'motivation-search';
    searchInput.type = 'search';
    main.appendChild(searchInput);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'motivation-sort';
    sortSelect.innerHTML = `
      <option value="newest">Newest</option>
      <option value="alphabetical">Alphabetical</option>
      <option value="oldest">Oldest</option>
    `;
    main.appendChild(sortSelect);

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.style.display = 'none';
    const loadingText = document.createElement('p');
    loadingIndicator.appendChild(loadingText);
    main.appendChild(loadingIndicator);

    const motivationsContainer = document.createElement('div');
    motivationsContainer.id = 'motivations-container';
    main.appendChild(motivationsContainer);

    const emptyState = document.createElement('div');
    emptyState.id = 'empty-state';
    main.appendChild(emptyState);

    const resultsCount = document.createElement('div');
    resultsCount.id = 'search-results-count';
    resultsCount.style.display = 'none';
    const countValue = document.createElement('span');
    countValue.id = 'search-count';
    resultsCount.appendChild(countValue);
    main.appendChild(resultsCount);

    const selectedDisplay = document.createElement('div');
    selectedDisplay.id = 'selected-direction-display';
    main.appendChild(selectedDisplay);

    const directionCount = document.createElement('div');
    directionCount.id = 'direction-count';
    main.appendChild(directionCount);

    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.style.display = 'none';
    main.appendChild(modal);

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'confirm-clear';
    confirmBtn.type = 'button';
    modal.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-clear';
    cancelBtn.type = 'button';
    modal.appendChild(cancelBtn);
  };

  beforeEach(() => {
    jest.useFakeTimers();

    conceptData = {
      id: 'concept-1',
      text: 'A brave warrior seeking redemption',
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const existingMotivation = createMotivation({ id: 'existing-1' });
    const generatedMotivation = createMotivation({ id: 'generated-1' });

    characterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([conceptData]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([
        {
          direction: {
            id: 'direction-1',
            title: 'Heroic Journey',
            conceptId: 'concept-1',
          },
          concept: conceptData,
        },
      ]),
      hasClichesForDirection: jest.fn().mockResolvedValue(true),
      getCharacterConcept: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConcept = resolve;
          }),
      ),
      getClichesByDirectionId: jest
        .fn()
        .mockResolvedValue([{ id: 'cliche-1', text: 'Chosen one' }]),
      saveCoreMotivations: jest
        .fn()
        .mockResolvedValue(['generated-1']),
      getCoreMotivationsByDirectionId: jest
        .fn()
        .mockResolvedValueOnce([existingMotivation])
        .mockResolvedValue([existingMotivation, generatedMotivation]),
      removeCoreMotivationItem: jest.fn().mockResolvedValue(true),
      clearCoreMotivationsForDirection: jest.fn().mockResolvedValue(2),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    coreMotivationsGenerator = {
      generate: jest
        .fn()
        .mockResolvedValue([
          createMotivation({ id: 'generated-1', createdAt: new Date().toISOString() }),
        ]),
    };

    schemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    displayEnhancer = new CoreMotivationsDisplayEnhancer({ logger });
    eventBus = new EventBus({ logger });

    if (!navigator.clipboard) {
      navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
    }

    setupDOM();

    const controllerDependencies = createControllerDependencies({
      logger,
      eventBus,
      schemaValidator,
    });

    controller = new CoreMotivationsGeneratorController({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      coreMotivationsGenerator,
      displayEnhancer,
      ...controllerDependencies,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('manages loading state, focus, and screen reader announcements end-to-end', async () => {
    await controller.initialize();

    const directionSelect = document.getElementById('direction-selector');
    directionSelect.value = 'direction-1';
    directionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    const generateBtn = document.getElementById('generate-btn');
    const clearBtn = document.getElementById('clear-all-btn');
    const exportBtn = document.getElementById('export-btn');

    generateBtn.click();

    expect(generateBtn.classList.contains('loading-disabled')).toBe(true);
    expect(clearBtn.classList.contains('loading-disabled')).toBe(true);
    expect(exportBtn.classList.contains('loading-disabled')).toBe(true);

    resolveConcept(conceptData);
    await flushPromises();
    await flushPromises();

    expect(characterBuilderService.saveCoreMotivations).toHaveBeenCalledWith(
      'direction-1',
      expect.arrayContaining([expect.objectContaining({ id: 'generated-1' })]),
    );

    expect(generateBtn.classList.contains('loading-disabled')).toBe(false);
    expect(clearBtn.classList.contains('loading-disabled')).toBe(false);
    expect(exportBtn.classList.contains('loading-disabled')).toBe(false);

    const announcer = document.getElementById('sr-announcements');
    expect(announcer).toBeTruthy();
    expect(announcer.textContent).toBe('Core motivations generated successfully!');

    jest.advanceTimersByTime(1000);
    expect(announcer.textContent).toBe('');

    document.dispatchEvent(new Event('motivationCopied'));
    expect(announcer.textContent).toBe('Motivation copied to clipboard');
    jest.advanceTimersByTime(1000);
    expect(announcer.textContent).toBe('');

    const modal = document.getElementById('confirmation-modal');
    const confirmBtn = document.getElementById('confirm-clear');
    const cancelBtn = document.getElementById('cancel-clear');
    const clearFocusSpy = jest.spyOn(clearBtn, 'focus');
    const confirmFocusSpy = jest.spyOn(confirmBtn, 'focus');
    const cancelFocusSpy = jest.spyOn(cancelBtn, 'focus');

    modal.style.display = 'flex';
    await flushPromises();
    jest.advanceTimersByTime(150);

    expect(confirmFocusSpy).toHaveBeenCalled();
    expect(announcer.textContent).toBe(
      'Confirmation dialog opened. Clear all motivations?'
    );

    const tabEvent = new Event('keydown');
    Object.assign(tabEvent, {
      key: 'Tab',
      shiftKey: true,
      preventDefault: jest.fn(),
    });
    confirmBtn.focus();
    modal.dispatchEvent(tabEvent);
    expect(tabEvent.preventDefault).toHaveBeenCalled();
    expect(cancelFocusSpy).toHaveBeenCalled();

    const escapeEvent = new Event('keydown');
    Object.assign(escapeEvent, {
      key: 'Escape',
      preventDefault: jest.fn(),
    });
    modal.dispatchEvent(escapeEvent);
    expect(escapeEvent.preventDefault).toHaveBeenCalled();
    expect(modal.style.display).toBe('none');
    expect(clearFocusSpy).toHaveBeenCalled();
    expect(announcer.textContent).toBe('Dialog closed');

    const focusEvent = new Event('focus');
    const blurEvent = new Event('blur');
    const mouseDownEvent = new Event('mousedown');

    generateBtn.dispatchEvent(focusEvent);
    expect(generateBtn.classList.contains('keyboard-focus')).toBe(true);

    generateBtn.dispatchEvent(mouseDownEvent);
    expect(generateBtn.classList.contains('keyboard-focus')).toBe(false);

    generateBtn.dispatchEvent(focusEvent);
    generateBtn.dispatchEvent(blurEvent);
    expect(generateBtn.classList.contains('keyboard-focus')).toBe(false);
  });

  it('exposes controller state and user-facing messaging helpers', async () => {
    await controller.initialize();

    const directionSelect = document.getElementById('direction-selector');
    directionSelect.value = 'direction-1';
    directionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(controller.selectedDirectionId).toBe('direction-1');
    expect(controller.currentDirection).toMatchObject({ id: 'direction-1' });
    expect(controller.currentConcept).toMatchObject({ id: 'concept-1' });
    expect(controller.totalDirectionsCount).toBe(1);
    expect(controller.isGenerating).toBe(false);

    controller.showWarning('Heads up!');
    const announcer = document.getElementById('sr-announcements');
    expect(logger.warn).toHaveBeenCalledWith('Heads up!');
    expect(announcer.textContent).toBe('Heads up!');
    jest.advanceTimersByTime(1000);

    controller.showSuccess('All good');
    expect(logger.info).toHaveBeenCalledWith('All good');
    expect(announcer.textContent).toBe('All good');
    jest.advanceTimersByTime(1000);

    controller.showError('Something went wrong');
    expect(logger.error).toHaveBeenCalledWith('Something went wrong');
    expect(announcer.textContent).toBe('Error: Something went wrong');
    jest.advanceTimersByTime(1000);

    const showErrorSpy = jest.spyOn(controller, 'showError');
    controller.handleError(new Error('Boom'));
    expect(logger.error).toHaveBeenCalledWith(
      'Core Motivations Generator error:',
      expect.any(Error)
    );
    expect(showErrorSpy).toHaveBeenCalledWith(
      'An error occurred. Please try again.'
    );
    showErrorSpy.mockRestore();
  });
});
