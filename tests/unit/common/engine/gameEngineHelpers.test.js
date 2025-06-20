/**
 * @file Test suite for gameEngineHelpers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  withGameEngineBed,
  runUnavailableServiceTest,
} from '../../../common/engine/gameEngineHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import * as bedModule from '../../../common/engine/gameEngineTestBed.js';

describe('withGameEngineBed', () => {
  it('creates bed, resets mocks, runs callback and cleans up', async () => {
    const bed = {
      engine: 'engine',
      resetMocks: jest.fn(),
      cleanup: jest.fn(),
    };
    const createSpy = jest
      .spyOn(bedModule, 'createGameEngineTestBed')
      .mockReturnValue(bed);
    const testFn = jest.fn();

    await withGameEngineBed({ a: 1 }, testFn);

    expect(createSpy).toHaveBeenCalledWith({ a: 1 });
    expect(bed.resetMocks).toHaveBeenCalledTimes(1);
    expect(testFn).toHaveBeenCalledWith(bed, bed.engine);
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
  });

  it('cleans up even when callback throws', async () => {
    const bed = {
      engine: 'engine',
      resetMocks: jest.fn(),
      cleanup: jest.fn(),
    };
    jest.spyOn(bedModule, 'createGameEngineTestBed').mockReturnValue(bed);

    const error = new Error('fail');
    const testFn = jest.fn().mockRejectedValue(error);

    await expect(withGameEngineBed(undefined, testFn)).rejects.toThrow('fail');
    expect(bed.cleanup).toHaveBeenCalledTimes(1);

    bedModule.createGameEngineTestBed.mockRestore();
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
