/**
 * @file Test helpers for Core Motivations testing
 * Provides utilities and builders for Core Motivations tests
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a valid Core Motivation object with default or custom values
 *
 * @param {object} overrides - Optional overrides for default values
 * @returns {object} Valid Core Motivation object
 */
export function createMockCoreMotivation(overrides = {}) {
  return {
    id: uuidv4(),
    directionId: 'test-direction-id',
    conceptId: 'test-concept-id',
    coreDesire: 'To find meaning and purpose in life',
    internalContradiction:
      'Wants to help others but fears being taken advantage of',
    centralQuestion: 'Can true altruism exist without self-sacrifice?',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates multiple Core Motivations with variations
 *
 * @param {number} count - Number of motivations to create
 * @param {object} baseOverrides - Base overrides for all motivations
 * @returns {Array} Array of Core Motivation objects
 */
export function createMockCoreMotivations(count = 3, baseOverrides = {}) {
  const motivations = [];
  const themes = [
    {
      coreDesire: 'To protect those who cannot protect themselves',
      internalContradiction:
        'Believes in justice but questions if ends justify means',
      centralQuestion: 'Is it right to do wrong things for the right reasons?',
    },
    {
      coreDesire: 'To uncover the truth behind ancient mysteries',
      internalContradiction:
        'Seeks knowledge but fears what might be discovered',
      centralQuestion: 'Is some knowledge too dangerous to possess?',
    },
    {
      coreDesire: 'To achieve recognition and leave a lasting legacy',
      internalContradiction: 'Wants fame but values authentic relationships',
      centralQuestion: 'Can one be truly known and truly loved?',
    },
    {
      coreDesire: 'To experience every pleasure life has to offer',
      internalContradiction: 'Pursues hedonism but seeks deeper meaning',
      centralQuestion: 'Does constant pleasure lead to happiness or emptiness?',
    },
    {
      coreDesire: 'To restore honor to a disgraced family name',
      internalContradiction: 'Values tradition but sees its limitations',
      centralQuestion: 'Should we be bound by the sins of our ancestors?',
    },
  ];

  for (let i = 0; i < count; i++) {
    const theme = themes[i % themes.length];
    motivations.push(
      createMockCoreMotivation({
        ...theme,
        ...baseOverrides,
        id: `motivation-${i + 1}`,
      })
    );
  }

  return motivations;
}

/**
 * Creates a mock thematic direction for testing
 *
 * @param {object} overrides - Optional overrides
 * @returns {object} Mock thematic direction
 */
export function createMockThematicDirection(overrides = {}) {
  return {
    id: 'direction-test-id',
    name: 'Test Thematic Direction',
    title: 'Test Thematic Direction',
    theme: 'Test Theme',
    coreTension: 'Test tension between desire and duty',
    description: 'A test direction for unit testing',
    conceptId: 'concept-test-id',
    conceptName: 'Test Character Concept',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock character concept for testing
 *
 * @param {object} overrides - Optional overrides
 * @returns {object} Mock character concept
 */
export function createMockCharacterConcept(overrides = {}) {
  return {
    id: 'concept-test-id',
    name: 'Test Character',
    concept: 'A brave hero on a quest',
    archetype: 'The Hero',
    personality: 'Brave and determined',
    background: 'A mysterious past',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock LLM response for Core Motivations generation
 *
 * @param {object} options - Options for response generation
 * @returns {object} Mock LLM response
 */
export function createMockLLMResponse(options = {}) {
  const { count = 3, includeErrors = false, malformed = false } = options;

  if (malformed) {
    return JSON.stringify({
      wrongField: 'This is malformed',
      noMotivations: true,
    });
  }

  if (includeErrors) {
    return JSON.stringify({
      error: 'LLM service error',
      message: 'Failed to generate motivations',
    });
  }

  return JSON.stringify({
    motivations: createMockCoreMotivations(count).map((m) => ({
      coreDesire: m.coreDesire,
      internalContradiction: m.internalContradiction,
      centralQuestion: m.centralQuestion,
    })),
  });
}

/**
 * Creates mock DOM elements for Core Motivations UI testing
 *
 * @returns {object} Object containing mock DOM elements
 */
export function createMockDOMElements() {
  const createElement = (tag, id, className = '') => {
    const element = {
      tagName: tag.toUpperCase(),
      id,
      className,
      innerHTML: '',
      innerText: '',
      textContent: '',
      value: '',
      disabled: false,
      style: { display: 'block' },
      children: [],
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      click: jest.fn(),
      focus: jest.fn(),
      blur: jest.fn(),
      getAttribute: jest.fn((attr) => {
        if (attr === 'id') return id;
        if (attr === 'class') return className;
        return null;
      }),
      setAttribute: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      contains: jest.fn(),
    };
    return element;
  };

  return {
    directionSelector: createElement('select', 'direction-selector'),
    generateBtn: createElement('button', 'generate-btn'),
    clearAllBtn: createElement('button', 'clear-all-btn'),
    exportBtn: createElement('button', 'export-btn'),
    motivationsList: createElement('div', 'motivations-list'),
    emptyState: createElement('div', 'empty-state'),
    loadingState: createElement('div', 'loading-state'),
    resultsState: createElement('div', 'results-state'),
    errorState: createElement('div', 'error-state'),
    selectedDirectionDisplay: createElement(
      'div',
      'selected-direction-display'
    ),
  };
}

/**
 * Creates a mock IndexedDB database for testing
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock IndexedDB implementation
 */
export function createMockIndexedDB(options = {}) {
  const { hasExistingData = false, shouldFail = false } = options;

  const mockObjectStore = {
    put: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
    }),
    get: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
      result: hasExistingData ? createMockCoreMotivation() : null,
    }),
    getAll: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
      result: hasExistingData ? createMockCoreMotivations(3) : [],
    }),
    delete: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
    }),
    clear: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
    }),
    index: jest.fn().mockReturnValue({
      getAll: jest.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: hasExistingData ? createMockCoreMotivations(2) : [],
      }),
      count: jest.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: hasExistingData ? 2 : 0,
      }),
    }),
  };

  const mockTransaction = {
    objectStore: jest.fn().mockReturnValue(mockObjectStore),
    oncomplete: null,
    onerror: null,
    abort: jest.fn(),
  };

  const mockDB = {
    transaction: jest.fn().mockReturnValue(mockTransaction),
    createObjectStore: jest.fn().mockReturnValue(mockObjectStore),
    objectStoreNames: {
      contains: jest.fn((name) => name === 'coreMotivations'),
    },
    close: jest.fn(),
  };

  const mockRequest = {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: shouldFail ? null : mockDB,
  };

  return {
    open: jest.fn().mockReturnValue(mockRequest),
    deleteDatabase: jest.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
    }),
  };
}

/**
 * Validates Core Motivation structure
 *
 * @param {object} motivation - Motivation to validate
 * @returns {object} Validation result with isValid and errors
 */
export function validateCoreMotivationStructure(motivation) {
  const errors = [];
  const requiredFields = [
    'directionId',
    'conceptId',
    'coreDesire',
    'internalContradiction',
    'centralQuestion',
  ];

  if (!motivation) {
    return { isValid: false, errors: ['Motivation is null or undefined'] };
  }

  requiredFields.forEach((field) => {
    if (!motivation[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate field types
  if (motivation.coreDesire && typeof motivation.coreDesire !== 'string') {
    errors.push('coreDesire must be a string');
  }

  if (
    motivation.internalContradiction &&
    typeof motivation.internalContradiction !== 'string'
  ) {
    errors.push('internalContradiction must be a string');
  }

  if (
    motivation.centralQuestion &&
    typeof motivation.centralQuestion !== 'string'
  ) {
    errors.push('centralQuestion must be a string');
  }

  // Validate IDs format
  if (motivation.directionId && !motivation.directionId.trim()) {
    errors.push('directionId cannot be empty');
  }

  if (motivation.conceptId && !motivation.conceptId.trim()) {
    errors.push('conceptId cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a test scenario builder for complex test setups
 *
 * @returns {object} Scenario builder with fluent interface
 */
export function createScenarioBuilder() {
  let scenario = {
    directions: [],
    concepts: [],
    motivations: [],
    userActions: [],
    expectedOutcomes: [],
  };

  return {
    withDirection(direction) {
      scenario.directions.push(createMockThematicDirection(direction));
      return this;
    },

    withConcept(concept) {
      scenario.concepts.push(createMockCharacterConcept(concept));
      return this;
    },

    withMotivations(count, overrides) {
      scenario.motivations.push(...createMockCoreMotivations(count, overrides));
      return this;
    },

    withUserAction(action) {
      scenario.userActions.push(action);
      return this;
    },

    expectOutcome(outcome) {
      scenario.expectedOutcomes.push(outcome);
      return this;
    },

    build() {
      return scenario;
    },
  };
}

/**
 * Waits for async operations to complete
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after timeout
 */
export function waitForAsync(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock event bus for testing
 *
 * @returns {object} Mock event bus
 */
export function createMockEventBus() {
  const listeners = {};

  return {
    dispatch: jest.fn((event) => {
      const eventListeners = listeners[event.type] || [];
      eventListeners.forEach((listener) => listener(event));
    }),
    subscribe: jest.fn((eventType, listener) => {
      if (!listeners[eventType]) {
        listeners[eventType] = [];
      }
      listeners[eventType].push(listener);
      return () => {
        const index = listeners[eventType].indexOf(listener);
        if (index > -1) {
          listeners[eventType].splice(index, 1);
        }
      };
    }),
    unsubscribe: jest.fn(),
    listenerCount: jest.fn((eventType) => {
      return (listeners[eventType] || []).length;
    }),
    _clearAll: () => {
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
  };
}

/**
 * Creates test data for different test scenarios
 */
export const TestScenarios = {
  EMPTY_STATE: {
    directions: [],
    motivations: [],
  },
  SINGLE_DIRECTION: {
    directions: [createMockThematicDirection()],
    motivations: [],
  },
  WITH_EXISTING_DATA: {
    directions: [
      createMockThematicDirection({ id: 'dir-1', name: 'Direction 1' }),
      createMockThematicDirection({ id: 'dir-2', name: 'Direction 2' }),
    ],
    motivations: createMockCoreMotivations(5),
  },
  ERROR_STATE: {
    directions: [createMockThematicDirection()],
    error: 'Failed to generate motivations',
  },
};

export default {
  createMockCoreMotivation,
  createMockCoreMotivations,
  createMockThematicDirection,
  createMockCharacterConcept,
  createMockLLMResponse,
  createMockDOMElements,
  createMockIndexedDB,
  validateCoreMotivationStructure,
  createScenarioBuilder,
  waitForAsync,
  createMockEventBus,
  TestScenarios,
};
