/**
 * Integration tests that reproduce the specific runtime debug messages seen in browser console logs
 * Related to CriticalLogNotifier and missing event definitions during game initialization
 * ValidatedEventDispatcher treats core:critical_notification_shown as bootstrap event (DEBUG level)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { JSDOM } from 'jsdom';

describe('CriticalLogNotifier - Runtime Debug Messages Integration', () => {
  let testBed;
  let notifier;
  let mockEventBus;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let validatedEventDispatcher;
  let dom;
  let documentContext;
  let sharedMockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    
    // Set up DOM for DocumentContext
    dom = new JSDOM('<!DOCTYPE html><div id="test"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    documentContext = new DocumentContext(dom.window.document);
    
    // Create shared mock logger for both CriticalLogNotifier and ValidatedEventDispatcher
    sharedMockLogger = testBed.createMockLogger();
    jest.spyOn(sharedMockLogger, 'warn');
    jest.spyOn(sharedMockLogger, 'error');
    jest.spyOn(sharedMockLogger, 'debug');
    
    // Mock EventBus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    // Mock GameDataRepository that returns undefined for event definitions
    // This simulates the condition where event definitions aren't loaded yet
    // This will cause ValidatedEventDispatcher to treat core:critical_notification_shown as bootstrap event
    mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(undefined),
    };

    // Mock SchemaValidator
    mockSchemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      validate: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create ValidatedEventDispatcher with shared mock logger
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: sharedMockLogger,
    });
  });

  afterEach(() => {
    if (notifier) {
      notifier.dispose?.();
      notifier = null;
    }
    testBed.cleanup();
  });

  it('should reproduce "EventDefinition not found for core:critical_notification_shown" debug message', async () => {
    // Create notifier with real ValidatedEventDispatcher that has no event definitions loaded
    // Using shared mock logger to capture ValidatedEventDispatcher debug messages
    notifier = new CriticalLogNotifier({
      logger: sharedMockLogger,
      documentContext: documentContext,
      validatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger a critical log which should cause the debug message
    // This simulates what happens during baseManifestItemLoader.js:379 error
    sharedMockLogger.error('Test error to trigger critical log notification');

    // Wait for async processing (multiple animation frames + timers)
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Ensure all animation frames are processed
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Assert - Check that the bootstrap debug message was logged
    // ValidatedEventDispatcher treats core:critical_notification_shown as a bootstrap event
    expect(sharedMockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("VED: EventDefinition not found for 'core:critical_notification_shown' (expected during bootstrap)")
    );

    // Verify the event was still dispatched despite the warning
    expect(mockEventBus.dispatch).toHaveBeenCalled();
  });

  it('should reproduce multiple debug messages during repeated error events', async () => {
    // Using shared mock logger to capture ValidatedEventDispatcher debug messages
    notifier = new CriticalLogNotifier({
      logger: sharedMockLogger,
      documentContext: documentContext,
      validatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger multiple critical logs rapidly (simulating mod loading errors)
    for (let i = 0; i < 5; i++) {
      sharedMockLogger.error(`Test error ${i} to trigger multiple notifications`);
    }

    // Wait for async processing (multiple animation frames + timers)
    await new Promise((resolve) => setTimeout(resolve, 600));
    // Ensure all animation frames are processed
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Assert - Should have multiple debug messages
    const debugCalls = sharedMockLogger.debug.mock.calls.filter(
      ([msg]) => msg && msg.includes("VED: EventDefinition not found for 'core:critical_notification_shown' (expected during bootstrap)")
    );
    
    expect(debugCalls.length).toBeGreaterThanOrEqual(5);
  });

  it('should not produce debug messages when event definition is properly loaded', async () => {

    // Mock a properly loaded event definition
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
      logger: sharedMockLogger,
    });

    notifier = new CriticalLogNotifier({
      logger: sharedMockLogger,
      documentContext: documentContext,
      validatedEventDispatcher: properValidatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger a critical log
    sharedMockLogger.error('Test error with proper event definition loaded');

    // Wait for async processing (multiple animation frames + timers)
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Ensure all animation frames are processed
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Assert - Should NOT have any event definition debug messages
    const debugCalls = sharedMockLogger.debug.mock.calls.filter(
      ([msg]) => msg && msg.includes("VED: EventDefinition not found for 'core:critical_notification_shown'")
    );
    
    expect(debugCalls.length).toBe(0);
  });

  it('should handle concurrent critical log processing without producing excessive debug messages', async () => {
    // Using shared mock logger to capture ValidatedEventDispatcher debug messages
    notifier = new CriticalLogNotifier({
      logger: sharedMockLogger,
      documentContext: documentContext,
      validatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger concurrent critical logs (simulating concurrent mod loading failures)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            sharedMockLogger.error(`Concurrent error ${i}`);
            resolve();
          }, i * 10);
        })
      );
    }

    await Promise.all(promises);
    // Wait for async processing (multiple animation frames + timers)
    await new Promise((resolve) => setTimeout(resolve, 800));
    // Ensure all animation frames are processed
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Assert - Should handle concurrent processing without issues
    const debugCalls = sharedMockLogger.debug.mock.calls.filter(
      ([msg]) => msg && msg.includes("VED: EventDefinition not found for 'core:critical_notification_shown' (expected during bootstrap)")
    );
    
    // Should have debug messages but should be manageable (no more than expected)
    expect(debugCalls.length).toBeGreaterThan(0);
    expect(debugCalls.length).toBeLessThanOrEqual(15); // Some buffer for async timing
  });
});