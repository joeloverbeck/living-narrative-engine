/**
 * @file Integration tests for ErrorRecovery using real logger and event bus collaborators.
 */

import { describe, it, expect, jest } from '@jest/globals';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import EventBus from '../../../src/events/eventBus.js';
import { ErrorRecovery } from '../../../src/domUI/visualizer/ErrorRecovery.js';
import { AnatomyDataError } from '../../../src/errors/anatomyDataError.js';
import { AnatomyRenderError } from '../../../src/errors/anatomyRenderError.js';
import { AnatomyStateError } from '../../../src/errors/anatomyStateError.js';

const waitForEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

function createLogger() {
  const logger = new ConsoleLogger('DEBUG');
  logger.setLogLevel('DEBUG');
  return logger;
}

function createErrorRecovery(options = {}) {
  const logger = createLogger();
  const eventDispatcher = new EventBus({ logger });
  const errorRecovery = new ErrorRecovery(
    { logger, eventDispatcher },
    { maxRetryAttempts: 2, retryDelayMs: 5, useExponentialBackoff: false, ...options }
  );

  return { logger, eventDispatcher, errorRecovery };
}

describe('ErrorRecovery integration', () => {
  it('retries recoverable network failures and emits error events', async () => {
    const { errorRecovery, eventDispatcher } = createErrorRecovery({
      maxRetryAttempts: 2,
      retryDelayMs: 5,
      useExponentialBackoff: false,
    });

    const dispatchedEvents = [];
    const unsubscribe = eventDispatcher.subscribe(
      'anatomy:visualizer_error',
      async (event) => {
        dispatchedEvents.push(event);
      }
    );

    const retryCallback = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed: temporary outage'))
      .mockResolvedValueOnce({ payload: 'cached-anatomy' });

    const result = await errorRecovery.handleError(
      new TypeError('fetch failed: temporary outage'),
      {
        operation: 'fetch-visualization',
        retryCallback,
        data: { entityId: 'npc-42' },
      }
    );
    await waitForEventLoop();
    unsubscribe?.();

    expect(result).toMatchObject({
      success: true,
      strategy: 'retry',
      attempt: 2,
      result: { payload: 'cached-anatomy' },
    });
    expect(retryCallback).toHaveBeenCalledTimes(2);
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].payload.strategy).toBe('retry');

    const [latestHistory] = errorRecovery.getErrorHistory(1);
    expect(latestHistory.context.operation).toBe('fetch-visualization');
  });

  it('uses the built-in network fallback strategy when retries are disabled', async () => {
    const { errorRecovery } = createErrorRecovery({ maxRetryAttempts: -1 });

    const result = await errorRecovery.handleError(
      new TypeError('fetch failed: offline mode'),
      { operation: 'bootstrap' }
    );

    expect(result.strategy).toBe('custom_fallback');
    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({
      result: { networkFallback: true },
      userMessage: 'Network issue detected. Using cached data if available.',
    });
    expect(result.userMessage).toBe(
      'Network issue detected. Using cached data if available.'
    );
  });

  it('falls back to the generic strategy when the custom network fallback rejects', async () => {
    const { errorRecovery } = createErrorRecovery({ maxRetryAttempts: -1 });

    const result = await errorRecovery.handleError(
      new TypeError('Type mismatch during parsing'),
      { operation: 'bootstrap' }
    );

    expect(result.strategy).toBe('fallback');
    expect(result.userMessage).toBe('An unexpected error occurred.');
    expect(result.suggestions).toContain('Contact support if the problem persists');
  });

  const fallbackScenarios = [
    {
      description: 'missing anatomy data uses empty visualization fallback',
      errorFactory: () => AnatomyDataError.missingAnatomyData('npc-1', 'anatomy:body'),
      expectation: (result) => {
        expect(result.strategy).toBe('fallback');
        expect(result.result).toEqual({ emptyVisualization: true });
        expect(result.userMessage).toBe('No anatomy data available for this entity.');
      },
    },
    {
      description: 'missing anatomy parts returns partial visualization',
      errorFactory: () =>
        AnatomyDataError.missingAnatomyParts('npc-2', ['arm', 'leg']),
      expectation: (result) => {
        expect(result.result).toEqual({ partialVisualization: true });
        expect(result.userMessage).toBe('Showing available anatomy parts only.');
      },
    },
    {
      description: 'unrecognized data error triggers default message',
      errorFactory: () =>
        AnatomyDataError.invalidAnatomyStructure('npc-3', { parts: [] }, 'missing joints'),
      expectation: (result) => {
        expect(result.success).toBe(false);
        expect(result.userMessage).toBe('Could not process anatomy data.');
      },
    },
    {
      description: 'SVG rendering failures switch to text fallback',
      errorFactory: () =>
        AnatomyRenderError.svgRenderingFailed('initial render', new Error('svg error')),
      expectation: (result) => {
        expect(result.result).toEqual({ textFallback: true });
        expect(result.userMessage).toBe('Using text-based anatomy display.');
      },
    },
    {
      description: 'layout calculation failures use simplified layout',
      errorFactory: () =>
        AnatomyRenderError.layoutCalculationFailed('grid', { parts: [] }, new Error('layout')),
      expectation: (result) => {
        expect(result.result).toEqual({ simpleLayout: true });
        expect(result.userMessage).toBe('Using simplified layout display.');
      },
    },
    {
      description: 'other render errors show generic render fallback',
      errorFactory: () => AnatomyRenderError.domElementNotFound('root', 'mount'),
      expectation: (result) => {
        expect(result.success).toBe(false);
        expect(result.userMessage).toBe('Could not render anatomy visualization.');
      },
    },
    {
      description: 'invalid state transitions reset the visualizer',
      errorFactory: () =>
        AnatomyStateError.invalidStateTransition('LOADING', 'READY', 'render'),
      expectation: (result) => {
        expect(result.result).toEqual({ stateReset: true });
        expect(result.userMessage).toBe('Visualizer state has been reset.');
      },
    },
    {
      description: 'operation timeouts provide targeted suggestions',
      errorFactory: () =>
        AnatomyStateError.operationTimeout('load anatomy', 1500, 'LOADING'),
      expectation: (result) => {
        expect(result.success).toBe(false);
        expect(result.userMessage).toBe('Operation timed out.');
      },
    },
    {
      description: 'other state errors show the default state fallback',
      errorFactory: () =>
        AnatomyStateError.stateCorruption('ACTIVE', { parts: [] }, 'invalid linkage'),
      expectation: (result) => {
        expect(result.success).toBe(false);
        expect(result.userMessage).toBe('Visualizer state error occurred.');
      },
    },
    {
      description: 'generic errors fall back to the unexpected error handler',
      errorFactory: () => new Error('unexpected failure'),
      expectation: (result) => {
        expect(result.strategy).toBe('fallback');
        expect(result.userMessage).toBe('An unexpected error occurred.');
        expect(result.suggestions).toContain(
          'Contact support if the problem persists'
        );
      },
    },
  ];

  it.each(fallbackScenarios)(
    '%s',
    async ({ errorFactory, expectation }) => {
      const { errorRecovery } = createErrorRecovery({ maxRetryAttempts: -1 });
      const result = await errorRecovery.handleError(errorFactory(), {
        operation: 'visualizer-operation',
      });
      await waitForEventLoop();
      expectation(result);
    }
  );

  it('trims error history and prevents usage after disposal', async () => {
    const { errorRecovery } = createErrorRecovery({ maxRetryAttempts: -1 });

    for (let i = 0; i < 55; i += 1) {
      await errorRecovery.handleError(new Error(`failure-${i}`), {
        operation: `op-${i}`,
      });
    }

    const history = errorRecovery.getErrorHistory(100);
    expect(history).toHaveLength(50);
    expect(history[0].context.operation).toBe('op-5');

    errorRecovery.dispose();
    expect(errorRecovery.isDisposed()).toBe(true);

    await expect(
      errorRecovery.handleError(new Error('after-dispose'), {
        operation: 'final-op',
      })
    ).rejects.toThrow('ErrorRecovery instance has been disposed');
  });

  it('logs a warning when the event dispatcher throws synchronously', async () => {
    const logger = createLogger();
    const warnSpy = jest.spyOn(logger, 'warn');

    class ThrowingEventDispatcher extends EventBus {
      dispatch() {
        throw new Error('dispatcher offline for coverage');
      }
    }

    const eventDispatcher = new ThrowingEventDispatcher({ logger });
    const errorRecovery = new ErrorRecovery(
      { logger, eventDispatcher },
      { maxRetryAttempts: 0 }
    );

    const result = await errorRecovery.handleError(new Error('ui failure'), {
      operation: 'render-step',
    });

    expect(result.strategy).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to dispatch error event:',
      expect.objectContaining({ message: 'dispatcher offline for coverage' })
    );

    warnSpy.mockRestore();
  });
});
