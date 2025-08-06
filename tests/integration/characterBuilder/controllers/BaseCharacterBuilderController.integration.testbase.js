/**
 * @file Base integration test class for CharacterBuilder controllers
 * @description Provides shared integration test infrastructure for character builder controllers
 */

import { BaseCharacterBuilderControllerTestBase } from '../../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

/**
 * Base integration test class for CharacterBuilder controllers
 * Extends the unit test base with integration-specific features
 */
export class BaseCharacterBuilderControllerIntegrationTestBase extends BaseCharacterBuilderControllerTestBase {
  constructor() {
    super();
    this.integrationMocks = {};
  }

  /**
   * Enhanced setup for integration testing
   *
   * @param {object} options - Setup options
   * @param {boolean} options.includeFullDOM - Whether to include full DOM structure
   * @param {boolean} options.mockGlobalFunctions - Whether to mock global functions
   * @param {Array<string>} options.additionalMocks - Additional mocks to setup
   */
  async setup(options = {}) {
    await super.setup();

    const {
      includeFullDOM = true,
      mockGlobalFunctions = true,
      additionalMocks = [],
    } = options;

    if (includeFullDOM) {
      this._setupFullDOMStructure();
    }

    if (mockGlobalFunctions) {
      this._setupGlobalFunctionMocks();
    }

    for (const mockName of additionalMocks) {
      await this._setupAdditionalMock(mockName);
    }
  }

  /**
   * Enhanced cleanup for integration testing
   */
  async cleanup() {
    await super.cleanup();
    this._cleanupIntegrationMocks();
  }

  /**
   * Setup full DOM structure for integration testing
   *
   * @private
   */
  _setupFullDOMStructure() {
    this.addDOMElement(`
      <div class="character-builder-app">
        <header class="cb-header">
          <h1>Character Builder</h1>
          <nav class="cb-navigation">
            <button id="concepts-nav-btn">Concepts</button>
            <button id="directions-nav-btn">Thematic Directions</button>
            <button id="settings-nav-btn">Settings</button>
          </nav>
        </header>
        
        <main class="cb-main">
          <div class="cb-sidebar">
            <div class="cb-input-panel" id="input-panel">
              <!-- Dynamic content area -->
            </div>
          </div>
          
          <div class="cb-content">
            <!-- State containers -->
            <div id="empty-state" class="state-container" style="display: none;">
              <div class="empty-state-content">
                <h2>No Items Found</h2>
                <p class="empty-message">Get started by creating your first item.</p>
                <button class="btn btn-primary" id="create-first-btn">Create First Item</button>
              </div>
            </div>
            
            <div id="loading-state" class="state-container" style="display: none;">
              <div class="loading-spinner"></div>
              <p class="loading-message">Loading...</p>
            </div>
            
            <div id="error-state" class="state-container" style="display: none;">
              <div class="error-content">
                <h2>Something went wrong</h2>
                <p class="error-message">An error occurred while loading data.</p>
                <button class="btn btn-secondary" id="retry-btn">Retry</button>
              </div>
            </div>
            
            <div id="results-state" class="state-container" style="display: none;">
              <div class="results-header">
                <div class="results-controls">
                  <input type="text" id="search-input" placeholder="Search..." />
                  <button class="btn btn-secondary" id="refresh-btn">Refresh</button>
                </div>
                <div class="results-stats">
                  <span id="total-count">0 items</span>
                  <span id="filtered-count" style="display: none;"></span>
                </div>
              </div>
              <div class="results-content" id="results-content">
                <!-- Dynamic results content -->
              </div>
            </div>
          </div>
        </main>
        
        <footer class="cb-footer">
          <div class="cb-actions">
            <button class="btn btn-secondary" id="back-to-menu-btn">Back to Menu</button>
            <button class="btn btn-danger" id="cleanup-btn" style="display: none;">Cleanup</button>
          </div>
        </footer>
        
        <!-- Modal containers -->
        <div id="confirmation-modal" class="modal" style="display: none;">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <header class="modal-header">
              <h2 id="modal-title">Confirm Action</h2>
              <button class="modal-close" id="close-modal-btn">&times;</button>
            </header>
            <div class="modal-body">
              <p id="modal-message">Are you sure you want to perform this action?</p>
            </div>
            <footer class="modal-footer">
              <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
              <button class="btn btn-primary" id="modal-confirm-btn">Confirm</button>
            </footer>
          </div>
        </div>
        
        <!-- Notification containers -->
        <div id="notification-container" class="notification-container">
          <div id="success-notification" class="notification notification-success" style="display: none;">
            <span class="notification-icon">✓</span>
            <span class="notification-message"></span>
          </div>
          <div id="error-notification" class="notification notification-error" style="display: none;">
            <span class="notification-icon">✗</span>
            <span class="notification-message"></span>
          </div>
        </div>
      </div>
    `);
  }

  /**
   * Setup global function mocks for integration testing
   *
   * @private
   */
  _setupGlobalFunctionMocks() {
    // Timeout functions
    this.integrationMocks.setTimeout = global.setTimeout;
    this.integrationMocks.clearTimeout = global.clearTimeout;

    global.setTimeout = jest.fn((callback, delay) => {
      callback();
      return 'mock-timeout-id';
    });

    global.clearTimeout = jest.fn();

    // Alert and confirm functions
    this.integrationMocks.alert = global.alert;
    this.integrationMocks.confirm = global.confirm;

    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);

    // Document event methods (if not already mocked)
    if (!global.document.addEventListener.mockImplementation) {
      this.integrationMocks.addEventListener = global.document.addEventListener;
      this.integrationMocks.removeEventListener =
        global.document.removeEventListener;

      global.document.addEventListener = jest.fn();
      global.document.removeEventListener = jest.fn();
    }

    // Focus management
    const mockActiveElement = { focus: jest.fn() };
    if (
      !global.document.activeElement ||
      !global.document.activeElement.focus
    ) {
      Object.defineProperty(global.document, 'activeElement', {
        get: jest.fn(() => mockActiveElement),
        configurable: true,
      });
    }
  }

  /**
   * Setup additional mocks based on name
   *
   * @param {string} mockName - Name of the mock to setup
   * @private
   */
  async _setupAdditionalMock(mockName) {
    switch (mockName) {
      case 'localStorage':
        this._setupLocalStorageMock();
        break;
      case 'sessionStorage':
        this._setupSessionStorageMock();
        break;
      case 'fetch':
        this._setupFetchMock();
        break;
      case 'WebSocket':
        this._setupWebSocketMock();
        break;
      default:
        this.mocks.logger.warn(
          `Unknown additional mock requested: ${mockName}`
        );
    }
  }

  /**
   * Setup localStorage mock
   *
   * @private
   */
  _setupLocalStorageMock() {
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    this.integrationMocks.localStorage = global.localStorage;
    global.localStorage = localStorageMock;
  }

  /**
   * Setup sessionStorage mock
   *
   * @private
   */
  _setupSessionStorageMock() {
    const sessionStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    this.integrationMocks.sessionStorage = global.sessionStorage;
    global.sessionStorage = sessionStorageMock;
  }

  /**
   * Setup fetch mock
   *
   * @private
   */
  _setupFetchMock() {
    this.integrationMocks.fetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      })
    );
  }

  /**
   * Setup WebSocket mock
   *
   * @private
   */
  _setupWebSocketMock() {
    const WebSocketMock = jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1, // OPEN
    }));

    this.integrationMocks.WebSocket = global.WebSocket;
    global.WebSocket = WebSocketMock;
  }

  /**
   * Cleanup integration-specific mocks
   *
   * @private
   */
  _cleanupIntegrationMocks() {
    // Restore global functions
    Object.keys(this.integrationMocks).forEach((key) => {
      if (this.integrationMocks[key] !== undefined) {
        global[key] = this.integrationMocks[key];
      }
    });

    this.integrationMocks = {};
  }

  /**
   * Simulate user interaction workflow
   *
   * @param {Array<object>} actions - Array of actions to perform
   */
  async simulateUserWorkflow(actions) {
    for (const action of actions) {
      await this._performAction(action);

      // Wait for async operations to complete
      await this._waitForAsyncOperations();
    }
  }

  /**
   * Perform a single user action
   *
   * @param {object} action - Action to perform
   * @private
   */
  async _performAction(action) {
    const { type, target, value, delay = 0 } = action;

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    switch (type) {
      case 'click':
        this._simulateClick(target);
        break;
      case 'input':
        this._simulateInput(target, value);
        break;
      case 'keypress':
        this._simulateKeypress(target, value);
        break;
      case 'submit':
        this._simulateSubmit(target);
        break;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * Simulate click event
   *
   * @param {string} target - Target element selector or ID
   * @private
   */
  _simulateClick(target) {
    const element =
      typeof target === 'string'
        ? document.getElementById(target.replace('#', '')) ||
          document.querySelector(target)
        : target;

    if (element && element.click) {
      element.click();
    }
  }

  /**
   * Simulate input event
   *
   * @param {string} target - Target element selector or ID
   * @param {string} value - Value to input
   * @private
   */
  _simulateInput(target, value) {
    const element =
      typeof target === 'string'
        ? document.getElementById(target.replace('#', '')) ||
          document.querySelector(target)
        : target;

    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Simulate keypress event
   *
   * @param {string} target - Target element selector or ID
   * @param {string} key - Key to press
   * @private
   */
  _simulateKeypress(target, key) {
    const element =
      typeof target === 'string'
        ? document.getElementById(target.replace('#', '')) ||
          document.querySelector(target)
        : target;

    if (element) {
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          bubbles: true,
        })
      );
    }
  }

  /**
   * Simulate form submit
   *
   * @param {string} target - Target form selector or ID
   * @private
   */
  _simulateSubmit(target) {
    const element =
      typeof target === 'string'
        ? document.getElementById(target.replace('#', '')) ||
          document.querySelector(target)
        : target;

    if (element && element.submit) {
      element.submit();
    }
  }

  /**
   * Wait for async operations to complete
   *
   * @param {number} timeout - Maximum wait time in ms
   * @private
   */
  async _waitForAsyncOperations(timeout = 100) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeout);
    });
  }

  /**
   * Assert that workflow completed successfully
   *
   * @param {object} expectedState - Expected final state
   */
  assertWorkflowSuccess(expectedState = {}) {
    const {
      noErrors = true,
      visibleState = null,
      elementVisible = [],
      elementHidden = [],
      textContent = {},
    } = expectedState;

    if (noErrors) {
      expect(this.mocks.logger.error).not.toHaveBeenCalled();
    }

    if (visibleState) {
      const stateElement = document.getElementById(visibleState);
      expect(stateElement).toBeTruthy();
      expect(stateElement.style.display).not.toBe('none');
    }

    elementVisible.forEach((elementId) => {
      const element = document.getElementById(elementId);
      expect(element).toBeTruthy();
      expect(element.style.display).not.toBe('none');
    });

    elementHidden.forEach((elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        expect(element.style.display).toBe('none');
      }
    });

    Object.keys(textContent).forEach((elementId) => {
      const element = document.getElementById(elementId);
      expect(element).toBeTruthy();
      expect(element.textContent).toBe(textContent[elementId]);
    });
  }

  /**
   * Create mock data for integration tests
   *
   * @param {string} dataType - Type of data to create
   * @param {object} options - Options for data creation
   */
  createMockData(dataType, options = {}) {
    switch (dataType) {
      case 'thematicDirections':
        return this._createMockThematicDirections(options);
      case 'concepts':
        return this._createMockConcepts(options);
      case 'directionsWithConcepts':
        return this._createMockDirectionsWithConcepts(options);
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }

  /**
   * Create mock thematic directions data
   *
   * @param {object} options - Creation options
   * @private
   */
  _createMockThematicDirections(options = {}) {
    const { count = 3, includeOrphaned = true } = options;
    const directions = [];

    for (let i = 1; i <= count; i++) {
      directions.push({
        id: `direction-${i}`,
        title: `Direction ${i}`,
        description: `Description for direction ${i}`,
        thematicDirection: `Thematic direction ${i}`,
        conceptId: i <= count - 1 || !includeOrphaned ? `concept-${i}` : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return directions;
  }

  /**
   * Create mock concepts data
   *
   * @param {object} options - Creation options
   * @private
   */
  _createMockConcepts(options = {}) {
    const { count = 3, statuses = ['completed'] } = options;
    const concepts = [];

    for (let i = 1; i <= count; i++) {
      concepts.push({
        id: `concept-${i}`,
        concept: `Test concept ${i}`,
        status: statuses[(i - 1) % statuses.length],
        createdAt: new Date(),
        updatedAt: new Date(),
        thematicDirections: [`direction-${i}`],
        metadata: {},
      });
    }

    return concepts;
  }

  /**
   * Create mock directions with concepts data
   *
   * @param {object} options - Creation options
   * @private
   */
  _createMockDirectionsWithConcepts(options = {}) {
    const { count = 3, includeOrphaned = true } = options;
    const directions = this._createMockThematicDirections({
      count,
      includeOrphaned,
    });
    const concepts = this._createMockConcepts({ count });

    return directions.map((direction, index) => ({
      direction,
      concept: direction.conceptId ? concepts[index] : null,
    }));
  }
}
