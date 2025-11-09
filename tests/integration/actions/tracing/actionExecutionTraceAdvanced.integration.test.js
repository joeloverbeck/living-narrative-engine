import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

describe('ActionExecutionTrace advanced integration coverage', () => {
  /**
   * Helper to create a fully configured trace using production collaborators.
   *
   * @param {object} [options] Optional overrides for trace configuration.
   * @returns {ActionExecutionTrace}
   */
  function createTrace(options = {}) {
    return new ActionExecutionTrace({
      actionId: 'action.test',
      actorId: 'actor.test',
      turnAction: {
        actionDefinitionId: 'action.def',
        commandString: '/test-command',
        parameters: { attempt: 1 },
      },
      ...options,
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles classification/analysis failures and maintains detailed error history', () => {
    const trace = createTrace({ enableTiming: true, enableErrorAnalysis: true });
    trace.captureDispatchStart();
    trace.captureEventPayload({ source: 'integration', step: 'initial' });

    // Capture the baseline error so subsequent updates exercise the multi-error flow.
    const initialError = new Error('Network timeout occurred');
    trace.captureError(initialError, { phase: 'network_request' });

    expect(trace.hasError).toBe(true);

    // When the lock is engaged, duplicate capture requests should be ignored.
    ActionExecutionTrace.__setProcessingLockForTesting(trace, true);
    trace.captureError(new Error('should be ignored while locked'));
    ActionExecutionTrace.__setProcessingLockForTesting(trace, false);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const originalClassify = ErrorClassifier.prototype.classifyError;
    const originalParse = StackTraceAnalyzer.prototype.parseStackTrace;

    ErrorClassifier.prototype.classifyError = function () {
      throw new Error('classification exploded');
    };
    StackTraceAnalyzer.prototype.parseStackTrace = function () {
      throw new Error('parse exploded');
    };

    const retryError = new Error('Retry attempt failed');
    trace.captureError(retryError, { phase: 'retry_execution' }, true);

    expect(warnSpy).toHaveBeenCalledWith(
      'Error classification failed:',
      'classification exploded'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Stack trace analysis failed:',
      'parse exploded'
    );

    // Restore production behavior so the final update exercises the success path.
    ErrorClassifier.prototype.classifyError = originalClassify;
    StackTraceAnalyzer.prototype.parseStackTrace = originalParse;

    const historyAfterRetry = trace.getErrorHistory();
    expect(historyAfterRetry).toHaveLength(1);
    expect(historyAfterRetry[0].message).toBe('Network timeout occurred');
    expect(trace.hasMultipleErrors()).toBe(true);

    const summaryAfterRetry = trace.getErrorSummary();
    expect(summaryAfterRetry).toMatchObject({
      type: 'Error',
      message: 'Retry attempt failed',
      category: 'unknown',
      severity: 'medium',
      isRetryable: false,
    });

    const report = trace.getErrorReport();
    expect(report).toContain('ACTION EXECUTION ERROR REPORT');
    expect(report).toContain('Retry attempt failed');

    expect(trace.isErrorRecoverable()).toBe(true);

    // Updating the error should promote the current error into history and capture the new context.
    trace.updateError(new Error('Final failure observed'), {
      phase: 'finalization',
      retryCount: 2,
    });

    const finalHistory = trace.getErrorHistory();
    expect(finalHistory).toHaveLength(2);
    expect(finalHistory[0].message).toBe('Network timeout occurred');
    expect(finalHistory[1].message).toBe('Retry attempt failed');

    const finalSummary = trace.getErrorSummary();
    expect(finalSummary.message).toBe('Final failure observed');
    expect(finalSummary.troubleshooting.length).toBeGreaterThanOrEqual(0);

    const timingSummary = trace.getTimingSummary();
    expect(timingSummary).not.toBeNull();

    const json = trace.toJSON();
    expect(json.execution.status).toBe('error');
    expect(json.errorHistory).toHaveLength(2);
    expect(json.timing).toBeDefined();
  });

  it('tracks operations, sanitizes payloads, and reports failure status without timing', () => {
    const trace = createTrace({ enableTiming: false });

    trace.addErrorToHistory(new Error('pre-dispatch validation warning'));
    expect(trace.getErrorHistory()).toHaveLength(1);
    expect(trace.hasMultipleErrors()).toBe(true);

    trace.captureDispatchStart();

    const payload = {
      token: 'secret-token',
      credential: 'super-secret',
      nested: {
        password: 'p@ssw0rd',
        meta: { secret: 'classified' },
      },
      trace,
      huge: BigInt(42),
    };

    trace.captureEventPayload(payload);
    trace.captureOperationStart(
      { type: 'simulate', parameters: { attempt: 1 } },
      0
    );
    trace.captureOperationResult({ success: false, error: 'Validation failed' });
    trace.captureDispatchResult({ success: false, metadata: { reason: 'Validation' } });

    const operations = trace.getOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].result).toEqual({
      success: false,
      error: 'Validation failed',
    });

    const phases = trace.getExecutionPhases();
    const payloadPhase = phases.find((phase) => phase.phase === 'payload_captured');
    expect(payloadPhase.payloadSize).toBe(0);
    expect(phases.some((phase) => phase.phase === 'operation_completed')).toBe(true);

    expect(trace.getTimingSummary()).toBeNull();
    expect(trace.duration).not.toBeNull();

    const json = trace.toJSON();
    expect(json.eventPayload.token).toBe('[REDACTED]');
    expect(json.eventPayload.credential).toBe('[REDACTED]');
    expect(json.eventPayload.nested.password).toBe('[REDACTED]');
    expect(json.eventPayload.nested.meta.secret).toBe('[REDACTED]');
    expect(json.eventPayload.trace).toBeUndefined();
    expect(json.execution.operations).toHaveLength(1);
    expect(json.execution.status).toBe('failed');

    expect(trace.getErrorReport()).toBe('No error occurred during execution');
    expect(trace.isErrorRecoverable()).toBe(true);

    const summary = trace.toSummary();
    expect(summary).toContain('Status: failed');
  });

  it('exposes pending status before dispatch and returns unknown phase when no phases exist', () => {
    const trace = createTrace({ enableTiming: false });

    const pendingJson = trace.toJSON();
    expect(pendingJson.execution.status).toBe('pending');

    trace.addErrorToHistory(new Error('history without phases'));
    const history = trace.getErrorHistory();
    expect(history[0].context.phase).toBe('unknown');

    // Sanitize a non-object payload to cover the fast path.
    trace.captureDispatchStart();
    trace.captureEventPayload('raw-string-payload');

    trace.captureDispatchResult({ success: true });
    expect(trace.toJSON().execution.status).toBe('success');
  });
});
