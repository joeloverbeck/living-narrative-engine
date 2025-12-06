import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ExecutionPhaseTimer } from '../../../../src/actions/tracing/timing/executionPhaseTimer.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

const baseOptions = {
  actionId: 'coverage:action',
  actorId: 'coverage:actor',
  turnAction: {
    actionDefinitionId: 'coverage:action',
    commandString: 'do something',
    parameters: { value: 1 },
  },
};

describe('ActionExecutionTrace additional coverage validations', () => {
  let trace;
  let originalPerformance;

  beforeEach(() => {
    trace = new ActionExecutionTrace(baseOptions);
    originalPerformance = globalThis.performance;
  });

  afterEach(() => {
    globalThis.performance = originalPerformance;
    jest.restoreAllMocks();
  });

  it('finalizes timing when errors occur while the timer is active', () => {
    const endExecutionSpy = jest.spyOn(
      ExecutionPhaseTimer.prototype,
      'endExecution'
    );
    const addMarkerSpy = jest.spyOn(ExecutionPhaseTimer.prototype, 'addMarker');
    const isActiveSpy = jest.spyOn(ExecutionPhaseTimer.prototype, 'isActive');

    // Force the high precision timer to fall back to Date.now for coverage
    globalThis.performance = undefined;

    trace.captureDispatchStart();
    const error = new Error('catastrophic failure');
    trace.captureError(error);

    expect(isActiveSpy).toHaveBeenCalled();
    expect(addMarkerSpy).toHaveBeenCalledWith(
      'error_occurred',
      null,
      expect.objectContaining({
        errorType: 'Error',
        errorMessage: 'catastrophic failure',
        errorCategory: 'unknown',
      })
    );
    expect(endExecutionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Error',
        errorCategory: 'unknown',
      })
    );

    const capturedError = trace.getError();
    expect(capturedError.message).toBe('catastrophic failure');
    expect(capturedError.type).toBe('Error');
    expect(capturedError.stack).toEqual(expect.any(String));

    const phases = trace.getExecutionPhases();
    const errorPhase = phases.find((phase) => phase.phase === 'error_captured');
    expect(errorPhase).toBeDefined();
    expect(errorPhase.description).toContain('catastrophic failure');
    expect(errorPhase.errorType).toBe('Error');
  });

  it('serializes full execution data including timing metadata and error history', () => {
    const exportTimingSpy = jest
      .spyOn(ExecutionPhaseTimer.prototype, 'exportTimingData')
      .mockReturnValue({ totalDuration: 42 });

    trace.captureDispatchStart();
    trace.captureEventPayload({
      safe: true,
      trace: { circular: true },
      credential: 'secret',
    });
    trace.captureOperationStart(
      { type: 'effect', parameters: { foo: 'bar' } },
      0
    );
    trace.captureOperationResult({ success: true });

    const firstError = new Error('first failure');
    trace.addErrorToHistory(firstError, { phase: 'pre-check' });

    const terminalError = new Error('terminal failure');
    trace.captureError(terminalError);

    const json = trace.toJSON();

    expect(exportTimingSpy).toHaveBeenCalled();
    expect(json.timing).toEqual({ totalDuration: 42 });
    expect(json.eventPayload.credential).toBe('[REDACTED]');
    expect(json.eventPayload.trace).toBeUndefined();
    expect(json.execution.operations).toHaveLength(1);
    expect(json.errorHistory).toHaveLength(1);
    expect(json.error.message).toBe('terminal failure');
    expect(json.errorData).toEqual(
      expect.objectContaining({
        message: 'terminal failure',
        type: 'Error',
      })
    );
    expect(json.hasMultipleErrors).toBe(true);
  });

  it('produces detailed summaries and reports with error analysis insights', () => {
    const analysisTrace = new ActionExecutionTrace({
      ...baseOptions,
      enableErrorAnalysis: true,
    });

    const classification = {
      category: 'system',
      severity: 'high',
      isRetryable: true,
      recoveryPotential: 'immediate',
      troubleshooting: ['Restart subsystem'],
      confidence: 0.9,
    };

    jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockReturnValue(classification);
    jest
      .spyOn(StackTraceAnalyzer.prototype, 'parseStackTrace')
      .mockReturnValue({ tokens: [] });
    jest
      .spyOn(StackTraceAnalyzer.prototype, 'getErrorLocation')
      .mockReturnValue({
        shortFile: 'engine.js',
        function: 'performAction',
        line: 88,
        column: 13,
      });
    jest
      .spyOn(StackTraceAnalyzer.prototype, 'formatStackTrace')
      .mockReturnValue('formatted stack');

    analysisTrace.captureDispatchStart();
    const error = new Error('analysis failure');
    error.stack =
      'Error: analysis failure\n at performAction (engine.js:88:13)';
    analysisTrace.captureError(error);

    const summary = analysisTrace.getErrorSummary();
    expect(summary).toEqual(
      expect.objectContaining({
        message: 'analysis failure',
        category: 'system',
        severity: 'high',
        isRetryable: true,
        location: expect.objectContaining({ file: 'engine.js', line: 88 }),
      })
    );

    const report = analysisTrace.getErrorReport();
    expect(report).toContain('ACTION EXECUTION ERROR REPORT');
    expect(report).toContain('Error Type: Error');
    expect(report).toContain('Category: system');
    expect(report).toContain('Severity: high');
    expect(report).toContain('Error Location:');
    expect(report).toContain('Line: 88:13');
    expect(report).toContain('Troubleshooting Steps:');
    expect(report).toContain('Stack Trace:');
    expect(report).toContain('formatted stack');

    expect(analysisTrace.isErrorRecoverable()).toBe(true);
  });
});
