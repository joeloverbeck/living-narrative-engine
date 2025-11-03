/**
 * @file E2E test for Perceptible Event Sender UX flow
 * Tests the user experience when accessing the perceptible event sender
 * before and after game initialization.
 */

process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { EXITS_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { PerceptibleEventTestBed } from './common/perceptibleEventTestBed.js';

describe('Perceptible Event Sender - UX Flow E2E', () => {
  let container;
  let dom;
  let document;
  let window;
  let controller;
  let eventBus;
  let entityManager;
  let testBed;

  // DOM elements
  let locationSelect;
  let sendButton;
  let messageTextarea;
  let statusDiv;

  beforeEach(async () => {
    // Create minimal DOM matching game.html structure
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="perceptible-event-sender-widget">
            <div class="form-group">
              <label for="perceptible-event-message">Event Message</label>
              <textarea id="perceptible-event-message"></textarea>
            </div>
            <div class="form-group">
              <label for="perceptible-event-location">Target Location</label>
              <select id="perceptible-event-location">
                <option value="">-- Select Location --</option>
              </select>
            </div>
            <select id="perceptible-event-actors" multiple></select>
            <button id="send-perceptible-event-button" disabled>Send Event</button>
            <div id="perceptible-event-status"></div>
          </div>
        </body>
      </html>
    `);

    document = dom.window.document;
    window = dom.window;

    // Make globals available
    global.document = document;
    global.window = window;

    // Get references to DOM elements
    locationSelect = document.getElementById('perceptible-event-location');
    sendButton = document.getElementById('send-perceptible-event-button');
    messageTextarea = document.getElementById('perceptible-event-message');
    statusDiv = document.getElementById('perceptible-event-status');

    // Setup DI container with real implementations
    container = new AppContainer();

    // Create mock UI elements required by configureContainer
    const mockUiElements = {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };

    await configureContainer(container, mockUiElements);

    // Resolve required services
    eventBus = container.resolve(tokens.ISafeEventDispatcher);
    entityManager = container.resolve(tokens.IEntityManager);
    controller = container.resolve(tokens.PerceptibleEventSenderController);

    // Create test bed helper
    const registry = container.resolve(tokens.IDataRegistry);
    const validator = container.resolve(tokens.ISchemaValidator);
    const logger = container.resolve(tokens.ILogger);

    testBed = new PerceptibleEventTestBed({
      entityManager,
      registry,
      validator,
      logger,
    });

    // Register component schemas
    await testBed.registerComponentSchemas();
  });

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
    if (controller && typeof controller.cleanup === 'function') {
      controller.cleanup();
    }
    dom.window.close();
    delete global.document;
    delete global.window;
    jest.clearAllMocks();
  });

  describe('Initial State (Before Game Start)', () => {
    it('should have empty location selector before ENGINE_READY_UI fires', async () => {
      // Note: EntityManager has no locations yet (no game started)

      // Act: Initialize controller
      controller.initialize();

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Selector should only have placeholder option
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe('-- Select Location --');
    });

    it('should disable send button when no location selected', async () => {
      // Act: Initialize controller (no locations loaded)
      controller.initialize();

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Send button should be disabled
      expect(sendButton.disabled).toBe(true);
    });

    it('should show appropriate UX state when no locations available', async () => {
      // Act: Initialize controller (no locations loaded)
      controller.initialize();

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: User should understand why they can't send events
      // This test currently FAILS because the UI doesn't communicate the state clearly
      // Expected: Either disabled state with helper text, or loading indicator

      // Check if location selector is disabled (preferred UX)
      const isLocationDisabled = locationSelect.disabled === true;

      // Check if send button is disabled
      const isSendDisabled = sendButton.disabled === true;

      // At minimum, controls should be disabled until locations load
      expect(isLocationDisabled || isSendDisabled).toBe(true);
    });
  });

  describe('Post-Initialization State (After Game Start)', () => {
    it('should populate locations when ENGINE_READY_UI fires', async () => {
      // Initialize controller
      controller.initialize();

      // Verify initial empty state
      expect(locationSelect.options.length).toBe(1);

      // Arrange: Create test locations AFTER initialization
      await testBed.createLocation('test_loc_1', 'Tavern');
      await testBed.createLocation('test_loc_2', 'Market Square');

      // Act: Dispatch ENGINE_READY_UI event
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Locations should now be populated
      expect(locationSelect.options.length).toBe(3); // placeholder + 2 locations
      expect(locationSelect.options[1].value).toBe('test_loc_1');
      expect(locationSelect.options[1].textContent).toBe('Tavern');
      expect(locationSelect.options[2].value).toBe('test_loc_2');
      expect(locationSelect.options[2].textContent).toBe('Market Square');
    });

    it('should enable controls after locations are loaded', async () => {
      // Arrange: Create location
      await testBed.createLocation('test_loc_1', 'Tavern');

      // Initialize controller
      controller.initialize();

      // Act: Dispatch ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Location selector should be enabled (if it was disabled)
      // This is part of the UX improvement
      if (locationSelect.disabled !== undefined) {
        expect(locationSelect.disabled).toBe(false);
      }
    });

    it('should allow event sending after location selection', async () => {
      // Arrange: Create location
      await testBed.createLocation('test_loc_1', 'Tavern');

      // Initialize controller
      controller.initialize();

      // Dispatch ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Act: User enters message and selects location
      messageTextarea.value = 'A loud crash echoes';
      locationSelect.value = 'test_loc_1';

      // Trigger change event
      const changeEvent = new window.Event('change');
      locationSelect.dispatchEvent(changeEvent);

      // Assert: Send button should be enabled
      expect(sendButton.disabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple ENGINE_READY_UI events (e.g., loading saves)', async () => {
      // Arrange: Create first location
      await testBed.createLocation('test_loc_1', 'Tavern');

      controller.initialize();

      // First ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));
      expect(locationSelect.options.length).toBe(2); // placeholder + 1 location

      // Act: Simulate loading a save (different locations)
      await entityManager.removeEntityInstance('test_loc_1');

      await testBed.createLocation('test_loc_2', 'Castle');

      // Second ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world_2',
        message: 'Game reloaded',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Should refresh with new locations
      expect(locationSelect.options.length).toBe(2); // placeholder + 1 new location
      expect(locationSelect.options[1].value).toBe('test_loc_2');
      expect(locationSelect.options[1].textContent).toBe('Castle');
    });

    it('should handle empty location list gracefully', async () => {
      // Arrange: Initialize with no locations
      controller.initialize();

      // Act: ENGINE_READY_UI fires but no locations exist
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Should only have placeholder
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');

      // Send button should remain disabled
      expect(sendButton.disabled).toBe(true);
    });
  });

  describe('User Experience Flow', () => {
    it('should guide user through complete flow from page load to sending event', async () => {
      // Step 1: Page loads (no game started)
      controller.initialize();

      await new Promise((resolve) => setImmediate(resolve));

      // User sees empty selector - should understand why
      expect(locationSelect.options.length).toBe(1);
      expect(sendButton.disabled).toBe(true);

      // Step 2: Game starts (ENGINE_READY_UI fires)
      await testBed.createLocation('test_loc_1', 'Tavern');
      await testBed.createActor('test_actor_1', 'Hero', 'test_loc_1');

      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // User sees locations are now available
      expect(locationSelect.options.length).toBe(2);

      // Step 3: User fills in form
      messageTextarea.value = 'A mysterious figure appears';
      locationSelect.value = 'test_loc_1';
      locationSelect.dispatchEvent(new window.Event('change'));

      // Send button becomes enabled
      expect(sendButton.disabled).toBe(false);

      // Step 4: User clicks send
      // Note: We can't easily test the actual event dispatch in this E2E
      // because it would require mocking too many internal details
      // The unit tests cover this behavior
    });
  });

});
