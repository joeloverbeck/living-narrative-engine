import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClothingErrorHandler } from '../../../src/clothing/errors/clothingErrorHandler.js';
import {
  ClothingServiceError,
  CoverageAnalysisError,
  PriorityCalculationError,
  ClothingValidationError,
  ClothingAccessibilityError,
} from '../../../src/clothing/errors/clothingErrors.js';
import EventBus from '../../../src/events/eventBus.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../../src/errors/RecoveryStrategyManager.js';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';

/**
 *
 */
function createTestLogger() {
  const logs = [];
  const makeRecorder = (level) => (...args) => {
    logs.push({ level, args });
  };
  return {
    logs,
    debug: makeRecorder('debug'),
    info: makeRecorder('info'),
    warn: makeRecorder('warn'),
    error: makeRecorder('error'),
  };
}

/**
 *
 * @param root0
 * @param root0.includeCentral
 */
function createHarness({ includeCentral = false } = {}) {
  const logger = createTestLogger();
  const eventBus = new EventBus({ logger });
  const monitoringCoordinator = new MonitoringCoordinator({
    logger,
    eventBus,
    enabled: false,
  });

  // Ensure health checks remain disabled during tests
  monitoringCoordinator.setEnabled(false);

  let centralErrorHandler = null;
  let recoveryStrategyManager = null;

  if (includeCentral) {
    centralErrorHandler = new CentralErrorHandler({
      logger,
      eventBus,
      monitoringCoordinator,
    });
    recoveryStrategyManager = new RecoveryStrategyManager({
      logger,
      monitoringCoordinator,
    });
  }

  const dispatchEvents = [];
  const originalDispatch = eventBus.dispatch.bind(eventBus);
  eventBus.dispatch = (eventNameOrEvent, eventPayload = {}) => {
    if (typeof eventNameOrEvent === 'object' && eventNameOrEvent !== null) {
      const event = eventNameOrEvent;
      dispatchEvents.push(event);
      if (event.type === 'CLOTHING_ERROR_OCCURRED') {
        return undefined;
      }
      return originalDispatch(event.type, event.payload);
    }

    dispatchEvents.push({ type: eventNameOrEvent, payload: eventPayload });
    if (eventNameOrEvent === 'CLOTHING_ERROR_OCCURRED') {
      return undefined;
    }
    return originalDispatch(eventNameOrEvent, eventPayload);
  };

  const clothingErrorHandler = new ClothingErrorHandler({
    logger,
    eventBus,
    centralErrorHandler,
    recoveryStrategyManager,
  });

  return {
    logger,
    eventBus,
    monitoringCoordinator,
    centralErrorHandler,
    recoveryStrategyManager,
    clothingErrorHandler,
    dispatchEvents,
  };
}

describe('ClothingErrorHandler integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('handles clothing-specific errors locally with recovery fallbacks and metrics', async () => {
    const { clothingErrorHandler, dispatchEvents } = harness;

    const accessibilityError = new ClothingServiceError(
      'Accessibility service failed',
      'ClothingAccessibilityService',
      'scan-accessibility',
      { stage: 'accessibility' }
    );

    const coverageError = new CoverageAnalysisError('Coverage analysis failed', {
      items: ['vest'],
    });

    const priorityError = new PriorityCalculationError(
      'Priority calculation failed',
      'outer',
      { attempted: true },
      { layerPriority: 5 }
    );

    const validationError = new ClothingValidationError(
      'Invalid clothing data',
      'size',
      'XXL',
      'number'
    );

    const accessibilityContext = { requestId: 'req-1' };
    const coverageContext = { requestId: 'req-2' };
    const priorityContext = { requestId: 'req-3' };
    const validationContext = { requestId: 'req-4' };

    const results = [];
    results.push(await clothingErrorHandler.handleError(accessibilityError, accessibilityContext));
    results.push(await clothingErrorHandler.handleError(coverageError, coverageContext));
    results.push(await clothingErrorHandler.handleError(priorityError, priorityContext));
    results.push(await clothingErrorHandler.handleError(validationError, validationContext));

    const simpleAccessibility = await clothingErrorHandler.handleError(
      new ClothingAccessibilityError(
        'Target is not accessible',
        'actor-1',
        'item-1'
      ),
      { requestId: 'req-5' }
    );
    results.push(simpleAccessibility);

    const unknownErrorResult = await clothingErrorHandler.handleError(
      new Error('Unexpected failure'),
      { requestId: 'req-6' }
    );
    results.push(unknownErrorResult);

    expect(results[0].recovered).toBe(true);
    expect(results[0].fallbackData).toEqual({
      mode: 'legacy',
      items: [],
      accessible: true,
    });

    expect(results[1].fallbackData).toEqual({
      mode: 'layer_only',
      blockingDisabled: true,
    });

    expect(results[2].fallbackData).toEqual({
      mode: 'default_priorities',
      priorities: {
        outer: 1,
        base: 2,
        underwear: 3,
        accessories: 4,
      },
    });

    expect(results[3].fallbackData).toEqual({
      mode: 'sanitized',
      retryable: true,
      sanitizedField: 'size',
      sanitizedValue: null,
    });

    expect(results[4].fallbackData).toEqual({
      mode: 'simple_accessibility',
      allAccessible: true,
    });

    expect(results[5]).toEqual({
      errorId: expect.any(String),
      recovered: false,
      fallbackData: null,
      recoveryStrategy: 'none',
    });

    const clothingEvents = dispatchEvents.filter(
      (event) => event.type === 'CLOTHING_ERROR_OCCURRED'
    );
    expect(clothingEvents.length).toBe(6);
    expect(clothingEvents[0].payload.errorType).toBe('ClothingServiceError');
    expect(clothingEvents[5].payload.errorType).toBe('Error');

    const metrics = harness.clothingErrorHandler.getErrorMetrics();
    expect(metrics.ClothingServiceError.count).toBe(1);
    expect(metrics.CoverageAnalysisError.count).toBe(1);
    expect(metrics.PriorityCalculationError.count).toBe(1);
    expect(metrics.ClothingValidationError.count).toBe(1);
    expect(metrics.ClothingAccessibilityError.count).toBe(1);
    expect(metrics.Error.count).toBe(1);

    harness.clothingErrorHandler.clearMetrics();
    expect(harness.clothingErrorHandler.getErrorMetrics()).toEqual({});
  });

  it('delegates to the central error handler when configured', async () => {
    const harnessWithCentral = createHarness({ includeCentral: true });
    const { clothingErrorHandler, centralErrorHandler } = harnessWithCentral;

    centralErrorHandler.registerRecoveryStrategy(
      'ClothingValidationError',
      async (errorInfo) => ({
        handledBy: 'central',
        errorId: errorInfo.id,
        contextStage: errorInfo.context.stage,
      })
    );

    const result = await clothingErrorHandler.handleError(
      new ClothingValidationError('Schema mismatch', 'material', 'felt', 'string'),
      { stage: 'validation' }
    );

    expect(result).toEqual({
      handledBy: 'central',
      errorId: expect.any(String),
      contextStage: 'validation',
    });

    expect(clothingErrorHandler.getErrorMetrics()).toEqual({});
  });

  it('falls back to local handling when the central handler recovery fails', async () => {
    const harnessWithCentral = createHarness({ includeCentral: true });
    const { clothingErrorHandler, centralErrorHandler } = harnessWithCentral;

    centralErrorHandler.registerRecoveryStrategy('CoverageAnalysisError', () => {
      throw new Error('central strategy failure');
    });

    const result = await clothingErrorHandler.handleError(
      new CoverageAnalysisError('Coverage graph failure', { items: ['coat'] }),
      { stage: 'analysis' }
    );

    expect(result.recovered).toBe(true);
    expect(result.fallbackData).toEqual({
      mode: 'layer_only',
      blockingDisabled: true,
    });
  });

  it('supports synchronous error handling through the central handler', () => {
    const harnessWithCentral = createHarness({ includeCentral: true });
    const { clothingErrorHandler, centralErrorHandler } = harnessWithCentral;

    const syncStrategy = (errorInfo) => ({
      handled: true,
      stage: errorInfo.context.stage,
    });
    syncStrategy.sync = true;
    syncStrategy.fallback = (errorInfo) => ({
      handled: true,
      stage: errorInfo.context.stage,
      via: 'sync-fallback',
    });

    centralErrorHandler.registerRecoveryStrategy('ClothingAccessibilityError', syncStrategy);

    const result = clothingErrorHandler.handleErrorSync(
      new ClothingAccessibilityError('Cannot reach item', 'actor-22', 'item-9'),
      { stage: 'synchronous' }
    );

    expect(result).toEqual({
      handled: true,
      stage: 'synchronous',
      via: 'sync-fallback',
    });
  });

  it('logs a warning and falls back locally when the central sync handler throws', () => {
    const harnessWithCentral = createHarness({ includeCentral: true });
    const { clothingErrorHandler, centralErrorHandler, logger } = harnessWithCentral;

    const syncFailure = () => {
      throw new Error('sync failure');
    };
    centralErrorHandler.handleSync = syncFailure;

    const result = clothingErrorHandler.handleErrorSync(
      new ClothingServiceError('Sync central failure', 'ClothingAccessibilityService', 'sync-handle'),
      { stage: 'sync-failure' }
    );

    expect(result.recovered).toBe(true);
    expect(
      logger.logs.some(
        (entry) =>
          entry.level === 'warn' &&
          entry.args[0] === 'Central error handler failed, using local handling'
      )
    ).toBe(true);
  });

  it('registers clothing recovery strategies with the recovery manager', async () => {
    const harnessWithCentral = createHarness({ includeCentral: true });
    const { recoveryStrategyManager } = harnessWithCentral;

    const legacyFallback = await recoveryStrategyManager.executeWithRecovery(
      async () => {
        throw new Error('primary failure');
      },
      {
        operationName: 'legacy-check',
        errorType: 'ClothingServiceError',
        useCircuitBreaker: false,
        cacheResult: false,
      }
    );

    expect(legacyFallback).toEqual({ mode: 'legacy', items: [], accessible: true });
  });
});
