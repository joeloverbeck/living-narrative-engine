import { describe, it, expect } from '@jest/globals';
import InstrumentationDefault, {
  ActionFormattingInstrumentation,
} from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingInstrumentation.js';

describe('ActionFormattingInstrumentation', () => {
  it('throws descriptive errors for unimplemented hooks', () => {
    const instrumentation = new ActionFormattingInstrumentation();
    const stageContext = {
      actor: { id: 'actor-1' },
      formattingPath: 'legacy',
      actions: [
        {
          actionDef: { id: 'core:test-action' },
          metadata: { hint: 'example' },
        },
      ],
    };
    const actionContext = {
      actionDef: { id: 'core:test-action' },
      payload: { foo: 'bar' },
    };
    const completionContext = {
      formattingPath: 'legacy',
      statistics: {
        total: 1,
        successful: 0,
        failed: 1,
        perActionMetadata: 0,
        multiTarget: 0,
        legacy: 1,
      },
    };

    expect(() => instrumentation.stageStarted(stageContext)).toThrow(
      'ActionFormattingInstrumentation.stageStarted must be implemented'
    );
    expect(() => instrumentation.actionStarted(actionContext)).toThrow(
      'ActionFormattingInstrumentation.actionStarted must be implemented'
    );
    expect(() => instrumentation.actionCompleted(actionContext)).toThrow(
      'ActionFormattingInstrumentation.actionCompleted must be implemented'
    );
    expect(() => instrumentation.actionFailed(actionContext)).toThrow(
      'ActionFormattingInstrumentation.actionFailed must be implemented'
    );
    expect(() => instrumentation.stageCompleted(completionContext)).toThrow(
      'ActionFormattingInstrumentation.stageCompleted must be implemented'
    );
  });

  it('allows subclasses to provide custom lifecycle handling', () => {
    const calls = [];
    class TestInstrumentation extends ActionFormattingInstrumentation {
      stageStarted(context) {
        calls.push({ method: 'stageStarted', context });
      }

      actionStarted(context) {
        calls.push({ method: 'actionStarted', context });
      }

      actionCompleted(context) {
        calls.push({ method: 'actionCompleted', context });
      }

      actionFailed(context) {
        calls.push({ method: 'actionFailed', context });
      }

      stageCompleted(context) {
        calls.push({ method: 'stageCompleted', context });
      }
    }

    const instrumentation = new TestInstrumentation();
    const stageContext = {
      actor: { id: 'actor-42' },
      formattingPath: 'multi-target',
      actions: [
        {
          actionDef: { id: 'core:test-action', name: 'Test Action' },
          metadata: { attempt: 1 },
        },
      ],
    };
    const lifecycleContext = {
      actionDef: { id: 'core:test-action', name: 'Test Action' },
      payload: { placeholder: 'value' },
      timestamp: 123,
    };
    const completionContext = {
      formattingPath: 'multi-target',
      statistics: {
        total: 1,
        successful: 1,
        failed: 0,
        perActionMetadata: 1,
        multiTarget: 1,
        legacy: 0,
      },
      errorCount: 0,
    };

    instrumentation.stageStarted(stageContext);
    instrumentation.actionStarted(lifecycleContext);
    instrumentation.actionCompleted(lifecycleContext);
    instrumentation.actionFailed(lifecycleContext);
    instrumentation.stageCompleted(completionContext);

    expect(calls).toEqual([
      { method: 'stageStarted', context: stageContext },
      { method: 'actionStarted', context: lifecycleContext },
      { method: 'actionCompleted', context: lifecycleContext },
      { method: 'actionFailed', context: lifecycleContext },
      { method: 'stageCompleted', context: completionContext },
    ]);
  });

  it('exports the instrumentation class as the default export', () => {
    expect(InstrumentationDefault).toBe(ActionFormattingInstrumentation);
  });
});
