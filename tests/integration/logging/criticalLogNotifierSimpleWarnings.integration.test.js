/**
 * Simplified integration test that reproduces the specific runtime warnings
 * by testing the actual production code behavior directly
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

describe('ValidatedEventDispatcher - Missing Event Definition Warning', () => {
  let validatedEventDispatcher;
  let mockEventBus;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let mockLogger;
  let capturedLogs;

  beforeEach(() => {
    // Capture console logs to verify warnings
    capturedLogs = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      capturedLogs.push(args.join(' '));
      originalWarn(...args);
    };

    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    // Mock GameDataRepository that returns undefined for event definitions
    // This simulates the condition where event definitions aren't loaded yet
    mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(undefined),
    };

    // Mock SchemaValidator
    mockSchemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      validate: jest.fn().mockReturnValue({ valid: true }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn((...args) => {
        capturedLogs.push(`LOGGER_WARN: ${args.join(' ')}`);
      }),
      error: jest.fn(),
    };

    // Create ValidatedEventDispatcher with mocks that simulate missing event definitions
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Restore console.warn
    console.warn = console.warn.bind(console);
  });

  it('should reproduce "EventDefinition not found for core:critical_notification_shown" warning', async () => {
    // Act - Dispatch the event that's missing from event definitions
    // This simulates exactly what happens in the browser logs
    await validatedEventDispatcher.dispatch(
      'core:critical_notification_shown',
      {
        level: 'error',
        count: 1,
      }
    );

    // Assert - Check that the debug message was logged (no warning for bootstrap events)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "VED: EventDefinition not found for 'core:critical_notification_shown' (expected during bootstrap). Proceeding with dispatch."
      )
    );

    // Verify the event was still dispatched despite the warning
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:critical_notification_shown',
      {
        level: 'error',
        count: 1,
      }
    );
  });

  it('should reproduce multiple warnings during repeated event dispatches', async () => {
    // Act - Dispatch the same missing event multiple times (simulating mod loading errors)
    for (let i = 0; i < 3; i++) {
      await validatedEventDispatcher.dispatch(
        'core:critical_notification_shown',
        {
          level: 'warning',
          count: i + 1,
        }
      );
    }

    // Assert - Should have debug messages for bootstrap events (no warnings)
    const debugCalls = mockLogger.debug.mock.calls.filter(
      ([msg]) =>
        msg &&
        msg.includes(
          "VED: EventDefinition not found for 'core:critical_notification_shown' (expected during bootstrap)"
        )
    );
    expect(debugCalls.length).toBe(3);

    // Check that no warnings were generated for this bootstrap event
    const warnCalls = mockLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes('core:critical_notification_shown')
    );
    expect(warnCalls.length).toBe(0);
  });

  it('should not produce warnings when event definition is properly loaded', async () => {
    // Arrange - Mock a properly loaded event definition
    const eventDefinition = {
      id: 'core:critical_notification_shown',
      payloadSchema: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['error', 'warning'] },
          count: { type: 'number' },
        },
        required: ['level', 'count'],
      },
    };

    mockGameDataRepository.getEventDefinition.mockReturnValue(eventDefinition);
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Create new ValidatedEventDispatcher with loaded event definition
    const properValidatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    // Act - Dispatch the event that now has a definition
    await properValidatedEventDispatcher.dispatch(
      'core:critical_notification_shown',
      {
        level: 'error',
        count: 1,
      }
    );

    // Assert - Should NOT have any event definition warnings
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "EventDefinition not found for 'core:critical_notification_shown'"
      )
    );
  });

  it('should reproduce warning for any missing event definition, not just critical_notification_shown', async () => {
    // Act - Test with a different missing event to ensure the issue is systemic
    await validatedEventDispatcher.dispatch('core:some_other_missing_event', {
      someData: 'test',
    });

    // Assert - Should produce similar warning for any missing event
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "VED: EventDefinition not found for 'core:some_other_missing_event'. Cannot validate payload. Proceeding with dispatch."
      )
    );
  });

  it('should handle the exact sequence that produces warnings during game initialization', async () => {
    // Arrange - Simulate the sequence from the browser logs:
    // Multiple events dispatched during mod loading/initialization when event definitions aren't loaded yet

    const eventsFromLogs = [
      'core:critical_notification_shown',
      'core:critical_notification_shown', // Repeated several times in logs
      'core:critical_notification_shown',
      'core:critical_notification_shown',
    ];

    // Act - Dispatch all events in sequence
    for (const eventType of eventsFromLogs) {
      await validatedEventDispatcher.dispatch(eventType, {
        level: 'error',
        count: 1,
      });
    }

    // Assert - Should have logged debug messages for bootstrap events, no warnings
    const debugCalls = mockLogger.debug.mock.calls.filter(
      ([msg]) => msg && msg.includes('(expected during bootstrap)')
    );
    expect(debugCalls.length).toBe(4);

    // Check that no warnings were generated for bootstrap events
    const warnCalls = mockLogger.warn.mock.calls.filter(
      ([msg]) =>
        msg && eventsFromLogs.some((eventType) => msg.includes(eventType))
    );
    expect(warnCalls.length).toBe(0);

    // Verify all events were still dispatched
    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(4);
  });
});
