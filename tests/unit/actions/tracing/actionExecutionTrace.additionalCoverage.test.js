import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

const baseParams = {
  actionId: 'movement:go',
  actorId: 'player-1',
  turnAction: {
    actionDefinitionId: 'movement:go',
    commandString: 'go north',
    parameters: { direction: 'north' },
  },
};

describe('ActionExecutionTrace additional coverage scenarios', () => {
  let trace;
  let originalWarn;

  beforeEach(() => {
    trace = new ActionExecutionTrace(baseParams);
    originalWarn = console.warn;
  });

  afterEach(() => {
    console.warn = originalWarn;
    jest.restoreAllMocks();
  });

  it('prevents concurrent error capture when processing lock is active', () => {
    trace.captureDispatchStart();
    trace.captureError(new Error('primary failure'));

    ActionExecutionTrace.__setProcessingLockForTesting(trace, true);

    expect(() => trace.captureError(new Error('secondary failure'))).not.toThrow();
    const error = trace.getError();
    expect(error.message).toBe('primary failure');

    ActionExecutionTrace.__setProcessingLockForTesting(trace, false);
  });

  it('logs a warning when error classification fails during analysis', () => {
    const analysisTrace = new ActionExecutionTrace({
      ...baseParams,
      enableErrorAnalysis: true,
    });
    analysisTrace.captureDispatchStart();

    const warnSpy = jest.fn();
    console.warn = warnSpy;

    jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockImplementation(() => {
        throw new Error('classification failure');
      });

    analysisTrace.captureError(new Error('classification test'));

    expect(warnSpy).toHaveBeenCalledWith(
      'Error classification failed:',
      'classification failure'
    );
  });

  it('logs a warning when stack trace analysis throws an error', () => {
    const analysisTrace = new ActionExecutionTrace({
      ...baseParams,
      enableErrorAnalysis: true,
    });
    analysisTrace.captureDispatchStart();

    const warnSpy = jest.fn();
    console.warn = warnSpy;

    jest
      .spyOn(ErrorClassifier.prototype, 'classifyError')
      .mockReturnValue({ category: 'test', severity: 'low' });

    jest
      .spyOn(StackTraceAnalyzer.prototype, 'parseStackTrace')
      .mockImplementation(() => {
        throw new Error('stack parsing failed');
      });

    const error = new Error('stack analysis test');
    error.stack = 'Error: stack analysis test\n    at test (file.js:10:5)';

    analysisTrace.captureError(error);

    expect(warnSpy).toHaveBeenCalledWith(
      'Stack trace analysis failed:',
      'stack parsing failed'
    );
  });

  it('records operation lifecycle information', () => {
    trace.captureOperationStart(
      { type: 'effect', parameters: { value: 42 } },
      3
    );
    trace.captureOperationResult({ success: false, error: 'boom' });

    const operations = trace.getOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('effect');
    expect(operations[0].result.success).toBe(false);

    const phases = trace.getExecutionPhases();
    const completionPhase = phases.find(
      (phase) => phase.phase === 'operation_completed'
    );
    expect(completionPhase).toBeTruthy();
    expect(completionPhase.error).toBe('boom');
  });

  it('ignores operation result capture when no operation is active', () => {
    expect(() =>
      trace.captureOperationResult({ success: true, metadata: {} })
    ).not.toThrow();
    expect(trace.getOperations()).toHaveLength(0);
  });

  it('delegates updateError to captureError when no existing error', () => {
    const captureSpy = jest
      .spyOn(trace, 'captureError')
      .mockImplementation(() => undefined);
    trace.captureDispatchStart();

    const updateError = new Error('update test');
    const context = { phase: 'update' };
    trace.updateError(updateError, context);

    expect(captureSpy).toHaveBeenCalledWith(updateError, context, false);
  });

  it('uses unknown phase fallback when adding error history with no phases', () => {
    trace.addErrorToHistory(new Error('history test'));

    const history = trace.getErrorHistory();
    expect(history).toHaveLength(1);
    expect(history[0].context.phase).toBe('unknown');
  });

  it('ignores processing lock updates for non-trace instances', () => {
    expect(() =>
      ActionExecutionTrace.__setProcessingLockForTesting({}, true)
    ).not.toThrow();
  });
});

