// tests/engine/gameEngine.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import GameEngine from '../../../src/engine/gameEngine.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { createGameEngineTestBed } from '../../common/engine/gameEngineTestBed.js';
import {
  expectDispatchSequence,
  buildSaveDispatches,
  DEFAULT_ACTIVE_WORLD_FOR_SAVE,
} from '../../common/engine/dispatchTestUtils.js';
import {
  // --- Import new UI Event IDs ---
  ENGINE_INITIALIZING_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';

// --- JSDoc Type Imports for Mocks ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../../../src/interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../src/interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

describe('GameEngine', () => {
  let testBed;
  let gameEngine; // Instance of GameEngine

  const MOCK_WORLD_NAME = 'TestWorld';

  beforeEach(() => {
    testBed = createGameEngineTestBed();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should instantiate and resolve all core services successfully', () => {
      gameEngine = new GameEngine({ container: testBed.env.mockContainer }); // Instantiation for this test
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ILogger
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IEntityManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ITurnManager
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.GamePersistenceService
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.PlaytimeTracker
      );
      expect(testBed.env.mockContainer.resolve).toHaveBeenCalledWith(
        tokens.ISafeEventDispatcher
      );
    });

    it('should throw an error if ILogger cannot be resolved', () => {
      testBed.withTokenOverride(tokens.ILogger, () => {
        throw new Error('Logger failed to resolve');
      });

      expect(
        () => new GameEngine({ container: testBed.env.mockContainer })
      ).toThrow('GameEngine requires a logger.');
      expect(console.error).toHaveBeenCalledWith(
        'GameEngine: CRITICAL - Logger not resolved.',
        expect.any(Error)
      );
    });

    it.each([
      ['IEntityManager', tokens.IEntityManager],
      ['ITurnManager', tokens.ITurnManager],
      ['GamePersistenceService', tokens.GamePersistenceService],
      ['PlaytimeTracker', tokens.PlaytimeTracker],
      ['ISafeEventDispatcher', tokens.ISafeEventDispatcher],
    ])('should throw an error if %s cannot be resolved', (_, failingToken) => {
      const resolutionError = new Error(`${String(failingToken)} failed`);
      testBed.withTokenOverride(failingToken, () => {
        throw resolutionError;
      });

      expect(() => testBed.env.createGameEngine()).toThrow(
        `GameEngine: Failed to resolve core services. ${resolutionError.message}`
      );

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
        resolutionError
      );
    });
  });
});
