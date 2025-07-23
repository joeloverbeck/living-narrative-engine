// tests/unit/turns/turnManager.errorDispatch.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createMockTurnHandler } from '../../common/mockFactories';
import { createAiActor } from '../../common/turns/testActors.js';

describeTurnManagerSuite('TurnManager - Error Dispatch Failures', (getBed) => {
  let testBed;
  let ai1;

  beforeEach(() => {
    testBed = getBed();
    ai1 = createAiActor('actor1', {
      components: [ACTOR_COMPONENT_ID],
    });
    testBed.setActiveEntities(ai1);
  });

  describe('State Management', () => {
    test('should properly initialize with scheduler', () => {
      // Verify the turn manager was created successfully with scheduler
      expect(testBed.turnManager).toBeDefined();
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });
  });
});

// --- FILE END ---
