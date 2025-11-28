import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { TraitsRewriterError } from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';

jest.mock('../../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

const { validateDependency } = jest.requireMock(
  '../../../../src/utils/dependencyUtils.js'
);

/**
 *
 */
function createDomElements() {
  const elements = {};
  const ids = [
    'character-definition',
    'character-input-error',
    'rewrite-traits-button',
    'export-json-button',
    'export-text-button',
    'copy-traits-button',
    'clear-input-button',
    'retry-button',
    'generation-progress',
    'rewritten-traits-container',
    'generation-error',
    'empty-state',
    'loading-state',
    'results-state',
    'error-state',
    'character-name-display',
    'traits-sections',
    'screen-reader-announcement',
  ];

  ids.forEach((id) => {
    const element = document.createElement('div');
    element.id = id;
    document.body.appendChild(element);
    elements[id] = element;
  });

  const input = elements['character-definition'];
  input.value = '';
  input.disabled = false;

  const rewriteButton = elements['rewrite-traits-button'];
  rewriteButton.disabled = true;

  const progressText = document.createElement('div');
  progressText.classList.add('progress-text');
  document.body.appendChild(progressText);
  elements.progressText = progressText;

  const errorMessage = document.createElement('div');
  errorMessage.classList.add('error-message');
  document.body.appendChild(errorMessage);
  elements.errorMessage = errorMessage;

  return elements;
}

/**
 *
 * @param elements
 * @param listeners
 * @param subscriptions
 */
function createDependencies(elements, listeners, subscriptions) {
  const domElementManager = {
    configure: jest.fn(),
    cacheElementsFromMap: jest.fn((elementMap) => {
      Object.entries(elementMap).forEach(([key, config]) => {
        const selector = typeof config === 'string' ? config : config.selector;
        const required = typeof config === 'object' ? config.required !== false : true;
        const el = document.querySelector(selector);
        if (!el && required) {
          throw new Error(`Missing element for ${selector}`);
        }
        elements[key] = el;
      });
      return elements;
    }),
    normalizeElementConfig: jest.fn((config) =>
      typeof config === 'string' ? { selector: config, required: true } : config
    ),
    getElement: jest.fn((key) => elements[key] || null),
    refreshElement: jest.fn((key, selector) => {
      const el = document.querySelector(selector);
      elements[key] = el;
      return el;
    }),
    hideElement: jest.fn(),
    showElement: jest.fn(),
    addElementClass: jest.fn(),
    removeElementClass: jest.fn(),
    enableElement: jest.fn(),
    disableElement: jest.fn(),
  };

  const eventListenerRegistry = {
    setContextName: jest.fn(),
    addEventListener: jest.fn((element, type, handler) => {
      listeners.push({ element, type, handler });
      element.addEventListener?.(type, handler);
      return `${type}-${listeners.length}`;
    }),
    removeEventListener: jest.fn(),
    subscribeToEvent: jest.fn((eventBus, eventType, handler) => {
      subscriptions.push({ eventType, handler });
      return `${eventType}-${subscriptions.length}`;
    }),
  };

  const asyncUtilitiesToolkit = {
    debounce: (fn) => {
      const debounced = jest.fn(async (...args) => fn(...args));
      debounced.cancel = jest.fn();
      return debounced;
    },
    setTimeout: jest.fn((cb) => {
      cb();
      return 1;
    }),
    clearTimeout: jest.fn(),
  };

  const baseMocks = {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    characterBuilderService: {
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    },
    eventBus: {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    },
    schemaValidator: {
      validate: jest.fn(),
    },
    controllerLifecycleOrchestrator: {
      setControllerName: jest.fn(),
      registerHook: jest.fn(),
      executeHook: jest.fn(),
      hasHook: jest.fn(),
      getHooks: jest.fn(),
      clearHooks: jest.fn(),
      createControllerMethodHook: jest.fn((controller, methodName) =>
        controller[methodName]?.bind(controller)
      ),
      makeDestructionSafe: jest.fn((fn) => fn),
      reinitialize: jest.fn(),
      resetInitializationState: jest.fn(),
      initialize: jest.fn(),
      destroy: jest.fn(),
    },
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor: {
      configure: jest.fn(),
    },
    memoryManager: {
      setContextName: jest.fn(),
    },
    errorHandlingStrategy: {
      configureContext: jest.fn(),
    },
    validationService: {
      configure: jest.fn(),
    },
  };

  return baseMocks;
}

/**
 *
 */
function createGenerationResult() {
  return {
    characterName: 'Ada Lovelace',
    rewrittenTraits: {
      summary: 'Inventive',
      notes: ['Mathematics enthusiast'],
    },
  };
}

describe('TraitsRewriterController', () => {
  let elements;
  let listeners;
  let subscriptions;
  let deps;
  let controller;
  let generator;
  let displayEnhancer;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = '';
    listeners = [];
    subscriptions = [];
    elements = createDomElements();

    generator = {
      generateRewrittenTraits: jest
        .fn()
        .mockResolvedValue(createGenerationResult()),
    };

    displayEnhancer = {
      enhanceForDisplay: jest.fn(() => ({
        characterName: 'Ada Lovelace',
        sections: [
          { id: 'summary', title: 'Summary', content: 'Inventive mind' },
          {
            id: 'rich',
            title: 'Rich',
            htmlContent: '<p>Detailed</p>',
          },
        ],
      })),
      formatForExport: jest.fn(() => 'formatted export'),
      generateExportFilename: jest.fn(() => 'traits-ada'),
    };

    deps = createDependencies(elements, listeners, subscriptions);
    controller = new TraitsRewriterController({
      ...deps,
      traitsRewriterGenerator: generator,
      traitsRewriterDisplayEnhancer: displayEnhancer,
    });

    URL.createObjectURL = jest.fn(() => 'blob:123');
    URL.revokeObjectURL = jest.fn();
    navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.resetAllMocks();
  });

  it('validates TraitsRewriter dependencies during construction', () => {
    expect(validateDependency).toHaveBeenCalledWith(
      generator,
      'TraitsRewriterGenerator',
      deps.logger,
      expect.any(Object)
    );
    expect(validateDependency).toHaveBeenCalledWith(
      displayEnhancer,
      'TraitsRewriterDisplayEnhancer',
      deps.logger,
      expect.any(Object)
    );
  });

  it('caches required elements', () => {
    controller._cacheElements();
    expect(deps.domElementManager.cacheElementsFromMap).toHaveBeenCalled();
    expect(elements.characterDefinition).toBeDefined();
  });

  it('initializes UI state and shows empty state', async () => {
    const showState = jest.fn();
    controller._showState = showState;
    jest
      .spyOn(
        Object.getPrototypeOf(TraitsRewriterController.prototype),
        '_initializeUIState'
      )
      .mockResolvedValue();

    await controller._initializeUIState();

    expect(showState).toHaveBeenCalledWith('empty');
  });

  it('handles valid character input and enables generation', async () => {
    controller._cacheElements();
    controller._setupEventListeners();

    const validInput = JSON.stringify({
      components: {
        'core:name': 'Ada',
        'core:personality': ['curious'],
      },
    });

    elements['character-definition'].value = validInput;
    const inputHandler = listeners.find((l) => l.type === 'input').handler;

    await inputHandler();

    expect(deps.domElementManager.hideElement).toHaveBeenCalledWith(
      'characterInputError'
    );
    expect(elements['rewrite-traits-button'].disabled).toBe(false);
  });

  it('shows validation error for invalid JSON', async () => {
    controller._cacheElements();
    controller._setupEventListeners();

    elements['character-definition'].value = 'not json';
    const blurHandler = listeners.find((l) => l.type === 'blur').handler;

    await blurHandler();

    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'characterInputError'
    );
    expect(elements['rewrite-traits-button'].disabled).toBe(true);
  });

  it('runs generation workflow and displays results', async () => {
    controller._cacheElements();
    controller._setupEventListeners();

    elements['character-definition'].value = JSON.stringify({
      components: {
        'core:name': 'Ada',
        'core:personality': ['curious'],
      },
    });

    const inputHandler = listeners.find((l) => l.type === 'input').handler;
    await inputHandler();

    const generateHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'rewrite-traits-button'
    ).handler;

    await generateHandler();

    expect(generator.generateRewrittenTraits).toHaveBeenCalled();
    expect(displayEnhancer.enhanceForDisplay).toHaveBeenCalled();
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'rewrittenTraitsContainer'
    );
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'exportJsonButton'
    );
    expect(elements['character-name-display'].textContent).toBe('Ada Lovelace');
    expect(elements['traits-sections'].children.length).toBe(2);
  });

  it('displays errors when generation fails', async () => {
    generator.generateRewrittenTraits.mockRejectedValue(new Error('fail'));
    controller._cacheElements();
    controller._setupEventListeners();

    elements['character-definition'].value = JSON.stringify({
      components: {
        'core:name': 'Ada',
        'core:personality': ['curious'],
      },
    });
    const inputHandler = listeners.find((l) => l.type === 'input').handler;
    await inputHandler();

    const generateHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'rewrite-traits-button'
    ).handler;

    await generateHandler();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'TraitsRewriterController: Generation failed',
      expect.any(Error)
    );
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'generationError'
    );
  });

  it('exports results to JSON and text and copies to clipboard', async () => {
    controller._cacheElements();
    controller._setupEventListeners();

    elements['character-definition'].value = JSON.stringify({
      components: {
        'core:name': 'Ada',
        'core:personality': ['curious'],
      },
    });
    const inputHandler = listeners.find((l) => l.type === 'input').handler;
    await inputHandler();

    const generateHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'rewrite-traits-button'
    ).handler;
    await generateHandler();

    const exportJson = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'export-json-button'
    ).handler;
    const exportText = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'export-text-button'
    ).handler;
    const copyHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'copy-traits-button'
    ).handler;

    await exportJson();
    await exportText();
    await copyHandler();

    expect(displayEnhancer.formatForExport).toHaveBeenCalledWith(
      expect.any(Object),
      'json'
    );
    expect(displayEnhancer.formatForExport).toHaveBeenCalledWith(
      expect.any(Object),
      'text'
    );
    expect(displayEnhancer.generateExportFilename).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'formatted export'
    );
  });

  it('clears inputs and resets UI state', () => {
    controller._cacheElements();
    controller._setupEventListeners();

    elements['character-definition'].value = 'some value';
    const clearHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'clear-input-button'
    ).handler;

    clearHandler();

    expect(elements['character-definition'].value).toBe('');
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith('emptyState');
    expect(elements['rewrite-traits-button'].disabled).toBe(true);
  });

  it('subscribes to generation events and handles callbacks', async () => {
    controller._cacheElements();
    await controller._loadInitialData();

    expect(subscriptions.map((s) => s.eventType)).toEqual([
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED,
    ]);

    const progressHandler = subscriptions[0].handler;
    const completeHandler = subscriptions[1].handler;
    const errorHandler = subscriptions[2].handler;

    progressHandler({ payload: { message: 'progress' } });
    completeHandler({});
    errorHandler({ payload: { error: new TraitsRewriterError('boom') } });

    expect(elements.progressText.textContent).toBe('progress');
    expect(deps.logger.debug).toHaveBeenCalled();
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'generationError'
    );
  });

  it('handles display failures gracefully', async () => {
    displayEnhancer.enhanceForDisplay.mockImplementation(() => {
      throw new Error('display failure');
    });

    controller._cacheElements();
    controller._setupEventListeners();
    await controller._loadInitialData();

    elements['character-definition'].value = JSON.stringify({
      components: {
        'core:name': 'Ada',
        'core:personality': ['curious'],
      },
    });

    const inputHandler = listeners.find((l) => l.type === 'input').handler;
    await inputHandler();

    const generateHandler = listeners.find(
      (l) => l.type === 'click' && l.element.id === 'rewrite-traits-button'
    ).handler;
    await generateHandler();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'TraitsRewriterController: Display failed',
      expect.any(Error)
    );
    expect(deps.domElementManager.showElement).toHaveBeenCalledWith(
      'generationError'
    );
  });
});
