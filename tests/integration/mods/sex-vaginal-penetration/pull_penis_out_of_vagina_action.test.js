import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import '../../../common/mods/domainMatchers.js';

const EXPECTED_MESSAGE =
  "Alice pulls out their wet penis out of Beth's vagina.";
const ACTION_ID = 'sex-vaginal-penetration:pull_penis_out_of_vagina';

/**
 * Creates a test scenario with two actors in active vaginal penetration.
 * Alice is penetrating Beth's vagina.
 *
 * @returns {Array<object>} Entities for the fixture.
 */
function createPenetrationScenario() {
  const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

  const alice = new ModEntityBuilder('alice')
    .withName('Alice', 'Smith')
    .atLocation('bedroom')
    .withBody('aliceGroin')
    .closeToEntity('beth')
    .withComponent('positioning:fucking_vaginally', { targetId: 'beth' })
    .asActor()
    .build();

  const beth = new ModEntityBuilder('beth')
    .withName('Beth', 'Jones')
    .atLocation('bedroom')
    .withBody('bethPelvis')
    .closeToEntity('alice')
    .withComponent('positioning:being_fucked_vaginally', { actorId: 'alice' })
    .asActor()
    .build();

  const aliceGroin = new ModEntityBuilder('aliceGroin')
    .asBodyPart({ parent: null, children: ['alicePenis'], subType: 'groin' })
    .build();

  const alicePenis = new ModEntityBuilder('alicePenis')
    .asBodyPart({ parent: 'aliceGroin', children: [], subType: 'penis' })
    .build();

  const bethPelvis = new ModEntityBuilder('bethPelvis')
    .asBodyPart({ parent: null, children: ['bethVagina'], subType: 'pelvis' })
    .build();

  const bethVagina = new ModEntityBuilder('bethVagina')
    .asBodyPart({ parent: 'bethPelvis', children: [], subType: 'vagina' })
    .build();

  return [room, alice, beth, aliceGroin, alicePenis, bethPelvis, bethVagina];
}

describe('sex-vaginal-penetration:pull_penis_out_of_vagina - Action Execution', () => {
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
    }
  });

  it('performs the pull-out action successfully', async () => {
    const scenario = createPenetrationScenario();
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

  it('removes fucking_vaginally component from actor', async () => {
    const scenario = createPenetrationScenario();
    testFixture.reset(scenario);

    expect(
      testFixture.entityManager.hasComponent(
        'alice',
        'positioning:fucking_vaginally'
      )
    ).toBe(true);

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    expect(
      testFixture.entityManager.hasComponent(
        'alice',
        'positioning:fucking_vaginally'
      )
    ).toBe(false);
  });

  it('removes being_fucked_vaginally component from target', async () => {
    const scenario = createPenetrationScenario();
    testFixture.reset(scenario);

    expect(
      testFixture.entityManager.hasComponent(
        'beth',
        'positioning:being_fucked_vaginally'
      )
    ).toBe(true);

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    expect(
      testFixture.entityManager.hasComponent(
        'beth',
        'positioning:being_fucked_vaginally'
      )
    ).toBe(false);
  });

  it('dispatches perceptible event with correct payload', async () => {
    const scenario = createPenetrationScenario();
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

  it('fully cleans up penetration state between entities', async () => {
    const scenario = createPenetrationScenario();
    testFixture.reset(scenario);

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

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    expect(
      testFixture.entityManager.hasComponent(
        'alice',
        'positioning:fucking_vaginally'
      )
    ).toBe(false);
    expect(
      testFixture.entityManager.hasComponent(
        'beth',
        'positioning:being_fucked_vaginally'
      )
    ).toBe(false);
  });
});
