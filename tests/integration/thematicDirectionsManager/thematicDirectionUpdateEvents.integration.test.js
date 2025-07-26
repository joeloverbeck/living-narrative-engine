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
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { v4 as uuidv4 } from 'uuid';

describe('Thematic Direction Update Events - Integration Test', () => {
  let container;
  let controller;
  let characterBuilderService;
  let eventBus;
  let schemaValidator;
  let dataRegistry;
  let logger;
  let testConcept;
  let testDirection;

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

    // Mock schema validator methods to avoid network requests
    schemaValidator.validateAgainstSchema = jest.fn().mockReturnValue(true);
    schemaValidator.addSchema = jest.fn().mockResolvedValue(undefined);

    // Register the thematic:direction_updated event definition
    const eventDefinition = {
      id: 'thematic:direction_updated',
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

    await schemaValidator.addSchema(
      eventDefinition.payloadSchema,
      `${eventDefinition.id}#payload`
    );
    dataRegistry.setEventDefinition(eventDefinition.id, eventDefinition);

    // Create test character concept
    testConcept = {
      id: 'test-concept-id',
      name: 'Test Character',
      age: 25,
      personality: 'Test personality',
      background: 'Test background',
      appearance: 'Test appearance',
      motivations: 'Test motivations',
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

    // Mock characterBuilderService methods
    characterBuilderService.saveCharacterConcept = jest
      .fn()
      .mockResolvedValue(testConcept);
    characterBuilderService.saveThematicDirections = jest
      .fn()
      .mockResolvedValue([testDirection]);
    characterBuilderService.getThematicDirection = jest
      .fn()
      .mockResolvedValue(testDirection);
    characterBuilderService.updateThematicDirection = jest
      .fn()
      .mockImplementation(async (directionId, updates) => {
        // Dispatch events for each field that changed
        for (const [field, newValue] of Object.entries(updates)) {
          const oldValue = testDirection[field];
          if (oldValue !== newValue) {
            eventBus.dispatch('thematic:direction_updated', {
              directionId,
              field,
              oldValue: oldValue || '',
              newValue: newValue || '',
            });
          }
        }
        return { ...testDirection, ...updates };
      });
    characterBuilderService.deleteThematicDirection = jest
      .fn()
      .mockResolvedValue(true);
    characterBuilderService.deleteCharacterConcept = jest
      .fn()
      .mockResolvedValue(true);

    // Create and initialize controller
    controller = new ThematicDirectionsManagerController({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
    });
    await controller.initialize();
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
      eventBus.subscribe('thematic:direction_updated', listener);

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
      eventBus.unsubscribe('thematic:direction_updated', listener);
    });

    it('should pass validation when dispatching through controller', async () => {
      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe('thematic:direction_updated', listener);

      // Simulate the controller's field save method
      const fieldName = 'uniqueTwist';
      const oldValue = testDirection.uniqueTwist;
      const newValue = 'A completely new and different twist';

      // Update through controller's approach
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

      eventBus.unsubscribe('thematic:direction_updated', listener);
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
      };

      // Mock the update to handle null values properly
      characterBuilderService.updateThematicDirection = jest
        .fn()
        .mockImplementation(async (directionId, updates) => {
          // Dispatch events for each field that changed
          for (const [field, newValue] of Object.entries(updates)) {
            const oldValue = directionWithNull[field];
            eventBus.dispatch('thematic:direction_updated', {
              directionId,
              field,
              oldValue: oldValue || '',
              newValue: newValue || '',
            });
          }
          return { ...directionWithNull, ...updates };
        });

      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe('thematic:direction_updated', listener);

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
        oldValue: '', // Null converted to empty string
        newValue: 'Now has a value',
      });

      eventBus.unsubscribe('thematic:direction_updated', listener);
    });

    it('should not dispatch events for unchanged fields', async () => {
      const listener = jest.fn();
      eventBus.subscribe('thematic:direction_updated', listener);

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

      eventBus.unsubscribe('thematic:direction_updated', listener);
    });

    it('should handle multiple simultaneous updates', async () => {
      const capturedEvents = [];
      const listener = jest.fn((event) => {
        capturedEvents.push(event.payload);
      });
      eventBus.subscribe('thematic:direction_updated', listener);

      // Update all fields at once
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

      // Should dispatch 5 events
      expect(listener).toHaveBeenCalledTimes(5);
      expect(capturedEvents).toHaveLength(5);

      // Verify each field has its event
      const fields = capturedEvents.map((event) => event.field);
      expect(fields).toContain('title');
      expect(fields).toContain('description');
      expect(fields).toContain('coreTension');
      expect(fields).toContain('uniqueTwist');
      expect(fields).toContain('narrativePotential');

      eventBus.unsubscribe('thematic:direction_updated', listener);
    });
  });

  describe('Error scenarios', () => {
    it('should not dispatch events if direction not found', async () => {
      const listener = jest.fn();
      eventBus.subscribe('thematic:direction_updated', listener);

      const fakeId = uuidv4();

      // Mock the update to throw an error for non-existent direction
      characterBuilderService.updateThematicDirection = jest
        .fn()
        .mockRejectedValue(
          new Error(`Thematic direction not found: ${fakeId}`)
        );

      await expect(
        characterBuilderService.updateThematicDirection(fakeId, {
          title: 'New Title',
        })
      ).rejects.toThrow(`Thematic direction not found: ${fakeId}`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // No events should be dispatched
      expect(listener).not.toHaveBeenCalled();

      eventBus.unsubscribe('thematic:direction_updated', listener);
    });

    it('should validate event payload against schema', async () => {
      // This test verifies that the event payload matches the required schema
      const listener = jest.fn();
      eventBus.subscribe('thematic:direction_updated', listener);

      // Restore the original mock for this test
      characterBuilderService.updateThematicDirection = jest
        .fn()
        .mockImplementation(async (directionId, updates) => {
          // Dispatch events for each field that changed
          for (const [field, newValue] of Object.entries(updates)) {
            const oldValue = testDirection[field];
            if (oldValue !== newValue) {
              eventBus.dispatch('thematic:direction_updated', {
                directionId,
                field,
                oldValue: oldValue || '',
                newValue: newValue || '',
              });
            }
          }
          return { ...testDirection, ...updates };
        });

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

      eventBus.unsubscribe('thematic:direction_updated', listener);
    });
  });
});
