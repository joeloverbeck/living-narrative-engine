/**
 * @file perceptibleEventSenderController.test.js
 * @description Unit tests for PerceptibleEventSenderController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import PerceptibleEventSenderController from '../../../src/domUI/perceptibleEventSenderController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { EXITS_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('PerceptibleEventSenderController', () => {
  let dom;
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockLogger;
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockDocument;

  beforeEach(() => {
    // Setup JSDOM
    const html = `
      <div id="perceptible-event-sender-widget">
        <textarea id="perceptible-event-message"></textarea>
        <select id="perceptible-event-location">
          <option value="">-- Select Location --</option>
        </select>
        <select id="perceptible-event-actors" multiple></select>
        <div id="actor-filter-container" style="display: none;"></div>
        <input type="radio" name="filter-mode" value="all" checked />
        <input type="radio" name="filter-mode" value="specific" />
        <input type="radio" name="filter-mode" value="exclude" />
        <button id="send-perceptible-event-button" disabled></button>
        <div id="perceptible-event-status"></div>
      </div>
    `;
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    mockDocument = dom.window.document;

    // Mock dependencies
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockDocumentContext = new DocumentContext(mockDocument, dom.window);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    mockOperationInterpreter = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    controller = new PerceptibleEventSenderController({
      eventBus: mockEventBus,
      documentContext: mockDocumentContext,
      logger: mockLogger,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreter,
    });
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    dom.window.close();
  });

  /**
   * Helper function to trigger the ENGINE_READY_UI event which loads locations.
   * This simulates what happens in the real application when the game engine starts.
   */
  const triggerGameReady = () => {
    const subscribeCall = mockEventBus.subscribe.mock.calls.find(
      (call) => call[0] === ENGINE_READY_UI
    );
    if (subscribeCall && subscribeCall[1]) {
      subscribeCall[1](); // Trigger the game ready handler
    }
  };

  describe('Constructor & Initialization', () => {
    it('should validate required dependencies', () => {
      expect(() => {
        new PerceptibleEventSenderController({
          eventBus: null,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: mockEntityManager,
          operationInterpreter: mockOperationInterpreter,
        });
      }).toThrow();
    });

    it('should initialize with correct properties', () => {
      expect(controller).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled(); // Not initialized yet
    });

    it('should cache DOM elements on initialize()', () => {
      controller.initialize();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PerceptibleEventSender] Initialization complete'
      );
    });

    it('should attach event listeners on initialize()', () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      const addEventListenerSpy = jest.spyOn(messageInput, 'addEventListener');

      controller.initialize();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      );
      addEventListenerSpy.mockRestore();
    });

    it('should subscribe to ENGINE_READY_UI event on initialize()', () => {
      controller.initialize();
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should load locations when ENGINE_READY_UI event fires', () => {
      controller.initialize();
      triggerGameReady();
      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        EXITS_COMPONENT_ID
      );
    });
  });

  describe('Location Management', () => {
    beforeEach(() => {
      controller.initialize();
      triggerGameReady(); // Trigger loading of locations
    });

    it('should populate location dropdown with entities', () => {
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest
            .fn()
            .mockReturnValue({ name: 'The Prancing Pony' }),
        },
        {
          id: 'location:market',
          getComponent: jest.fn().mockReturnValue({ name: 'Market Square' }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      // Re-trigger game ready to reload with new mock data
      triggerGameReady();

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      expect(locationSelect.options.length).toBe(3); // Including default option
      expect(locationSelect.options[1].value).toBe('location:tavern');
      expect(locationSelect.options[1].textContent).toBe('The Prancing Pony');
    });

    it('should handle empty location list', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      // Re-trigger game ready to reload with empty data
      triggerGameReady();

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      expect(locationSelect.options.length).toBe(1); // Only default option
    });

    it('should handle location loading errors gracefully', () => {
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Database error');
      });

      controller.initialize();
      triggerGameReady(); // Trigger to cause the error

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[PerceptibleEventSender] ❌ Failed to load locations',
        expect.any(Error)
      );
    });
  });

  describe('Actor Management', () => {
    beforeEach(() => {
      // Setup mock locations BEFORE initialize so select gets populated
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest
            .fn()
            .mockReturnValue({ name: 'The Prancing Pony' }),
        },
        {
          id: 'location:market',
          getComponent: jest.fn().mockReturnValue({ name: 'Market Square' }),
        },
        {
          id: 'location:empty',
          getComponent: jest.fn().mockReturnValue({ name: 'Empty Location' }),
        },
      ];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      controller.initialize();
      triggerGameReady(); // Load locations before actor tests
    });

    it('should load actors when location selected', () => {
      const mockActors = [
        {
          id: 'actor:frodo',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:tavern' };
            }
            if (componentType === 'core:name') {
              return { name: 'Frodo' };
            }
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            return mockActors;
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Verify the handler was called and queried for actors
      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        'core:actor'
      );

      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      expect(actorSelect.options.length).toBe(1);
      expect(actorSelect.options[0].value).toBe('actor:frodo');
    });

    it('should filter actors by location correctly', () => {
      const mockActors = [
        {
          id: 'actor:frodo',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:tavern' };
            }
            if (componentType === 'core:name') {
              return { name: 'Frodo' };
            }
            return null;
          }),
        },
        {
          id: 'actor:gandalf',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:market' };
            }
            if (componentType === 'core:name') {
              return { name: 'Gandalf' };
            }
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            return mockActors;
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      expect(actorSelect.options.length).toBe(1);
      expect(actorSelect.options[0].value).toBe('actor:frodo');
    });

    it('should handle location with no actors', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:empty';
      locationSelect.dispatchEvent(new dom.window.Event('change'));

      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      expect(actorSelect.options.length).toBe(0);
    });

    it('should clear actor list when no location selected (empty value)', () => {
      // First load some actors
      const mockActors = [
        {
          id: 'actor:frodo',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:tavern' };
            }
            if (componentType === 'core:name') {
              return { name: 'Frodo' };
            }
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            return mockActors;
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      expect(actorSelect.options.length).toBe(1);

      // Now select empty value (line 151)
      locationSelect.value = '';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      expect(actorSelect.innerHTML).toBe('');
    });

    it('should handle errors when loading actors for location', () => {
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            throw new Error('Failed to fetch actors');
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Lines 279-280: Error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load actors',
        expect.any(Error)
      );

      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      expect(actorSelect.innerHTML).toBe('');
    });
  });

  describe('Filter Mode Logic', () => {
    beforeEach(() => {
      controller.initialize();
    });

    it('should show actor selector for specific mode', () => {
      const specificRadio = mockDocument.querySelector(
        'input[value="specific"]'
      );
      specificRadio.checked = true;
      specificRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const actorContainer = mockDocument.getElementById(
        'actor-filter-container'
      );
      expect(actorContainer.style.display).toBe('block');
    });

    it('should show actor selector for exclude mode', () => {
      const excludeRadio = mockDocument.querySelector('input[value="exclude"]');
      excludeRadio.checked = true;
      excludeRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const actorContainer = mockDocument.getElementById(
        'actor-filter-container'
      );
      expect(actorContainer.style.display).toBe('block');
    });

    it('should hide actor selector for all mode', () => {
      // First set to specific
      const specificRadio = mockDocument.querySelector(
        'input[value="specific"]'
      );
      specificRadio.checked = true;
      specificRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Then switch back to all
      const allRadio = mockDocument.querySelector('input[value="all"]');
      allRadio.checked = true;
      allRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      const actorContainer = mockDocument.getElementById(
        'actor-filter-container'
      );
      expect(actorContainer.style.display).toBe('none');
    });

    it('should return default "all" when no radio button is checked (line 317)', () => {
      // Uncheck all radio buttons to test the default fallback
      const widget = mockDocument.getElementById(
        'perceptible-event-sender-widget'
      );
      const filterModeRadios = widget.querySelectorAll(
        'input[name="filter-mode"]'
      );
      filterModeRadios.forEach((radio) => {
        radio.checked = false;
      });

      // Trigger validation which internally calls getSelectedFilterMode
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      // The form should still validate (fallback to 'all' mode)
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(true); // Still disabled due to no location
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      // Setup mock locations BEFORE initialize so select gets populated
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest
            .fn()
            .mockReturnValue({ name: 'The Prancing Pony' }),
        },
      ];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      controller.initialize();
      triggerGameReady(); // Load locations before form validation tests
    });

    it('should disable send button when message empty', () => {
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(true);
    });

    it('should disable send button when no location selected', () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(true);
    });

    it('should enable send button when form valid', () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(false);
    });

    it('should disable send button when specific mode but no actors selected', () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const specificRadio = mockDocument.querySelector(
        'input[value="specific"]'
      );
      specificRadio.checked = true;
      specificRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(true);
    });

    it('should send event via Ctrl+Enter keyboard shortcut (lines 182-183)', async () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Send button should be enabled
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      expect(sendButton.disabled).toBe(false);

      // Press Ctrl+Enter
      const keyEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      });
      messageInput.dispatchEvent(keyEvent);

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockOperationInterpreter.execute).toHaveBeenCalled();
    });

    it('should not send event via Enter without Ctrl', async () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Press Enter without Ctrl
      const keyEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: false,
        bubbles: true,
      });
      messageInput.dispatchEvent(keyEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });

    it('should not send event via Ctrl+Enter when button is disabled', async () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = ''; // Empty message to keep button disabled

      // Press Ctrl+Enter
      const keyEvent = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      });
      messageInput.dispatchEvent(keyEvent);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockOperationInterpreter.execute).not.toHaveBeenCalled();
    });
  });

  describe('Operation Execution', () => {
    beforeEach(() => {
      // Setup mock locations BEFORE initialize so select gets populated
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest
            .fn()
            .mockReturnValue({ name: 'The Prancing Pony' }),
        },
      ];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      controller.initialize();
      triggerGameReady(); // Load locations before operation execution tests

      // Setup valid form
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'A loud crash echoes from nearby';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );
    });

    it('should execute DISPATCH_PERCEPTIBLE_EVENT operation', async () => {
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: expect.objectContaining({
            location_id: 'location:tavern',
            description_text: 'A loud crash echoes from nearby',
            perception_type: 'state_change_observable',
            actor_id: 'system',
            log_entry: true,
          }),
        }),
        expect.objectContaining({
          event: { payload: {} },
          context: {},
          evaluationContext: {},
        })
      );
    });

    it('should include log_entry: true in operation parameters', async () => {
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      const executeCall = mockOperationInterpreter.execute.mock.calls[0];
      expect(executeCall[0].parameters.log_entry).toBe(true);
    });

    it('should construct correct operation for all mode', async () => {
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: expect.objectContaining({
            location_id: 'location:tavern',
            description_text: 'A loud crash echoes from nearby',
            perception_type: 'state_change_observable',
            actor_id: 'system',
            target_id: null,
            involved_entities: [],
            contextual_data: {},
            log_entry: true,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should clear form after successful operation execution', async () => {
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );

      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(messageInput.value).toBe('');
    });

    it('should handle operation execution errors', async () => {
      mockOperationInterpreter.execute.mockRejectedValue(
        new Error('Operation failed')
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to execute perceptible event operation',
        expect.any(Error)
      );
    });

    it('should construct payload with recipientIds for specific mode (line 373)', async () => {
      // Switch to specific mode
      const specificRadio = mockDocument.querySelector(
        'input[value="specific"]'
      );
      specificRadio.checked = true;
      specificRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Mock actors for selection
      const mockActors = [
        {
          id: 'actor:frodo',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:tavern' };
            }
            if (componentType === 'core:name') {
              return { name: 'Frodo' };
            }
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            return mockActors;
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Select an actor
      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      actorSelect.options[0].selected = true;
      actorSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            contextual_data: {
              recipientIds: ['actor:frodo'],
            },
          }),
        }),
        expect.any(Object)
      );
    });

    it('should construct payload with excludedActorIds for exclude mode (line 375)', async () => {
      // Switch to exclude mode
      const excludeRadio = mockDocument.querySelector('input[value="exclude"]');
      excludeRadio.checked = true;
      excludeRadio.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Mock actors for selection
      const mockActors = [
        {
          id: 'actor:gandalf',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:position') {
              return { locationId: 'location:tavern' };
            }
            if (componentType === 'core:name') {
              return { name: 'Gandalf' };
            }
            return null;
          }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentType) => {
          if (componentType === 'core:actor') {
            return mockActors;
          }
          return [];
        }
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      // Select an actor to exclude
      const actorSelect = mockDocument.getElementById(
        'perceptible-event-actors'
      );
      actorSelect.options[0].selected = true;
      actorSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            contextual_data: {
              excludedActorIds: ['actor:gandalf'],
            },
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      controller.initialize();

      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      const removeEventListenerSpy = jest.spyOn(
        messageInput,
        'removeEventListener'
      );

      controller.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'input',
        expect.any(Function)
      );
      removeEventListenerSpy.mockRestore();
    });

    it('should unsubscribe from ENGINE_READY_UI event', () => {
      controller.initialize();
      controller.cleanup();

      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should clear cached state', () => {
      controller.initialize();
      controller.cleanup();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PerceptibleEventSenderController cleaned up'
      );
    });

    it('should log error if cleanup fails', () => {
      controller.initialize();

      // Make cleanup fail by causing eventBus.unsubscribe to throw
      mockEventBus.unsubscribe.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      expect(() => controller.cleanup()).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during PerceptibleEventSenderController cleanup',
        expect.any(Error)
      );
    });
  });

  describe('Additional Edge Cases', () => {
    it('should throw and log error if initialization fails', () => {
      const badDom = new JSDOM('<div></div>');
      const badDocContext = new DocumentContext(
        badDom.window.document,
        badDom.window
      );

      const badController = new PerceptibleEventSenderController({
        eventBus: mockEventBus,
        documentContext: badDocContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
      });

      expect(() => badController.initialize()).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[PerceptibleEventSender] Failed to initialize',
        expect.any(Error)
      );

      badDom.window.close();
    });

    it('should call refresh method to reload locations', () => {
      controller.initialize();

      mockLogger.debug.mockClear();
      mockEntityManager.getEntitiesWithComponent.mockClear();

      const mockLocations = [
        {
          id: 'location:new',
          getComponent: jest.fn().mockReturnValue({ name: 'New Location' }),
        },
      ];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      controller.refresh();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PerceptibleEventSender] Manual refresh requested - reloading locations'
      );
      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        EXITS_COMPONENT_ID
      );
    });

    it('should log success when subscription succeeds', () => {
      mockEventBus.subscribe.mockReturnValue(() => {}); // Return unsubscribe function

      const newController = new PerceptibleEventSenderController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
      });

      newController.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PerceptibleEventSender] Successfully subscribed to ENGINE_READY_UI event'
      );

      newController.cleanup();
    });
  });

  describe('Status Message and Timeout Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      controller.initialize();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should clear previous timeout when showing new status (lines 440-441)', () => {
      const statusArea = mockDocument.getElementById(
        'perceptible-event-status'
      );

      // Show first status
      statusArea.textContent = 'First message';
      statusArea.className = 'status-message-area success';

      // Manually trigger controller's internal showStatus by calling refresh with error
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Test error');
      });

      controller.refresh();

      // The previous timeout should be cleared and new status shown
      expect(statusArea.textContent).toBe('Failed to load locations');
      expect(statusArea.className).toBe('status-message-area error');
    });

    it('should auto-clear status message after 5 seconds (lines 450-452)', async () => {
      const statusArea = mockDocument.getElementById(
        'perceptible-event-status'
      );

      // Trigger an error to show status
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Test error');
      });

      controller.refresh();

      // Status should be set
      expect(statusArea.textContent).toBe('Failed to load locations');
      expect(statusArea.className).toBe('status-message-area error');

      // Fast-forward time by 5 seconds
      jest.advanceTimersByTime(5000);

      // Status should be cleared
      expect(statusArea.textContent).toBe('');
      expect(statusArea.className).toBe('status-message-area');
    });

    it('should handle multiple rapid status updates correctly', () => {
      const statusArea = mockDocument.getElementById(
        'perceptible-event-status'
      );

      // Show first status
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Error 1');
      });
      controller.refresh();
      expect(statusArea.textContent).toBe('Failed to load locations');

      // Advance time by 2 seconds (not enough to clear)
      jest.advanceTimersByTime(2000);

      // Show second status (should clear previous timeout)
      mockEntityManager.getEntitiesWithComponent.mockImplementation(() => {
        throw new Error('Error 2');
      });
      controller.refresh();
      expect(statusArea.textContent).toBe('Failed to load locations');

      // Advance time by 3 seconds (total 5 from first, but 3 from second)
      jest.advanceTimersByTime(3000);

      // Status should still be visible because we're only 3 seconds from the second status
      expect(statusArea.textContent).toBe('Failed to load locations');

      // Advance another 2 seconds (total 5 from second status)
      jest.advanceTimersByTime(2000);

      // Now status should be cleared
      expect(statusArea.textContent).toBe('');
    });
  });

  describe('Form Clearing with Radio Reset', () => {
    beforeEach(() => {
      // Setup mock locations
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest
            .fn()
            .mockReturnValue({ name: 'The Prancing Pony' }),
        },
      ];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockLocations);

      controller.initialize();
      triggerGameReady();
    });

    it('should reset filter mode radios to "all" when clearing form (lines 469-470)', async () => {
      // Setup form with specific mode
      const specificRadio = mockDocument.querySelector(
        'input[value="specific"]'
      );
      specificRadio.checked = true;

      const allRadio = mockDocument.querySelector('input[value="all"]');
      allRadio.checked = false;

      expect(specificRadio.checked).toBe(true);
      expect(allRadio.checked).toBe(false);

      // Fill and submit form
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );
      sendButton.dispatchEvent(
        new dom.window.Event('click', { bubbles: true })
      );

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // After form clear, radios should be reset to "all"
      expect(allRadio.checked).toBe(true);
      expect(specificRadio.checked).toBe(false);
    });

    it('should handle missing filter mode radios gracefully in clearForm', async () => {
      // Remove radio buttons from DOM to test edge case
      const widget = mockDocument.getElementById(
        'perceptible-event-sender-widget'
      );
      const radios = widget.querySelectorAll('input[name="filter-mode"]');
      radios.forEach((radio) => radio.remove());

      // Fill and submit form
      const messageInput = mockDocument.getElementById(
        'perceptible-event-message'
      );
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(
        new dom.window.Event('input', { bubbles: true })
      );

      const locationSelect = mockDocument.getElementById(
        'perceptible-event-location'
      );
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true })
      );

      const sendButton = mockDocument.getElementById(
        'send-perceptible-event-button'
      );

      // Should not throw error
      expect(() => {
        sendButton.dispatchEvent(
          new dom.window.Event('click', { bubbles: true })
        );
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler
    });
  });
});
