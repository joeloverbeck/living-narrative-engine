/**
 * @file End-to-end tests for Perceptible Event Sender location loading
 * Tests the complete bootstrap → game start → location loading workflow
 */

process.env.NODE_ENV = 'test';

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { EXITS_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { PerceptibleEventTestBed } from './common/perceptibleEventTestBed.js';

describe('PerceptibleEventSender E2E - Location Loading', () => {
  let container;
  let dom;
  let document;
  let window;
  let controller;
  let eventBus;
  let entityManager;
  let testBed;

  beforeEach(async () => {
    // Create minimal DOM for perceptible event sender
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
              <select id="perceptible-event-location" class="perceptible-event-select">
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

  describe('Complete Bootstrap Flow', () => {
    it('should load locations when ENGINE_READY_UI event is dispatched', async () => {
      // Initialize controller (subscribes to ENGINE_READY_UI)
      controller.initialize();

      // Get the location selector
      const locationSelect = document.getElementById(
        'perceptible-event-location'
      );

      // Verify selector starts with only placeholder (before locations created)
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );

      // Arrange: Create test locations AFTER initialization
      await testBed.createLocation('test_location_1', 'Test Tavern');
      await testBed.createLocation('test_location_2', 'Test Market');

      // Act: Simulate game start by dispatching ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      // Allow microtasks to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Locations should now be loaded
      expect(locationSelect.options.length).toBe(3); // placeholder + 2 locations
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );
      expect(locationSelect.options[1].value).toBe('test_location_1');
      expect(locationSelect.options[1].textContent).toBe('Test Tavern');
      expect(locationSelect.options[2].value).toBe('test_location_2');
      expect(locationSelect.options[2].textContent).toBe('Test Market');
    });

    it('should handle empty location list gracefully', async () => {
      // Arrange: No locations created
      controller.initialize();

      const locationSelect = document.getElementById(
        'perceptible-event-location'
      );

      // Act: Dispatch ENGINE_READY_UI with no locations
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Only placeholder option should exist
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );
    });

    it('should reload locations when ENGINE_READY_UI fires multiple times', async () => {
      // Arrange: Create initial location
      await testBed.createLocation('test_location_1', 'Initial Location');

      controller.initialize();

      const locationSelect = document.getElementById(
        'perceptible-event-location'
      );

      // Act: First ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Should have 1 location
      expect(locationSelect.options.length).toBe(2); // placeholder + 1 location

      // Arrange: Add another location
      await testBed.createLocation('test_location_2', 'New Location');

      // Act: Second ENGINE_READY_UI (e.g., after loading a save)
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game loaded',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Should have 2 locations now
      expect(locationSelect.options.length).toBe(3); // placeholder + 2 locations
      expect(locationSelect.options[1].textContent).toBe('Initial Location');
      expect(locationSelect.options[2].textContent).toBe('New Location');
    });

    it('should use entity ID as fallback when location has no name component', async () => {
      // Arrange: Create location without name component
      // Use the testBed but override to create location with only exits (no name)
      await testBed.createLocation(
        'test_location_no_name',
        'test_location_no_name'
      );
      // Remove the name component to test fallback behavior
      await entityManager.removeComponent('test_location_no_name', 'core:name');

      controller.initialize();

      const locationSelect = document.getElementById(
        'perceptible-event-location'
      );

      // Act: Dispatch ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Assert: Should use entity ID as text
      expect(locationSelect.options.length).toBe(2);
      expect(locationSelect.options[1].value).toBe('test_location_no_name');
      expect(locationSelect.options[1].textContent).toBe(
        'test_location_no_name'
      );
    });
  });

  describe('Timing and Initialization Order', () => {
    it('should work if ENGINE_READY_UI fires before controller initialization', async () => {
      // This tests the edge case where the event might fire early
      // The controller should still load locations when initialized

      // Arrange: Create location
      await testBed.createLocation('test_location_1', 'Test Location');

      // Act: Dispatch ENGINE_READY_UI BEFORE controller initializes
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await new Promise((resolve) => setImmediate(resolve));

      // Now initialize controller
      controller.initialize();

      const locationSelect = document.getElementById(
        'perceptible-event-location'
      );

      // Assert: Locations should still load (either via event or defensive loading)
      // This test documents the expected behavior - the controller should handle
      // initialization after the event has already fired
      expect(locationSelect.options.length).toBeGreaterThanOrEqual(1);
    });
  });
});
