import { beforeEach, expect, it } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Tests for targetId extraction from errors thrown during candidate processing

describeActionDiscoverySuite(
  'ActionDiscoveryService error target extraction',
  (getBed) => {
    beforeEach(() => {
      const bed = getBed();
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([
        { type: 'none', entityId: null },
      ]);
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
    });

    it('extracts targetId from error.target.entityId', async () => {
      const bed = getBed();
      const def = { id: 'bad', commandVerb: 'bad', scope: 'none' };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.formatActionCommandFn.mockImplementation(() => {
        const err = new Error('boom');
        err.target = { entityId: 'target-123' };
        throw err;
      });

      const result = await bed.service.getValidActions({ id: 'actor' }, {});

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: 'target-123',
        details: null,
      });
    });

    it('extracts targetId from error.entityId', async () => {
      const bed = getBed();
      const def = { id: 'bad', commandVerb: 'bad', scope: 'none' };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.formatActionCommandFn.mockImplementation(() => {
        const err = new Error('boom');
        err.entityId = 'target-456';
        throw err;
      });

      const result = await bed.service.getValidActions({ id: 'actor' }, {});

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: 'target-456',
        details: null,
      });
    });
  }
);
