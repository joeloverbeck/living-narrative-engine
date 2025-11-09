/**
 * @file Workflow integration test for vaginal penetration insert → pull out sequence.
 * @description Validates the complete workflow: Actor A inserts penis → components set → Actor B can pull out.
 * This test catches the bug where scope resolution failed, preventing pull out action from being discovered.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates a penetration-ready scenario with two actors.
 * @returns {Array<object>} Entities for the test.
 */
function createPenetrationScenario() {
  const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

  const actorA = new ModEntityBuilder('actorA')
    .withName('Alice')
    .atLocation('bedroom')
    .withBody('alicePelvis')
    .closeToEntity('actorB')
    .asActor()
    .build();

  const actorB = new ModEntityBuilder('actorB')
    .withName('Bob')
    .atLocation('bedroom')
    .withBody('bobGroin')
    .closeToEntity('actorA')
    .asActor()
    .build();

  const alicePelvis = new ModEntityBuilder('alicePelvis')
    .asBodyPart({ parent: null, children: ['aliceVagina'], subType: 'pelvis' })
    .build();

  const aliceVagina = new ModEntityBuilder('aliceVagina')
    .asBodyPart({ parent: 'alicePelvis', children: [], subType: 'vagina' })
    .build();

  const bobGroin = new ModEntityBuilder('bobGroin')
    .asBodyPart({ parent: null, children: ['bobPenis'], subType: 'groin' })
    .build();

  const bobPenis = new ModEntityBuilder('bobPenis')
    .asBodyPart({ parent: 'bobGroin', children: [], subType: 'penis' })
    .build();

  return [room, actorA, actorB, alicePelvis, aliceVagina, bobGroin, bobPenis];
}

describe('Vaginal Penetration Workflow - Insert → Pull Out', () => {
  let testFixture;

  beforeEach(async () => {
    // Use forAction for generic fixture initialization
    // Include pull_penis_out_of_vagina as a supporting action so its rule is loaded
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      'sex-vaginal-penetration:insert_primary_penis_into_your_vagina',
      null,
      null,
      {
        supportingActions: ['sex-vaginal-penetration:pull_penis_out_of_vagina']
      }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('should allow complete insert → pull out workflow', async () => {
    // Arrange: Create scenario with Alice (actor) and Bob (target with penis)
    testFixture.reset(createPenetrationScenario());

    // Act - Turn 1: Alice inserts Bob's penis into her vagina
    await testFixture.executeAction('actorA', 'actorB', {
      actionId: 'sex-vaginal-penetration:insert_primary_penis_into_your_vagina',
      additionalPayload: {
        primaryId: 'actorB',
      },
    });

    // Assert: Components are set correctly after insertion
    const aliceAfterInsert = testFixture.entityManager.getEntityInstance('actorA');
    const bobAfterInsert = testFixture.entityManager.getEntityInstance('actorB');

    expect(aliceAfterInsert.components['positioning:being_fucked_vaginally']).toBeDefined();
    expect(aliceAfterInsert.components['positioning:being_fucked_vaginally'].actorId).toBe('actorB');

    expect(bobAfterInsert.components['positioning:fucking_vaginally']).toBeDefined();
    expect(bobAfterInsert.components['positioning:fucking_vaginally'].targetId).toBe('actorA');

    // Act - Turn 2: Bob discovers and uses pull_penis_out_of_vagina action
    // This is the CRITICAL test - previously failed due to scope resolution bug
    const availableActions = await testFixture.discoverActions('actorB');
    const pullOutAction = availableActions.find(
      (a) => a.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
    );

    // Assert: Pull out action is available (THIS WOULD FAIL WITH THE BUG)
    expect(pullOutAction).toBeDefined();
    expect(pullOutAction.targets).toBeDefined();
    expect(pullOutAction.targets.primary).toBeDefined();
    // Action discovery returns the action definition with scope, not resolved target IDs
    expect(pullOutAction.targets.primary.scope).toBe('sex-vaginal-penetration:actors_being_fucked_vaginally_by_me');

    // Execute the pull out action
    await testFixture.executeAction('actorB', 'actorA', {
      actionId: 'sex-vaginal-penetration:pull_penis_out_of_vagina',
    });

    // Assert: Components are removed after withdrawal
    const aliceAfterPullOut = testFixture.entityManager.getEntityInstance('actorA');
    const bobAfterPullOut = testFixture.entityManager.getEntityInstance('actorB');

    expect(aliceAfterPullOut.components['positioning:being_fucked_vaginally']).toBeUndefined();
    expect(bobAfterPullOut.components['positioning:fucking_vaginally']).toBeUndefined();
  });

  it('should not discover pull out action when no penetration exists', async () => {
    // Arrange: Create scenario without penetration components
    testFixture.reset(createPenetrationScenario());

    // Act: Try to discover actions for Bob (no penetration yet)
    const availableActions = await testFixture.discoverActions('actorB');
    const pullOutAction = availableActions.find(
      (a) => a.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
    );

    // Assert: Pull out action should NOT be available
    expect(pullOutAction).toBeUndefined();
  });

  it('should handle multiple sequential penetration cycles', async () => {
    // Arrange: Create scenario
    testFixture.reset(createPenetrationScenario());

    // Act: Cycle 1 - Insert → Pull out
    await testFixture.executeAction('actorA', 'actorB', {
      actionId: 'sex-vaginal-penetration:insert_primary_penis_into_your_vagina',
      additionalPayload: { primaryId: 'actorB' },
    });

    await testFixture.executeAction('actorB', 'actorA', {
      actionId: 'sex-vaginal-penetration:pull_penis_out_of_vagina',
    });

    // Assert: Clean state after first cycle
    const aliceCycle1 = testFixture.entityManager.getEntityInstance('actorA');
    expect(aliceCycle1.components['positioning:being_fucked_vaginally']).toBeUndefined();

    // Act: Cycle 2 - Insert again
    await testFixture.executeAction('actorA', 'actorB', {
      actionId: 'sex-vaginal-penetration:insert_primary_penis_into_your_vagina',
      additionalPayload: { primaryId: 'actorB' },
    });

    // Assert: Components set again
    const aliceCycle2 = testFixture.entityManager.getEntityInstance('actorA');
    expect(aliceCycle2.components['positioning:being_fucked_vaginally']).toBeDefined();

    // Act: Pull out action should still be discoverable
    const availableActions = await testFixture.discoverActions('actorB');
    const pullOutAction = availableActions.find(
      (a) => a.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
    );

    // Assert: Pull out action available again
    expect(pullOutAction).toBeDefined();
    // Action discovery returns the action definition, not resolved target IDs
    expect(pullOutAction.targets.primary.scope).toBe('sex-vaginal-penetration:actors_being_fucked_vaginally_by_me');
  });
});
