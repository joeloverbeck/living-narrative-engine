/**
 * @file Integration tests for the recovery:help_target_to_their_feet action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import helpAction from '../../../../data/mods/recovery/actions/help_target_to_their_feet.action.json' assert { type: 'json' };

const HELP_ACTION_ID = 'recovery:help_target_to_their_feet';

describe('recovery:help_target_to_their_feet action integration', () => {
  let testFixture;

  const setupScenario = (options = {}) => {
    const actorId = options.actorId || 'test:helper';
    const targetId = options.targetId || 'test:fallen';
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
          'core:name': { text: options.actorName || 'Helper' },
          'core:position': { locationId },
          'core:actor': {},
          ...(options.actorFallen ? { 'positioning:fallen': {} } : {}),
          ...(options.actorRestrained ? { 'positioning:being_restrained': {} } : {}),
        },
      },
      {
        id: targetId,
        components: {
          'core:name': { text: options.targetName || 'Faller' },
          'core:position': { locationId },
          'core:actor': {},
          ...(options.targetFallen === false ? {} : { 'positioning:fallen': {} }),
        },
      },
    ];

    testFixture.reset(entities);
    return { actorId, targetId, locationId };
  };

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'recovery',
      HELP_ACTION_ID,
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning'],
      }
    );
    testFixture.testEnv.actionIndex.buildIndex([helpAction]);
    const actorsInLocationResolver = ScopeResolverHelpers.createLocationMatchResolver(
      'core:actors_in_location',
      {
        filterFn: (entityId, source, context, em) =>
          em.hasComponent(entityId, 'core:actor'),
      }
    );
    ScopeResolverHelpers._registerResolvers(
      testFixture.testEnv,
      testFixture.testEnv.entityManager,
      {
        'core:actors_in_location': actorsInLocationResolver,
      }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('is discoverable when a nearby target is fallen', async () => {
    const { actorId } = setupScenario();

    const actions = await testFixture.testEnv.getAvailableActions(actorId);
    const helpActions = actions.filter((action) => action.id === HELP_ACTION_ID);

    expect(helpActions.length).toBeGreaterThan(0);
  });

  it('is hidden when the target is not fallen', async () => {
    const { actorId } = setupScenario({ targetFallen: false });

    const actions = await testFixture.testEnv.getAvailableActions(actorId);
    const helpActions = actions.filter((action) => action.id === HELP_ACTION_ID);

    expect(helpActions.length).toBe(0);
  });

  it('is hidden when the actor is fallen or restrained', async () => {
    const { actorId } = setupScenario({ actorFallen: true });

    let actions = await testFixture.testEnv.getAvailableActions(actorId);
    let helpActions = actions.filter((action) => action.id === HELP_ACTION_ID);
    expect(helpActions.length).toBe(0);

    setupScenario({ actorRestrained: true });
    actions = await testFixture.testEnv.getAvailableActions(actorId);
    helpActions = actions.filter((action) => action.id === HELP_ACTION_ID);
    expect(helpActions.length).toBe(0);
  });

  it('helps the target stand, clears fallen, and emits perceptible event', async () => {
    const { actorId, targetId, locationId } = setupScenario({
      actorName: 'Clara',
      targetName: 'Dana',
      locationId: 'plaza',
    });

    await testFixture.executeAction(actorId, targetId);

    const target = testFixture.entityManager.getEntityInstance(targetId);
    expect(target).toNotHaveComponent('positioning:fallen');

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Clara helps Dana to their feet.'
    );
    expect(perceptibleEvent.payload.locationId).toBe(locationId);
    expect(perceptibleEvent.payload.actorId).toBe(actorId);
    expect(perceptibleEvent.payload.targetId).toBe(targetId);
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');

    expect(testFixture.events).toHaveActionSuccess(
      'Clara helps Dana to their feet.'
    );
  });

  it('fails gracefully when the target is already standing', async () => {
    const { actorId, targetId } = setupScenario({
      targetName: 'Evan',
      targetFallen: false,
    });

    await testFixture.executeAction(actorId, targetId, { skipValidation: true });

    const failureEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.message).toBe('Evan is already on their feet.');

    expect(testFixture.events).not.toDispatchEvent('core:perceptible_event');
  });

  it('does not stand the target when the actor is unable to help', async () => {
    const { actorId, targetId } = setupScenario({
      actorName: 'Grant',
      actorFallen: true,
      targetName: 'Harper',
    });

    await testFixture.executeAction(actorId, targetId, { skipValidation: true });

    const target = testFixture.entityManager.getEntityInstance(targetId);
    expect(target).toHaveComponent('positioning:fallen');

    const failureEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.message).toBe(
      'You need to stand up before helping someone else.'
    );
  });
});
