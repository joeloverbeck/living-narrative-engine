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
  createMockContainer,
} from '../mockFactories.js';
import { createMockEnvironment } from '../mockEnvironment.js';

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
  const { mocks, cleanup } = createMockEnvironment({
    logger: createMockLogger,
    entityManager: createMockEntityManager,
    turnManager: createMockTurnManager,
    gamePersistenceService: createMockGamePersistenceService,
    playtimeTracker: createMockPlaytimeTracker,
    safeEventDispatcher: createMockSafeEventDispatcher,
    initializationService: createMockInitializationService,
  });

  const mapping = {
    [tokens.ILogger]: mocks.logger,
    [tokens.IEntityManager]: mocks.entityManager,
    [tokens.ITurnManager]: mocks.turnManager,
    [tokens.GamePersistenceService]: mocks.gamePersistenceService,
    [tokens.PlaytimeTracker]: mocks.playtimeTracker,
    [tokens.ISafeEventDispatcher]: mocks.safeEventDispatcher,
    [tokens.IInitializationService]: mocks.initializationService,
  };

  const mockContainer = createMockContainer(mapping, overrides);

  const createGameEngine = () => new GameEngine({ container: mockContainer });

  return {
    mockContainer,
    ...mocks,
    createGameEngine,
    cleanup,
  };
}
