import { beforeEach, expect, test, jest } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// This test verifies that getValidActions can be called with an undefined
// baseContext argument without throwing or producing errors.
describeActionDiscoverySuite(
  'ActionDiscoveryService baseContext default',
  (getBed) => {
    const actor = { id: 'actor-1' };

    beforeEach(() => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockResolvedValue([]);
      bed.mocks.getActorLocationFn.mockReturnValue({
        id: 'room1',
        getComponentData: jest.fn(),
      });
    });

    test('handles undefined baseContext without errors', async () => {
      const bed = getBed();
      const result = await bed.service.getValidActions(actor, undefined);

      expect(result).toEqual({ actions: [], errors: [], trace: null });
      expect(bed.mocks.logger.error).not.toHaveBeenCalled();
    });
  }
);
