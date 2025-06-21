/**
 * @file Test suite for gameEngineHelpers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  withGameEngineBed,
  withInitializedGameEngineBed,
  runUnavailableServiceTest,
} from '../../../common/engine/gameEngineHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import * as bedModule from '../../../common/engine/gameEngineTestBed.js';
import * as utils from '../../../common/testBedUtils.js';

describe('withGameEngineBed', () => {
  it('creates bed, resets mocks, runs callback and cleans up', async () => {
    const bed = {
      engine: 'engine',
      resetMocks: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        await cb(bed);
        await bed.cleanup();
      });
    const testFn = jest.fn();

    await withGameEngineBed({ a: 1 }, testFn);

    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      { a: 1 },
      expect.any(Function)
    );
    expect(bed.resetMocks).toHaveBeenCalledTimes(1);
    expect(testFn).toHaveBeenCalledWith(bed, bed.engine);
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('cleans up even when callback throws', async () => {
    const bed = {
      engine: 'engine',
      resetMocks: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        try {
          await cb(bed);
        } finally {
          await bed.cleanup();
        }
      });

    const testFn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(withGameEngineBed(undefined, testFn)).rejects.toThrow('fail');
    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      {},
      expect.any(Function)
    );
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

describe('withInitializedGameEngineBed', () => {
  it('initializes engine, runs callback and cleans up', async () => {
    const bed = {
      engine: 'engine',
      initAndReset: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        await cb(bed);
        await bed.cleanup();
      });
    const testFn = jest.fn();

    await withInitializedGameEngineBed({ b: 2 }, 'World', testFn);

    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      { b: 2 },
      expect.any(Function)
    );
    expect(bed.initAndReset).toHaveBeenCalledWith('World');
    expect(testFn).toHaveBeenCalledWith(bed, bed.engine);
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('uses defaults and cleans up on error', async () => {
    const bed = {
      engine: 'engine',
      initAndReset: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        try {
          await cb(bed);
        } finally {
          await bed.cleanup();
        }
      });
    const error = new Error('oops');
    const testFn = jest.fn().mockRejectedValue(error);

    await expect(withInitializedGameEngineBed(testFn)).rejects.toThrow('oops');
    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      {},
      expect.any(Function)
    );
    expect(bed.initAndReset).toHaveBeenCalledWith('TestWorld');
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('passes initialized bed and engine to callback', async () => {
    const bed = {
      engine: 'engine',
      initAndReset: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        await cb(bed);
        await bed.cleanup();
      });
    const callOrder = [];
    bed.initAndReset.mockImplementation(() => {
      callOrder.push('init');
    });
    const testFn = jest.fn(() => {
      callOrder.push('callback');
    });

    await withInitializedGameEngineBed({ c: 3 }, 'World', testFn);

    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      { c: 3 },
      expect.any(Function)
    );
    expect(bed.initAndReset).toHaveBeenCalledWith('World');
    expect(testFn).toHaveBeenCalledWith(bed, bed.engine);
    expect(callOrder).toEqual(['init', 'callback']);
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('cleans up even when callback throws', async () => {
    const bed = {
      engine: 'engine',
      initAndReset: jest.fn(),
      cleanup: jest.fn(),
    };
    const spy = jest
      .spyOn(utils, 'withTestBed')
      .mockImplementation(async (_ctor, _ovr, cb) => {
        try {
          await cb(bed);
        } finally {
          await bed.cleanup();
        }
      });
    const error = new Error('fail');
    const testFn = jest.fn(() => {
      throw error;
    });

    await expect(withInitializedGameEngineBed(testFn)).rejects.toThrow('fail');
    expect(spy).toHaveBeenCalledWith(
      bedModule.GameEngineTestBed,
      {},
      expect.any(Function)
    );
    expect(bed.initAndReset).toHaveBeenCalledWith('TestWorld');
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

describe('runUnavailableServiceTest', () => {
  it('generates executable test functions', async () => {
    const cases = [
      [
        tokens.GamePersistenceService,
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.',
      ],
    ];

    const testCases = runUnavailableServiceTest(cases, (bed, engine) => {
      engine.showLoadGameUI();
      return [bed.mocks.logger.error, bed.mocks.safeEventDispatcher.dispatch];
    });

    expect(Array.isArray(testCases)).toBe(true);
    const [token, fn] = testCases[0];
    expect(token).toBe(tokens.GamePersistenceService);
    await fn();
  });
});
