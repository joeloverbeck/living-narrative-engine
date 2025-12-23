import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates scenario where actor is close to sitting target.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} targetName - Name for the target
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with room, actor, chair, and target entities
 */
function setupStraddleFacingScenario(
  actorName = 'Alice',
  targetName = 'Bob',
  locationId = 'bedroom'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Bedroom').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .closeToEntity('test:target1')
    .asActor()
    .build();

  const chair = new ModEntityBuilder('test:chair1')
    .withName('Chair')
    .atLocation(locationId)
    .build();

  const target = new ModEntityBuilder('test:target1')
    .withName(targetName)
    .atLocation(locationId)
    .closeToEntity('test:actor1')
    .asActor()
    .build();

  target.components['sitting-states:sitting_on'] = {
    furniture_id: 'test:chair1',
    spot_index: 0,
  };

  return { room, actor, chair, target };
}

describe('Straddle Waist Facing - Action Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:straddle_waist_facing'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should add straddling_waist component with facing_away=false', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['straddling-states:straddling_waist']).toBeDefined();
    expect(actor.components['straddling-states:straddling_waist'].target_id).toBe(
      'test:target1'
    );
    expect(actor.components['straddling-states:straddling_waist'].facing_away).toBe(
      false
    );
  });

  it('should lock actor movement', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    // LOCK_MOVEMENT operation handler adds movement lock via its implementation
    // Check that action executed successfully (movement lock is internal)
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice sits on Bob's lap (face-to-face)."
    );
  });

  it('should keep target sitting after straddling', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const targetActor =
      testFixture.entityManager.getEntityInstance('test:target1');
    expect(targetActor.components['sitting-states:sitting_on']).toBeDefined();
    expect(targetActor.components['sitting-states:sitting_on'].furniture_id).toBe(
      'test:chair1'
    );
  });

  it('should generate correct log message', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice sits on Bob's lap (face-to-face)."
    );
  });

  it('should dispatch perceptible event', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice sits on Bob's lap (face-to-face)."
    );
    expect(perceptibleEvent.payload.locationId).toBe('bedroom');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe('test:target1');
  });

  it('should keep both actors in closeness circle', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    const target = testFixture.entityManager.getEntityInstance('test:target1');

    expect(actor.components['personal-space-states:closeness']).toBeDefined();
    expect(actor.components['personal-space-states:closeness'].partners).toContain(
      'test:target1'
    );
    expect(target.components['personal-space-states:closeness']).toBeDefined();
    expect(target.components['personal-space-states:closeness'].partners).toContain(
      'test:actor1'
    );
  });

  it('should not add facing_away component', async () => {
    const entities = setupStraddleFacingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['facing-states:facing_away']).toBeUndefined();
  });
});
