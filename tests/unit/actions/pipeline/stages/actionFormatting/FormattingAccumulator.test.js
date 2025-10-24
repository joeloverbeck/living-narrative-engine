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

    const formattedActions = accumulator.getFormattedActions();
    formattedActions.push({ id: 'new-action' });

    const errors = accumulator.getErrors();
    errors.push(new Error('unexpected'));

    expect(accumulator.getFormattedActions()).toEqual([formattedAction]);
    expect(accumulator.getErrors()).toEqual([{ message: 'failure' }]);
    expect(accumulator.getActionSummary('legacy-action')).toEqual({
      actionId: 'legacy-action',
      failures: 0,
      path: 'legacy',
      successes: 0,
    });
  });

  it('retains explicit per-action counts when derived counts are lower', () => {
    const accumulator = new FormattingAccumulator();

    accumulator.registerAction('per-one', 'per-action');
    accumulator.registerAction('per-two', 'per-action');
    accumulator.registerAction('multi-one', 'multi-target');

    expect(accumulator.getStatistics()).toEqual({
      failed: 0,
      legacy: 0,
      multiTarget: 1,
      perActionMetadata: 2,
      successful: 0,
      total: 3,
    });
  });

  it('only increments success and failure counts the first time per action', () => {
    const accumulator = new FormattingAccumulator();

    accumulator.registerAction('tracked-action', 'per-action');

    accumulator.recordSuccess('tracked-action');
    accumulator.recordSuccess('tracked-action');
    accumulator.recordFailure('tracked-action');
    accumulator.recordFailure('tracked-action');

    expect(accumulator.getActionSummary('tracked-action')).toEqual({
      actionId: 'tracked-action',
      failures: 2,
      path: 'per-action',
      successes: 2,
    });

    expect(accumulator.getStatistics()).toEqual({
      failed: 1,
      legacy: 0,
      multiTarget: 0,
      perActionMetadata: 1,
      successful: 1,
      total: 1,
    });
  });

  it('ignores updates for unknown actions and surfaces missing summaries', () => {
    const accumulator = new FormattingAccumulator();

    accumulator.recordSuccess('missing');
    accumulator.recordFailure('missing');

    expect(accumulator.getStatistics()).toEqual({
      failed: 0,
      legacy: 0,
      multiTarget: 0,
      perActionMetadata: 0,
      successful: 0,
      total: 0,
    });

    expect(accumulator.getActionSummary('missing')).toBeUndefined();
  });
});
