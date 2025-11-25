import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

const baseParams = {
  actionId: 'movement:go',
  actorId: 'player-1',
  turnAction: {
    actionDefinitionId: 'movement:go',
    commandString: 'go north',
    parameters: { direction: 'north' },
  },
};

describe('ActionExecutionTrace uncovered edge cases', () => {
  let trace;
  let performanceSpy;

  beforeEach(() => {
    trace = new ActionExecutionTrace(baseParams);
    let current = 0;
    performanceSpy = jest
      .spyOn(globalThis.performance, 'now')
      .mockImplementation(() => {
        current += 5;
        return current;
      });
  });

  afterEach(() => {
    performanceSpy?.mockRestore();
    jest.restoreAllMocks();
  });

  it('throws when enableErrorAnalysis is not a boolean', () => {
    expect(
      () =>
        new ActionExecutionTrace({
          ...baseParams,
          enableErrorAnalysis: 'yes',
        })
    ).toThrow(InvalidArgumentError);
  });

  it('captures detailed error information and phases', () => {
    trace.captureDispatchStart();
    const boom = new Error('detailed failure');
    boom.stack = 'Error: detailed failure\n    at action (engine.js:10:2)';

    trace.captureError(boom);

    const storedError = trace.getError();
    expect(storedError.message).toBe('detailed failure');
    expect(storedError.type).toBe('Error');
    expect(storedError.name).toBe('Error');
    expect(storedError.stack).toContain('engine.js');

    const phases = trace.getExecutionPhases();
    const lastPhase = phases[phases.length - 1];
    expect(lastPhase.description).toContain('detailed failure');
    expect(lastPhase.errorType).toBe('Error');
  });

  it('includes parameters and error data when exporting to JSON and summary', () => {
    trace.captureDispatchStart();
    trace.captureError(new Error('json failure'));

    const json = trace.toJSON();
    expect(json.turnAction.parameters).toEqual(baseParams.turnAction.parameters);
    expect(json.errorData.type).toBe('Error');

    const summary = trace.toSummary();
    expect(summary).toContain('Duration:');
  });

  it('delegates updateError to captureError when an error already exists', () => {
    trace.captureDispatchStart();
    trace.captureError(new Error('first error'));

    const original = trace.captureError.bind(trace);
    const captureSpy = jest
      .spyOn(trace, 'captureError')
      .mockImplementation((error, context, allowMultiple) =>
        original(error, context, allowMultiple)
      );

    trace.updateError(new Error('follow up'), { phase: 'retry_phase' });

    expect(captureSpy).toHaveBeenCalledWith(
      expect.any(Error),
      { phase: 'retry_phase' },
      true
    );
  });

  it('records history entries with message and type', () => {
    trace.addErrorToHistory(new Error('history failure'));

    const history = trace.getErrorHistory();
    expect(history[0].message).toBe('history failure');
    expect(history[0].type).toBe('Error');
  });

  it('produces rich summaries and reports with troubleshooting details', () => {
    const analysisTrace = new ActionExecutionTrace({
      ...baseParams,
      enableErrorAnalysis: true,
    });

    const classifySpy = jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockReturnValue({
        category: 'logic',
        severity: 'high',
        recoveryPotential: 'immediate',
        isRetryable: true,
        troubleshooting: ['Check inputs'],
      });

    jest
      .spyOn(StackTraceAnalyzer.prototype, 'parseStackTrace')
      .mockReturnValue({
        frames: [
          {
            fileName: '/project/src/engine.js',
            shortFileName: 'src/engine.js',
            functionName: 'execute',
            lineNumber: 20,
            columnNumber: 5,
            isProjectCode: true,
          },
        ],
        frameCount: 1,
        hasProjectFrames: true,
        topProjectFrame: null,
        analysis: {},
      });

    jest
      .spyOn(StackTraceAnalyzer.prototype, 'formatStackTrace')
      .mockReturnValue('formatted-stack');

    analysisTrace.captureDispatchStart();
    analysisTrace.captureEventPayload({ key: 'value' });
    const error = new Error('analysis failure');
    error.stack = 'Error: analysis failure\n    at execute (/project/src/engine.js:20:5)';
    analysisTrace.captureError(error);

    const summary = analysisTrace.getErrorSummary();
    expect(summary.severity).toBe('high');
    expect(summary.category).toBe('logic');

    const report = analysisTrace.getErrorReport();
    expect(report).toContain('Duration:');
    expect(report).toContain('Line: 20:5');
    expect(report).toContain('Check inputs');

    expect(classifySpy).toHaveBeenCalled();
  });
});
