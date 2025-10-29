/**
 * @file Additional coverage tests for ErrorRecovery.js
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { ErrorRecovery } from '../../../../src/domUI/visualizer/ErrorRecovery.js';
import { AnatomyDataError } from '../../../../src/errors/anatomyDataError.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';
import { AnatomyStateError } from '../../../../src/errors/anatomyStateError.js';

class CustomFallbackError extends Error {}
class MinimalFallbackError extends Error {}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn(),
});

const createRecovery = (options = {}) => {
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const recovery = new ErrorRecovery({ logger, eventDispatcher }, options);
  return { recovery, logger, eventDispatcher };
};

describe('ErrorRecovery additional coverage', () => {
  let recovery;

  afterEach(() => {
    if (recovery && !recovery.isDisposed()) {
      recovery.dispose();
    }
  });

  it('uses default context values when none provided', async () => {
    const setup = createRecovery();
    recovery = setup.recovery;

    const outcome = await recovery.handleError(new Error('plain failure'));

    expect(outcome.strategy).toBe('fallback');
    expect(setup.eventDispatcher.dispatch).toHaveBeenCalledWith(
      'anatomy:visualizer_error',
      expect.objectContaining({
        context: {},
        strategy: 'fallback',
      })
    );
    expect(recovery.getErrorHistory(1)[0].context).toEqual({});
  });

  it('throws when registering a fallback strategy with a non-function', () => {
    ({ recovery } = createRecovery());

    expect(() =>
      recovery.registerFallbackStrategy('TypeError', 'invalid')
    ).toThrow('Fallback strategy must be a function');
  });

  it('computes exponential retry delay with jitter', () => {
    ({ recovery } = createRecovery({
      retryDelayMs: 100,
      useExponentialBackoff: true,
    }));

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    const delay = recovery.getRetryDelay('load-operation');
    const expectedDelay = Math.floor(100 * (1 + 0.25 * 0.3));
    expect(delay).toBe(expectedDelay);
    randomSpy.mockRestore();
  });

  it('allows dispose to be called multiple times without error', () => {
    ({ recovery } = createRecovery());

    recovery.dispose();
    expect(() => recovery.dispose()).not.toThrow();
  });

  it('rejects unknown recovery strategies', async () => {
    ({ recovery } = createRecovery());

    await expect(
      recovery._executeRecoveryStrategy('unknown', new Error('boom'), {})
    ).rejects.toThrow('Unknown recovery strategy: unknown');
  });

  it('falls back when a custom strategy throws', async () => {
    ({ recovery } = createRecovery());

    recovery.registerFallbackStrategy('CustomFallbackError', async () => {
      throw AnatomyRenderError.svgRenderingFailed('render', new Error('fail'));
    });

    const result = await recovery._executeCustomFallback(
      new CustomFallbackError('custom fail'),
      { operation: 'render' }
    );

    expect(result.strategy).toBe('fallback');
    expect(result.userMessage).toContain('Using text-based anatomy display');
  });

  it('handles render fallback strategies', async () => {
    ({ recovery } = createRecovery());

    const result = await recovery._executeFallbackStrategy(
      AnatomyRenderError.svgRenderingFailed('draw', new Error('bad svg')),
      { operation: 'render' }
    );

    expect(result.strategy).toBe('fallback');
    expect(result.userMessage).toContain('Using text-based anatomy display');
  });

  it('handles data error fallbacks for missing data and parts', () => {
    ({ recovery } = createRecovery());

    const missingData = AnatomyDataError.missingAnatomyData('entity-1');
    const missingParts = AnatomyDataError.missingAnatomyParts('entity-2', [
      'torso',
    ]);
    const genericFailure = AnatomyDataError.invalidAnatomyStructure(
      'entity-3',
      {},
      'invalid'
    );

    expect(recovery._handleDataErrorFallback(missingData, {})).toEqual(
      expect.objectContaining({
        success: true,
        result: { emptyVisualization: true },
      })
    );
    expect(recovery._handleDataErrorFallback(missingParts, {})).toEqual(
      expect.objectContaining({
        success: true,
        result: { partialVisualization: true },
      })
    );
    expect(recovery._handleDataErrorFallback(genericFailure, {})).toEqual(
      expect.objectContaining({
        success: false,
        userMessage: 'Could not process anatomy data.',
      })
    );
  });

  it('handles render error fallback default branch', () => {
    ({ recovery } = createRecovery());

    const fallback = recovery._handleRenderErrorFallback(
      AnatomyRenderError.viewportConfigError('zoom issue', {}),
      {}
    );

    expect(fallback.success).toBe(false);
    expect(fallback.userMessage).toContain('Could not render anatomy visualization');
  });

  it('handles layout calculation fallback branch', () => {
    ({ recovery } = createRecovery());

    const layoutFallback = recovery._handleRenderErrorFallback(
      AnatomyRenderError.layoutCalculationFailed(
        'hierarchical',
        { nodes: [] },
        new Error('layout too complex')
      ),
      {}
    );

    expect(layoutFallback).toEqual(
      expect.objectContaining({
        success: true,
        result: { simpleLayout: true },
        userMessage: 'Using simplified layout display.',
      })
    );
  });

  it('uses default messaging when custom fallback omits fields', async () => {
    ({ recovery } = createRecovery());

    recovery.registerFallbackStrategy('MinimalFallbackError', async () => ({
      result: { minimal: true },
    }));

    const outcome = await recovery._executeCustomFallback(
      new MinimalFallbackError('no extras'),
      { operation: 'minimal' }
    );

    expect(outcome.userMessage).toBe('Used alternative approach.');
    expect(outcome.suggestions).toEqual([]);
    expect(outcome.result).toEqual({ result: { minimal: true } });
  });

  it('uses fallback defaults when handlers return empty metadata', async () => {
    ({ recovery } = createRecovery());

    const genericFallbackSpy = jest
      .spyOn(recovery, '_handleGenericErrorFallback')
      .mockReturnValue({});

    const result = await recovery._executeFallbackStrategy(
      new Error('incomplete fallback'),
      {}
    );

    expect(result.userMessage).toBe('Used fallback approach.');
    expect(result.suggestions).toEqual([]);
    expect(result.result).toBeNull();

    genericFallbackSpy.mockRestore();
  });

  it('handles state error fallback branches', () => {
    ({ recovery } = createRecovery());

    const invalidTransition = recovery._handleStateErrorFallback(
      AnatomyStateError.invalidStateTransition('IDLE', 'ACTIVE', 'start'),
      {}
    );
    const unknownState = recovery._handleStateErrorFallback(
      AnatomyStateError.stateCorruption('ACTIVE', {}, 'corrupted'),
      {}
    );

    expect(invalidTransition).toEqual(
      expect.objectContaining({
        success: true,
        result: { stateReset: true },
      })
    );
    expect(unknownState).toEqual(
      expect.objectContaining({
        success: false,
        userMessage: 'Visualizer state error occurred.',
      })
    );
  });

  it('uses default fallback for non-fetch TypeError', async () => {
    ({ recovery } = createRecovery());

    const result = await recovery._executeCustomFallback(
      new TypeError('unexpected failure'),
      { operation: 'network-call' }
    );

    expect(result.strategy).toBe('fallback');
    expect(result.userMessage).toContain('An unexpected error occurred');
  });

  it('uses registered network fallback for fetch TypeError', async () => {
    ({ recovery } = createRecovery());

    const result = await recovery._executeCustomFallback(
      new TypeError('fetch failed due to network'),
      { operation: 'network-call' }
    );

    expect(result.strategy).toBe('custom_fallback');
    expect(result.result.result).toEqual({ networkFallback: true });
  });
});
