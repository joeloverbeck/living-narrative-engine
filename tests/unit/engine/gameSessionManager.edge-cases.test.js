/**
 * @file Additional edge case coverage tests for GameSessionManager.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories/index.js';

/** @type {import('../../../src/engine/gameSessionManager.js').default} */
let GameSessionManager;

const createDependencies = () => {
  const engineState = new EngineState();
  const logger = createMockLogger();
  const turnManager = createMockTurnManager();
  const playtimeTracker = createMockPlaytimeTracker();
  const safeEventDispatcher = createMockSafeEventDispatcher();
  const stopFn = jest.fn().mockResolvedValue();
  const resetCoreGameStateFn = jest.fn();
  const startEngineFn = jest.fn((worldName) => {
    engineState.setStarted(worldName);
  });
  const anatomyInitializationService = {
    getPendingGenerationCount: jest.fn().mockReturnValue(0),
    waitForAllGenerationsToComplete: jest.fn().mockResolvedValue(),
  };

  return {
    engineState,
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
    anatomyInitializationService,
  };
};

describe('GameSessionManager edge case coverage', () => {
  beforeEach(async () => {
    jest.resetModules();
    ({ default: GameSessionManager } = await import(
      '../../../src/engine/gameSessionManager.js'
    ));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should record reset failures when stopFn already failed with an existing cause', async () => {
    const deps = createDependencies();
    deps.engineState.setStarted('ExistingWorld');

    const stopFailure = new Error('Stop failed');
    stopFailure.cause = new Error('Existing cause');
    deps.stopFn.mockRejectedValue(stopFailure);

    const resetFailure = new Error('Reset failed');
    deps.resetCoreGameStateFn.mockRejectedValue(resetFailure);

    const manager = new GameSessionManager({
      logger: deps.logger,
      turnManager: deps.turnManager,
      playtimeTracker: deps.playtimeTracker,
      safeEventDispatcher: deps.safeEventDispatcher,
      engineState: deps.engineState,
      stopFn: deps.stopFn,
      resetCoreGameStateFn: deps.resetCoreGameStateFn,
      startEngineFn: deps.startEngineFn,
      anatomyInitializationService: deps.anatomyInitializationService,
    });

    await expect(
      manager.prepareForNewGameSession('RecoveryWorld')
    ).rejects.toBe(stopFailure);

    expect(stopFailure.resetErrors).toEqual([resetFailure]);
  });
});
