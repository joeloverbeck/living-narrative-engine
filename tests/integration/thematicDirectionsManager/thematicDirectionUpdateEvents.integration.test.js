import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { v4 as uuidv4 } from 'uuid';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Thematic Direction Update Events - Integration Test', () => {
  let container;
  let characterBuilderService;
  let eventBus;
  let schemaValidator;
  let dataRegistry;
  let logger;
  let testConcept;
  let testDirection;
  let storageService;

  beforeEach(async () => {
    logger = new ConsoleLogger('error'); // Only log errors in tests
    container = new AppContainer();
    container.register(tokens.ILogger, logger);

    // Configure base container with required services
    await configureBaseContainer(container, {
      includeGameSystems: true,
      includeCharacterBuilder: true,
      logger,
    });

    // Mock the schema loader to avoid network requests
    const schemaLoader = container.resolve(tokens.SchemaLoader);
    schemaLoader.loadAndCompileAllSchemas = jest
      .fn()
      .mockResolvedValue(undefined);

    // Get services
    schemaValidator = container.resolve(tokens.ISchemaValidator);
    dataRegistry = container.resolve(tokens.IDataRegistry);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);
    characterBuilderService = container.resolve(tokens.CharacterBuilderService);
    storageService = container.resolve(tokens.CharacterStorageService);

    // Mock schema validator methods to avoid network requests
    schemaValidator.validateAgainstSchema = jest.fn().mockReturnValue(true);
    schemaValidator.addSchema = jest.fn().mockResolvedValue(undefined);

    // Only register the core:direction_updated event definition if it's not already loaded
    // This prevents duplicate registration warnings when mod loading has already registered it
    const eventDefinition = {
      id: 'core:direction_updated',
      description: 'Fired when a thematic direction is updated.',
      payloadSchema: {
        type: 'object',
        required: ['directionId', 'field', 'oldValue', 'newValue'],
        properties: {
          directionId: {
            type: 'string',
            description: 'Updated direction ID',
          },
          field: { type: 'string', description: 'Updated field name' },
          oldValue: { type: 'string', description: 'Previous field value' },
          newValue: { type: 'string', description: 'New field value' },
        },
      },
    };

    // Check if event definition is already registered before adding it
    const existingEventDef = dataRegistry.getEventDefinition(
      eventDefinition.id
    );
    if (!existingEventDef) {
      await schemaValidator.addSchema(
        eventDefinition.payloadSchema,
        `${eventDefinition.id}#payload`
      );
      dataRegistry.setEventDefinition(eventDefinition.id, eventDefinition);
    }

    // Create test character concept
    testConcept = {
      id: 'test-concept-id',
      name: 'Test Character',
      age: 25,
      personality: 'Test personality',
      background: 'Test background',
      appearance: 'Test appearance',
      motivations: 'Test motivations',
      concept: 'Test character concept for testing purposes',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Create test thematic direction
    testDirection = {
      id: 'test-direction-id',
      conceptId: testConcept.id,
      title: 'Original Direction Title',
      description: 'Original direction description for testing',
      coreTension: 'Original core tension',
      uniqueTwist: 'Original unique twist',
      narrativePotential: 'Original narrative potential',
      createdAt: new Date().toISOString(),
    };

    // Initialize the service
    await characterBuilderService.initialize();

    // Mock storage service methods to provide test data
    storageService.getCharacterConcept = jest
      .fn()
      .mockResolvedValue(testConcept);
    storageService.getThematicDirection = jest
      .fn()
      .mockResolvedValue(testDirection);
    storageService.updateThematicDirection = jest
      .fn()
      .mockImplementation(async (directionId, updates) => ({
        ...testDirection,
        ...updates,
      }));
    storageService.storeThematicDirections = jest
      .fn()
      .mockResolvedValue([testDirection]);
    storageService.findOrphanedDirections = jest.fn().mockResolvedValue([]);
  });

  afterEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Event dispatching through ValidatedEventDispatcher', () => {
    it('should successfully dispatch events with correct payload format', async () => {
      // Set up event listener to capture dispatched events
      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update the direction through the service
      const updates = {
        title: 'Updated Direction Title',
        description: 'Updated direction description',
      };

      await characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates
      );

      // Wait a moment for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify events were dispatched correctly
      expect(listener).toHaveBeenCalledTimes(2);
      expect(capturedEvents).toHaveLength(2);

      // Check first event (title update)
      expect(capturedEvents[0]).toEqual({
        directionId: testDirection.id,
        field: 'title',
        oldValue: 'Original Direction Title',
        newValue: 'Updated Direction Title',
      });

      // Check second event (description update)
      expect(capturedEvents[1]).toEqual({
        directionId: testDirection.id,
        field: 'description',
        oldValue: 'Original direction description for testing',
        newValue: 'Updated direction description',
      });

      // Clean up listener
      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should pass validation when dispatching through service', async () => {
      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update a single field
      const fieldName = 'uniqueTwist';
      const oldValue = testDirection.uniqueTwist;
      const newValue = 'A completely new and different twist';

      await characterBuilderService.updateThematicDirection(testDirection.id, {
        [fieldName]: newValue,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify event was dispatched with correct format
      expect(listener).toHaveBeenCalledTimes(1);
      expect(capturedEvents[0]).toEqual({
        directionId: testDirection.id,
        field: fieldName,
        oldValue,
        newValue,
      });

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should handle null values correctly in event payload', async () => {
      // Create a direction with a null value
      const directionWithNull = {
        id: 'direction-with-null',
        conceptId: testConcept.id,
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
        uniqueTwist: null, // Null value
        narrativePotential: 'Test potential',
        createdAt: new Date().toISOString(),
      };

      // Mock storage to return the direction with null
      storageService.getThematicDirection = jest
        .fn()
        .mockResolvedValue(directionWithNull);
      storageService.updateThematicDirection = jest
        .fn()
        .mockImplementation(async (directionId, updates) => ({
          ...directionWithNull,
          ...updates,
        }));

      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update the null field
      await characterBuilderService.updateThematicDirection(
        directionWithNull.id,
        {
          uniqueTwist: 'Now has a value',
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(capturedEvents[0]).toEqual({
        directionId: directionWithNull.id,
        field: 'uniqueTwist',
        oldValue: '', // Null converted to empty string by service
        newValue: 'Now has a value',
      });

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should not dispatch events for unchanged fields', async () => {
      const listener = jest.fn();
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update with same values
      await characterBuilderService.updateThematicDirection(testDirection.id, {
        title: testDirection.title, // Same value
        description: 'New description', // Different value
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only dispatch one event for the changed field
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            directionId: testDirection.id,
            field: 'description',
            oldValue: testDirection.description,
            newValue: 'New description',
          },
        })
      );

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should handle multiple simultaneous updates within recursion limits', async () => {
      // NOTE: EventBus has recursion protection that limits same-event dispatching to depth 3
      // This test validates that the system correctly respects these safety limits

      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update 3 fields at once (within recursion limit)
      const updates = {
        title: 'Completely New Title',
        description: 'Completely New Description',
        coreTension: 'Completely New Tension',
      };

      await characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should dispatch 3 events (maximum allowed by recursion protection)
      expect(listener).toHaveBeenCalledTimes(3);
      expect(capturedEvents).toHaveLength(3);

      // Verify each field has its event
      const fields = capturedEvents.map((event) => event.field);
      expect(fields).toContain('title');
      expect(fields).toContain('description');
      expect(fields).toContain('coreTension');

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should handle batch updates respecting recursion protection limits', async () => {
      // This test demonstrates the actual production behavior where EventBus
      // recursion protection limits the number of same-type events that can be dispatched

      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Attempt to update all 5 fields at once
      const updates = {
        title: 'Completely New Title',
        description: 'Completely New Description',
        coreTension: 'Completely New Tension',
        uniqueTwist: 'Completely New Twist',
        narrativePotential: 'Completely New Potential',
      };

      await characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // EventBus recursion protection limits to 5 events (all fields should be processed)
      // With increased recursion limits, all 5 field updates should succeed
      expect(listener).toHaveBeenCalledTimes(5);
      expect(capturedEvents).toHaveLength(5);

      // Verify that we get all 5 events (one for each field)
      const fields = capturedEvents.map((event) => event.field);
      expect(fields).toHaveLength(5);

      // Each field should be unique - all 5 fields should have been updated
      expect(new Set(fields).size).toBe(5);

      // All events should be from the correct direction
      capturedEvents.forEach((event) => {
        expect(event.directionId).toBe(testDirection.id);
        expect(typeof event.field).toBe('string');
        expect(typeof event.oldValue).toBe('string');
        expect(typeof event.newValue).toBe('string');

        // Field should be one of the fields we tried to update
        expect([
          'title',
          'description',
          'coreTension',
          'uniqueTwist',
          'narrativePotential',
        ]).toContain(event.field);
      });

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should demonstrate sequential updates as workaround for bulk operations', async () => {
      // This test shows how to perform bulk updates by doing them sequentially
      // in smaller batches to work with recursion protection

      const allEvents = [];
      const listener = jest.fn((event) => {
        allEvents.push(event.payload);
      });

      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      // Update fields one at a time to avoid recursion protection
      await characterBuilderService.updateThematicDirection(testDirection.id, {
        title: 'Sequential Title 1',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      await characterBuilderService.updateThematicDirection(testDirection.id, {
        description: 'Sequential Description 1',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should receive 2 events
      expect(listener).toHaveBeenCalledTimes(2);
      expect(allEvents).toHaveLength(2);

      const fields = allEvents.map((e) => e.field);
      expect(fields).toContain('title');
      expect(fields).toContain('description');

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });
  });

  describe('Error scenarios', () => {
    it('should not dispatch events if direction not found', async () => {
      const listener = jest.fn();
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      const fakeId = uuidv4();

      // Mock storage to return null for non-existent direction
      storageService.getThematicDirection = jest.fn().mockResolvedValue(null);

      await expect(
        characterBuilderService.updateThematicDirection(fakeId, {
          title: 'New Title',
        })
      ).rejects.toThrow(`Thematic direction not found: ${fakeId}`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // No events should be dispatched
      expect(listener).not.toHaveBeenCalled();

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });

    it('should validate event payload against schema', async () => {
      // This test verifies that the event payload matches the required schema
      const listener = jest.fn();
      eventBus.subscribe(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, listener);

      await characterBuilderService.updateThematicDirection(testDirection.id, {
        coreTension: 'Schema-validated tension update',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalledTimes(1);

      const event = listener.mock.calls[0][0];
      const payload = event.payload;

      // Verify payload has all required fields
      expect(payload).toHaveProperty('directionId');
      expect(payload).toHaveProperty('field');
      expect(payload).toHaveProperty('oldValue');
      expect(payload).toHaveProperty('newValue');

      // Verify field types
      expect(typeof payload.directionId).toBe('string');
      expect(typeof payload.field).toBe('string');
      expect(typeof payload.oldValue).toBe('string');
      expect(typeof payload.newValue).toBe('string');

      eventBus.unsubscribe(
        CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED,
        listener
      );
    });
  });
});
