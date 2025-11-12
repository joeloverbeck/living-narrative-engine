import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ExecutionPhaseTimer } from '../../../../src/actions/tracing/timing/executionPhaseTimer.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

const baseOptions = {
  actionId: 'trace-action',
  actorId: 'actor-42',
  turnAction: {
    actionDefinitionId: 'action.def',
    commandString: 'do-something',
    parameters: {
      difficulty: 'hard',
      retries: 1,
    },
  },
};

describe('ActionExecutionTrace uncovered scenarios', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('handles error analysis failures while still recording error details', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const addMarkerSpy = jest.spyOn(
      ExecutionPhaseTimer.prototype,
      'addMarker'
    );
    const endExecutionSpy = jest.spyOn(
      ExecutionPhaseTimer.prototype,
      'endExecution'
    );

    jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockImplementation(() => {
        throw new Error('classification exploded');
      });

    jest
      .spyOn(StackTraceAnalyzer.prototype, 'parseStackTrace')
      .mockImplementation(() => {
        throw new Error('unable to parse stack');
      });

    const trace = new ActionExecutionTrace({
      ...baseOptions,
      enableTiming: true,
      enableErrorAnalysis: true,
    });

    trace.captureDispatchStart();

    const error = new Error('catastrophic failure');
    error.stack = `Error: catastrophic failure\n    at failingFn (${process.cwd()}/src/file.js:12:34)`;

    trace.captureError(error, { retryCount: 1 });

    expect(warnSpy).toHaveBeenCalledWith(
      'Error classification failed:',
      'classification exploded'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Stack trace analysis failed:',
      'unable to parse stack'
    );

    expect(addMarkerSpy).toHaveBeenCalledWith(
      'error_occurred',
      null,
      expect.objectContaining({
        errorType: 'Error',
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
    expect(capturedError).toMatchObject({
      message: 'catastrophic failure',
      type: 'Error',
      classification: expect.objectContaining({
        category: 'unknown',
        severity: 'medium',
      }),
    });

    const phases = trace.getExecutionPhases();
    expect(phases[phases.length - 1]).toMatchObject({
      phase: 'error_captured',
      description: expect.stringContaining('catastrophic failure'),
    });
  });

  it('produces rich serialization, summaries, and reports with location metadata', () => {
    const classificationResult = {
      category: 'logic',
      severity: 'high',
      recoveryPotential: 'immediate',
      isTransient: true,
      isRetryable: true,
      confidence: 0.75,
      troubleshooting: ['Restart the orchestrator', 'Escalate to SRE team'],
    };

    jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockReturnValue(classificationResult);

    const stackAnalysis = {
      errorMessage: 'Error: detailed failure',
      frames: [
        {
          functionName: 'performDangerousOperation',
          fileName: `${process.cwd()}/src/services/doThing.js`,
          shortFileName: 'src/services/doThing.js',
          lineNumber: 42,
          columnNumber: 9,
          isProjectCode: true,
          isNodeModules: false,
          isNativeCode: false,
        },
      ],
      analysis: {},
    };

    jest
      .spyOn(StackTraceAnalyzer.prototype, 'parseStackTrace')
      .mockReturnValue(stackAnalysis);
    jest
      .spyOn(StackTraceAnalyzer.prototype, 'formatStackTrace')
      .mockReturnValue('Formatted stack trace for diagnostics');

    const trace = new ActionExecutionTrace({
      ...baseOptions,
      enableTiming: true,
      enableErrorAnalysis: true,
    });

    const originalPerformance = globalThis.performance;
    globalThis.performance = { now: undefined };
    trace.captureDispatchStart();
    globalThis.performance = originalPerformance;

    trace.captureEventPayload({
      token: 'sensitive',
      nested: { password: 'secret123' },
      trace: 'should be removed',
      context: { safe: true },
    });

    trace.captureOperationStart({ type: 'side-effect' }, 3);
    trace.captureOperationResult({ success: false, error: 'minor issue' });

    const initialError = new Error('detailed failure');
    initialError.stack = `Error: detailed failure\n    at performDangerousOperation (${process.cwd()}/src/services/doThing.js:42:9)`;

    trace.captureError(initialError, {
      phase: 'operation_completed',
      retryCount: 2,
    });

    const followUpError = new Error('retry failure');
    followUpError.stack = `Error: retry failure\n    at performDangerousOperation (${process.cwd()}/src/services/doThing.js:45:11)`;
    trace.updateError(followUpError, { phase: 'retry', retryCount: 3 });

    trace.addErrorToHistory(new Error('background issue'), { phase: 'cleanup' });

    const json = trace.toJSON();
    expect(json.turnAction.parameters).toEqual(baseOptions.turnAction.parameters);
    expect(json.eventPayload).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]' },
      context: { safe: true },
    });
    expect(json.errorData).toEqual({
      message: 'retry failure',
      type: 'Error',
      stack: followUpError.stack,
    });
    expect(json.hasMultipleErrors).toBe(true);
    expect(json.errorHistory.length).toBeGreaterThan(0);

    const summary = trace.toSummary();
    expect(summary).toContain('Status: error');
    expect(summary).toContain('Duration:');

    const performanceReport = trace.getPerformanceReport();
    expect(performanceReport).not.toContain('Timing not enabled');

    const timingSummary = trace.getTimingSummary();
    expect(timingSummary).not.toBeNull();

    const errorSummary = trace.getErrorSummary();
    expect(errorSummary).toEqual({
      type: 'Error',
      message: 'retry failure',
      category: 'logic',
      severity: 'high',
      isRetryable: true,
      location: {
        file: 'src/services/doThing.js',
        function: 'performDangerousOperation',
        line: 42,
      },
      troubleshooting: classificationResult.troubleshooting,
    });

    expect(trace.hasMultipleErrors()).toBe(true);

    const report = trace.getErrorReport();
    expect(report).toContain('Error Type: Error');
    expect(report).toContain('Category: logic');
    expect(report).toContain('Severity: high');
    expect(report).toContain('Phase: retry');
    expect(report).toContain('Duration:');
    expect(report).toContain('Line: 42:9');
    expect(report).toContain('Troubleshooting Steps:');
    expect(report).toContain('Formatted stack trace for diagnostics');

    expect(trace.isErrorRecoverable()).toBe(true);
  });
});

