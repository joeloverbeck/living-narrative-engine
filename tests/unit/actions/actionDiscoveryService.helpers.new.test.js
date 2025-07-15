import { beforeEach, expect, it } from '@jest/globals';
import {
  describeActionDiscoverySuite,
  createActionDiscoveryBed,
} from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Additional coverage for private helper methods via public API

describeActionDiscoverySuite(
  'ActionDiscoveryService helper method coverage',
  (getBed) => {
    const actor = { id: 'actor1' };

    beforeEach(() => {
      const bed = getBed();
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
    });

    it('#fetchCandidateActions rethrows and logs index errors', async () => {
      const bed = getBed();
      const err = new Error('boom');
      bed.mocks.actionIndex.getCandidateActions.mockImplementation(() => {
        throw err;
      });

      const result = await bed.service.getValidActions(actor, {});

      expect(result.actions).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe(err);
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error retrieving candidate actions'),
        err
      );
    });

    it('#processCandidate propagates processor results', async () => {
      const processed = {
        actions: [{ id: 'test', command: 'cmd', params: { targetId: null } }],
        errors: [],
      };
      const actionCandidateProcessor = {
        process: jest.fn().mockResolvedValue(processed),
      };
      const bed = createActionDiscoveryBed({ actionCandidateProcessor });
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        { id: 'test', commandVerb: 'test', scope: 'none' },
      ]);

      const result = await bed.service.getValidActions(actor, {});

      expect(actionCandidateProcessor.process).toHaveBeenCalled();
      expect(result.actions).toEqual(processed.actions);
      expect(result.errors).toEqual(processed.errors);
      await bed.cleanup();
    });

    it('#processCandidate captures processor throw', async () => {
      const actionCandidateProcessor = {
        process: jest.fn(() => {
          throw new Error('fail');
        }),
      };
      const bed = createActionDiscoveryBed({ actionCandidateProcessor });
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        { id: 'bad', commandVerb: 'bad', scope: 'none' },
      ]);

      const result = await bed.service.getValidActions(actor, {});

      expect(actionCandidateProcessor.process).toHaveBeenCalled();
      expect(result.actions).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: null,
        error: expect.any(Error),
      });
      expect(result.errors[0].error.message).toBe('fail');
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("ActionDiscoveryService: Error processing candidate action 'bad': fail"),
        expect.objectContaining({
          actionDefinition: expect.objectContaining({ id: 'bad' }),
          actionId: 'bad',
          actorSnapshot: expect.any(Object),
          environmentContext: expect.any(Object),
        })
      );
      await bed.cleanup();
    });
  }
);
