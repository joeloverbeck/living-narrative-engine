import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import action from '../../../../data/mods/seduction/actions/cross_legs_alluringly.action.json';

const ACTION_ID = 'seduction:cross_legs_alluringly';

describe('seduction:cross_legs_alluringly - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Metadata', () => {
    it('should have correct action ID', () => {
      expect(action.id).toBe(ACTION_ID);
    });

    it('should have correct template', () => {
      expect(action.template).toBe('cross your legs alluringly');
    });

    it('should have targets set to none', () => {
      expect(action.targets).toBe('none');
    });

    it('should have seduction visual styling', () => {
      expect(action.visual.backgroundColor).toBe('#f57f17');
      expect(action.visual.textColor).toBe('#000000');
      expect(action.visual.hoverBackgroundColor).toBe('#f9a825');
      expect(action.visual.hoverTextColor).toBe('#212121');
    });
  });

  describe('Component Requirements', () => {
    it('should require sitting-states:sitting_on component', () => {
      expect(action.required_components.actor).toContain(
        'sitting-states:sitting_on'
      );
    });

    it('should forbid hugging-states:hugging component', () => {
      expect(action.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
    });

    it('should forbid performances-states:doing_complex_performance component', () => {
      expect(action.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Prerequisites', () => {
    it('should have anatomy prerequisite for legs', () => {
      const legPrereq = action.prerequisites.find(
        (p) => p.logic.hasPartOfType && p.logic.hasPartOfType[1] === 'leg'
      );
      expect(legPrereq).toBeDefined();
      expect(legPrereq.failure_message).toBe('You need legs to cross them.');
    });
  });

  describe('Action discoverability scenarios', () => {
    // eslint-disable-next-line jest/expect-expect
    it('should be executable without any special setup', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [{ id: 'actor1', name: 'Ava', spotIndex: 0 }],
      });

      // Add leg anatomy (prerequisite for action)
      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');
      actor.components['core:body'] = {
        structure: {
          parts: [
            { type: 'leg', name: 'Left Leg' },
            { type: 'leg', name: 'Right Leg' },
          ],
        },
      };

      testFixture.reset(sittingScenario.entities);

      await testFixture.executeAction(actor.id, null);

      testFixture.assertActionSuccess('Ava crosses their legs alluringly.');
    });

    it('rejects execution when the actor is currently hugging someone', async () => {
      const sittingScenario = ModEntityScenarios.createSittingPair({
        seatedActors: [
          { id: 'actor1', name: 'Dana', spotIndex: 0 },
          { id: 'actor2', name: 'Elliot', spotIndex: 1 },
        ],
      });

      const actor = sittingScenario.entities.find((e) => e.id === 'actor1');
      const partner = sittingScenario.entities.find((e) => e.id === 'actor2');

      actor.components['hugging-states:hugging'] = {
        embraced_entity_id: partner.id,
        initiated: true,
      };

      // Add leg anatomy (prerequisite for action)
      actor.components['core:body'] = {
        structure: {
          parts: [
            { type: 'leg', name: 'Left Leg' },
            { type: 'leg', name: 'Right Leg' },
          ],
        },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...sittingScenario.entities]);

      await expect(testFixture.executeAction(actor.id, null)).rejects.toThrow(
        /forbidden component/i
      );

      const actorInstance = testFixture.entityManager.getEntityInstance(
        actor.id
      );
      expect(actorInstance.components['hugging-states:hugging']).toEqual({
        embraced_entity_id: partner.id,
        initiated: true,
      });
    });
  });
});
