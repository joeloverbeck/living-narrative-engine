/**
 * @file Shared test utilities for CharacterConceptsManagerController tests
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock logger with all required methods
 *
 * @returns {object} Mock logger
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a mock character builder service with all required methods
 *
 * @returns {object} Mock character builder service
 */
export function createMockCharacterBuilderService() {
  return {
    initialize: jest.fn().mockResolvedValue(),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn(),
    updateCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    getThematicDirections: jest.fn().mockResolvedValue([]),
  };
}

/**
 * Creates a mock event bus with all required methods
 *
 * @returns {object} Mock event bus
 */
export function createMockEventBus() {
  return {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    dispatch: jest.fn(),
  };
}

/**
 * Creates a mock DOM element with common properties and methods
 *
 * @param {string} id - Element ID
 * @param {object} additionalProps - Additional properties to add to the element
 * @returns {object} Mock DOM element
 */
export function createMockElement(id, additionalProps = {}) {
  const mockElement = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn(),
    },
    style: {
      display: 'none',
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    dispatchEvent: jest.fn(),
    remove: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    insertBefore: jest.fn(),
    replaceChild: jest.fn(),
    contains: jest.fn(),
    closest: jest.fn(),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    hasAttribute: jest.fn(),
    dataset: {},
    disabled: false,
    checked: false,
    // Additional DOM methods needed for complex operations
    cloneNode: jest.fn(),
    ...additionalProps,
  };

  // Set up cloneNode to return a copy of the element
  mockElement.cloneNode = jest.fn(() => createMockElement(id + '-clone', additionalProps));
  
  // Set up parentNode to reference a mock parent
  mockElement.parentNode = {
    replaceChild: jest.fn(),
    removeChild: jest.fn(),
    appendChild: jest.fn(),
  };

  // Set up parentElement (which is the same as parentNode for testing)
  mockElement.parentElement = {
    insertBefore: jest.fn(),
    removeChild: jest.fn(),
    appendChild: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
  };

  // Set up nextSibling
  mockElement.nextSibling = null;

  return mockElement;
}

/**
 * Creates a set of mock DOM elements commonly used in tests
 *
 * @returns {object} Object containing mock elements keyed by their IDs
 */
export function createMockElements() {
  const elements = {
    // Main containers
    'concepts-container': createMockElement('concepts-container'),
    'concepts-results': createMockElement('concepts-results'),

    // State containers
    'empty-state': createMockElement('empty-state'),
    'loading-state': createMockElement('loading-state'),
    'error-state': createMockElement('error-state'),
    'results-state': createMockElement('results-state'),
    'error-message-text': createMockElement('error-message-text'),

    // Controls
    'create-concept-btn': createMockElement('create-concept-btn'),
    'create-first-btn': createMockElement('create-first-btn'),
    'retry-btn': createMockElement('retry-btn'),
    'back-to-menu-btn': createMockElement('back-to-menu-btn'),
    'concept-search': createMockElement('concept-search', { value: '' }),

    // Statistics
    'total-concepts': createMockElement('total-concepts'),
    'concepts-with-directions': createMockElement('concepts-with-directions'),
    'total-directions': createMockElement('total-directions'),

    // Create/Edit Modal
    'concept-modal': createMockElement('concept-modal'),
    'concept-modal-title': createMockElement('concept-modal-title'),
    'concept-form': createMockElement('concept-form', { reset: jest.fn() }),
    'concept-text': createMockElement('concept-text', { value: '' }),
    'char-count': createMockElement('char-count'),
    'concept-error': createMockElement('concept-error'),
    'save-concept-btn': createMockElement('save-concept-btn'),
    'cancel-concept-btn': createMockElement('cancel-concept-btn'),
    'close-concept-modal': createMockElement('close-concept-modal'),

    // Delete Modal
    'delete-confirmation-modal': createMockElement('delete-confirmation-modal'),
    'delete-modal-message': createMockElement('delete-modal-message'),
    'confirm-delete-btn': createMockElement('confirm-delete-btn'),
    'cancel-delete-btn': createMockElement('cancel-delete-btn'),
    'close-delete-modal': createMockElement('close-delete-modal'),

    // Search elements
    'search-concepts': createMockElement('search-concepts', {
      value: '',
    }),
    'clear-search-btn': createMockElement('clear-search-btn'),
    'search-status': createMockElement('search-status'),

    // Create modal elements
    'create-concept-btn': createMockElement('create-concept-btn'),
    'create-modal': createMockElement('create-modal'),
    'create-modal-overlay': createMockElement('create-modal-overlay'),
    'close-create-modal': createMockElement('close-create-modal'),
    'create-concept-text': createMockElement('create-concept-text', {
      value: '',
    }),
    'create-char-count': createMockElement('create-char-count'),
    'create-error': createMockElement('create-error'),
    'save-create-btn': createMockElement('save-create-btn'),

    // Edit modal elements
    'edit-modal': createMockElement('edit-modal'),
    'edit-modal-overlay': createMockElement('edit-modal-overlay'),
    'close-edit-modal': createMockElement('close-edit-modal'),
    'edit-concept-text': createMockElement('edit-concept-text', {
      value: '',
    }),
    'edit-char-count': createMockElement('edit-char-count'),
    'edit-error': createMockElement('edit-error'),
    'save-edit-btn': createMockElement('save-edit-btn'),

    // Delete modal elements
    'delete-modal': createMockElement('delete-modal'),
    'delete-modal-overlay': createMockElement('delete-modal-overlay'),
    'close-delete-modal': createMockElement('close-delete-modal'),
    'delete-message': createMockElement('delete-message'),
    'delete-error': createMockElement('delete-error'),
    'cancel-delete-btn': createMockElement('cancel-delete-btn'),
    'confirm-delete-btn': createMockElement('confirm-delete-btn'),
  };

  return elements;
}

/**
 * Sets up the document.getElementById mock with the provided elements
 *
 * @param {object} elements - Object containing mock elements keyed by their IDs
 */
export function setupDocumentMock(elements) {
  // Create a mock stats display element
  const statsDisplay = createMockElement('stats-display');

  document.getElementById = jest.fn((id) => elements[id] || null);
  document.querySelector = jest.fn((selector) => {
    // Handle ID selectors
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      return elements[id] || null;
    }
    // Handle class selectors for known elements
    if (selector === '.stats-display') {
      return statsDisplay;
    }
    // For other selectors, return null or implement as needed
    return null;
  });

  // Mock document.activeElement
  Object.defineProperty(document, 'activeElement', {
    writable: true,
    value: elements['concept-text'] || document.body,
  });

  // Mock window.getComputedStyle
  window.getComputedStyle = jest.fn(() => ({
    display: 'none',
    visibility: 'hidden',
    opacity: '0',
    getPropertyValue: jest.fn(),
  }));
}

/**
 * Creates test concept data
 *
 * @param {object} overrides - Properties to override in the concept
 * @returns {object} Test concept data
 */
export function createTestConcept(overrides = {}) {
  return {
    id: 'test-concept-1',
    text: 'Test concept text',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    ...overrides,
  };
}

/**
 * Creates test thematic direction data
 *
 * @param {object} overrides - Properties to override in the direction
 * @returns {object} Test thematic direction data
 */
export function createTestDirection(overrides = {}) {
  return {
    id: 'test-direction-1',
    conceptId: 'test-concept-1',
    direction: 'Test thematic direction',
    createdAt: new Date('2024-01-01').toISOString(),
    ...overrides,
  };
}

/**
 * Simulates a keyboard event
 *
 * @param {string} key - The key to simulate
 * @param {object} options - Additional event options
 * @returns {KeyboardEvent} The keyboard event
 */
export function createKeyboardEvent(key, options = {}) {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

/**
 * Waits for all promises to resolve
 *
 * @returns {Promise<void>}
 */
export async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Sets up common mocks for UIStateManager
 *
 * @returns {object} Mock UIStateManager instance
 */
export function createMockUIStateManager() {
  return {
    showState: jest.fn(),
    showError: jest.fn(),
    showLoading: jest.fn(),
    getCurrentState: jest.fn(),
    setState: jest.fn(),
  };
}

/**
 * Creates a mock character storage service with all required methods
 *
 * @returns {object} Mock character storage service
 */
export function createMockCharacterStorageService() {
  return {
    initialize: jest.fn().mockResolvedValue(),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    getCharacterConcept: jest.fn(),
    storeCharacterConcept: jest.fn().mockResolvedValue(),
    deleteCharacterConcept: jest.fn().mockResolvedValue(),
    getThematicDirections: jest.fn().mockResolvedValue([]),
  };
}

/**
 * Creates a mock event dispatcher with all required methods
 *
 * @returns {object} Mock event dispatcher
 */
export function createMockEventDispatcher() {
  return {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
}

/**
 * Populates the controller's internal elements cache for testing
 *
 * @param {CharacterConceptsManagerController} controller - Controller instance
 * @param {object} elements - Mock elements object
 */
export function populateControllerElements(controller, elements) {
  if (controller._testExports) {
    controller._testExports.elements = {
      conceptsContainer: elements['concepts-container'],
      conceptsResults: elements['concepts-results'],
      emptyState: elements['empty-state'],
      loadingState: elements['loading-state'],
      errorState: elements['error-state'],
      resultsState: elements['results-state'],
      errorMessageText: elements['error-message-text'],
      createConceptBtn: elements['create-concept-btn'],
      createFirstBtn: elements['create-first-btn'],
      retryBtn: elements['retry-btn'],
      backToMenuBtn: elements['back-to-menu-btn'],
      conceptSearch: elements['concept-search'],
      statsDisplay: elements['.stats-display'] || createMockElement('stats-display'), // Handle class selector
      totalConcepts: elements['total-concepts'],
      conceptsWithDirections: elements['concepts-with-directions'],
      totalDirections: elements['total-directions'],
      conceptModal: elements['concept-modal'],
      conceptModalTitle: elements['concept-modal-title'],
      conceptForm: elements['concept-form'],
      conceptText: elements['concept-text'],
      charCount: elements['char-count'],
      conceptError: elements['concept-error'],
      saveConceptBtn: elements['save-concept-btn'],
      cancelConceptBtn: elements['cancel-concept-btn'],
      closeConceptModal: elements['close-concept-modal'],
      deleteModal: elements['delete-confirmation-modal'],
      deleteModalMessage: elements['delete-modal-message'],
      confirmDeleteBtn: elements['confirm-delete-btn'],
      cancelDeleteBtn: elements['cancel-delete-btn'],
      closeDeleteModal: elements['close-delete-modal'],
    };
  }
}

/**
 * Creates a comprehensive test setup for CharacterConceptsManagerController tests
 *
 * @returns {object} Test setup containing mocks and configuration
 */
export function createTestSetup() {
  // Create all required mocks
  const mocks = {
    logger: createMockLogger(),
    builderService: createMockCharacterBuilderService(),
    storageService: createMockCharacterStorageService(),
    eventBus: createMockEventDispatcher(),
    uiStateManager: createMockUIStateManager(),
  };

  // Create elements and set up DOM mock
  const elements = createMockElements();
  setupDocumentMock(elements);

  // Add querySelector to the concepts-results element for deletion tests
  elements['concepts-results'].querySelector = jest.fn().mockReturnValue(null);
  elements['concepts-results'].children = { length: 0 };
  elements['concepts-results'].innerHTML = '';
  elements['concepts-results'].appendChild = jest.fn();
  elements['concepts-results'].classList = {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
  };

  // Create controller configuration
  const config = {
    logger: mocks.logger,
    characterBuilderService: mocks.builderService,
    eventBus: mocks.eventBus,
  };

  return {
    mocks,
    elements,
    config,
    populateControllerElements, // Helper function to populate controller elements
  };
}
