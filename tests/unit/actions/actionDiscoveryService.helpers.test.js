import { expect, it, jest, describe } from '@jest/globals';
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Tests leveraging custom ActionCandidateProcessor overrides to exercise
// helper method behavior indirectly through the public API.

describe('ActionDiscoveryService helper methods', () => {
  const actor = { id: 'actor1' };
  const defs = [
    { id: 'a', commandVerb: 'a', scope: 'none' },
    { id: 'b', commandVerb: 'b', scope: 'none' },
  ];

  const setupBed = (bed) => {
    bed.mocks.actionIndex.getCandidateActions.mockReturnValue(defs);
    bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
    bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([
      { type: 'none', entityId: null },
    ]);
    bed.mocks.actionCommandFormatter.format.mockReturnValue({
      ok: true,
      value: 'cmd',
    });
    bed.mocks.getActorLocationFn.mockReturnValue('room');
  };

  it('calls the candidate processor for each definition', async () => {
    const actionCandidateProcessor = {
      process: jest.fn(() => ({ actions: [], errors: [] })),
    };
    const bed = createActionDiscoveryBed({ actionCandidateProcessor });
    setupBed(bed);

    await bed.service.getValidActions(actor, {});

    expect(actionCandidateProcessor.process).toHaveBeenCalledTimes(defs.length);
    await bed.cleanup();
  });

  it('aggregates results returned from candidate processing', async () => {
    const actionCandidateProcessor = {
      process: jest
        .fn()
        .mockReturnValueOnce({
          actions: [{ id: 'a', command: 'cmd', params: { targetId: null } }],
          errors: [],
        })
        .mockReturnValueOnce({
          actions: [],
          errors: [{ actionId: 'b', targetId: null, error: new Error('bad') }],
        }),
    };
    const bed = createActionDiscoveryBed({ actionCandidateProcessor });
    setupBed(bed);

    const result = await bed.service.getValidActions(actor, {});

    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].actionId).toBe('b');
    await bed.cleanup();
  });

  it('defaults to empty arrays when processor returns null', async () => {
    const actionCandidateProcessor = {
      process: jest.fn(() => null),
    };
    const bed = createActionDiscoveryBed({ actionCandidateProcessor });
    setupBed(bed);
    bed.mocks.actionIndex.getCandidateActions.mockReturnValue([defs[0]]);

    const result = await bed.service.getValidActions(actor, {});

    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    await bed.cleanup();
  });

  it('captures errors thrown by the processor', async () => {
    const actionCandidateProcessor = {
      process: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const bed = createActionDiscoveryBed({ actionCandidateProcessor });
    setupBed(bed);
    bed.mocks.actionIndex.getCandidateActions.mockReturnValue([defs[0]]);

    const result = await bed.service.getValidActions(actor, {});

    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      actionId: defs[0].id,
      targetId: null,
      error: expect.any(Error),
    });
    await bed.cleanup();
  });
});
