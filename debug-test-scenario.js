// Reproduce the exact test scenario
import { beforeEach, describe, expect, it } from '@jest/globals';
import EventBus from './src/events/eventBus.js';
import ValidatedEventDispatcher from './src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from './src/events/safeEventDispatcher.js';
import ConsoleLogger from './src/logging/consoleLogger.js';

describe('Debug Error Event Flow', () => {
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let logger;
  let capturedEvents;
  let eventListener;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logger.setLogLevel('error');

    const mockGameDataRepository = {
      getEventDefinition: (id) => {
        if (id === 'core:system_error_occurred') {
          return {
            id: 'core:system_error_occurred',
            name: 'System Error Occurred',
            description: 'A system error has occurred',
            payloadSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                details: { type: 'object' },
              },
              required: ['message'],
            },
          };
        }
        return null;
      },
    };

    const mockSchemaValidator = {
      isValid: () => true,
      validate: () => ({ isValid: true }),
    };

    eventBus = new EventBus({ logger });
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    capturedEvents = [];
    eventListener = (event) => {
      capturedEvents.push(event);
    };
  });

  it('should handle multiple error events in parallel', async () => {
    eventBus.subscribe('core:system_error_occurred', eventListener);

    // Dispatch 3 error events in parallel
    await Promise.all([
      safeEventDispatcher.dispatch('core:system_error_occurred', {
        message: 'Error 1',
        details: {
          raw: 'Entity ID: entity-1',
          timestamp: new Date().toISOString(),
        },
      }),
      safeEventDispatcher.dispatch('core:system_error_occurred', {
        message: 'Error 2',
        details: {
          raw: 'Entity ID: entity-2',
          timestamp: new Date().toISOString(),
        },
      }),
      safeEventDispatcher.dispatch('core:system_error_occurred', {
        message: 'Error 3',
        details: {
          raw: 'Entity ID: entity-3',
          timestamp: new Date().toISOString(),
        },
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 20));

    console.log('Captured events:', capturedEvents.length);
    console.log(
      'Events:',
      capturedEvents.map((e) => e.payload.message)
    );

    expect(capturedEvents).toHaveLength(3);
  });
});
