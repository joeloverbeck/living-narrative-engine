/**
 * @file Integration tests for the seduction:brush_hair_back_coyly action.
 * @description Tests basic action properties and structure validation using the action
 * property helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import brushHairBackCoylyRule from '../../../../data/mods/seduction/rules/brush_hair_back_coyly.rule.json';
import eventIsActionBrushHairBackCoyly from '../../../../data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Seduction Mod: Brush Hair Back Coyly Action', () => {
  describe('Action Properties', () => {
    // eslint-disable-next-line jest/expect-expect -- validateActionProperties contains assertions
    it('should have correct action properties', () => {
      validateActionProperties(brushHairBackCoylyAction, {
        id: 'seduction:brush_hair_back_coyly',
        name: 'Brush Hair Back Coyly',
        targets: 'none',
        template: 'brush your hair back coyly',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    // eslint-disable-next-line jest/expect-expect -- validateVisualStyling contains assertions
    it('should use correct orange visual styling', () => {
      validateVisualStyling(brushHairBackCoylyAction.visual, 'Orange Theme', {
        backgroundColor: '#f57f17',
        textColor: '#000000',
        hoverBackgroundColor: '#f9a825',
        hoverTextColor: '#212121',
      });
    });

    // eslint-disable-next-line jest/expect-expect -- validateComponentRequirements contains assertions
    it('should require actor to not be hugging anyone', () => {
      validateComponentRequirements(brushHairBackCoylyAction, {
        required: {},
        forbidden: {
          actor: [
            'positioning:hugging',
            'positioning:doing_complex_performance',
            'positioning:restraining',
          ],
        },
      });
    });

    // eslint-disable-next-line jest/expect-expect -- validatePrerequisites contains assertions
    it('should have three prerequisites (grabbing, hair, other actors)', () => {
      validatePrerequisites(brushHairBackCoylyAction.prerequisites, {
        count: 3,
      });
    });
  });

  describe('Visual Design and Accessibility', () => {
    // eslint-disable-next-line jest/expect-expect -- validateAccessibilityCompliance contains assertions
    it('should meet accessibility contrast requirements', () => {
      validateAccessibilityCompliance(
        brushHairBackCoylyAction.visual,
        'Orange color scheme'
      );
    });
  });

  describe('Schema Compliance', () => {
    // eslint-disable-next-line jest/expect-expect -- validateRequiredActionProperties contains assertions
    it('should have all required action properties', () => {
      validateRequiredActionProperties(brushHairBackCoylyAction);
    });

    it('should have properly formatted description', () => {
      expect(brushHairBackCoylyAction.description).toBe(
        'Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture.'
      );
      expect(brushHairBackCoylyAction.description.length).toBeGreaterThan(0);
    });

    it('should be self-targeting action', () => {
      expect(brushHairBackCoylyAction.targets).toBe('none');
    });

    it('should have appropriate action template', () => {
      expect(brushHairBackCoylyAction.template).toBe('brush your hair back coyly');
      expect(brushHairBackCoylyAction.template).toMatch(/^[a-z]/); // starts with lowercase
    });
  });

  describe('Prerequisites Logic Validation', () => {
    it('should require free grabbing appendage (first prerequisite)', () => {
      const grabbingPrerequisite = brushHairBackCoylyAction.prerequisites[0];
      expect(grabbingPrerequisite.logic.condition_ref).toBeDefined();
      expect(grabbingPrerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    it('should require hair body part (second prerequisite)', () => {
      const hairPrerequisite = brushHairBackCoylyAction.prerequisites[1];
      expect(hairPrerequisite.logic.hasPartOfType).toBeDefined();
      expect(hairPrerequisite.logic.hasPartOfType).toEqual(['actor', 'hair']);
    });

    it('should require other actors at location (third prerequisite)', () => {
      const otherActorsPrerequisite = brushHairBackCoylyAction.prerequisites[2];
      expect(otherActorsPrerequisite.logic.hasOtherActorsAtLocation).toBeDefined();
      expect(otherActorsPrerequisite.logic.hasOtherActorsAtLocation).toEqual([
        'actor',
      ]);
    });

    it('should have meaningful failure messages', () => {
      const grabbingFailure =
        brushHairBackCoylyAction.prerequisites[0].failure_message;
      const hairFailure =
        brushHairBackCoylyAction.prerequisites[1].failure_message;
      const otherActorsFailure =
        brushHairBackCoylyAction.prerequisites[2].failure_message;

      expect(grabbingFailure).toContain('free hand');
      expect(grabbingFailure.length).toBeGreaterThan(20);
      expect(hairFailure).toContain('hair');
      expect(hairFailure.length).toBeGreaterThan(20);
      expect(otherActorsFailure).toContain('nobody here');
      expect(otherActorsFailure.length).toBeGreaterThan(20);
    });
  });
});

describe('Seduction Mod: Brush Hair Back Coyly hugging restrictions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:brush_hair_back_coyly',
      brushHairBackCoylyRule,
      eventIsActionBrushHairBackCoyly
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('rejects the action when the actor is currently hugging someone', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alex', 'Jordan'], {
      includeRoom: false,
    });

    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await expect(
      testFixture.executeAction(scenario.actor.id, null)
    ).rejects.toThrow(/forbidden component/i);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    expect(actorInstance.components['positioning:hugging']).toEqual({
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
  });
});
