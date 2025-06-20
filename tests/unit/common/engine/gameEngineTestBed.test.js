/**
 * @file Test suite for the GameEngine test bed helper.
 * @see tests/unit/common/engine/gameEngineTestBed.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GameEngineTestBed } from '../../../common/engine/gameEngineTestBed.js';
import GameEngine from '../../../../src/engine/gameEngine.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

jest.mock('../../../../src/engine/gameEngine.js');

describe('GameEngine Test Helpers: GameEngineTestBed', () => {
  let testBed;
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = {
      startNewGame: jest.fn(),
      stop: jest.fn(),
      getEngineStatus: jest.fn().mockReturnValue({ isInitialized: false }),
    };
    GameEngine.mockImplementation(() => engine);
    testBed = new GameEngineTestBed();
  });

  it('instantiates GameEngine with mocks', () => {
    expect(GameEngine).toHaveBeenCalledTimes(1);
    expect(GameEngine).toHaveBeenCalledWith({
      container: testBed.env.mockContainer,
    });
    expect(testBed.engine).toBe(engine);
    expect(testBed.mocks.logger).toBe(testBed.env.logger);
    expect(testBed.mocks.turnManager).toBe(testBed.env.turnManager);
  });

  it('start presets initialization result and calls startNewGame', async () => {
    const initResult = { success: false };
    await testBed.start('World', initResult);

    expect(engine.startNewGame).toHaveBeenCalledWith('World');
    await expect(
      testBed.env.initializationService.runInitializationSequence()
    ).resolves.toEqual(initResult);
  });

  it('init mocks successful initialization and starts default world', async () => {
    await testBed.init();

    expect(engine.startNewGame).toHaveBeenCalledWith('TestWorld');
    await expect(
      testBed.env.initializationService.runInitializationSequence()
    ).resolves.toEqual({ success: true });
  });

  it('init accepts custom world name', async () => {
    await testBed.init('Custom');
    expect(engine.startNewGame).toHaveBeenCalledWith('Custom');
  });

  it('stop only stops engine when initialized', async () => {
    engine.getEngineStatus.mockReturnValue({ isInitialized: true });
    await testBed.stop();
    expect(engine.stop).toHaveBeenCalledTimes(1);

    engine.stop.mockClear();
    engine.getEngineStatus.mockReturnValue({ isInitialized: false });
    await testBed.stop();
    expect(engine.stop).not.toHaveBeenCalled();
  });

  it('cleanup stops engine and calls env.cleanup', async () => {
    jest.spyOn(testBed.env, 'cleanup').mockImplementation(() => {});
    engine.getEngineStatus.mockReturnValue({ isInitialized: true });

    await testBed.cleanup();

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(testBed.env.cleanup).toHaveBeenCalledTimes(1);
  });

  it('withTokenOverride replaces container resolve and resets on cleanup', async () => {
    const custom = { foo: 'bar' };
    testBed.withTokenOverride(tokens.PlaytimeTracker, custom);

    const resolved = testBed.env.mockContainer.resolve(tokens.PlaytimeTracker);
    expect(resolved).toBe(custom);

    await testBed.cleanup();

    const restored = testBed.env.mockContainer.resolve(tokens.PlaytimeTracker);
    expect(restored).toBe(testBed.mocks.playtimeTracker);
  });

  it('resetMocks clears all spy call history', () => {
    testBed.mocks.logger.info('log');
    testBed.mocks.entityManager.clearAll();
    testBed.mocks.turnManager.start();
    testBed.mocks.gamePersistenceService.saveGame();
    testBed.mocks.playtimeTracker.startSession();
    testBed.mocks.safeEventDispatcher.dispatch();
    testBed.mocks.initializationService.runInitializationSequence();

    expect(testBed.mocks.logger.info).toHaveBeenCalled();
    expect(testBed.mocks.entityManager.clearAll).toHaveBeenCalled();
    expect(testBed.mocks.turnManager.start).toHaveBeenCalled();
    expect(testBed.mocks.gamePersistenceService.saveGame).toHaveBeenCalled();
    expect(testBed.mocks.playtimeTracker.startSession).toHaveBeenCalled();
    expect(testBed.mocks.safeEventDispatcher.dispatch).toHaveBeenCalled();
    expect(
      testBed.mocks.initializationService.runInitializationSequence
    ).toHaveBeenCalled();

    testBed.resetMocks();

    expect(testBed.mocks.logger.info).not.toHaveBeenCalled();
    expect(testBed.mocks.entityManager.clearAll).not.toHaveBeenCalled();
    expect(testBed.mocks.turnManager.start).not.toHaveBeenCalled();
    expect(
      testBed.mocks.gamePersistenceService.saveGame
    ).not.toHaveBeenCalled();
    expect(testBed.mocks.playtimeTracker.startSession).not.toHaveBeenCalled();
    expect(testBed.mocks.safeEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(
      testBed.mocks.initializationService.runInitializationSequence
    ).not.toHaveBeenCalled();
  });
});
