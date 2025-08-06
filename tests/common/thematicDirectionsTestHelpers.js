/**
 * @file Enhanced test utilities for ThematicDirectionsManager testing
 * @description Provides specialized test helpers and utilities for thematic directions testing
 */

/**
 * ThematicDirectionsTestHelpers - Collection of specialized test utilities
 */
export class ThematicDirectionsTestHelpers {
  /**
   * Create mock thematic direction data
   *
   * @param {object} options - Options for direction creation
   * @returns {object} Mock thematic direction
   */
  static createMockDirection(options = {}) {
    const {
      id = 'test-direction-1',
      title = 'Test Direction',
      description = 'A test thematic direction',
      thematicDirection = 'Character follows a path of testing',
      conceptId = 'test-concept-1',
      createdAt = new Date('2023-01-01T12:00:00Z'),
      updatedAt = new Date('2023-01-01T12:00:00Z'),
    } = options;

    return {
      id,
      title,
      description,
      thematicDirection,
      conceptId,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Create mock concept data
   *
   * @param {object} options - Options for concept creation
   * @returns {object} Mock concept
   */
  static createMockConcept(options = {}) {
    const {
      id = 'test-concept-1',
      concept = 'A brave test character seeking resolution',
      status = 'completed',
      createdAt = new Date('2023-01-01T12:00:00Z'),
      updatedAt = new Date('2023-01-01T12:00:00Z'),
      thematicDirections = ['test-direction-1'],
      metadata = {},
    } = options;

    return {
      id,
      concept,
      status,
      createdAt,
      updatedAt,
      thematicDirections,
      metadata,
    };
  }

  /**
   * Create mock direction with concept data
   *
   * @param {object} options - Options for creation
   * @returns {object} Mock direction with concept
   */
  static createMockDirectionWithConcept(options = {}) {
    const {
      direction: directionOptions = {},
      concept: conceptOptions = {},
      orphaned = false,
    } = options;

    const direction = this.createMockDirection(directionOptions);
    const concept = orphaned ? null : this.createMockConcept(conceptOptions);

    if (orphaned) {
      direction.conceptId = null;
    }

    return {
      direction,
      concept,
    };
  }

  /**
   * Create multiple mock directions with concepts
   *
   * @param {number} count - Number of items to create
   * @param {object} options - Options for creation
   * @returns {Array} Array of mock directions with concepts
   */
  static createMockDirectionsWithConcepts(count = 3, options = {}) {
    const { includeOrphaned = true } = options;
    const items = [];

    for (let i = 1; i <= count; i++) {
      const isOrphaned = includeOrphaned && i === count; // Last item is orphaned

      items.push(
        this.createMockDirectionWithConcept({
          direction: {
            id: `direction-${i}`,
            title: `Direction ${i}`,
            description: `Description for direction ${i}`,
            thematicDirection: `Thematic direction ${i}`,
            conceptId: isOrphaned ? null : `concept-${i}`,
          },
          concept: {
            id: `concept-${i}`,
            concept: `Test concept ${i}`,
          },
          orphaned: isOrphaned,
        })
      );
    }

    return items;
  }

  /**
   * Setup DOM elements specifically for thematic directions testing
   *
   * @param {object} testBase - Test base instance
   * @param {object} options - Setup options
   */
  static setupThematicDirectionsDOM(testBase, options = {}) {
    const {
      includeModal = true,
      includeNotifications = true,
      includeConceptDisplay = true,
      includeFilters = true,
    } = options;

    let domHTML = `
      <div class="thematic-directions-container">
        <!-- Core state containers -->
        <div id="empty-state" style="display: none;">
          <p class="empty-message">No thematic directions found</p>
          <button id="create-first-btn">Create First Direction</button>
        </div>
        <div id="loading-state" style="display: none;">
          <div class="loading-spinner"></div>
        </div>
        <div id="error-state" style="display: none;">
          <p class="error-message">An error occurred</p>
          <button id="retry-btn">Retry</button>
        </div>
        <div id="results-state" style="display: none;">
          <div id="directions-results"></div>
          <div class="results-summary">
            <span id="total-directions">0 directions</span>
            <span id="orphaned-count" style="display: none;">0 orphaned</span>
          </div>
        </div>
    `;

    if (includeConceptDisplay) {
      domHTML += `
        <!-- Concept selection and display -->
        <div class="concept-selection-panel">
          <div id="concept-selector"></div>
          <div id="concept-display-container" style="display: none;">
            <div id="concept-display-content"></div>
          </div>
        </div>
      `;
    }

    if (includeFilters) {
      domHTML += `
        <!-- Filtering controls -->
        <div class="filters-panel">
          <div id="direction-filter"></div>
          <input type="text" id="search-input" placeholder="Search directions..." />
        </div>
      `;
    }

    domHTML += `
        <!-- Action buttons -->
        <div class="actions-panel">
          <button id="refresh-btn">Refresh</button>
          <button id="cleanup-orphans-btn">Cleanup Orphans</button>
          <button id="back-to-menu-btn">Back to Menu</button>
        </div>
    `;

    if (includeModal) {
      domHTML += `
        <!-- Modal -->
        <div id="confirmation-modal" class="modal" style="display: none;">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <h2 id="modal-title"></h2>
            <p id="modal-message"></p>
            <div class="modal-actions">
              <button id="modal-confirm-btn">Confirm</button>
              <button id="modal-cancel-btn">Cancel</button>
              <button id="close-modal-btn">×</button>
            </div>
          </div>
        </div>
      `;
    }

    if (includeNotifications) {
      domHTML += `
        <!-- Notifications -->
        <div id="notification-container">
          <div id="success-notification" class="notification notification-success" style="display: none;"></div>
          <div id="error-notification" class="notification notification-error" style="display: none;"></div>
        </div>
      `;
    }

    domHTML += `
      </div>
    `;

    testBase.addDOMElement(domHTML);
  }

  /**
   * Setup global mocks for thematic directions testing
   *
   * @param {object} options - Mock setup options
   */
  static setupGlobalMocks(options = {}) {
    const {
      includeTimeouts = true,
      includeAlerts = true,
      includeDocument = true,
    } = options;

    if (includeTimeouts) {
      global.setTimeout = jest.fn((callback, delay) => {
        callback();
        return 'mock-timeout-id';
      });
      global.clearTimeout = jest.fn();
    }

    if (includeAlerts) {
      global.alert = jest.fn();
      global.confirm = jest.fn(() => true);
    }

    if (includeDocument) {
      if (!global.document.addEventListener.mockImplementation) {
        global.document.addEventListener = jest.fn();
        global.document.removeEventListener = jest.fn();
      }

      // Mock activeElement
      const mockActiveElement = { focus: jest.fn() };
      Object.defineProperty(global.document, 'activeElement', {
        get: jest.fn(() => mockActiveElement),
        configurable: true,
      });
    }
  }

  /**
   * Create mock service responses for testing
   *
   * @param {object} testBase - Test base instance
   * @param {object} responses - Response configurations
   */
  static setupServiceMocks(testBase, responses = {}) {
    const {
      getAllDirections = null,
      getConcept = null,
      getConcepts = null,
      deleteDirection = null,
      createDirection = null,
      updateDirection = null,
    } = responses;

    if (getAllDirections !== null) {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        getAllDirections
      );
    }

    if (getConcept !== null) {
      testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue(
        getConcept
      );
    }

    if (getConcepts !== null) {
      testBase.mocks.characterBuilderService.getCharacterConcepts.mockResolvedValue(
        getConcepts
      );
    }

    if (deleteDirection !== null) {
      testBase.mocks.characterBuilderService.deleteThematicDirection.mockResolvedValue(
        deleteDirection
      );
    }

    if (createDirection !== null) {
      testBase.mocks.characterBuilderService.createThematicDirection.mockResolvedValue(
        createDirection
      );
    }

    if (updateDirection !== null) {
      testBase.mocks.characterBuilderService.updateThematicDirection.mockResolvedValue(
        updateDirection
      );
    }
  }

  /**
   * Simulate concept selection workflow
   *
   * @param {object} controller - Controller instance
   * @param {string} conceptId - Concept ID to select
   */
  static async simulateConceptSelection(controller, conceptId) {
    // Get the selection handler from PreviousItemsDropdown mock
    const selectionHandler = global.__testSelectionHandler;

    if (selectionHandler) {
      await selectionHandler(conceptId);
    } else {
      // Fallback: call the method directly if available
      const handleMethod =
        controller._handleConceptSelection || controller.handleConceptSelection;
      if (typeof handleMethod === 'function') {
        await handleMethod.call(controller, conceptId);
      }
    }
  }

  /**
   * Simulate modal confirmation workflow
   *
   * @param {object} controller - Controller instance
   * @param {object} options - Modal options
   * @param {boolean} confirm - Whether to confirm or cancel
   */
  static simulateModalConfirmation(controller, options, confirm = true) {
    // Show the modal
    controller._showConfirmationModal(options);

    // Simulate user action
    if (confirm) {
      controller._handleModalConfirm();
    } else {
      controller._handleModalCancel();
    }
  }

  /**
   * Assert DOM state matches expectations
   *
   * @param {object} expectations - Expected DOM state
   */
  static assertDOMState(expectations = {}) {
    const {
      visibleElements = [],
      hiddenElements = [],
      elementTexts = {},
      elementClasses = {},
      elementAttributes = {},
    } = expectations;

    // Check visible elements
    visibleElements.forEach((elementId) => {
      const element = document.getElementById(elementId);
      expect(element).toBeTruthy();
      expect(element.style.display).not.toBe('none');
    });

    // Check hidden elements
    hiddenElements.forEach((elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        expect(element.style.display).toBe('none');
      }
    });

    // Check element text content
    Object.keys(elementTexts).forEach((elementId) => {
      const element = document.getElementById(elementId);
      expect(element).toBeTruthy();
      expect(element.textContent).toBe(elementTexts[elementId]);
    });

    // Check element classes
    Object.keys(elementClasses).forEach((elementId) => {
      const element = document.getElementById(elementId);
      const expectedClasses = elementClasses[elementId];

      expect(element).toBeTruthy();

      if (Array.isArray(expectedClasses)) {
        expectedClasses.forEach((className) => {
          expect(element.classList.contains(className)).toBe(true);
        });
      } else {
        expect(element.className).toBe(expectedClasses);
      }
    });

    // Check element attributes
    Object.keys(elementAttributes).forEach((elementId) => {
      const element = document.getElementById(elementId);
      const expectedAttributes = elementAttributes[elementId];

      expect(element).toBeTruthy();

      Object.keys(expectedAttributes).forEach((attrName) => {
        expect(element.getAttribute(attrName)).toBe(
          expectedAttributes[attrName]
        );
      });
    });
  }

  /**
   * Assert service method calls
   *
   * @param {object} testBase - Test base instance
   * @param {object} expectations - Expected service calls
   */
  static assertServiceCalls(testBase, expectations = {}) {
    const {
      getAllDirections = null,
      getConcept = null,
      deleteDirection = null,
      createDirection = null,
      updateDirection = null,
    } = expectations;

    if (getAllDirections !== null) {
      if (getAllDirections.called) {
        expect(
          testBase.mocks.characterBuilderService
            .getAllThematicDirectionsWithConcepts
        ).toHaveBeenCalledTimes(getAllDirections.times || 1);

        if (getAllDirections.with) {
          expect(
            testBase.mocks.characterBuilderService
              .getAllThematicDirectionsWithConcepts
          ).toHaveBeenCalledWith(...getAllDirections.with);
        }
      } else {
        expect(
          testBase.mocks.characterBuilderService
            .getAllThematicDirectionsWithConcepts
        ).not.toHaveBeenCalled();
      }
    }

    if (getConcept !== null) {
      if (getConcept.called) {
        expect(
          testBase.mocks.characterBuilderService.getCharacterConcept
        ).toHaveBeenCalledTimes(getConcept.times || 1);

        if (getConcept.with) {
          expect(
            testBase.mocks.characterBuilderService.getCharacterConcept
          ).toHaveBeenCalledWith(...getConcept.with);
        }
      } else {
        expect(
          testBase.mocks.characterBuilderService.getCharacterConcept
        ).not.toHaveBeenCalled();
      }
    }

    if (deleteDirection !== null) {
      if (deleteDirection.called) {
        expect(
          testBase.mocks.characterBuilderService.deleteThematicDirection
        ).toHaveBeenCalledTimes(deleteDirection.times || 1);

        if (deleteDirection.with) {
          expect(
            testBase.mocks.characterBuilderService.deleteThematicDirection
          ).toHaveBeenCalledWith(...deleteDirection.with);
        }
      } else {
        expect(
          testBase.mocks.characterBuilderService.deleteThematicDirection
        ).not.toHaveBeenCalled();
      }
    }

    if (createDirection !== null) {
      if (createDirection.called) {
        expect(
          testBase.mocks.characterBuilderService.createThematicDirection
        ).toHaveBeenCalledTimes(createDirection.times || 1);

        if (createDirection.with) {
          expect(
            testBase.mocks.characterBuilderService.createThematicDirection
          ).toHaveBeenCalledWith(...createDirection.with);
        }
      } else {
        expect(
          testBase.mocks.characterBuilderService.createThematicDirection
        ).not.toHaveBeenCalled();
      }
    }

    if (updateDirection !== null) {
      if (updateDirection.called) {
        expect(
          testBase.mocks.characterBuilderService.updateThematicDirection
        ).toHaveBeenCalledTimes(updateDirection.times || 1);

        if (updateDirection.with) {
          expect(
            testBase.mocks.characterBuilderService.updateThematicDirection
          ).toHaveBeenCalledWith(...updateDirection.with);
        }
      } else {
        expect(
          testBase.mocks.characterBuilderService.updateThematicDirection
        ).not.toHaveBeenCalled();
      }
    }
  }

  /**
   * Wait for async operations to complete
   *
   * @param {number} timeout - Timeout in milliseconds
   */
  static async waitForAsync(timeout = 50) {
    return new Promise((resolve) => setTimeout(resolve, timeout));
  }

  /**
   * Create a complete test scenario
   *
   * @param {object} scenario - Scenario configuration
   */
  static createTestScenario(scenario = {}) {
    const {
      name = 'Default Scenario',
      data = {},
      mocks = {},
      dom = {},
      expectations = {},
    } = scenario;

    return {
      name,
      async setup(testBase, controller) {
        // Setup DOM
        this.setupThematicDirectionsDOM(testBase, dom);

        // Setup global mocks
        this.setupGlobalMocks();

        // Setup service mocks
        if (data.directions) {
          this.setupServiceMocks(testBase, {
            getAllDirections: data.directions,
          });
        }

        if (data.concept) {
          this.setupServiceMocks(testBase, {
            getConcept: data.concept,
          });
        }

        // Initialize controller
        if (controller && controller.initialize) {
          await controller.initialize();
        }
      },

      async execute(controller) {
        // Override in specific scenarios
      },

      assert(testBase) {
        if (expectations.dom) {
          this.assertDOMState(expectations.dom);
        }

        if (expectations.services) {
          this.assertServiceCalls(testBase, expectations.services);
        }

        if (expectations.noErrors) {
          expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
        }
      },
    };
  }

  /**
   * Predefined test scenarios
   */
  static get scenarios() {
    return {
      emptyState: this.createTestScenario({
        name: 'Empty State',
        data: { directions: [] },
        expectations: {
          dom: { visibleElements: ['empty-state'] },
          services: { getAllDirections: { called: true } },
          noErrors: true,
        },
      }),

      loadingError: this.createTestScenario({
        name: 'Loading Error',
        mocks: {
          getAllDirections: () => Promise.reject(new Error('Load failed')),
        },
        expectations: {
          dom: { visibleElements: ['error-state'] },
          services: { getAllDirections: { called: true } },
        },
      }),

      withData: this.createTestScenario({
        name: 'With Data',
        data: {
          directions: this.createMockDirectionsWithConcepts(3),
        },
        expectations: {
          dom: { visibleElements: ['results-state'] },
          services: { getAllDirections: { called: true } },
          noErrors: true,
        },
      }),
    };
  }
}

export default ThematicDirectionsTestHelpers;
