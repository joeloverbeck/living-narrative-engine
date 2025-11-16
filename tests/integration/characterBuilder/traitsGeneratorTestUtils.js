import { jest } from '@jest/globals';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { TraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';

const defaultDirectionItem = {
  direction: {
    id: 'dir-1',
    title:
      'A remarkably elaborate thematic direction title that should be truncated for display purposes',
    description: 'A direction focused on resilience and curiosity.',
    conceptId: 'concept-1',
    concept: 'Resilience',
    createdAt: new Date().toISOString(),
  },
  concept: {
    id: 'concept-1',
    concept: 'Resilience in adversity',
    name: 'Resilience Concept',
  },
};

const defaultMotivations = [
  {
    id: 'mot-1',
    directionId: 'dir-1',
    conceptId: 'concept-1',
    coreDesire: 'To inspire communities to rebuild together',
    internalContradiction:
      'Leads boldly but quietly fears the sacrifices that leadership demands',
    centralQuestion: 'How much of themselves must they give to heal their world?',
  },
];

const defaultCliche = {
  id: 'cliche-1',
  directionId: 'dir-1',
  conceptId: 'concept-1',
  categories: {
    archetypes: ['The bridge-builder'],
    conflicts: ['Balancing hope and exhaustion'],
  },
  createdAt: new Date().toISOString(),
};

const comprehensiveTraits = {
  id: 'traits-1',
  generatedAt: new Date().toISOString(),
  names: [
    { name: 'Alden', justification: 'Echoes their relentless warmth' },
    { name: 'Lyra', justification: 'Guides others like a constellation' },
  ],
  physicalDescription: 'Tall, ink-stained hands, and observant eyes that rarely miss detail.',
  personality: [
    { trait: 'Curious', explanation: 'Collects stories from every traveler met.' },
    { trait: 'Resilient', explanation: 'Continues planning even after setbacks.' },
  ],
  strengths: ['Strategic empathy', 'Creative problem solving'],
  weaknesses: ['Sleepless planning', 'Reluctance to delegate'],
  likes: ['Restoring forgotten gardens', 'Sunrise planning sessions'],
  dislikes: ['Grandstanding speeches', 'Wasted potential'],
  fears: ['Failing their community', 'Watching allies give up'],
  goals: {
    shortTerm: ['Secure safe shelters', 'Organize mutual aid circles'],
    longTerm: 'Ignite a sustainable renaissance for their city.',
  },
  notes: ['Keeps sketches of every settlement visited', 'Hums ancestral lullabies'],
  profile: 'A wandering strategist rebuilding hope through collaboration.',
  secrets: ['Smuggled archives out of hostile territory', 'Masked true heritage for safety'],
};

class TestLogger {
  constructor() {
    this.debug = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.error = jest.fn();
  }
}

class TestEventBus {
  constructor() {
    this.events = [];
  }

  dispatch(name, payload) {
    this.events.push({ name, payload });
  }

  subscribe() {}

  unsubscribe() {}
}

class TestSchemaValidator {
  validate() {
    return { isValid: true, errors: [] };
  }

  validateAgainstSchema() {
    return { isValid: true, errors: [] };
  }

  async addSchema() {
    return true;
  }

  isSchemaLoaded() {
    return true;
  }

  formatAjvErrors(errors) {
    return Array.isArray(errors) ? errors.join(', ') : '';
  }
}

class TestCharacterBuilderService {
  constructor({ directions, clichesByDirection, motivationsByDirection, traitsResolver }) {
    this.directions = directions;
    this.clichesByDirection = clichesByDirection;
    this.motivationsByDirection = motivationsByDirection;
    this.traitsResolver = traitsResolver;
    this.generateTraitsCalls = [];
  }

  async initialize() {}

  async getAllCharacterConcepts() {
    return [];
  }

  async createCharacterConcept() {
    return {};
  }

  async updateCharacterConcept() {
    return {};
  }

  async deleteCharacterConcept() {
    return true;
  }

  async getCharacterConcept() {
    return null;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }

  async getAllThematicDirectionsWithConcepts() {
    return this.directions;
  }

  async hasClichesForDirection(directionId) {
    return this.clichesByDirection.has(directionId);
  }

  async getCoreMotivationsByDirectionId(directionId) {
    return this.motivationsByDirection.get(directionId) || [];
  }

  async getClichesByDirectionId(directionId) {
    return this.clichesByDirection.get(directionId) || null;
  }

  async generateTraits(params) {
    this.generateTraitsCalls.push(params);
    if (!this.traitsResolver) {
      return null;
    }
    return await this.traitsResolver(params);
  }

  setTraitsResolver(resolver) {
    this.traitsResolver = resolver;
  }
}

function createTraitsGeneratorDOM({ includeResultsContainer = true } = {}) {
  document.body.innerHTML = `
    <div id="traits-generator-root">
      <div class="form-section">
        <div class="cb-form-group">
          <select id="direction-selector">
            <option value="">Select a thematic direction</option>
          </select>
          <div id="direction-selector-error"></div>
        </div>
        <div id="selected-direction-display" style="display: none;">
          <h2 id="direction-title"></h2>
          <p id="direction-description"></p>
        </div>
        <div id="core-motivations-panel" style="display: none;">
          <div id="core-motivations-list"></div>
        </div>
        <textarea id="core-motivation-input"></textarea>
        <textarea id="internal-contradiction-input"></textarea>
        <textarea id="central-question-input"></textarea>
        <div id="input-validation-error"></div>
        <div id="user-input-summary"></div>
        <button id="generate-btn">Generate</button>
        <button id="export-btn" style="display: none;">Export</button>
        <button id="clear-btn">Clear</button>
        <button id="back-btn">Back</button>
      </div>
      <div id="empty-state" class="cb-empty-state" style="display: none;"></div>
      <div id="loading-state" class="cb-loading-state" style="display: none;">
        <p id="loading-message"></p>
      </div>
      <div id="error-state" class="cb-error-state" style="display: none;">
        <p id="error-message-text"></p>
      </div>
      <div id="results-state" class="cb-results-state" style="display: none;">
        ${
          includeResultsContainer
            ? '<div id="traits-results"></div>'
            : '<div class="missing-results-placeholder"></div>'
        }
      </div>
      <div id="screen-reader-announcement"></div>
    </div>
  `;
}

function createControllerSetup({
  directions = [defaultDirectionItem],
  motivations = new Map([[defaultDirectionItem.direction.id, defaultMotivations]]),
  cliches = new Map([[defaultDirectionItem.direction.id, defaultCliche]]),
  traitsResolver = async () => comprehensiveTraits,
  includeResultsContainer = true,
  traitsDisplayEnhancerFactory,
} = {}) {
  createTraitsGeneratorDOM({ includeResultsContainer });
  const logger = new TestLogger();
  const eventBus = new TestEventBus();
  const schemaValidator = new TestSchemaValidator();
  const service = new TestCharacterBuilderService({
    directions,
    clichesByDirection: cliches,
    motivationsByDirection: motivations,
    traitsResolver,
  });
  const traitsDisplayEnhancer =
    typeof traitsDisplayEnhancerFactory === 'function'
      ? traitsDisplayEnhancerFactory({ logger })
      : new TraitsDisplayEnhancer({ logger });
  
  // Create required service mocks (added after refactoring)
  const lifecycleState = {
    isInitialized: false,
    isDestroyed: false,
    isInitializing: false,
    isDestroying: false,
  };

  // Store registered hooks so they can be executed during initialize()
  const registeredHooks = new Map();

  const controllerLifecycleOrchestrator = {
    initialize: jest.fn().mockImplementation(async () => {
      lifecycleState.isInitializing = true;

      // Execute all registered hooks in order
      const phases = ['preInit', 'cacheElements', 'initServices', 'setupEventListeners', 'loadData', 'initUI', 'postInit'];
      for (const phase of phases) {
        const phaseHooks = registeredHooks.get(phase);
        if (phaseHooks && phaseHooks.length > 0) {
          for (const hook of phaseHooks) {
            await hook();
          }
        }
      }

      lifecycleState.isInitializing = false;
      lifecycleState.isInitialized = true;
    }),
    destroy: jest.fn().mockImplementation(() => {
      lifecycleState.isDestroyed = true;
    }),
    setControllerName: jest.fn(),
    registerHook: jest.fn((phase, hook) => {
      if (!registeredHooks.has(phase)) {
        registeredHooks.set(phase, []);
      }
      registeredHooks.get(phase).push(hook);
    }),
    createControllerMethodHook: jest.fn((controller, methodName) => async () => {
      if (typeof controller[methodName] === 'function') {
        await controller[methodName]();
      }
    }),
    registerCleanupTask: jest.fn(),
    checkDestroyed: jest.fn().mockReturnValue(false),
    makeDestructionSafe: jest.fn((fn) => fn),
    get isInitialized() { return lifecycleState.isInitialized; },
    get isDestroyed() { return lifecycleState.isDestroyed; },
    get isInitializing() { return lifecycleState.isInitializing; },
    get isDestroying() { return lifecycleState.isDestroying; },
  };
  
  // DOM element manager with actual caching functionality
  const cachedElements = new Map();

  const domElementManager = {
    configure: jest.fn(),
    cacheElement: jest.fn((key, selector, required = true) => {
      const element = typeof selector === 'string'
        ? document.querySelector(selector)
        : selector;
      if (element) {
        cachedElements.set(key, element);
      }
      return element;
    }),
    getElement: jest.fn((key) => {
      // First check cache, then try direct DOM lookup
      if (cachedElements.has(key)) {
        return cachedElements.get(key);
      }
      const element = document.getElementById(key);
      if (element) {
        cachedElements.set(key, element);
      }
      return element;
    }),
    clearCache: jest.fn(() => {
      cachedElements.clear();
    }),
    validateElementCache: jest.fn(),
    getElementsSnapshot: jest.fn(() => {
      const snapshot = {};
      cachedElements.forEach((element, key) => {
        snapshot[key] = element;
      });
      return snapshot;
    }),
    cacheElementsFromMap: jest.fn((elementMap, options = {}) => {
      Object.entries(elementMap).forEach(([key, config]) => {
        const selector = typeof config === 'string' ? config : config.selector;
        const required = typeof config === 'object' ? config.required !== false : true;
        const element = document.querySelector(selector);
        if (element) {
          cachedElements.set(key, element);
        } else if (required) {
          console.warn(`Required element not found: ${key} (${selector})`);
        }
      });
    }),
    setElementText: jest.fn((key, text) => {
      const element = cachedElements.get(key);
      if (element) {
        element.textContent = text;
      }
    }),
    setElementEnabled: jest.fn((key, enabled = true) => {
      const element = cachedElements.get(key);
      if (element) {
        element.disabled = !enabled;
      }
    }),
    showElement: jest.fn((key, displayType = 'block') => {
      const element = cachedElements.get(key);
      if (element) {
        element.style.display = displayType;
      }
    }),
    hideElement: jest.fn((key) => {
      const element = cachedElements.get(key);
      if (element) {
        element.style.display = 'none';
      }
    }),
    addElementClass: jest.fn((key, className) => {
      const element = cachedElements.get(key);
      if (element) {
        element.classList.add(className);
      }
    }),
    removeElementClass: jest.fn((key, className) => {
      const element = cachedElements.get(key);
      if (element) {
        element.classList.remove(className);
      }
    }),
  };
  
  // Event listener registry that actually registers events
  const eventListenerRegistry = {
    setContextName: jest.fn(),
    addEventListener: jest.fn((element, eventType, handler) => {
      if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(eventType, handler);
      }
    }),
    detachEventBusListeners: jest.fn(),
    destroy: jest.fn(),
  };
  
  const asyncUtilitiesToolkit = {
    setTimeout: jest.fn((cb, delay) => setTimeout(cb, delay)),
    clearTimeout: jest.fn((id) => clearTimeout(id)),
    getTimerStats: jest.fn().mockReturnValue({ timeouts: { count: 0 }, intervals: { count: 0 }, animationFrames: { count: 0 } }),
    clearAllTimers: jest.fn(),
  };
  
  const performanceMonitor = {
    configure: jest.fn(),
    clearData: jest.fn(),
  };
  
  const memoryManager = {
    setContextName: jest.fn(),
    clear: jest.fn(),
  };
  
  const errorHandlingStrategy = {
    configureContext: jest.fn(),
    handleError: jest.fn(),
    resetLastError: jest.fn(),
    executeWithErrorHandling: jest.fn(async (operation, operationName, options = {}) => {
      const { retries = 0 } = options;
      let lastError;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    }),
    handleServiceError: jest.fn((error, operation, userMessage) => {
      console.error(`Service error in ${operation}:`, error);
      throw error;
    }),
    isRetryableError: jest.fn(() => false),
  };
  
  const validationService = {
    configure: jest.fn(),
    validateData: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  };
  
  const controller = new TraitsGeneratorController({
    logger,
    characterBuilderService: service,
    eventBus,
    schemaValidator,
    traitsDisplayEnhancer,
    controllerLifecycleOrchestrator,
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  });
  return { controller, logger, eventBus, schemaValidator, service };
}

async function flushMicrotasksOnly() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushAsyncOperations() {
  await flushMicrotasksOnly();
  jest.runOnlyPendingTimers();
  await flushMicrotasksOnly();
}

async function initializeAndSettle(controller) {
  await controller.initialize();
  await flushAsyncOperations();
}

export {
  comprehensiveTraits,
  createControllerSetup,
  createTraitsGeneratorDOM,
  defaultCliche,
  defaultDirectionItem,
  defaultMotivations,
  flushAsyncOperations,
  flushMicrotasksOnly,
  initializeAndSettle,
};
