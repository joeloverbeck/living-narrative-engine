import { test, expect } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Parameter validation tests for ActionDiscoveryService

describeActionDiscoverySuite(
  'ActionDiscoveryService parameter validation',
  (getBed) => {
    const actor = { id: 'actor1' };

    test('throws Error when baseContext is not an object', async () => {
      const bed = getBed();
      await expect(bed.service.getValidActions(actor, 5)).rejects.toThrow(
        'ActionDiscoveryService.getValidActions: baseContext must be an object when provided'
      );
      expect(bed.mocks.logger.error).toHaveBeenCalled();
    });
  }
);
