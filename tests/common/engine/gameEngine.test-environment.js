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
import { buildEnvironment } from '../mockEnvironment.js';

/**
 * Creates a set of mocks and a container for GameEngine.
 *
 * @description Creates a fully mocked environment for GameEngine tests.
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
 * }} Test environment utilities and mocks.
 * @param {{[token: string]: any}} [overrides] - Optional map of DI tokens to
 *   replacement values used instead of defaults.
 */
export function createTestEnvironment(overrides = {}) {
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

  const {
    mocks,
    mockContainer,
    instance: gameEngine,
    cleanup,
  } = buildEnvironment(
    factoryMap,
    tokenMap,
    overrides,
    (container) => new GameEngine({ container })
  );

  const createGameEngine = () => new GameEngine({ container: mockContainer });

  return {
    mockContainer,
    ...mocks,
    gameEngine,
    createGameEngine,
    cleanup,
  };
}
