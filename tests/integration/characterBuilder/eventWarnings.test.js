/**
 * @file Simplified integration tests for event definition warnings
 * @description Tests event registration without full controller bootstrap to avoid timeouts
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Character Builder Event Warnings (Simplified)', () => {
  let warnings;
  let consoleWarnSpy;

  beforeEach(() => {
    // Capture console warnings
    warnings = [];
    consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation((message) => {
        warnings.push(message);
      });

    // Mock minimal global objects
    global.document = {
      getElementById: jest.fn(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {},
        innerHTML: '',
        textContent: '',
      })),
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      createElement: jest.fn(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {},
        innerHTML: '',
        textContent: '',
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      })),
      body: { appendChild: jest.fn() },
    };

    global.BroadcastChannel = jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
      close: jest.fn(),
    }));

    global.performance = { now: jest.fn(() => Date.now()) };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    delete global.document;
    delete global.BroadcastChannel;
    delete global.performance;
  });

  it('should register event definitions without warnings', async () => {
    const bootstrap = new CharacterBuilderBootstrap();

    // Test just the container setup and event registration parts
    const config = {
      pageName: 'Test Character Builder',
      controllerClass: class TestController {
        constructor() {}
        async initialize() {
          // Minimal initialization
        }
      },
      includeModLoading: false,
      eventDefinitions: [
        {
          id: 'UI_STATE_CHANGED',
          description: 'Test event for UI state changes',
          payloadSchema: {
            type: 'object',
            properties: {
              controller: { type: 'string' },
              currentState: { type: 'string' },
            },
            required: ['controller', 'currentState'],
          },
        },
        {
          id: 'CONTROLLER_INITIALIZED',
          description: 'Test event for controller initialization',
          payloadSchema: {
            type: 'object',
            properties: {
              controllerName: { type: 'string' },
              initializationTime: { type: 'number' },
            },
            required: ['controllerName', 'initializationTime'],
          },
        },
      ],
    };

    const result = await bootstrap.bootstrap(config);

    // Check that no schema overwriting warnings occurred
    const schemaWarnings = warnings.filter((w) =>
      w.includes('was already loaded. Overwriting.')
    );
    expect(schemaWarnings).toEqual([]);

    // Check that no missing event definition warnings occurred
    const missingEventWarnings = warnings.filter((w) =>
      w.includes('EventDefinition not found for')
    );
    expect(missingEventWarnings).toEqual([]);

    // Verify events are registered
    const dataRegistry = result.container.resolve(tokens.IDataRegistry);
    const uiStateEvent = dataRegistry.getEventDefinition('UI_STATE_CHANGED');
    const controllerInitEvent = dataRegistry.getEventDefinition(
      'CONTROLLER_INITIALIZED'
    );

    expect(uiStateEvent).toBeDefined();
    expect(controllerInitEvent).toBeDefined();
    expect(uiStateEvent.id).toBe('UI_STATE_CHANGED');
    expect(controllerInitEvent.id).toBe('CONTROLLER_INITIALIZED');
  }, 10000); // 10 second timeout

  it('should handle duplicate event registration gracefully', async () => {
    const bootstrap = new CharacterBuilderBootstrap();

    const duplicateEvent = {
      id: 'DUPLICATE_EVENT',
      description: 'Test duplicate event',
      payloadSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    };

    const config = {
      pageName: 'Test Duplicate Events',
      controllerClass: class TestController {
        constructor() {}
        async initialize() {}
      },
      includeModLoading: false,
      eventDefinitions: [duplicateEvent, duplicateEvent], // Intentional duplicate
    };

    const result = await bootstrap.bootstrap(config);

    // Check for appropriate handling of duplicates
    const dataRegistry = result.container.resolve(tokens.IDataRegistry);
    const event = dataRegistry.getEventDefinition('DUPLICATE_EVENT');

    expect(event).toBeDefined();
    expect(event.id).toBe('DUPLICATE_EVENT');

    // Should not produce errors for duplicate registration
    const errorWarnings = warnings.filter((w) =>
      w.includes('Failed to register event')
    );
    expect(errorWarnings).toEqual([]);
  }, 10000);
});
