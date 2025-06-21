/**
 * @file Test suite for the GameEngine test bed helper.
 * @see tests/unit/common/engine/gameEngineTestBed.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GameEngineTestBed,
  describeGameEngineSuite,
  describeEngineSuite,
  describeInitializedEngineSuite,
} from '../../../common/engine/gameEngineTestBed.js';
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
    expect(testBed.logger).toBe(testBed.env.logger);
    expect(testBed.turnManager).toBe(testBed.env.turnManager);
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

  it('initAndReset runs init then clears mock history', async () => {
    const initSpy = jest.spyOn(testBed, 'init');
    const resetSpy = jest.spyOn(testBed, 'resetMocks');

    await testBed.initAndReset('ResetWorld');

    expect(initSpy).toHaveBeenCalledWith('ResetWorld');
    expect(engine.startNewGame).toHaveBeenCalledWith('ResetWorld');
    expect(resetSpy).toHaveBeenCalledTimes(1);

    await expect(
      testBed.env.initializationService.runInitializationSequence()
    ).resolves.toEqual({ success: true });

    initSpy.mockRestore();
    resetSpy.mockRestore();
  });

  it('startAndReset calls start with result then clears mock history', async () => {
    const startSpy = jest.spyOn(testBed, 'start');
    const resetSpy = jest.spyOn(testBed, 'resetMocks');
    const result = { success: false };

    await testBed.startAndReset('WorldName', result);

    expect(startSpy).toHaveBeenCalledWith('WorldName', result);
    expect(engine.startNewGame).toHaveBeenCalledWith('WorldName');
    expect(resetSpy).toHaveBeenCalledTimes(1);

    await expect(
      testBed.env.initializationService.runInitializationSequence()
    ).resolves.toEqual(result);

    startSpy.mockRestore();
    resetSpy.mockRestore();
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

  it('cleanup stops engine', async () => {
    jest.spyOn(testBed.env, 'cleanup').mockImplementation(() => { console.trace('env.cleanup called'); });
    engine.getEngineStatus.mockReturnValue({ isInitialized: true });

    await testBed.cleanup();

    expect(engine.stop).toHaveBeenCalledTimes(1);
    expect(testBed.env.cleanup).not.toHaveBeenCalled();
  });

  it('withTokenOverride replaces container resolve and resets on cleanup', async () => {
    const custom = { foo: 'bar' };
    testBed.withTokenOverride(tokens.PlaytimeTracker, custom);

    const resolved = testBed.env.mockContainer.resolve(tokens.PlaytimeTracker);
    expect(resolved).toBe(custom);

    await testBed.cleanup();

    const restored = testBed.env.mockContainer.resolve(tokens.PlaytimeTracker);
    expect(restored).toBe(testBed.playtimeTracker);
  });

  it('constructor overrides return specified value', async () => {
    const custom = { foo: 'bar' };
    const bed = new GameEngineTestBed({ [tokens.PlaytimeTracker]: custom });
    expect(bed.env.mockContainer.resolve(tokens.PlaytimeTracker)).toBe(custom);
    await bed.cleanup();
  });

  it('constructor overrides can return null', async () => {
    const bed = new GameEngineTestBed({ [tokens.PlaytimeTracker]: null });
    expect(bed.env.mockContainer.resolve(tokens.PlaytimeTracker)).toBeNull();
    await bed.cleanup();
  });

  it('resetMocks clears all spy call history', () => {
    testBed.logger.info('log');
    testBed.entityManager.clearAll();
    testBed.turnManager.start();
    testBed.gamePersistenceService.saveGame();
    testBed.playtimeTracker.startSession();
    testBed.safeEventDispatcher.dispatch();
    testBed.initializationService.runInitializationSequence();

    expect(testBed.logger.info).toHaveBeenCalled();
    expect(testBed.entityManager.clearAll).toHaveBeenCalled();
    expect(testBed.turnManager.start).toHaveBeenCalled();
    expect(testBed.gamePersistenceService.saveGame).toHaveBeenCalled();
    expect(testBed.playtimeTracker.startSession).toHaveBeenCalled();
    expect(testBed.safeEventDispatcher.dispatch).toHaveBeenCalled();
    expect(
      testBed.initializationService.runInitializationSequence
    ).toHaveBeenCalled();

    testBed.resetMocks();

    expect(testBed.logger.info).not.toHaveBeenCalled();
    expect(testBed.entityManager.clearAll).not.toHaveBeenCalled();
    expect(testBed.turnManager.start).not.toHaveBeenCalled();
    expect(testBed.gamePersistenceService.saveGame).not.toHaveBeenCalled();
    expect(testBed.playtimeTracker.startSession).not.toHaveBeenCalled();
    expect(testBed.safeEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(
      testBed.initializationService.runInitializationSequence
    ).not.toHaveBeenCalled();
  });
});

describe('describeGameEngineSuite', () => {
  let cleanupCalls = 0;
  let originalCleanup;
  let cleanupSpy;

  beforeAll(() => {
    originalCleanup = GameEngineTestBed.prototype.cleanup;
  });

  beforeEach(() => {
    cleanupSpy = jest
      .spyOn(GameEngineTestBed.prototype, 'cleanup')
      .mockImplementation(async function (...args) {
        cleanupCalls++;
        return originalCleanup.apply(this, args);
      });
  });

  afterEach(() => {
    cleanupSpy.mockRestore();
  });

  describeGameEngineSuite('inner', (getBed) => {
    it('instantiates a test bed', () => {
      expect(getBed()).toBeInstanceOf(GameEngineTestBed);
    });

    it('suppresses console.error', () => {
      expect(jest.isMockFunction(console.error)).toBe(true);
      console.error('oops');
      expect(console.error).toHaveBeenCalledWith('oops');
    });
  });

  it('calls cleanup after each test', () => {
    expect(cleanupCalls).toBe(2);
  });
});

describe('describeInitializedEngineSuite', () => {
  let initCalls = 0;
  let originalInit;
  let initSpy;

  beforeAll(() => {
    originalInit = GameEngineTestBed.prototype.initAndReset;
  });

  beforeEach(() => {
    initSpy = jest
      .spyOn(GameEngineTestBed.prototype, 'initAndReset')
      .mockImplementation(async function (...args) {
        initCalls++;
        return originalInit.apply(this, args);
      });
  });

  afterEach(() => {
    initSpy.mockRestore();
  });

  describeInitializedEngineSuite('inner', (ctx) => {
    it('provides bed and engine references', () => {
      expect(ctx.bed).toBeInstanceOf(GameEngineTestBed);
      expect(ctx.engine).toBe(ctx.bed.engine);
    });

    it('initializes engine and suppresses console.error', () => {
      expect(jest.isMockFunction(console.error)).toBe(true);
      expect(initSpy).toHaveBeenCalledWith('TestWorld');
      console.error('oops');
      expect(console.error).toHaveBeenCalledWith('oops');
    });
  });

  it('calls initAndReset before each test', () => {
    expect(initCalls).toBe(2);
  });

  describeInitializedEngineSuite(
    'custom world',
    () => {
      it('uses provided world name', () => {
        expect(initSpy).toHaveBeenCalledWith('MyWorld');
      });
    },
    'MyWorld'
  );

  it('tracks total initialization calls', () => {
    expect(initCalls).toBe(3);
  });
});

describe('describeEngineSuite', () => {
  let initCalls = 0;
  let cleanupCalls = 0;
  let originalInit;
  let originalCleanup;
  let initSpy;
  let cleanupSpy;

  beforeAll(() => {
    originalCleanup = GameEngineTestBed.prototype.cleanup;
    originalInit = GameEngineTestBed.prototype.initAndReset;
  });

  beforeEach(() => {
    cleanupSpy = jest
      .spyOn(GameEngineTestBed.prototype, 'cleanup')
      .mockImplementation(async function (...args) {
        cleanupCalls++;
        return originalCleanup.apply(this, args);
      });
    initSpy = jest
      .spyOn(GameEngineTestBed.prototype, 'initAndReset')
      .mockImplementation(async function (...args) {
        initCalls++;
        return originalInit.apply(this, args);
      });
  });

  afterEach(() => {
    cleanupSpy.mockRestore();
    initSpy.mockRestore();
  });

  describeEngineSuite('inner', (ctx) => {
    beforeEach(async () => {
      await ctx.bed.initAndReset();
    });

    it('provides bed and engine references', () => {
      expect(ctx.bed).toBeInstanceOf(GameEngineTestBed);
      expect(ctx.engine).toBe(ctx.bed.engine);
    });

    it('suppresses console.error', () => {
      expect(jest.isMockFunction(console.error)).toBe(true);
      console.error('oops');
      expect(console.error).toHaveBeenCalledWith('oops');
    });
  });

  it('calls initAndReset before each test', () => {
    expect(initCalls).toBe(2);
  });

  it('calls cleanup after each test', () => {
    expect(cleanupCalls).toBe(2);
  });
});
