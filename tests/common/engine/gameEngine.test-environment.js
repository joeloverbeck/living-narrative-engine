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
} from '../mockFactories.js';

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
 */
export function createTestEnvironment() {
  jest.clearAllMocks();

  const logger = createMockLogger();
  const entityManager = createMockEntityManager();
  const turnManager = createMockTurnManager();
  const gamePersistenceService = createMockGamePersistenceService();
  const playtimeTracker = createMockPlaytimeTracker();
  const safeEventDispatcher = createMockSafeEventDispatcher();
  const initializationService = createMockInitializationService();

  const mockContainer = {
    resolve: jest.fn((token) => {
      switch (token) {
        case tokens.ILogger:
          return logger;
        case tokens.IEntityManager:
          return entityManager;
        case tokens.ITurnManager:
          return turnManager;
        case tokens.GamePersistenceService:
          return gamePersistenceService;
        case tokens.PlaytimeTracker:
          return playtimeTracker;
        case tokens.ISafeEventDispatcher:
          return safeEventDispatcher;
        case tokens.IInitializationService:
          return initializationService;
        default: {
          const tokenName =
            Object.keys(tokens).find((key) => tokens[key] === token) ||
            token?.toString();
          throw new Error(
            `gameEngine.test-environment: Unmocked token: ${tokenName}`
          );
        }
      }
    }),
  };

  const createGameEngine = () => new GameEngine({ container: mockContainer });

  const cleanup = () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  };

  return {
    mockContainer,
    logger,
    entityManager,
    turnManager,
    gamePersistenceService,
    playtimeTracker,
    safeEventDispatcher,
    initializationService,
    createGameEngine,
    cleanup,
  };
}
