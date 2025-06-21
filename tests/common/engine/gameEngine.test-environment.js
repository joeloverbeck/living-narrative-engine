/**
 * @file Test environment factory for GameEngine-related tests.
 * @see tests/common/engine/gameEngine.test-environment.js
 */

import { jest } from '@jest/globals';
import GameEngine from '../../../src/engine/gameEngine.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockTurnManager,
  createMockGamePersistenceService,
  createMockPlaytimeTracker,
  createMockSafeEventDispatcher,
  createMockInitializationService,
} from '../mockFactories';
import {
  createTestEnvironmentBuilder,
  createServiceTestEnvironment,
} from '../mockEnvironment.js';
const factoryMap = {
  logger: createMockLogger,
  entityManager: createMockEntityManager,
  turnManager: createMockTurnManager,
  gamePersistenceService: createMockGamePersistenceService,
  playtimeTracker: createMockPlaytimeTracker,
  safeEventDispatcher: createMockSafeEventDispatcher,
  initializationService: createMockInitializationService,
};

const tokenMap = {
  [tokens.ILogger]: 'logger',
  [tokens.IEntityManager]: 'entityManager',
  [tokens.ITurnManager]: 'turnManager',
  [tokens.GamePersistenceService]: 'gamePersistenceService',
  [tokens.PlaytimeTracker]: 'playtimeTracker',
  [tokens.ISafeEventDispatcher]: 'safeEventDispatcher',
  [tokens.IInitializationService]: 'initializationService',
};

const buildGameEngineEnv = createTestEnvironmentBuilder(
  factoryMap,
  tokenMap,
  (container) => new GameEngine({ container })
);

/**
 * Creates a set of mocks and a container for GameEngine.
 *
 * @description Creates a fully mocked environment for GameEngine tests.
 * @param {{[token: string]: any}} [overrides] - Optional DI token overrides.
 * @returns {{
 *   mockContainer: { resolve: jest.Mock },
 *   logger: ReturnType<typeof createMockLogger>,
 *   entityManager: ReturnType<typeof createMockEntityManager>,
 *   turnManager: ReturnType<typeof createMockTurnManager>,
 *   gamePersistenceService: ReturnType<typeof createMockGamePersistenceService>,
 *   playtimeTracker: ReturnType<typeof createMockPlaytimeTracker>,
 *   safeEventDispatcher: ReturnType<typeof createMockSafeEventDispatcher>,
 *   initializationService: ReturnType<typeof createMockInitializationService>,
 *   createGameEngine: () => GameEngine,
 *   cleanup: () => void,
 * }}
 *   Test environment utilities and mocks.
 */
export function createTestEnvironment(overrides = {}) {
  const hasOverrides = Object.keys(overrides).length > 0;
  const { mocks, mockContainer, instance, cleanup } = hasOverrides
    ? buildGameEngineEnv(overrides)
    : createServiceTestEnvironment(
        factoryMap,
        tokenMap,
        (container) => new GameEngine({ container })
      );

  const createGameEngine = () => new GameEngine({ container: mockContainer });

  return {
    mockContainer,
    ...mocks,
    gameEngine: instance,
    createGameEngine,
    cleanup,
  };
}
