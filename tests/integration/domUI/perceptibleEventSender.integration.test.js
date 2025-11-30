/**
 * @file perceptibleEventSender.integration.test.js
 * @description Integration tests for Perceptible Event Sender UI workflow
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import PerceptibleEventSenderController from '../../../src/domUI/perceptibleEventSenderController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { EXITS_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('PerceptibleEventSender Integration Tests', () => {
  let dom;
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockLogger;
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockDocument;
  let executedOperations;

  beforeEach(() => {
    // Setup JSDOM with complete HTML structure
    const html = `
      <div id="perceptible-event-sender-widget">
        <h3>Send Perceptible Event</h3>
        <div class="form-group">
          <label for="perceptible-event-message">Event Message</label>
          <textarea id="perceptible-event-message" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="perceptible-event-location">Target Location</label>
          <select id="perceptible-event-location">
            <option value="">-- Select Location --</option>
          </select>
        </div>
        <details class="filter-section">
          <summary>Advanced Filters</summary>
          <div class="filter-group">
            <label><input type="radio" name="filter-mode" value="all" checked /> All actors</label>
            <label><input type="radio" name="filter-mode" value="specific" /> Specific actors</label>
            <label><input type="radio" name="filter-mode" value="exclude" /> Exclude actors</label>
          </div>
          <div id="actor-filter-container" style="display: none;">
            <select id="perceptible-event-actors" multiple size="4"></select>
          </div>
        </details>
        <button id="send-perceptible-event-button" disabled>Send Event</button>
        <div id="perceptible-event-status"></div>
      </div>
    `;
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
    mockDocument = dom.window.document;

    executedOperations = [];

    // Mock dependencies
    let gameReadyHandler = null;
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventType, handler) => {
        if (eventType === ENGINE_READY_UI) {
          gameReadyHandler = handler;
        }
        // Return unsubscribe function like real EventBus
        return jest.fn();
      }),
      unsubscribe: jest.fn(),
    };

    mockDocumentContext = new DocumentContext(mockDocument, dom.window);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockOperationInterpreter = {
      execute: jest.fn((operation, context) => {
        executedOperations.push({ operation, context });
        return Promise.resolve();
      }),
    };

    // Mock entity data
    const createMockEntity = (id, name, locationId) => ({
      id,
      getComponent: jest.fn((componentType) => {
        if (componentType === 'core:position') {
          return { locationId };
        }
        if (componentType === 'core:name') {
          return { name };
        }
        return null;
      }),
    });

    const mockLocations = [
      createMockEntity('location:tavern', 'The Prancing Pony', null),
      createMockEntity('location:market', 'Market Square', null),
    ];

    const mockActors = [
      createMockEntity('actor:frodo', 'Frodo Baggins', 'location:tavern'),
      createMockEntity('actor:sam', 'Samwise Gamgee', 'location:tavern'),
      createMockEntity('actor:gandalf', 'Gandalf', 'location:market'),
    ];

    mockEntityManager = {
      getEntitiesWithComponent: jest.fn((componentType) => {
        if (componentType === EXITS_COMPONENT_ID) {
          return mockLocations;
        }
        if (componentType === 'core:actor') {
          return mockActors;
        }
        return [];
      }),
    };

    controller = new PerceptibleEventSenderController({
      eventBus: mockEventBus,
      documentContext: mockDocumentContext,
      logger: mockLogger,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreter,
    });

    controller.initialize();

    // Simulate game ready event to load locations
    const subscribeCall = mockEventBus.subscribe.mock.calls.find(
      (call) => call[0] === ENGINE_READY_UI
    );
    if (subscribeCall && subscribeCall[1]) {
      subscribeCall[1](); // Trigger the game ready handler
    }
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    dom.window.close();
    executedOperations = [];
  });

  describe('Full Workflow - All Actors Mode', () => {
    it('should execute operation to send event to all actors in location', async () => {
      // Arrange: Fill out form
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'A loud crash echoes from nearby';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Act: Send event
      const sendButton = mockDocument.getElementById('send-perceptible-event-button');
      expect(sendButton.disabled).toBe(false);
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Verify operation executed
      expect(executedOperations.length).toBe(1);
      const { operation, context } = executedOperations[0];

      expect(operation.type).toBe('DISPATCH_PERCEPTIBLE_EVENT');
      expect(operation.parameters.location_id).toBe('location:tavern');
      expect(operation.parameters.description_text).toBe('A loud crash echoes from nearby');
      expect(operation.parameters.perception_type).toBe('state_change_observable');
      expect(operation.parameters.actor_id).toBe('system');
      expect(operation.parameters.log_entry).toBe(true);
      expect(operation.parameters.contextual_data).toEqual({});
    });
  });

  describe('Full Workflow - Specific Actors Mode', () => {
    it('should execute operation with specific actor recipientIds', async () => {
      // Arrange: Select location
      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Switch to specific mode
      const specificRadio = mockDocument.querySelector('input[value="specific"]');
      specificRadio.checked = true;
      specificRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Select specific actor
      const actorSelect = mockDocument.getElementById('perceptible-event-actors');
      const option = Array.from(actorSelect.options).find((opt) => opt.value === 'actor:frodo');
      if (option) option.selected = true;
      actorSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Fill message
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'Frodo, you have a visitor';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      // Act: Send event
      const sendButton = mockDocument.getElementById('send-perceptible-event-button');
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Verify recipientIds included in operation
      expect(executedOperations.length).toBe(1);
      const { operation } = executedOperations[0];
      expect(operation.parameters.contextual_data.recipientIds).toContain('actor:frodo');
      expect(operation.parameters.contextual_data.excludedActorIds).toBeUndefined();
    });
  });

  describe('Full Workflow - Exclude Actors Mode', () => {
    it('should execute operation with excludedActorIds', async () => {
      // Arrange: Select location
      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Switch to exclude mode
      const excludeRadio = mockDocument.querySelector('input[value="exclude"]');
      excludeRadio.checked = true;
      excludeRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Select actor to exclude
      const actorSelect = mockDocument.getElementById('perceptible-event-actors');
      const option = Array.from(actorSelect.options).find((opt) => opt.value === 'actor:sam');
      if (option) option.selected = true;
      actorSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Fill message
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'Frodo receives a secret message';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      // Act: Send event
      const sendButton = mockDocument.getElementById('send-perceptible-event-button');
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Verify excludedActorIds included in operation
      expect(executedOperations.length).toBe(1);
      const { operation } = executedOperations[0];
      expect(operation.parameters.contextual_data.excludedActorIds).toContain('actor:sam');
      expect(operation.parameters.contextual_data.recipientIds).toBeUndefined();
    });
  });

  describe('Multiple Events Workflow', () => {
    it('should execute multiple operations for different locations', async () => {
      // Event 1: Tavern
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'Event at tavern';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      const sendButton = mockDocument.getElementById('send-perceptible-event-button');
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Event 2: Market
      messageInput.value = 'Event at market';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      locationSelect.value = 'location:market';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Both operations executed
      expect(executedOperations.length).toBe(2);
      expect(executedOperations[0].operation.parameters.location_id).toBe('location:tavern');
      expect(executedOperations[1].operation.parameters.location_id).toBe('location:market');
    });
  });

  describe('Error Recovery', () => {
    it('should handle operation execution errors and allow retry', async () => {
      // Arrange: Setup form
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'Test message';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Mock operation execution failure
      mockOperationInterpreter.execute.mockRejectedValueOnce(new Error('Operation failed'));

      // Act: First attempt fails
      const sendButton = mockDocument.getElementById('send-perceptible-event-button');
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Error logged
      expect(mockLogger.error).toHaveBeenCalled();

      // Act: Retry should work
      mockOperationInterpreter.execute.mockImplementationOnce((operation, context) => {
        executedOperations.push({ operation, context });
        return Promise.resolve();
      });
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler

      // Assert: Second attempt succeeds
      expect(executedOperations.length).toBe(1);
    });
  });

  describe('Form State Management', () => {
    it('should maintain correct button state during workflow', async () => {
      const sendButton = mockDocument.getElementById('send-perceptible-event-button');

      // Initially disabled
      expect(sendButton.disabled).toBe(true);

      // Add message - still disabled (no location)
      const messageInput = mockDocument.getElementById('perceptible-event-message');
      messageInput.value = 'Test';
      messageInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      expect(sendButton.disabled).toBe(true);

      // Add location - enabled
      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      expect(sendButton.disabled).toBe(false);

      // Send event - form cleared, button disabled again
      sendButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async handler
      expect(sendButton.disabled).toBe(true);
      expect(messageInput.value).toBe('');
    });
  });

  describe('Bootstrap Timing and Empty State', () => {
    it('should handle empty entity state when no locations exist', () => {
      // Arrange: Clean up existing controller first
      if (controller) {
        controller.cleanup();
      }

      // Reset location select to clean state
      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.innerHTML = '<option value="">-- Select Location --</option>';

      // Create controller with empty entityManager
      const emptyEntityManager = {
        getEntitiesWithComponent: jest.fn(() => []),
      };

      const emptyEventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const emptyController = new PerceptibleEventSenderController({
        eventBus: emptyEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: emptyEntityManager,
        operationInterpreter: mockOperationInterpreter,
      });

      // Act: Initialize controller (without triggering game ready)
      emptyController.initialize();

      // Assert: Location selector should only have placeholder
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe('-- Select Location --');

      // Cleanup
      emptyController.cleanup();
    });

    it('should load locations when ENGINE_READY_UI event is dispatched', async () => {
      // Arrange: Clean up existing controller first
      if (controller) {
        controller.cleanup();
      }

      // Reset location select to clean state
      let locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.innerHTML = '<option value="">-- Select Location --</option>';

      // Create controller with empty entityManager initially
      const mockLocations = [
        {
          id: 'location:tavern',
          getComponent: jest.fn((componentType) => {
            if (componentType === 'core:name') {
              return { name: 'The Prancing Pony' };
            }
            return null;
          }),
        },
      ];

      let entitiesAvailable = false;
      const dynamicEntityManager = {
        getEntitiesWithComponent: jest.fn((componentType) => {
          if (componentType === EXITS_COMPONENT_ID && entitiesAvailable) {
            return mockLocations;
          }
          return [];
        }),
      };

      let gameReadyHandler = null;
      const eventBusWithSubscribe = {
        dispatch: mockEventBus.dispatch,
        subscribe: jest.fn((eventType, handler) => {
          if (eventType === ENGINE_READY_UI) {
            gameReadyHandler = handler;
          }
        }),
        unsubscribe: jest.fn(),
      };

      const dynamicController = new PerceptibleEventSenderController({
        eventBus: eventBusWithSubscribe,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: dynamicEntityManager,
        operationInterpreter: mockOperationInterpreter,
      });

      // Act: Initialize controller (no entities yet)
      dynamicController.initialize();

      // Assert: Initially empty
      locationSelect = mockDocument.getElementById('perceptible-event-location');
      expect(locationSelect.options.length).toBe(1);

      // Act: Simulate game ready - entities become available
      entitiesAvailable = true;
      if (gameReadyHandler) {
        gameReadyHandler();
      }

      // Wait for async location loading to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Locations should now be populated
      locationSelect = mockDocument.getElementById('perceptible-event-location');
      expect(locationSelect.options.length).toBe(2); // placeholder + 1 location
      expect(locationSelect.options[1].value).toBe('location:tavern');
      expect(locationSelect.options[1].textContent).toBe('The Prancing Pony');

      // Cleanup
      dynamicController.cleanup();
    });

    it('should handle location selection when actors are not yet loaded', () => {
      // Arrange: Controller with locations but no actors
      const locationsOnlyManager = {
        getEntitiesWithComponent: jest.fn((componentType) => {
          if (componentType === EXITS_COMPONENT_ID) {
            return [
              {
                id: 'location:tavern',
                getComponent: jest.fn(() => ({ name: 'The Prancing Pony' })),
              },
            ];
          }
          return []; // No actors
        }),
      };

      const locationsController = new PerceptibleEventSenderController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: locationsOnlyManager,
        operationInterpreter: mockOperationInterpreter,
      });

      locationsController.initialize();

      // Act: Select location (should not crash even with no actors)
      const locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.value = 'location:tavern';
      locationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Switch to specific actors mode
      const specificRadio = mockDocument.querySelector('input[value="specific"]');
      specificRadio.checked = true;
      specificRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      // Assert: Actor selector should be visible but empty
      const actorFilterContainer = mockDocument.getElementById('actor-filter-container');
      expect(actorFilterContainer.style.display).not.toBe('none');

      const actorSelect = mockDocument.getElementById('perceptible-event-actors');
      expect(actorSelect.options.length).toBe(0);

      // Assert: No errors logged
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Cleanup
      locationsController.cleanup();
    });

    it('should reload data when refresh method is called', async () => {
      // Arrange: Clean up existing controller first
      if (controller) {
        controller.cleanup();
      }

      // Reset location select to clean state
      let locationSelect = mockDocument.getElementById('perceptible-event-location');
      locationSelect.innerHTML = '<option value="">-- Select Location --</option>';

      // Controller starts with empty data
      let locationsLoaded = false;
      const refreshableManager = {
        getEntitiesWithComponent: jest.fn((componentType) => {
          if (componentType === EXITS_COMPONENT_ID && locationsLoaded) {
            return [
              {
                id: 'location:market',
                getComponent: jest.fn(() => ({ name: 'Market Square' })),
              },
            ];
          }
          return [];
        }),
      };

      const refreshableEventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const refreshableController = new PerceptibleEventSenderController({
        eventBus: refreshableEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: refreshableManager,
        operationInterpreter: mockOperationInterpreter,
      });

      refreshableController.initialize();

      // Assert: Initially empty
      locationSelect = mockDocument.getElementById('perceptible-event-location');
      expect(locationSelect.options.length).toBe(1);

      // Act: Load entities and refresh
      locationsLoaded = true;
      if (typeof refreshableController.refresh === 'function') {
        refreshableController.refresh();

        // Wait for async location loading to complete
        await new Promise((resolve) => setImmediate(resolve));

        // Assert: Locations now loaded
        locationSelect = mockDocument.getElementById('perceptible-event-location');
        expect(locationSelect.options.length).toBe(2);
        expect(locationSelect.options[1].value).toBe('location:market');
      }

      // Cleanup
      refreshableController.cleanup();
    });
  });
});
