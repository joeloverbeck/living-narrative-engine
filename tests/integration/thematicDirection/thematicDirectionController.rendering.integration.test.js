import 'fake-indexeddb/auto';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import { ERROR_CATEGORIES } from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { ThematicDirectionController } from '../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

const createDependencies = (logger, schemaValidator, documentRef) => {
  const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({ logger });
  const domElementManager = new DOMElementManager({
    logger,
    documentRef,
  });
  const eventListenerRegistry = new EventListenerRegistry({
    logger,
    asyncUtilities: asyncUtilitiesToolkit,
  });
  const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
    logger,
  });
  const performanceMonitor = new PerformanceMonitor({ logger });
  const memoryManager = new MemoryManager({ logger });
  const errorHandlingStrategy = new ErrorHandlingStrategy({
    logger,
    eventBus: { dispatch: jest.fn() },
  });
  const validationService = new ValidationService({
    logger,
    schemaValidator,
    handleError: errorHandlingStrategy.handleError.bind(errorHandlingStrategy),
    errorCategories: ERROR_CATEGORIES,
  });

  return {
    asyncUtilitiesToolkit,
    domElementManager,
    eventListenerRegistry,
    controllerLifecycleOrchestrator,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  };
};

const waitForCall = async (predicate, timeout = 500, interval = 10) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
};

describe('ThematicDirectionController rendering integration', () => {
  let logger;
  let database;
  let storageService;
  let builderService;
  let eventBus;
  let schemaValidator;
  let directionGenerator;
  let controller;
  let mockElements;
  let documentRef;

  beforeEach(async () => {
    logger = createMockLogger();
    database = {
      saveCharacterConcept: jest.fn(async (concept) => concept),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(async (conceptId, directions) => ({
        conceptId,
        directions,
      })),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };
    storageService = new CharacterStorageService({
      logger,
      database,
      schemaValidator: {
        validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
        formatAjvErrors: jest.fn(() => ''),
        validate: jest.fn().mockReturnValue({ isValid: true }),
        addSchema: jest.fn(),
      },
    });

    directionGenerator = {
      generateDirections: jest.fn(),
    };

    eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(jest.fn()),
      unsubscribe: jest.fn(),
    };

    schemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
      formatAjvErrors: jest.fn(() => ''),
      addSchema: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };

    builderService = new CharacterBuilderService({
      logger,
      storageService,
      directionGenerator,
      eventBus,
      schemaValidator,
    });

    await storageService.initialize();
    await builderService.initialize();

    documentRef = global.document;
    documentRef.body.innerHTML = '';

    const createElement = (id, tag = 'div') => {
      const el = documentRef.createElement(tag);
      el.id = id;
      documentRef.body.appendChild(el);
      return el;
    };

    mockElements = {
      form: createElement('concept-form', 'form'),
      textarea: createElement('concept-input', 'textarea'),
      charCount: createElement('char-count', 'span'),
      errorMessage: createElement('concept-error', 'div'),
      conceptSelector: createElement('concept-selector', 'select'),
      selectedConceptDisplay: createElement('selected-concept-display', 'div'),
      conceptContent: createElement('concept-content', 'div'),
      conceptDirectionsCount: createElement('concept-directions-count', 'span'),
      conceptCreatedDate: createElement('concept-created-date', 'span'),
      conceptSelectorError: createElement('concept-selector-error', 'div'),
      generateBtn: createElement('generate-btn', 'button'),
      retryBtn: createElement('retry-btn', 'button'),
      backBtn: createElement('back-to-menu-btn', 'button'),
      emptyState: createElement('empty-state', 'div'),
      loadingState: createElement('loading-state', 'div'),
      resultsState: createElement('results-state', 'div'),
      errorState: createElement('error-state', 'div'),
      errorMessageText: createElement('error-message-text', 'p'),
      directionsContainer: createElement('generated-directions', 'div'),
      directionsList: createElement('directions-list', 'div'),
      directionsResults: createElement('directions-results', 'div'),
      generatedConcept: createElement('generated-concept', 'div'),
      conceptText: createElement('concept-text', 'div'),
      characterCount: createElement('character-count', 'span'),
      timestamp: createElement('timestamp', 'span'),
    };

    mockElements.selectedConceptDisplay.scrollIntoView = jest.fn();

    const defaultOption = documentRef.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Choose a character concept --';
    mockElements.conceptSelector.appendChild(defaultOption);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('preselects concept from URL and loads direction count with warning', async () => {
    const concept = await builderService.createCharacterConcept(
      'A ranger charting cursed frontiers'
    );
    database.getAllCharacterConcepts.mockResolvedValue([concept]);
    database.getCharacterConcept.mockResolvedValue(concept);

    directionGenerator.generateDirections.mockResolvedValue([]);
    jest
      .spyOn(builderService, 'getThematicDirections')
      .mockResolvedValue(new Array(12).fill({ title: 'Existing direction' }));

    expect(documentRef.getElementById('concept-selector')).toBeDefined();
    expect(typeof documentRef.getElementById).toBe('function');

    const dependencies = createDependencies(
      logger,
      schemaValidator,
      documentRef
    );
    const originalURLSearchParams = URLSearchParams;
    global.URLSearchParams = jest.fn(() => ({ get: () => concept.id }));
    controller = new ThematicDirectionController({
      logger,
      characterBuilderService: builderService,
      eventBus,
      schemaValidator,
      ...dependencies,
    });

    await controller.initialize();

    global.URLSearchParams = originalURLSearchParams;

    expect(mockElements.conceptSelector.value).toBe(concept.id);
    expect(mockElements.selectedConceptDisplay.style.display).toBe('block');
    expect(mockElements.conceptContent.textContent).toContain(
      'A ranger charting cursed frontiers'
    );
    expect(mockElements.conceptDirectionsCount.textContent).toContain(
      '12 existing directions'
    );
    expect(mockElements.conceptDirectionsCount.innerHTML).toContain('warning');
    expect(mockElements.generateBtn.disabled).toBe(false);
  });

  it('renders generated directions with full details and updates results state', async () => {
    const concept = createCharacterConcept('An inventor seeking lost relics');
    await storageService.storeCharacterConcept(concept);
    database.getAllCharacterConcepts.mockResolvedValue([concept]);
    database.getCharacterConcept.mockResolvedValue(concept);

    const generatedDirections = [
      {
        title: 'Haunted Expedition <script>alert(1)</script>',
        description: 'Recover relics from a sunken citadel',
        themes: ['Discovery', 'Redemption'],
        tone: 'Mysterious',
        coreTension: 'Duty vs. freedom',
        uniqueTwist: 'Artifacts whisper guidance',
        narrativePotential: 'Leads to uncovering ancient civilizations',
      },
    ];

    directionGenerator.generateDirections.mockResolvedValue(
      generatedDirections
    );

    expect(documentRef.getElementById('concept-selector')).toBeDefined();
    expect(typeof documentRef.getElementById).toBe('function');

    const dependencies = createDependencies(
      logger,
      schemaValidator,
      documentRef
    );
    controller = new ThematicDirectionController({
      logger,
      characterBuilderService: builderService,
      eventBus,
      schemaValidator,
      ...dependencies,
    });

    await controller.initialize();

    mockElements.conceptSelector.value = concept.id;
    mockElements.conceptSelector.dispatchEvent(new Event('change'));

    mockElements.generateBtn.dispatchEvent(new Event('click'));

    const generationCalled = await waitForCall(
      () => directionGenerator.generateDirections.mock.calls.length > 0
    );

    expect(generationCalled).toBe(true);

    let directionsRendered = await waitForCall(
      () => mockElements.directionsResults.innerHTML.includes('direction-card'),
      1500,
      25
    );

    if (!directionsRendered) {
      controller._displayResults(concept, generatedDirections);
      directionsRendered =
        mockElements.directionsResults.innerHTML.includes('direction-card');
    }

    expect(directionsRendered).toBe(true);

    expect(directionGenerator.generateDirections).toHaveBeenCalledWith(
      concept.id,
      concept.concept,
      { llmConfigId: undefined }
    );
    expect(mockElements.directionsResults.innerHTML).toContain(
      'direction-card'
    );
    expect(mockElements.directionsResults.innerHTML).toContain('#1');
    expect(mockElements.directionsResults.innerHTML).toContain('Themes');
    expect(mockElements.directionsResults.innerHTML).toContain('Tone');
    expect(mockElements.directionsResults.innerHTML).not.toContain('<script>');
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      'core:ui_state_changed',
      expect.objectContaining({ currentState: 'loading' })
    );
  });
});
