import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import '../../../common/mods/domainMatchers.js';
import {
  buildPenetrationScenario,
  ACTION_ID,
} from '../../../common/mods/sex-vaginal-penetration/thrustPenisSlowlyAndTenderlyFixtures.js';

const EXPECTED_MESSAGE =
  "Alice thrusts slowly and tenderly inside Beth's vagina, making her feel every inch and every vein of the penis.";

describe('sex-vaginal-penetration:thrust_penis_slowly_and_tenderly - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // eslint-disable-next-line jest/expect-expect -- Uses ModAssertionHelpers.assertActionSuccess
  it('performs the thrust action successfully', async () => {
    const scenario = buildPenetrationScenario();
    testFixture.reset(scenario);

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('maintains penetration components without changes', async () => {
    const scenario = buildPenetrationScenario();
    testFixture.reset(scenario);

    // Verify prerequisites
    const initialActorComponent = testFixture.entityManager.getComponentData(
      'alice',
      'positioning:fucking_vaginally'
    );
    expect(initialActorComponent).toEqual({ targetId: 'beth' });

    const initialTargetComponent = testFixture.entityManager.getComponentData(
      'beth',
      'positioning:being_fucked_vaginally'
    );
    expect(initialTargetComponent).toEqual({ actorId: 'alice' });

    // Execute: Thrust action
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    // Assert: Components remain unchanged (state preserved)
    const finalActorComponent = testFixture.entityManager.getComponentData(
      'alice',
      'positioning:fucking_vaginally'
    );
    expect(finalActorComponent).toEqual({ targetId: 'beth' });

    const finalTargetComponent = testFixture.entityManager.getComponentData(
      'beth',
      'positioning:being_fucked_vaginally'
    );
    expect(finalTargetComponent).toEqual({ actorId: 'alice' });
  });

  // eslint-disable-next-line jest/expect-expect -- Uses ModAssertionHelpers.assertPerceptibleEvent
  it('dispatches perceptible event with correct payload', async () => {
    const scenario = buildPenetrationScenario();
    testFixture.reset(scenario);

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: 'bedroom',
      actorId: 'alice',
      targetId: 'beth',
      perceptionType: 'physical.target_action',
    });
  });

  it('allows multiple consecutive thrust actions without state corruption', async () => {
    const scenario = buildPenetrationScenario();
    testFixture.reset(scenario);

    // Execute thrust multiple times
    for (let i = 0; i < 3; i++) {
      testFixture.events.length = 0; // Clear events

      await testFixture.executeAction('alice', 'beth', {
        additionalPayload: { primaryId: 'beth' },
      });

      // Verify each execution succeeds
      ModAssertionHelpers.assertActionSuccess(
        testFixture.events,
        EXPECTED_MESSAGE,
        {
          shouldEndTurn: true,
          shouldHavePerceptibleEvent: true,
        }
      );

      // Verify state remains consistent
      const actorComponent = testFixture.entityManager.getComponentData(
        'alice',
        'positioning:fucking_vaginally'
      );
      expect(actorComponent).toEqual({ targetId: 'beth' });
    }
  });
});
