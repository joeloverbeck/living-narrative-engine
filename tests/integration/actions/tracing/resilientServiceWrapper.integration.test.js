import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { ResilientServiceWrapper } from '../../../../src/actions/tracing/resilience/resilientServiceWrapper.js';
import {
  TraceErrorHandler,
  TraceErrorType,
} from '../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { ErrorMetricsService } from '../../../../src/actions/tracing/metrics/errorMetricsService.js';
import { RecoveryManager } from '../../../../src/actions/tracing/recovery/recoveryManager.js';
import { RetryManager } from '../../../../src/actions/tracing/resilience/retryManager.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

const createWrapperContext = (
  service,
  {
    serviceName = 'TracingService',
    recoveryConfig,
    errorHandlerClass = TraceErrorHandler,
  } = {}
) => {
  const logger = new RecordingLogger();
  const metrics = new ErrorMetricsService({ logger });
  const retryManager = new RetryManager();
  const recoveryManager = new RecoveryManager({
    logger,
    retryManager,
    config: recoveryConfig,
  });
  const errorHandler = new errorHandlerClass({
    logger,
    errorMetrics: metrics,
    recoveryManager,
    config: {},
  });

  const wrapper = new ResilientServiceWrapper({
    service,
    errorHandler,
    logger,
    serviceName,
  });

  return {
    wrapper,
    proxy: wrapper.createResilientProxy(),
    logger,
    metrics,
    recoveryManager,
  };
};

describe('ResilientServiceWrapper integration', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('disables the service when a critical error is recorded and recovers with manual enable', async () => {
    class CriticalService {
      constructor() {
        this.invocations = 0;
      }

      async processData(input) {
        this.invocations += 1;

        if (this.invocations === 1) {
          const error = new Error('memory exhaustion detected');
          error.message = 'memory exhaustion detected';
          return Promise.reject(error);
        }

        return `processed:${input}:${this.invocations}`;
      }

      getFallbackData(input) {
        return `disabled-fallback:${input}`;
      }
    }

    const service = new CriticalService();
    const { wrapper, proxy, logger, metrics } = createWrapperContext(service);

    const firstResult = await proxy.processData('payload');
    expect(firstResult).toBe('disabled-fallback:payload');

    const secondResult = await proxy.processData('payload');
    expect(secondResult).toBe('disabled-fallback:payload');
    expect(wrapper.isEnabled()).toBe(false);

    expect(
      logger.warnLogs.some(
        ([message, context]) =>
          message.includes('Service disabled: TracingService') &&
          context.reason === 'Error pattern threshold exceeded'
      )
    ).toBe(true);

    wrapper.enable();
    expect(wrapper.isEnabled()).toBe(true);
    expect(wrapper.getFallbackMode()).toBeNull();
    expect(
      logger.infoLogs.some(([message]) =>
        message.includes('Service re-enabled: TracingService')
      )
    ).toBe(true);

    const metricsSummary = metrics.getMetrics();
    expect(
      metricsSummary.errorsByType[TraceErrorType.MEMORY]
    ).toBeGreaterThanOrEqual(1);
  });

  it('recovers from fallback via retry and clears fallback mode using real collaborators', async () => {
    jest.useFakeTimers();

    class RecoveringService {
      constructor() {
        this.callCount = 0;
        this.retryAttempted = false;
      }

      async send(payload) {
        this.callCount += 1;

        if (this.callCount === 1 || this.callCount === 3) {
          const fileError = new Error('disk capacity exceeded');
          fileError.code = this.callCount === 1 ? 'ENOSPC' : 'EACCES';
          throw fileError;
        }

        if (this.callCount === 4) {
          if (!this.retryAttempted) {
            this.retryAttempted = true;
            const networkError = new Error('network timeout while sending');
            networkError.code = 'ETIMEDOUT';
            networkError.message = 'network timeout while sending';
            throw networkError;
          }
        }

        if (this.retryAttempted) {
          return `sent:${payload}:retry`;
        }

        return `sent:${payload}:${this.callCount}`;
      }

      getFallbackData(payload) {
        return `fallback:${payload}:${this.callCount}`;
      }
    }

    const service = new RecoveringService();
    const { wrapper, proxy, logger } = createWrapperContext(service);

    const firstFallback = await proxy.send('trace');
    expect(firstFallback).toBe('fallback:trace:1');
    expect(wrapper.getFallbackMode()).toBe('no-op');

    const secondAttempt = await proxy.send('trace');
    expect(secondAttempt).toBe('sent:trace:2');
    expect(wrapper.getFallbackMode()).toBeNull();
    expect(
      logger.infoLogs.some(([message]) =>
        message.includes('Service recovered from fallback mode: TracingService')
      )
    ).toBe(true);

    const thirdFallback = await proxy.send('trace');
    expect(thirdFallback).toBe('fallback:trace:3');
    expect(wrapper.getFallbackMode()).toBe('no-op');

    const retryPromise = proxy.send('trace');
    await jest.runOnlyPendingTimersAsync();
    const retryResult = await retryPromise;
    expect(retryResult).toBe('sent:trace:retry');
    expect(wrapper.getFallbackMode()).toBeNull();
  });

  it('logs fallback failures, disables via circuit breaker, and provides disabled fallbacks', async () => {
    class DegradedService {
      constructor() {
        this.calls = 0;
      }

      async writeTrace(payload) {
        this.calls += 1;
        const error = new Error(`storage denied for ${payload}`);
        error.code = 'EACCES';
        throw error;
      }

      getFallbackData() {
        throw new Error('fallback pipeline failed');
      }

      async shouldTrace() {
        const validationError = new Error('invalid state');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      async isEnabled() {
        const validationError = new Error('validation');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      async getConfig() {
        return { traced: true };
      }
    }

    const service = new DegradedService();
    const { wrapper, proxy, logger } = createWrapperContext(service);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await proxy.writeTrace('record');
      expect(result).toBeUndefined();
    }

    expect(
      logger.errorLogs.some(([message]) =>
        message.includes('Fallback method also failed')
      )
    ).toBe(true);

    expect(wrapper.isEnabled()).toBe(false);
    expect(
      logger.warnLogs.some(
        ([message, context]) =>
          message.includes('Service disabled: TracingService') &&
          context.reason === 'Error handler requested disable'
      )
    ).toBe(true);

    const disabledWrite = await proxy.writeTrace('record');
    expect(disabledWrite).toBeUndefined();
    expect(
      logger.errorLogs.some(([message]) =>
        message.includes('Fallback method failed for disabled service')
      )
    ).toBe(true);

    const shouldTraceResult = await proxy.shouldTrace();
    expect(shouldTraceResult).toBe(false);

    const isEnabledResult = await proxy.isEnabled();
    expect(isEnabledResult).toBe(false);

    const configResult = await proxy.getConfig();
    expect(configResult).toEqual({});
  });

  it('resets error tracking after inactivity and disables when exceeding internal threshold', async () => {
    jest.useFakeTimers();
    const initialTime = new Date('2024-01-01T00:00:00Z').getTime();
    jest.setSystemTime(initialTime);

    class ThresholdBypassErrorHandler extends TraceErrorHandler {
      shouldDisableComponent() {
        return false;
      }
    }

    class ThresholdService {
      constructor() {
        this.calls = 0;
      }

      async processData() {
        this.calls += 1;
        const serializationError = new SyntaxError('bad format encountered');
        throw serializationError;
      }
    }

    const service = new ThresholdService();
    const { wrapper, proxy, metrics, logger } = createWrapperContext(service, {
      recoveryConfig: { circuitBreaker: { threshold: 100 } },
      errorHandlerClass: ThresholdBypassErrorHandler,
    });

    for (let i = 0; i < 2; i += 1) {
      const result = await proxy.processData();
      expect(result).toBe('fallback-data');
    }

    jest.setSystemTime(initialTime + 301000);

    for (let i = 0; i < 5; i += 1) {
      const result = await proxy.processData();
      expect(result).toBe('fallback-data');
    }

    const finalResult = await proxy.processData();
    expect(finalResult).toBeUndefined();

    expect(wrapper.isEnabled()).toBe(false);
    expect(
      metrics.getMetrics().errorsByType[TraceErrorType.SERIALIZATION]
    ).toBeGreaterThan(0);
    expect(metrics.getMetrics().totalErrors >= 7).toBe(true);
    expect(
      logger.warnLogs.some(
        ([message, context]) =>
          message.includes('Service disabled: TracingService') &&
          context.reason === 'Error threshold exceeded'
      )
    ).toBe(true);
  });
});
