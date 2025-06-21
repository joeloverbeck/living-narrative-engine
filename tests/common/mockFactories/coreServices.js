/**
 * @file Factory functions for core service mocks used in tests.
 * @see tests/common/mockFactories/coreServices.js
 */

import { jest } from '@jest/globals';

/**
 * Creates a simple mock object with jest.fn methods.
 *
 * @description Utility to generate mock implementations for a list of method names.
 * @param {string[]} methodNames - Names of the methods to mock.
 * @param {Record<string, any>} [defaults] - Optional default implementations.
 * @returns {Record<string, jest.Mock>} Object containing mocked methods.
 */
export function createSimpleMock(methodNames, defaults = {}) {
  const mock = {};
  for (const name of methodNames) {
    mock[name] = Object.prototype.hasOwnProperty.call(defaults, name)
      ? defaults[name]
      : jest.fn();
  }
  return mock;
}

/**
 * Generates simple mock factory functions based on a specification map.
 *
 * @param {Record<string, string[] | {methods: string[], defaults?: object}>} specMap
 *  Mapping of factory names to method arrays or spec objects.
 * @returns {Record<string, () => object>} Generated factory functions.
 */
export function generateFactories(specMap) {
  const factories = {};
  for (const [name, spec] of Object.entries(specMap)) {
    const { methods, defaults = {} } = Array.isArray(spec)
      ? { methods: spec, defaults: {} }
      : spec;
    factories[name] = () => createSimpleMock(methods, defaults);
  }
  return factories;
}

const simpleFactories = {
  createMockLogger: ['info', 'warn', 'error', 'debug'],
  createMockTurnManager: ['start', 'stop', 'nextTurn'],
  createMockTurnOrderService: [
    'startNewRound',
    'getNextEntity',
    'peekNextEntity',
    'addEntity',
    'removeEntity',
    'isEmpty',
    'getCurrentOrder',
    'clearCurrentRound',
  ],
  createMockTurnHandlerResolver: ['resolveHandler'],
  createMockGamePersistenceService: [
    'saveGame',
    'loadAndRestoreGame',
    'isSavingAllowed',
  ],
  createMockPlaytimeTracker: {
    methods: [
      'reset',
      'startSession',
      'endSessionAndAccumulate',
      'getTotalPlaytime',
      'setAccumulatedPlaytime',
    ],
    defaults: { getTotalPlaytime: jest.fn().mockReturnValue(0) },
  },
  createMockInitializationService: ['runInitializationSequence'],
  createMockLLMAdapter: ['getAIDecision', 'getCurrentActiveLlmId'],
  createMockAIGameStateProvider: ['buildGameState'],
  createMockAIPromptContentProvider: ['getPromptData'],
  createMockPromptBuilder: ['build'],
  createMockSafeEventDispatcher: ['dispatch'],
  createMockValidatedEventDispatcher: {
    methods: ['dispatch'],
    defaults: { dispatch: jest.fn().mockResolvedValue(undefined) },
  },
};

export const {
  createMockLogger,
  createMockTurnManager,
  createMockTurnOrderService,
  createMockTurnHandlerResolver,
  createMockGamePersistenceService,
  createMockPlaytimeTracker,
  createMockInitializationService,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockSafeEventDispatcher,
  createMockValidatedEventDispatcher,
} = generateFactories(simpleFactories);

/**
 * Creates a mock turn handler.
 *
 * @param {object} [options]
 * @param {import('../../src/entities/entity.js').default} [options.actor] - Associated actor.
 * @param {boolean} [options.failStart] - If true, startTurn throws an error.
 * @param {boolean} [options.failDestroy] - If true, destroy throws an error.
 * @param {boolean} [options.includeSignalTermination] - Add signalNormalApparentTermination fn.
 * @param options.name
 * @returns {{
 *   actor: any,
 *   startTurn: jest.Mock,
 *   destroy: jest.Mock,
 *   signalNormalApparentTermination?: jest.Mock
 * }} Mock turn handler.
 */
export const createMockTurnHandler = ({
  actor = null,
  failStart = false,
  failDestroy = false,
  includeSignalTermination = false,
  name = 'MockTurnHandler',
} = {}) => {
  const handler = {
    actor,
    constructor: { name },
    startTurn: jest.fn(async (currentActor) => {
      if (failStart) {
        throw new Error(
          `Simulated startTurn failure for ${currentActor?.id || 'unknown actor'}`
        );
      }
    }),
    destroy: jest.fn(async () => {
      if (failDestroy) {
        throw new Error('Simulated destroy failure');
      }
    }),
  };
  if (includeSignalTermination) {
    handler.signalNormalApparentTermination = jest.fn();
  }
  return handler;
};

/**
 * Creates a mock event bus that records subscriptions and allows manual triggering.
 *
 * @returns {object} Mock event bus with helper methods
 */
export const createMockValidatedEventBus = () => {
  const handlers = {};
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn((eventName, handler) => {
      if (!handlers[eventName]) {
        handlers[eventName] = [];
      }
      handlers[eventName].push(handler);
      return jest.fn(() => {
        const index = handlers[eventName].indexOf(handler);
        if (index > -1) {
          handlers[eventName].splice(index, 1);
        }
      });
    }),
    _triggerEvent: (eventName, payload) => {
      (handlers[eventName] || []).forEach((h) => h(payload));
    },
    _clearHandlers: () => {
      Object.keys(handlers).forEach((k) => delete handlers[k]);
    },
  };
};

/**
 * Creates a mock AJV schema validator service.
 *
 * @param {object} [defaultValidationResult] - Default result.
 * @returns {{ validate: jest.Mock }} Mock validator
 */
export const createMockSchemaValidator = (
  defaultValidationResult = { isValid: true }
) => ({
  validate: jest.fn(() => defaultValidationResult),
  isSchemaLoaded: jest.fn(),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  getValidator: jest.fn(),
});

/**
 * Creates a mock configuration provider.
 *
 * @returns {object} Mock configuration
 */
export const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest.fn((type) => `schema:${type}`),
  getBaseDataPath: jest.fn(() => './data'),
  getSchemaFiles: jest.fn(() => []),
  getSchemaBasePath: jest.fn(() => 'schemas'),
  getContentBasePath: jest.fn(() => 'content'),
  getGameConfigFilename: jest.fn(() => 'game.json'),
  getModsBasePath: jest.fn(() => 'mods'),
  getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
});
