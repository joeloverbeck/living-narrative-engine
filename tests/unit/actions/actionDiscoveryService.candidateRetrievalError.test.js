import { beforeEach, expect, it } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Test handling of errors thrown by the action index

describeActionDiscoverySuite(
  'ActionDiscoveryService candidate retrieval errors',
  (getBed) => {
    beforeEach(() => {
      const bed = getBed();
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
    });

    it('returns error result when action index throws', async () => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockImplementation(() => {
        throw new Error('boom');
      });

      const { actions, errors, trace } = await bed.service.getValidActions(
        { id: 'actor' },
        {}
      );

      expect(actions).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(Error);
      expect(errors[0].message).toBe('Candidate retrieval failed');
      expect(trace).toBeNull();
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error retrieving candidate actions'),
        expect.any(Error)
      );
    });
  }
);
