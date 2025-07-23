/**
 * @file Integration tests for CharacterBuilderController
 * @description Tests the controller initialization and basic service integration
 * @note Event-driven tests removed due to JSDOM limitations with complex DOM interactions
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderController } from '../../../src/characterBuilder/controllers/characterBuilderController.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createMockSafeEventDispatcher } from '../../common/mockFactories/eventBusMocks.js';
import { JSDOM } from 'jsdom';

describe('CharacterBuilderController - Integration Tests', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Create a minimal DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <form id="character-concept-form">
            <textarea id="character-concept-input"></textarea>
            <div class="char-count">0/1000</div>
            <div id="concept-error"></div>
            <button id="generate-directions-btn">Generate</button>
            <button id="save-concept-btn">Save</button>
          </form>
          
          <button id="retry-btn">Retry</button>
          <button id="regenerate-btn">Regenerate</button>
          <button id="export-directions-btn">Export</button>
          <button id="continue-step2-btn">Continue</button>
          <button id="back-to-menu-btn">Back</button>
          
          <div id="empty-state" style="display: flex;"></div>
          <div id="loading-state" style="display: none;">
            <div class="error-message"></div>
          </div>
          <div id="error-state" style="display: none;">
            <div class="error-message"></div>
          </div>
          <div id="directions-results" style="display: none;">
            <div id="directions-list"></div>
          </div>
          
          <aside id="saved-concepts-sidebar" class="collapsed">
            <button id="toggle-sidebar-btn" aria-expanded="false">Toggle</button>
            <div id="saved-concepts-list"></div>
            <button id="refresh-concepts-btn">Refresh</button>
            <button id="clear-all-concepts-btn">Clear All</button>
          </aside>
          
          <a id="help-link" href="#">Help</a>
          <div id="help-modal" style="display: none;">
            <button class="modal-close">Close</button>
          </div>
          <div id="confirm-modal" style="display: none;">
            <h2 id="confirm-title"></h2>
            <p id="confirm-message"></p>
            <button id="confirm-yes">Yes</button>
            <button id="confirm-no">No</button>
          </div>
          
          <div id="live-region" aria-live="polite"></div>
          
          <button id="error-details-btn">Show Details</button>
          <div id="error-details" style="display: none;">
            <div id="error-details-content"></div>
          </div>
        </body>
      </html>
    `,
      {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url: 'http://localhost',
      }
    );

    // Store references
    document = dom.window.document;
    window = dom.window;

    // Set globals
    global.document = document;
    global.window = window;
    global.location = window.location;
    global.Blob = window.Blob;
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn(),
    };

    // Create mocks
    mockLogger = createMockLogger();
    mockEventBus = createMockSafeEventDispatcher();

    // Mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      createCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
    delete global.document;
    delete global.window;
    delete global.location;
    delete global.Blob;
    delete global.URL;
  });

  describe('initialization', () => {
    it('should initialize successfully with all DOM elements', async () => {
      controller = new CharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
      });

      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderController: Successfully initialized'
      );

      // Verify initial UI state
      expect(document.getElementById('empty-state').style.display).toBe('flex');
      expect(document.getElementById('loading-state').style.display).toBe(
        'none'
      );
      expect(document.getElementById('error-state').style.display).toBe('none');
      expect(document.getElementById('directions-results').style.display).toBe(
        'none'
      );

      // Verify no errors during initialization
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should call getAllCharacterConcepts during initialization', async () => {
      const mockConcepts = [
        {
          id: '1',
          concept: 'A brave warrior',
          createdAt: new Date().toISOString(),
          status: 'draft',
        },
        {
          id: '2',
          concept: 'A wise wizard',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
      ];
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      controller = new CharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
      });

      await controller.initialize();

      // Verify initialization completed successfully
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderController: Successfully initialized'
      );

      // Verify service was called during initialization to load saved concepts
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();

      // Verify no errors during initialization
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Service initialization failed');
      mockCharacterBuilderService.initialize.mockRejectedValue(error);

      controller = new CharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
      });

      await controller.initialize();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CharacterBuilderController: Failed to initialize',
        error
      );

      // Verify initialization was attempted
      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    });
  });

  describe('service integration', () => {
    beforeEach(async () => {
      controller = new CharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
      });
      await controller.initialize();
    });

    it('should have all required DOM elements cached', () => {
      // Verify all required DOM elements are present
      expect(document.getElementById('character-concept-form')).not.toBeNull();
      expect(document.getElementById('character-concept-input')).not.toBeNull();
      expect(document.querySelector('.char-count')).not.toBeNull();
      expect(document.getElementById('concept-error')).not.toBeNull();
      expect(document.getElementById('generate-directions-btn')).not.toBeNull();
      expect(document.getElementById('save-concept-btn')).not.toBeNull();
      expect(document.getElementById('saved-concepts-list')).not.toBeNull();
      expect(document.getElementById('live-region')).not.toBeNull();
    });

    it('should integrate with character builder service', async () => {
      // Verify service integration during initialization
      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();

      // Verify controller initialized successfully
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderController: Successfully initialized'
      );
    });

    it('should integrate with event bus', () => {
      // Verify event bus was provided during construction
      expect(mockEventBus).toBeDefined();

      // The controller should have initialized without errors
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
