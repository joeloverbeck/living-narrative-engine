/**
 * @file Unified DOM mocking setup for ThematicDirection tests
 * @description Provides consistent DOM element mocking across all thematic direction test files
 */

import { jest } from '@jest/globals';

/**
 * Creates a properly mocked DOM element with all necessary methods and properties
 *
 * @param {string} tag - HTML tag name
 * @returns {object} Mock DOM element
 */
export function createMockElement(tag = 'div') {
  const listeners = new Map();

  const element = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    get textContent() {
      return this._textContent || '';
    },
    set textContent(value) {
      this._textContent = value;
    },
    _textContent: '',
    value: '',
    style: {
      get display() {
        return this._display || 'none';
      },
      set display(value) {
        this._display = value;
      },
      _display: 'none',
    },
    disabled: false,
    selected: false, // For option elements

    // CSS classes management
    classList: {
      add: jest.fn((className) => {
        const classes = element.className.split(' ').filter((c) => c);
        if (!classes.includes(className)) {
          classes.push(className);
          element.className = classes.join(' ');
        }
      }),
      remove: jest.fn((className) => {
        const classes = element.className.split(' ').filter((c) => c);
        const index = classes.indexOf(className);
        if (index > -1) {
          classes.splice(index, 1);
          element.className = classes.join(' ');
        }
      }),
      contains: jest.fn((className) => {
        return element.className.split(' ').includes(className);
      }),
      toggle: jest.fn((className) => {
        if (element.classList.contains(className)) {
          element.classList.remove(className);
        } else {
          element.classList.add(className);
        }
      }),
    },

    // Event handling
    addEventListener: jest.fn((eventType, handler) => {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, []);
      }
      listeners.get(eventType).push(handler);
    }),

    removeEventListener: jest.fn((eventType, handler) => {
      if (listeners.has(eventType)) {
        const handlers = listeners.get(eventType);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }),

    dispatchEvent: jest.fn((event) => {
      if (listeners.has(event.type)) {
        const handlers = listeners.get(event.type);
        handlers.forEach((handler) => {
          try {
            handler(event);
          } catch (error) {
            console.warn(`Event handler error for ${event.type}:`, error);
          }
        });
      }
      return true;
    }),

    // DOM manipulation
    setAttribute: jest.fn((name, value) => {
      element[name] = value;
    }),

    getAttribute: jest.fn((name) => {
      return element[name] || null;
    }),

    // Children array management
    _childrenArray: [],

    // Special getter for children.length to ensure it's always current
    get children() {
      return {
        length: this._childrenArray.length,
        ...this._childrenArray,
      };
    },

    // Options array for select elements
    get options() {
      return {
        length: this._childrenArray.length,
        ...this._childrenArray,
      };
    },

    // Remove method for options
    remove: jest.fn(function (index) {
      if (index >= 0 && index < this._childrenArray.length) {
        this._childrenArray.splice(index, 1);
      }
    }),

    // Improved appendChild that properly updates innerHTML
    appendChild: jest.fn(function (child) {
      this._childrenArray.push(child);

      // Handle different child types for innerHTML update
      if (child.tagName === 'OPTION') {
        const value = child.value || '';
        const text = child.textContent || '';
        const selected = child.selected ? ' selected' : '';
        this.innerHTML += `<option value="${value}"${selected}>${text}</option>`;
      } else if (child.outerHTML) {
        this.innerHTML += child.outerHTML;
      } else {
        // Fallback for simple text content
        this.innerHTML += child.textContent || '';
      }

      return child;
    }),

    // DOM navigation methods
    closest: jest.fn((selector) => {
      // Simple implementation for testing - just return a mock element
      if (selector === '.cb-form-group') {
        return {
          insertAdjacentElement: jest.fn(),
        };
      }
      return null;
    }),

    insertAdjacentElement: jest.fn((position, element) => {
      // Mock implementation for testing
      return element;
    }),

    scrollIntoView: jest.fn(),

    // DOM query methods
    querySelector: jest.fn((selector) => {
      // Simple mock implementation for common cases
      if (selector === 'p' || selector === '.error-message, p') {
        return {
          textContent: '',
          get textContent() {
            return this._textContent || '';
          },
          set textContent(value) {
            this._textContent = value;
          },
        };
      }
      return null;
    }),

    querySelectorAll: jest.fn(() => []),

    // Mock outerHTML property for nested elements
    get outerHTML() {
      const attrs = [];
      if (this.id) attrs.push(`id="${this.id}"`);
      if (this.className) attrs.push(`class="${this.className}"`);
      if (this.value !== undefined && this.value !== '')
        attrs.push(`value="${this.value}"`);
      if (this.selected) attrs.push('selected');

      const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

      // Self-closing tags
      if (['input', 'br', 'hr', 'img'].includes(this.tagName.toLowerCase())) {
        return `<${this.tagName.toLowerCase()}${attrString} />`;
      }

      return `<${this.tagName.toLowerCase()}${attrString}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
    },
  };

  return element;
}

/**
 * Creates all DOM elements needed for ThematicDirectionController
 *
 * @returns {object} Object containing all mock DOM elements
 */
export function createThematicDirectionMockElements() {
  return {
    // Form elements
    form: createMockElement('form'),
    textarea: createMockElement('textarea'),
    charCount: createMockElement('span'),
    errorMessage: createMockElement('div'),

    // Buttons
    generateBtn: createMockElement('button'),
    retryBtn: createMockElement('button'),
    backBtn: createMockElement('button'),

    // State containers
    emptyState: createMockElement('div'),
    loadingState: createMockElement('div'),
    errorState: createMockElement('div'),
    resultsState: createMockElement('div'),

    // Results elements
    directionsContainer: createMockElement('div'),
    directionsList: createMockElement('div'),
    directionsResults: createMockElement('div'),
    generatedConcept: createMockElement('div'),
    conceptText: createMockElement('div'),
    characterCount: createMockElement('span'),
    timestamp: createMockElement('span'),

    // Error message
    errorMessageText: createMockElement('p'),

    // New concept selector elements
    conceptSelector: createMockElement('select'),
    selectedConceptDisplay: createMockElement('div'),
    conceptContent: createMockElement('div'),
    conceptDirectionsCount: createMockElement('span'),
    conceptCreatedDate: createMockElement('span'),
    conceptSelectorError: createMockElement('div'),
  };
}

/**
 * Sets up complete DOM mocking for ThematicDirectionController tests
 *
 * @param {object} mockElements - Mock elements from createThematicDirectionMockElements()
 * @returns {object} Mock document object
 */
export function setupThematicDirectionDOM(mockElements) {
  // Setup new concept selector
  if (mockElements.conceptSelector) {
    mockElements.conceptSelector.innerHTML =
      '<option value="">-- Choose a character concept --</option>';
    // Initialize children array with the default option
    mockElements.conceptSelector._childrenArray = [
      {
        tagName: 'OPTION',
        value: '',
        textContent: '-- Choose a character concept --',
        selected: false,
      },
    ];
  }

  // Setup concept display as initially hidden
  if (mockElements.selectedConceptDisplay) {
    mockElements.selectedConceptDisplay.style.display = 'none';
  }

  const mockDocument = {
    getElementById: jest.fn((id) => {
      const elementMap = {
        // Legacy elements
        'concept-form': mockElements.form,
        'concept-input': mockElements.textarea,
        'concept-error': mockElements.errorMessage,
        'generate-btn': mockElements.generateBtn,
        'retry-btn': mockElements.retryBtn,
        'back-to-menu-btn': mockElements.backBtn,
        'empty-state': mockElements.emptyState,
        'loading-state': mockElements.loadingState,
        'error-state': mockElements.errorState,
        'results-state': mockElements.resultsState,
        'error-message-text': mockElements.errorMessageText,

        // Results elements
        'generated-directions': mockElements.directionsContainer,
        'directions-list': mockElements.directionsList,
        'directions-results': mockElements.directionsResults,
        'generated-concept': mockElements.generatedConcept,
        'concept-text': mockElements.conceptText,
        'character-count': mockElements.characterCount,
        timestamp: mockElements.timestamp,

        // New concept selector elements
        'concept-selector': mockElements.conceptSelector,
        'selected-concept-display': mockElements.selectedConceptDisplay,
        'concept-content': mockElements.conceptContent,
        'concept-directions-count': mockElements.conceptDirectionsCount,
        'concept-created-date': mockElements.conceptCreatedDate,
        'concept-selector-error': mockElements.conceptSelectorError,
      };
      const element = elementMap[id];

      return element || null;
    }),

    querySelector: jest.fn((selector) => {
      if (selector === '.char-count') return mockElements.charCount;
      console.warn(
        `querySelector called with unsupported selector: ${selector}`
      );
      return null;
    }),

    createElement: jest.fn((tag) => {
      const element = createMockElement(tag);

      // Special handling for different element types
      if (tag === 'option') {
        element.selected = false;
        // Ensure option has proper structure
        element.value = '';
        element.textContent = '';
      }

      return element;
    }),

    // Mock for body (used in error display)
    body: {
      innerHTML: '',
      appendChild: jest.fn(),
      contains: jest.fn(() => true),
    },
  };

  // Set up window mock
  const mockWindow = {
    location: {
      href: '',
    },
  };

  // Override specific document methods to use our mocks
  if (global.document) {
    // Override existing document's methods with our mock implementations
    global.document.getElementById = mockDocument.getElementById;
    global.document.querySelector = mockDocument.querySelector;
    global.document.createElement = mockDocument.createElement;

    if (!global.document.body) {
      global.document.body = mockDocument.body;
    } else if (typeof global.document.body.contains !== 'function') {
      global.document.body.contains = jest.fn(() => true);
    }
  } else {
    // If document doesn't exist, create it
    global.document = mockDocument;
  }

  global.window = mockWindow;

  // Store reference to mockDocument for test access
  global.mockDocument = mockDocument;

  return { document: mockDocument, window: mockWindow };
}

/**
 * Creates a mock Event object for testing
 *
 * @param {string} type - Event type (e.g., 'submit', 'input', 'change')
 * @param {object} options - Additional event properties
 * @returns {object} Mock event object
 */
export function createMockEvent(type, options = {}) {
  return {
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: options.target || {},
    ...options,
  };
}

/**
 * Cleanup function to restore global objects after tests
 */
export function cleanupThematicDirectionDOM() {
  delete global.document;
  delete global.window;
  delete global.mockDocument;
}
