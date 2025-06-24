/**
 * @file Test suite for gameEngineHelpers.
 */

import { describe, it, expect } from '@jest/globals';
import {
  withGameEngineBed,
  withInitializedGameEngineBed,
  withRunningGameEngineBed,
  runUnavailableServiceTest,
} from '../../../common/engine/gameEngineHelpers.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import * as bedModule from '../../../common/engine/gameEngineTestBed.js';
import { GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE } from '../../../common/engine/unavailableMessages.js';

describe('withGameEngineBed', () => {
  it('creates bed, resets mocks, runs callback and cleans up', async () => {
    const calls = [];
    await withGameEngineBed({ a: 1 }, (bed, engine) => {
      calls.push('cb');
      expect(bed).toBeInstanceOf(bedModule.GameEngineTestBed);
      expect(engine).toBe(bed.engine);
    });
    expect(calls).toEqual(['cb']);
  });

  it('cleans up even when callback throws', async () => {
    const error = new Error('fail');
    const testFn = jest.fn().mockRejectedValue(error);
    await expect(withGameEngineBed(undefined, testFn)).rejects.toThrow('fail');
  });
});

describe('withInitializedGameEngineBed', () => {
  it('initializes engine, runs callback and cleans up', async () => {
    const calls = [];
    await withInitializedGameEngineBed(
      { overrides: { b: 2 }, initArg: 'World' },
      (bed, engine) => {
        calls.push('cb');
        expect(bed).toBeInstanceOf(bedModule.GameEngineTestBed);
        expect(engine).toBe(bed.engine);
      }
    );
    expect(calls).toEqual(['cb']);
  });

  it('uses defaults and cleans up on error', async () => {
    const error = new Error('oops');
    const testFn = jest.fn().mockRejectedValue(error);
    await expect(withInitializedGameEngineBed({}, testFn)).rejects.toThrow(
      'oops'
    );
  });

  it('passes initialized bed and engine to callback', async () => {
    const calls = [];
    await withInitializedGameEngineBed(
      { overrides: { c: 3 }, initArg: 'World' },
      (bed, engine) => {
        calls.push('cb');
        expect(bed).toBeInstanceOf(bedModule.GameEngineTestBed);
        expect(engine).toBe(bed.engine);
      }
    );
    expect(calls).toEqual(['cb']);
  });

  it('cleans up even when callback throws', async () => {
    const error = new Error('fail');
    const testFn = jest.fn(() => {
      throw error;
    });
    await expect(withInitializedGameEngineBed({}, testFn)).rejects.toThrow(
      'fail'
    );
  });
});

describe('withRunningGameEngineBed', () => {
  it('starts engine, runs callback and cleans up', async () => {
    const calls = [];
    await withRunningGameEngineBed(
      { overrides: { d: 4 }, initArg: 'World' },
      (bed, engine) => {
        calls.push('cb');
        expect(bed).toBeInstanceOf(bedModule.GameEngineTestBed);
        expect(engine).toBe(bed.engine);
      }
    );
    expect(calls).toEqual(['cb']);
  });

  it('uses defaults and cleans up on error', async () => {
    const error = new Error('oops');
    const testFn = jest.fn().mockRejectedValue(error);
    await expect(withRunningGameEngineBed({}, testFn)).rejects.toThrow('oops');
  });

  it('passes running bed and engine to callback', async () => {
    const calls = [];
    await withRunningGameEngineBed(
      { overrides: { e: 5 }, initArg: 'World' },
      (bed, engine) => {
        calls.push('cb');
        expect(bed).toBeInstanceOf(bedModule.GameEngineTestBed);
        expect(engine).toBe(bed.engine);
      }
    );
    expect(calls).toEqual(['cb']);
  });

  it('cleans up even when callback throws', async () => {
    const error = new Error('fail');
    const testFn = jest.fn(() => {
      throw error;
    });
    await expect(withRunningGameEngineBed({}, testFn)).rejects.toThrow('fail');
  });
});

describe('runUnavailableServiceTest', () => {
  it('generates executable test functions', async () => {
    const cases = [
      [tokens.GamePersistenceService, GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE],
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
