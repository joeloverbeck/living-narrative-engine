import { expect, it, jest, describe } from '@jest/globals';
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

/**
 * Tests to ensure candidate processing runs concurrently.
 */
describe('ActionDiscoveryService concurrency', () => {
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

  it('processes all candidates in parallel', async () => {
    jest.useFakeTimers();
    const callTimes = [];
    const processor = {
      process: jest.fn((def) => {
        callTimes.push(Date.now());
        const delay = def.id === 'a' ? 50 : 100;
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                actions: [
                  { id: def.id, command: 'cmd', params: { targetId: null } },
                ],
                errors: [],
              }),
            delay
          )
        );
      }),
    };
    const bed = createActionDiscoveryBed({
      actionCandidateProcessor: processor,
    });
    setupBed(bed);

    const promise = bed.service.getValidActions(actor, {});
    await Promise.resolve();

    expect(callTimes).toHaveLength(defs.length);

    jest.advanceTimersByTime(100);
    const result = await promise;

    expect(result.actions).toHaveLength(defs.length);
    expect(callTimes[1]).toBe(callTimes[0]);
    await bed.cleanup();
  });
});
