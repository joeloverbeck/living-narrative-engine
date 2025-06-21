/**
 * @file Test suite for gameEngineHelpers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { withGameEngineBed } from '../../../common/engine/gameEngineHelpers.js';
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
