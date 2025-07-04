/* eslint-env node */
/**
 * @file Test suite to cover event bus adapter registrations.
 * @see src/dependencyInjection/registrations/eventBusAdapterRegistrations.js
 */

// --- Test Framework & Mocker Imports ---
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// --- DI & System Under Test (SUT) Imports ---
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerEventBusAdapters } from '../../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js';

// --- Concrete Class Imports for `instanceof` checks ---
import { EventBusPromptAdapter } from '../../../../src/turns/adapters/eventBusPromptAdapter.js';
import EventBusTurnEndAdapter from '../../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerEventBusAdapters', () => {
  /** @type {AppContainer} */
  let container;

  // --- Mock External Dependencies ---
  const mockLogger = mock();
  const mockValidatedEventDispatcher = mock();
  const mockSafeEventDispatcher = mock();

  beforeEach(() => {
    container = new AppContainer();

    // Register the logger, which is a common dependency for the registration module itself
    container.register(tokens.ILogger, () => mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should log start, intermediate, and end messages in order', () => {
    // Arrange: Ensure all dependencies are present for a full run-through
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockValidatedEventDispatcher
    );
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockSafeEventDispatcher
    );

    // Act
    registerEventBusAdapters(container);

    // Assert
    const logCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logCalls[0]).toBe('Event Bus Adapter Registrations: Starting...');
    expect(logCalls[1]).toContain(
      `Registered EventBusPromptAdapter as ${tokens.IPromptOutputPort}`
    );
    expect(logCalls[2]).toContain(
      `Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}`
    );
    expect(logCalls[3]).toBe(
      'Event Bus Adapter Registrations: All registrations complete.'
    );
  });

  describe('IPromptOutputPort (EventBusPromptAdapter) Registration', () => {
    const successCases = [
      {
        description:
          'should resolve correctly when both dispatchers are present',
        setup: (c) => {
          c.register(
            tokens.ISafeEventDispatcher,
            () => mockSafeEventDispatcher
          );
          c.register(
            tokens.IValidatedEventDispatcher,
            () => mockValidatedEventDispatcher
          );
        },
      },
      {
        description:
          'should resolve correctly when only ISafeEventDispatcher is present',
        setup: (c) => {
          c.register(
            tokens.ISafeEventDispatcher,
            () => mockSafeEventDispatcher
          );
        },
      },
      {
        description:
          'should resolve correctly when only IValidatedEventDispatcher is present',
        setup: (c) => {
          c.register(
            tokens.IValidatedEventDispatcher,
            () => mockValidatedEventDispatcher
          );
        },
      },
    ];

    test.each(successCases)('$description', ({ setup }) => {
      // Arrange
      // Use a fresh container for each parameterized test to ensure isolation
      const freshContainer = new AppContainer();
      freshContainer.register(tokens.ILogger, () => mockLogger);
      setup(freshContainer);

      // Act
      registerEventBusAdapters(freshContainer);

      // Assert
      expectSingleton(
        freshContainer,
        tokens.IPromptOutputPort,
        EventBusPromptAdapter
      );
    });

    test('should throw during resolution if dispatcher dependency is missing', () => {
      // Arrange: No dispatcher is registered
      registerEventBusAdapters(container);

      // Act & Assert
      // --- FIX: Use a regex to match the error message substring. ---
      expect(() => container.resolve(tokens.IPromptOutputPort)).toThrow(
        /Missing dispatcher dependency for EventBusPromptAdapter/
      );
    });
  });

  describe('ITurnEndPort (EventBusTurnEndAdapter) Registration', () => {
    const successCases = [
      {
        description:
          'should resolve correctly when ISafeEventDispatcher is present',
        setup: (c) => {
          c.register(
            tokens.ISafeEventDispatcher,
            () => mockSafeEventDispatcher
          );
        },
      },
    ];

    test.each(successCases)('$description', ({ setup }) => {
      // Arrange
      const freshContainer = new AppContainer();
      freshContainer.register(tokens.ILogger, () => mockLogger);
      setup(freshContainer);

      // Act
      registerEventBusAdapters(freshContainer);

      // Assert
      expectSingleton(
        freshContainer,
        tokens.ITurnEndPort,
        EventBusTurnEndAdapter
      );
    });

    test('should throw during resolution if both dispatcher dependencies are missing', () => {
      // Arrange: No dispatchers are registered
      registerEventBusAdapters(container);

      // Act & Assert
      // --- FIX: Use a regex to match the error message substring. ---
      expect(() => container.resolve(tokens.ITurnEndPort)).toThrow(
        /Missing dispatcher dependency for EventBusTurnEndAdapter/
      );
    });
  });
});
