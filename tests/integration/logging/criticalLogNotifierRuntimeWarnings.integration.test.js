/**
 * Integration tests that reproduce the specific runtime warnings seen in browser console logs
 * Related to CriticalLogNotifier and missing event definitions during game initialization
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

describe('CriticalLogNotifier - Runtime Warnings Integration', () => {
  let testBed;
  let notifier;
  let mockEventBus;
  let mockGameDataRepository;
  let mockSchemaValidator;
  let validatedEventDispatcher;
  let dom;
  let documentContext;

  beforeEach(() => {
    testBed = createTestBed();
    
    // Set up DOM for DocumentContext
    dom = new JSDOM('<!DOCTYPE html><div id="test"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    documentContext = new DocumentContext(dom.window.document);
    
    // Mock EventBus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
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

    // Create ValidatedEventDispatcher with mocks
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    if (notifier) {
      notifier.destroy();
      notifier = null;
    }
    testBed.cleanup();
  });

  it('should reproduce "EventDefinition not found for core:critical_notification_shown" warning', async () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    // Create notifier with real ValidatedEventDispatcher that has no event definitions loaded
    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: documentContext,
      validatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger a critical log which should cause the warning
    // This simulates what happens during baseManifestItemLoader.js:379 error
    mockLogger.error('Test error to trigger critical log notification');

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert - Check that the warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("VED: EventDefinition not found for 'core:critical_notification_shown'")
    );

    // Verify the event was still dispatched despite the warning
    expect(mockEventBus.dispatch).toHaveBeenCalled();
  });

  it('should reproduce multiple warnings during repeated error events', async () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: documentContext,
      validatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger multiple critical logs rapidly (simulating mod loading errors)
    for (let i = 0; i < 5; i++) {
      mockLogger.error(`Test error ${i} to trigger multiple notifications`);
    }

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert - Should have multiple warnings
    const warnCalls = mockLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes("EventDefinition not found for 'core:critical_notification_shown'")
    );
    
    expect(warnCalls.length).toBeGreaterThanOrEqual(5);
  });

  it('should not produce warnings when event definition is properly loaded', async () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

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
      logger: mockLogger,
    });

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: documentContext,
      validatedEventDispatcher: properValidatedEventDispatcher,
      config: {
        enableVisualNotifications: true,
      },
    });

    // Act - Trigger a critical log
    mockLogger.error('Test error with proper event definition loaded');

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert - Should NOT have any event definition warnings
    const warnCalls = mockLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes("EventDefinition not found for 'core:critical_notification_shown'")
    );
    
    expect(warnCalls.length).toBe(0);
  });

  it('should handle concurrent critical log processing without producing duplicate warnings', async () => {
    // Arrange
    const mockLogger = testBed.createMockLogger();

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
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
            mockLogger.error(`Concurrent error ${i}`);
            resolve();
          }, i * 10);
        })
      );
    }

    await Promise.all(promises);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Assert - Should handle concurrent processing without issues
    const warnCalls = mockLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes("EventDefinition not found for 'core:critical_notification_shown'")
    );
    
    // Should have warnings but should be manageable (no more than expected)
    expect(warnCalls.length).toBeGreaterThan(0);
    expect(warnCalls.length).toBeLessThanOrEqual(15); // Some buffer for async timing
  });
});