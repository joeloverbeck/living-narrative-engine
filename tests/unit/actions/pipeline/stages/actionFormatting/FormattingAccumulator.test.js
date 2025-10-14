import { FormattingAccumulator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';

describe('FormattingAccumulator', () => {
  it('tracks statistics for multiple pathways', () => {
    const accumulator = new FormattingAccumulator();

    accumulator.registerAction('legacy-action', 'legacy');
    accumulator.registerAction('multi-action', 'multi-target');
    accumulator.registerAction('per-action', 'per-action');

    accumulator.recordSuccess('legacy-action');
    accumulator.recordFailure('legacy-action');

    accumulator.recordSuccess('multi-action');
    accumulator.recordFailure('multi-action');
    accumulator.recordFailure('multi-action');

    accumulator.recordSuccess('per-action');

    const statistics = accumulator.getStatistics();

    expect(statistics).toEqual({
      failed: 2,
      legacy: 1,
      multiTarget: 1,
      perActionMetadata: 2,
      successful: 3,
      total: 3,
    });
  });

  it('stores formatted actions and errors independently from statistics', () => {
    const accumulator = new FormattingAccumulator();

    accumulator.registerAction('legacy-action', 'legacy');

    const formattedAction = {
      id: 'legacy-action',
      name: 'Test Action',
      command: 'do-test',
      params: { targetId: 'target-1' },
      visual: null,
    };

    accumulator.addFormattedAction(formattedAction);
    accumulator.addError({ message: 'failure' });

    expect(accumulator.getFormattedActions()).toEqual([formattedAction]);
    expect(accumulator.getErrors()).toEqual([{ message: 'failure' }]);
    expect(accumulator.getActionSummary('legacy-action')).toEqual({
      actionId: 'legacy-action',
      failures: 0,
      path: 'legacy',
      successes: 0,
    });
  });
});
