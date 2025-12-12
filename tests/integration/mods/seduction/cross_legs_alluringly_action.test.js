import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import action from '../../../../data/mods/seduction/actions/cross_legs_alluringly.action.json';
import rule from '../../../../data/mods/seduction/rules/cross_legs_alluringly.rule.json';
import condition from '../../../../data/mods/seduction/conditions/event-is-action-cross-legs-alluringly.condition.json';

const ACTION_ID = 'seduction:cross_legs_alluringly';

describe('seduction:cross_legs_alluringly - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      rule,
      condition
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Metadata Validation', () => {
    it('should have correct action structure', () => {
      expect(action.id).toBe(ACTION_ID);
      expect(action.name).toBe('Cross Legs Alluringly');
      expect(action.targets).toBe('none');
    });

    it('should have seduction visual styling', () => {
      expect(action.visual).toMatchObject({
        backgroundColor: '#f57f17',
        textColor: '#000000',
        hoverBackgroundColor: '#f9a825',
        hoverTextColor: '#212121',
      });
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have correct rule ID', () => {
      expect(rule.rule_id).toBe('cross_legs_alluringly');
    });

    it('should handle core:attempt_action event', () => {
      expect(rule.event_type).toBe('core:attempt_action');
    });

    it('should reference correct condition', () => {
      expect(rule.condition.condition_ref).toBe(
        'seduction:event-is-action-cross-legs-alluringly'
      );
    });
  });

  describe('Condition Validation', () => {
    it('should check for correct action ID', () => {
      expect(condition.id).toBe(
        'seduction:event-is-action-cross-legs-alluringly'
      );
      expect(condition.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        ACTION_ID,
      ]);
    });
  });

  describe('Successful Action Execution', () => {
    it('should successfully execute when actor is sitting', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Seated Actor', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      // Execute action
      await testFixture.executeAction(actor.id);

      // Verify success
      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should dispatch perceptible event with correct message', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Elena', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      await testFixture.executeAction(actor.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Elena crosses their legs alluringly.'
      );
    });

    it('should set correct perception type', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Actor', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      await testFixture.executeAction(actor.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.self_action'
      );
    });

    it('should set location ID from actor position', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Actor', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      await testFixture.executeAction(actor.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.locationId).toBeDefined();
      expect(perceptibleEvent.payload.locationId).toBe('room1'); // Default location from createSittingPair
    });

    it('should set targetId to null for self-targeting action', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Actor', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      await testFixture.executeAction(actor.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.targetId).toBeNull();
    });
  });

  describe('Turn Management', () => {
    it('should end turn after successful execution', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Actor', spotIndex: 0 }],
      });

      testFixture.reset(sittingScenario.entities);
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');

      await testFixture.executeAction(actor.id);

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });
});
