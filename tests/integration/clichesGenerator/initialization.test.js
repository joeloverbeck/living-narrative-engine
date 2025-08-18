/**
 * @file Integration tests for ClichesGeneratorController initialization issues
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClichesGeneratorController } from '../../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import { UIStateManager } from '../../../src/shared/characterBuilder/uiStateManager.js';

describe('ClichesGeneratorController - Initialization Issues', () => {
  let controller;
  let mockLogger;
  let mockEventBus;
  let mockCharacterBuilderService;
  let mockClicheGenerator;
  let mockSchemaValidator;

  beforeEach(() => {
    // Setup mock logger to track warnings and errors
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    // Setup mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Setup mock services
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([
        {
          direction: {
            id: 'dir-1',
            conceptId: 'concept-1',
            title: 'Test Direction',
            description: 'Test description',
          },
          concept: {
            id: 'concept-1',
            text: 'Test concept text',
          },
        },
      ]),
      getCharacterConcept: jest.fn().mockResolvedValue({
        id: 'concept-1',
        text: 'Test concept text',
      }),
      hasClichesForDirection: jest.fn().mockResolvedValue(false),
      getClichesByDirectionId: jest.fn().mockResolvedValue(null),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      storeCliches: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn().mockResolvedValue(true),
      storeThematicDirection: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn(),
    };

    mockClicheGenerator = {
      generateCliches: jest.fn(),
      parseLLMResponse: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    // Create proper DOM structure for UIStateManager
    document.body.innerHTML = `
      <div id="cliches-generator-container">
        <form id="cliches-form">
          <select id="direction-selector">
            <option value="">-- Choose a thematic direction --</option>
          </select>
          <button id="generate-btn" type="submit" disabled>Generate Clichés</button>
        </form>
        
        <div id="selected-direction-display" style="display: none">
          <div id="direction-content"></div>
          <div id="direction-meta"></div>
        </div>
        
        <div id="original-concept-display" style="display: none">
          <div id="concept-content"></div>
        </div>
        
        <div id="status-messages"></div>
        
        <div id="cliches-container">
          <!-- State containers that UIStateManager needs -->
          <div id="empty-state" class="cb-empty-state">
            <p>Select a thematic direction to view or generate clichés.</p>
          </div>
          <div id="loading-state" class="cb-loading-state" style="display: none">
            <div class="loading-spinner"></div>
            <p>Loading...</p>
          </div>
          <div id="results-state" class="cb-results-state" style="display: none">
            <!-- Results will be populated here -->
          </div>
          <div id="error-state" class="cb-error-state" style="display: none">
            <p id="error-message"></p>
          </div>
        </div>
        
        <button id="back-to-menu-btn">Back to Menu</button>
      </div>
    `;
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('UIStateManager Initialization Timing - Fixed', () => {
    it('should NOT have UIStateManager not initialized warning after fix', async () => {
      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Initialize controller - should NOT trigger warning after fix
      await controller.initialize();

      // Check that NO warning was logged about UIStateManager not being initialized
      const warningCalls = mockLogger.warn.mock.calls;
      const uiStateManagerWarning = warningCalls.find((call) =>
        call[0].includes('UIStateManager not initialized')
      );

      expect(uiStateManagerWarning).toBeUndefined();
    });

    it('should NOT have invalid idle state warning after fix', async () => {
      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Initialize controller
      await controller.initialize();

      // Check for NO invalid 'idle' state warning
      const warningCalls = mockLogger.warn.mock.calls;
      const idleStateWarning = warningCalls.find((call) =>
        call[0].includes("Invalid state 'idle'")
      );

      expect(idleStateWarning).toBeUndefined();
    });

    it('should show that loading overlay remains visible after initialization', async () => {
      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Initialize controller
      await controller.initialize();

      // Check if loading state is still visible (it shouldn't be)
      const loadingState = document.getElementById('loading-state');
      const emptyState = document.getElementById('empty-state');

      // The bug would cause loading state to remain visible or no proper state to be shown
      // After fixing, empty state should be visible
      expect(loadingState.style.display).toBe('none');

      // Due to the UIStateManager not being initialized properly,
      // the empty state might not be properly shown
      // This test will fail initially and pass after the fix
    });

    it('should properly show states with UIStateManager initialized', async () => {
      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Spy on _showState method to verify it's called successfully
      const showStateSpy = jest.spyOn(controller, '_showState');

      // Initialize controller
      await controller.initialize();

      // Verify _showState was called
      expect(showStateSpy).toHaveBeenCalled();

      // Verify NO warnings about UIStateManager were logged
      const warningCalls = mockLogger.warn.mock.calls;
      const uiStateManagerWarnings = warningCalls.filter((call) =>
        call[0].includes('UIStateManager not initialized')
      );

      // Should have NO warnings after fix
      expect(uiStateManagerWarnings.length).toBe(0);
    });
  });

  describe('State Management After Fix', () => {
    it('should properly initialize UIStateManager before showing states', async () => {
      // This test will verify the fix works correctly
      // It should pass after we fix the initialization sequence

      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Initialize controller
      await controller.initialize();

      // After fix, there should be no UIStateManager warnings
      const warningCalls = mockLogger.warn.mock.calls;
      const uiStateManagerWarnings = warningCalls.filter((call) =>
        call[0].includes('UIStateManager not initialized')
      );

      // This will fail before fix and pass after
      expect(uiStateManagerWarnings.length).toBe(0);

      // Empty state should be properly shown
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');

      // After fix, empty state should be visible and loading state hidden
      expect(emptyState.style.display).toBe('flex');
      expect(loadingState.style.display).toBe('none');
    });

    it('should use valid states only (not idle)', async () => {
      // Create controller
      controller = new ClichesGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      // Initialize controller
      await controller.initialize();

      // After fix, there should be no 'idle' state warnings
      const warningCalls = mockLogger.warn.mock.calls;
      const idleStateWarnings = warningCalls.filter((call) =>
        call[0].includes("Invalid state 'idle'")
      );

      // This will fail before fix and pass after
      expect(idleStateWarnings.length).toBe(0);
    });
  });
});
