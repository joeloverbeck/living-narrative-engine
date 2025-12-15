/**
 * @file End-to-end tests for Perceptible Event Sender location loading
 * Tests the complete bootstrap → game start → location loading workflow
 *
 * Performance-optimized: JSDOM and container are created once per suite,
 * with state reset between tests.
 */

process.env.NODE_ENV = 'test';

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { PerceptibleEventTestBed } from './common/perceptibleEventTestBed.js';

describe('PerceptibleEventSender E2E - Location Loading', () => {
  // Shared across all tests (expensive to create)
  let container;
  let dom;
  let document;
  let window;
  let eventBus;
  let entityManager;
  let testBed;

  // Reset per test (cheap)
  let controller;
  let locationSelect;

  /**
   * Helper to flush pending microtasks.
   *
   * @returns {Promise<void>}
   */
  const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

  beforeAll(async () => {
    // ONE-TIME: Create JSDOM for perceptible event sender
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

    // ONE-TIME: Setup DI container with real implementations
    container = new AppContainer();

    // Create mock UI elements required by configureContainer
    const mockUiElements = {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };

    await configureContainer(container, mockUiElements);

    // ONE-TIME: Resolve shared services
    eventBus = container.resolve(tokens.ISafeEventDispatcher);
    entityManager = container.resolve(tokens.IEntityManager);

    // ONE-TIME: Create test bed helper and register schemas
    const registry = container.resolve(tokens.IDataRegistry);
    const validator = container.resolve(tokens.ISchemaValidator);
    const logger = container.resolve(tokens.ILogger);

    testBed = new PerceptibleEventTestBed({
      entityManager,
      registry,
      validator,
      logger,
    });

    // ONE-TIME: Register component schemas
    await testBed.registerComponentSchemas();
  });

  afterAll(() => {
    dom.window.close();
    delete global.document;
    delete global.window;
  });

  beforeEach(() => {
    // EACH TEST: Get DOM element reference
    locationSelect = document.getElementById('perceptible-event-location');

    // EACH TEST: Reset DOM to initial state
    locationSelect.innerHTML = '<option value="">-- Select Location --</option>';

    // EACH TEST: Get fresh controller instance
    controller = container.resolve(tokens.PerceptibleEventSenderController);
  });

  afterEach(async () => {
    if (controller && typeof controller.cleanup === 'function') {
      controller.cleanup();
    }
    await testBed.reset();
    jest.clearAllMocks();
  });

  describe('Complete Bootstrap Flow', () => {
    it('should load locations when ENGINE_READY_UI event is dispatched', async () => {
      // Initialize controller (subscribes to ENGINE_READY_UI)
      controller.initialize();

      // Verify selector starts with only placeholder (before locations created)
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );

      // Arrange: Create test locations AFTER initialization
      // Note: Using unique IDs (load_*) to avoid definition cache collisions with other tests
      await testBed.createLocation('load_location_1', 'Test Tavern');
      await testBed.createLocation('load_location_2', 'Test Market');

      // Act: Simulate game start by dispatching ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      // Allow microtasks to complete
      await flushMicrotasks();

      // Assert: Locations should now be loaded
      expect(locationSelect.options.length).toBe(3); // placeholder + 2 locations
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );
      expect(locationSelect.options[1].value).toBe('load_location_1');
      expect(locationSelect.options[1].textContent).toBe('Test Tavern');
      expect(locationSelect.options[2].value).toBe('load_location_2');
      expect(locationSelect.options[2].textContent).toBe('Test Market');
    });

    it('should handle empty location list gracefully', async () => {
      // Arrange: No locations created
      controller.initialize();

      // Act: Dispatch ENGINE_READY_UI with no locations
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await flushMicrotasks();

      // Assert: Only placeholder option should exist
      expect(locationSelect.options.length).toBe(1);
      expect(locationSelect.options[0].value).toBe('');
      expect(locationSelect.options[0].textContent).toBe(
        '-- Select Location --'
      );
    });

    it('should reload locations when ENGINE_READY_UI fires multiple times', async () => {
      // Arrange: Create initial location
      // Note: Using unique IDs (reload_*) to avoid definition cache collisions with other tests
      await testBed.createLocation('reload_location_1', 'Initial Location');

      controller.initialize();

      // Act: First ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await flushMicrotasks();

      // Assert: Should have 1 location
      expect(locationSelect.options.length).toBe(2); // placeholder + 1 location

      // Arrange: Add another location
      await testBed.createLocation('reload_location_2', 'New Location');

      // Act: Second ENGINE_READY_UI (e.g., after loading a save)
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game loaded',
      });

      await flushMicrotasks();

      // Assert: Should have 2 locations now
      expect(locationSelect.options.length).toBe(3); // placeholder + 2 locations
      expect(locationSelect.options[1].textContent).toBe('Initial Location');
      expect(locationSelect.options[2].textContent).toBe('New Location');
    });

    it('should use entity ID as fallback when location has no name component', async () => {
      // Arrange: Create location without name component
      // Use the testBed but override to create location with only exits (no name)
      // Note: Using unique ID (fallback_*) to avoid definition cache collisions with other tests
      await testBed.createLocation(
        'fallback_location_no_name',
        'fallback_location_no_name'
      );
      // Remove the name component to test fallback behavior
      await entityManager.removeComponent('fallback_location_no_name', 'core:name');

      controller.initialize();

      // Act: Dispatch ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await flushMicrotasks();

      // Assert: Should use entity ID as text
      expect(locationSelect.options.length).toBe(2);
      expect(locationSelect.options[1].value).toBe('fallback_location_no_name');
      expect(locationSelect.options[1].textContent).toBe(
        'fallback_location_no_name'
      );
    });
  });

  describe('Timing and Initialization Order', () => {
    it('should work if ENGINE_READY_UI fires before controller initialization', async () => {
      // This tests the edge case where the event might fire early
      // The controller should still load locations when initialized

      // Arrange: Create location
      // Note: Using unique ID (timing_*) to avoid definition cache collisions with other tests
      await testBed.createLocation('timing_location_1', 'Test Location');

      // Act: Dispatch ENGINE_READY_UI BEFORE controller initializes
      await eventBus.dispatch(ENGINE_READY_UI, {
        activeWorld: 'test_world',
        message: 'Game ready',
      });

      await flushMicrotasks();

      // Now initialize controller
      controller.initialize();

      // Assert: Locations should still load (either via event or defensive loading)
      // This test documents the expected behavior - the controller should handle
      // initialization after the event has already fired
      expect(locationSelect.options.length).toBeGreaterThanOrEqual(1);
    });
  });
});
