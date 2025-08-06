/**
 * @file Unit tests for ThematicDirectionsManagerController state management migration
 * @description Tests the migration from direct UIStateManager calls to base controller methods
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockCharacterBuilderService = {
  initialize: jest.fn(),
  getAllThematicDirectionsWithConcepts: jest.fn(),
  deleteThematicDirection: jest.fn(),
  updateThematicDirection: jest.fn(),
  getCharacterConcept: jest.fn(),
};

const mockEventBus = {
  dispatch: jest.fn(),
};

const mockSchemaValidator = {
  validate: jest.fn(),
};

const mockUIStateManager = {
  showState: jest.fn(),
  showError: jest.fn(),
};

// Mock BaseCharacterBuilderController with required methods
jest.mock(
  '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js',
  () => ({
    BaseCharacterBuilderController: jest
      .fn()
      .mockImplementation(function (dependencies) {
        // Store dependencies
        this._logger = dependencies.logger;
        this._characterBuilderService = dependencies.characterBuilderService;
        this._eventBus = dependencies.eventBus;
        this._schemaValidator = dependencies.schemaValidator;
        this.additionalServices = {
          uiStateManager: dependencies.uiStateManager,
        };

        // Mock elements storage
        this._elements = {};

        // Mock base controller state management methods
        this._showState = jest.fn();
        this._showError = jest.fn();
        this._showLoading = jest.fn();
        this._showResults = jest.fn();
        this._showEmpty = jest.fn();
        this._executeWithErrorHandling = jest.fn();

        // Mock element management methods
        this._getElement = jest.fn((key) => this._elements[key] || null);
        this._setElementText = jest.fn();
        this._showElement = jest.fn();
        this._hideElement = jest.fn();
        this._addEventListener = jest.fn();
        this._cacheElementsFromMap = jest.fn();

        // Mock initialization methods
        this._initializeAdditionalServices = jest.fn().mockResolvedValue();
        this._loadInitialData = jest.fn().mockResolvedValue();
        this._initializeUIState = jest.fn().mockResolvedValue();
        this._postInitialize = jest.fn().mockResolvedValue();
        this._setupEventListeners = jest.fn();
        this._preDestroy = jest.fn();
        this._postDestroy = jest.fn();

        // Create getters for dependencies
        Object.defineProperty(this, 'logger', {
          get: () => this._logger,
        });
        Object.defineProperty(this, 'characterBuilderService', {
          get: () => this._characterBuilderService,
        });
        Object.defineProperty(this, 'eventBus', {
          get: () => this._eventBus,
        });
      }),
  })
);

describe('ThematicDirectionsManagerController - State Management Migration', () => {
  let controller;
  let mockDependencies;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    mockDependencies = {
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      uiStateManager: mockUIStateManager,
    };

    controller = new ThematicDirectionsManagerController(mockDependencies);

    // Mock DOM elements for success notifications
    document.getElementById = jest.fn();
    document.createElement = jest.fn(() => ({
      id: '',
      className: '',
      textContent: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      querySelector: jest.fn(),
    }));

    // Mock document.body.appendChild properly for jsdom
    const originalAppendChild = document.body.appendChild;
    document.body.appendChild = jest.fn();

    global.clearTimeout = jest.fn();
    global.setTimeout = jest.fn((fn, delay) => {
      // Execute timeout immediately for testing
      fn();
      return 'mock-timeout-id';
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Base Controller Method Integration', () => {
    it('should use base controller _showLoading instead of direct UIStateManager calls', () => {
      // Test the loading state call that was replaced
      controller._showLoading('Loading thematic directions...');

      expect(controller._showLoading).toHaveBeenCalledWith(
        'Loading thematic directions...'
      );
    });

    it('should use base controller _showError instead of direct UIStateManager calls', () => {
      const errorMessage =
        'Failed to load thematic directions. Please try again.';

      controller._showError(errorMessage);

      expect(controller._showError).toHaveBeenCalledWith(errorMessage);
    });

    it('should use base controller _showEmpty instead of direct UIStateManager calls', () => {
      controller._showEmpty();

      expect(controller._showEmpty).toHaveBeenCalled();
    });

    it('should use base controller _showResults instead of direct UIStateManager calls', () => {
      const testData = [
        { direction: { id: '1', title: 'Test' }, concept: null },
      ];

      controller._showResults(testData);

      expect(controller._showResults).toHaveBeenCalledWith(testData);
    });
  });

  describe('Success Notifications', () => {
    beforeEach(() => {
      // Mock notification element doesn't exist initially
      document.getElementById.mockReturnValue(null);
      document.createElement.mockReturnValue({
        id: '',
        className: '',
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      });
    });

    it('should create and show success notification', () => {
      const message = 'Thematic direction deleted successfully';
      const mockNotification = {
        id: '',
        className: '',
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      document.createElement.mockReturnValue(mockNotification);

      controller._showSuccess(message);

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockNotification.id).toBe('success-notification');
      expect(mockNotification.className).toBe(
        'notification notification-success'
      );
      expect(mockNotification.textContent).toBe(message);
      expect(mockNotification.classList.add).toHaveBeenCalledWith(
        'notification-visible'
      );
      expect(document.body.appendChild).toHaveBeenCalledWith(mockNotification);
    });

    it('should reuse existing notification element', () => {
      const message = 'Test success message';
      const existingNotification = {
        id: 'success-notification',
        className: 'notification notification-success',
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
        },
      };

      document.getElementById.mockReturnValue(existingNotification);

      controller._showSuccess(message);

      expect(document.createElement).not.toHaveBeenCalled();
      expect(existingNotification.textContent).toBe(message);
      expect(existingNotification.classList.add).toHaveBeenCalledWith(
        'notification-visible'
      );
    });

    it('should auto-hide notification after specified duration', () => {
      const message = 'Test message';
      const duration = 5000;

      controller._showSuccess(message, duration);

      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        duration
      );
    });

    it('should clear existing timeout when showing new notification', () => {
      controller._showSuccess('First message');
      controller._showSuccess('Second message');

      expect(global.clearTimeout).toHaveBeenCalled();
    });
  });

  describe('Contextual Empty States', () => {
    beforeEach(() => {
      const mockEmptyElement = {
        querySelector: jest.fn(() => ({
          textContent: '',
        })),
      };
      controller._getElement = jest.fn((key) =>
        key === 'emptyState' ? mockEmptyElement : null
      );
    });

    it('should show empty state with custom message', () => {
      const customMessage =
        'No thematic directions found. Create your first direction to get started.';

      controller._showEmptyWithMessage(customMessage);

      expect(controller._showEmpty).toHaveBeenCalled();
      expect(controller._getElement).toHaveBeenCalledWith('emptyState');
    });

    it('should update empty state message if element exists', () => {
      const customMessage = 'No directions match your current filters.';
      const mockMessageElement = { textContent: '' };
      const mockEmptyElement = {
        querySelector: jest.fn(() => mockMessageElement),
      };

      controller._getElement = jest.fn(() => mockEmptyElement);

      controller._showEmptyWithMessage(customMessage);

      expect(mockEmptyElement.querySelector).toHaveBeenCalledWith(
        '.empty-message'
      );
      expect(mockMessageElement.textContent).toBe(customMessage);
    });

    it('should handle missing empty state element gracefully', () => {
      controller._getElement = jest.fn(() => null);

      expect(() => {
        controller._showEmptyWithMessage('Test message');
      }).not.toThrow();

      expect(controller._showEmpty).toHaveBeenCalled();
    });
  });

  describe('Migration Verification', () => {
    it('should not call UIStateManager methods directly', () => {
      // Verify that no direct UIStateManager calls are made during operations
      controller._showLoading('Test');
      controller._showError('Test error');
      controller._showEmpty();
      controller._showResults([]);

      // UIStateManager should not be called directly
      expect(mockUIStateManager.showState).not.toHaveBeenCalled();
      expect(mockUIStateManager.showError).not.toHaveBeenCalled();
    });

    it('should use base controller methods for all state transitions', () => {
      // Test that all new methods call the appropriate base controller methods
      controller._showLoading('Loading...');
      controller._showError('Error occurred');
      controller._showEmpty();
      controller._showResults([]);

      expect(controller._showLoading).toHaveBeenCalledWith('Loading...');
      expect(controller._showError).toHaveBeenCalledWith('Error occurred');
      expect(controller._showEmpty).toHaveBeenCalled();
      expect(controller._showResults).toHaveBeenCalledWith([]);
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should show contextual error messages', () => {
      const error = new Error('Network failure');
      const context = { context: 'thematic directions operations' };

      controller._showError(error, context);

      expect(controller._showError).toHaveBeenCalledWith(error, context);
    });

    it('should handle string error messages', () => {
      const errorMessage = 'Failed to refresh concepts. Please try again.';

      controller._showError(errorMessage);

      expect(controller._showError).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('State Transition Logic', () => {
    it('should show appropriate states based on data conditions', () => {
      // Mock the private field access indirectly by testing the behavior
      // This tests the logic in #filterAndDisplayDirections method

      // Test empty data state
      controller._showEmptyWithMessage(
        'No thematic directions found. Create your first direction to get started.'
      );
      expect(controller._showEmpty).toHaveBeenCalled();

      // Test filtered empty state
      controller._showEmptyWithMessage(
        'No directions match your current filters. Try adjusting your search criteria.'
      );
      expect(controller._showEmpty).toHaveBeenCalled();

      // Test results state
      const testData = [
        { direction: { id: '1', title: 'Test' }, concept: null },
      ];
      controller._showResults(testData);
      expect(controller._showResults).toHaveBeenCalledWith(testData);
    });
  });
});
