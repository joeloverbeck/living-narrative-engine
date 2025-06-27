/**
 * @file Test environment factory for GameEngine-related tests.
 * @see tests/common/engine/gameEngineEnvironment.js
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
import { buildServiceEnvironment } from '../mockEnvironment.js';

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

/**
 * Creates a set of mocks and a container for GameEngine.
 *
 * @description Creates a fully mocked environment for GameEngine tests.
 * @param {{[token: string]: any}} [overrides] - Optional DI token overrides.
 * @returns {{
 *   logger: ReturnType<typeof createMockLogger>,
 *   entityManager: ReturnType<typeof createMockEntityManager>,
 *   turnManager: ReturnType<typeof createMockTurnManager>,
 *   gamePersistenceService: ReturnType<typeof createMockGamePersistenceService>,
 *   playtimeTracker: ReturnType<typeof createMockPlaytimeTracker>,
 *   safeEventDispatcher: ReturnType<typeof createMockSafeEventDispatcher>,
 *   initializationService: ReturnType<typeof createMockInitializationService>,
 *   mockContainer: { resolve: jest.Mock },
 *   instance: GameEngine,
 *   createInstance: () => GameEngine,
 *   cleanup: () => void,
 * }}
 *   Test environment utilities and mocks.
 */
export function createEnvironment(overrides = {}) {
  // Adapter class to match the constructor signature expected by buildServiceEnvironment
  // and to correctly pass the logger mock to the GameEngine constructor.
  class GameEngineAdapter {
    constructor({ container, mocks }) {
      return new GameEngine({
        container,
        logger: mocks.logger, // GameEngine constructor expects logger directly
      });
    }
  }

  const env = buildServiceEnvironment(
    factoryMap,
    tokenMap,
    GameEngineAdapter, // Use the adapter
    overrides
  );

  // The 'service' returned by buildServiceEnvironment is our GameEngine instance (via the adapter).
  // The 'createInstance' from buildServiceEnvironment will also return a GameEngine instance.
  return {
    ...env.mocks, // Spread all individual mocks (logger, entityManager, etc.)
    mockContainer: env.mockContainer,
    instance: env.service, // This is the GameEngine instance
    createInstance: env.createInstance, // This will create new GameEngine instances
    cleanup: env.cleanup,
  };
}
