/**
 * @file Integration tests for the recovery:push_yourself_to_your_feet action and rule.
 * @description Tests the rule execution after the push_yourself_to_your_feet action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('recovery:push_yourself_to_your_feet action integration', () => {
  let testFixture;

  const createFallenScenario = (options = {}) => {
    const actorId = options.actorId || 'test:actor1';
    const locationId = options.locationId || 'room1';

    const entities = [
      {
        id: locationId,
        components: {
          'core:room': { name: options.roomName || 'Test Room' },
        },
      },
      {
        id: actorId,
        components: {
          'core:name': { text: options.actorName || 'Alice' },
          'core:position': { locationId: locationId },
          'positioning:fallen': {},
        },
      },
    ];

    if (options.witnesses) {
      options.witnesses.forEach((witness) => {
        entities.push({
          id: witness.id,
          components: {
            'core:name': { text: witness.name },
            'core:position': { locationId: locationId },
          },
        });
      });
    }

    testFixture.reset(entities);
    return { actorId, locationId };
  };

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'recovery',
      'recovery:push_yourself_to_your_feet'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('successfully executes push to feet action when fallen', async () => {
    createFallenScenario({
      actorName: 'Alice',
    });

    await testFixture.executeAction('test:actor1', 'none');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toNotHaveComponent('positioning:fallen');
    expect(testFixture.events).toHaveActionSuccess(
      'Alice pushes themselves back to their feet.'
    );
  });

  it('creates correct perceptible event', async () => {
    createFallenScenario({
      actorName: 'Bob',
      locationId: 'alleyway',
    });

    await testFixture.executeAction('test:actor1', 'none');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Bob pushes themselves back to their feet.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('alleyway');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe(null);
    expect(perceptibleEvent.payload.perceptionType).toBe('action_self_general');
  });

  it('only fires for correct action ID', async () => {
    createFallenScenario({
      actorName: 'Alice',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'none',
      originalInput: 'wait',
    });

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toHaveComponent('positioning:fallen');

    expect(testFixture.events).not.toDispatchEvent('core:perceptible_event');
  });

  it('handles witness perception', async () => {
    createFallenScenario({
      actorName: 'Alice',
      locationId: 'courtyard',
      witnesses: [{ id: 'test:witness1', name: 'Bob' }],
    });

    await testFixture.executeAction('test:actor1', 'none');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toNotHaveComponent('positioning:fallen');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('verifies action discoverability', async () => {
    createFallenScenario({
      actorName: 'Alice',
    });

    const actions =
      await testFixture.testEnv.getAvailableActions('test:actor1');
    const pushAction = actions.find(
      (a) => a.id === 'recovery:push_yourself_to_your_feet'
    );
    expect(pushAction).toBeDefined();

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    testFixture.entityManager.removeComponent(
      'test:actor1',
      'positioning:fallen'
    );

    const actionsWithoutComponent =
      await testFixture.testEnv.getAvailableActions('test:actor1');
    const pushActionMissing = actionsWithoutComponent.find(
      (a) => a.id === 'recovery:push_yourself_to_your_feet'
    );
    expect(pushActionMissing).toBeUndefined();
  });
});
