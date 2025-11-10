/**
 * @file Integration tests for the seduction:draw_attention_to_breasts action.
 * @description Tests basic action properties and structure validation using the action property helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import drawAttentionToBreastsAction from '../../../../data/mods/seduction/actions/draw_attention_to_breasts.action.json';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import drawAttentionToBreastsRule from '../../../../data/mods/seduction/rules/draw_attention_to_breasts.rule.json';
import eventIsActionDrawAttentionToBreasts from '../../../../data/mods/seduction/conditions/event-is-action-draw-attention-to-breasts.condition.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Seduction Mod: Draw Attention to Breasts Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      validateActionProperties(drawAttentionToBreastsAction, {
        id: 'seduction:draw_attention_to_breasts',
        name: 'Draw Attention to Breasts',
        targets: 'none',
        template: 'draw attention to your breasts',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    it('should use correct orange visual styling', () => {
      validateVisualStyling(
        drawAttentionToBreastsAction.visual,
        'Orange Theme',
        {
          backgroundColor: '#f57f17',
          textColor: '#000000',
          hoverBackgroundColor: '#f9a825',
          hoverTextColor: '#212121',
        }
      );
    });

    it('should require actor to not be hugging anyone', () => {
      validateComponentRequirements(drawAttentionToBreastsAction, {
        required: {},
        forbidden: { actor: ['positioning:hugging', 'positioning:doing_complex_performance'] },
      });
    });

    it('should have prerequisites for breasts and upper torso clothing', () => {
      validatePrerequisites(drawAttentionToBreastsAction.prerequisites, {
        count: 3,
      });
    });
  });

  describe('Visual Design and Accessibility', () => {
    it('should meet accessibility contrast requirements', () => {
      // Test ensures the colors meet WCAG 2.1 AA standards
      // Orange theme: #f57f17 on #000000 and hover colors provide adequate contrast

      validateAccessibilityCompliance(
        drawAttentionToBreastsAction.visual,
        'Orange color scheme'
      );
    });
  });

  describe('Schema Compliance', () => {
    it('should have all required action properties', () => {
      validateRequiredActionProperties(drawAttentionToBreastsAction);
    });

    it('should have properly formatted description', () => {
      expect(drawAttentionToBreastsAction.description).toBe(
        'Angle and position yourself to flatter your bustline, drawing attention to your breasts in an alluring manner.'
      );
      expect(drawAttentionToBreastsAction.description.length).toBeGreaterThan(
        0
      );
    });

    it('should be self-targeting action', () => {
      expect(drawAttentionToBreastsAction.targets).toBe('none');
    });

    it('should have appropriate action template', () => {
      expect(drawAttentionToBreastsAction.template).toBe(
        'draw attention to your breasts'
      );
      expect(drawAttentionToBreastsAction.template).toMatch(/^[a-z]/); // starts with lowercase
    });
  });

  describe('Prerequisites Logic Validation', () => {
    it('should require breast body part', () => {
      const breastPrerequisite = drawAttentionToBreastsAction.prerequisites[0];
      expect(breastPrerequisite.logic.hasPartOfType).toBeDefined();
      expect(breastPrerequisite.logic.hasPartOfType).toEqual([
        'actor',
        'breast',
      ]);
    });

    it('should require upper torso clothing', () => {
      const clothingPrerequisite =
        drawAttentionToBreastsAction.prerequisites[1];
      expect(clothingPrerequisite.logic.hasClothingInSlot).toBeDefined();
      expect(clothingPrerequisite.logic.hasClothingInSlot).toEqual([
        'actor',
        'torso_upper',
      ]);
    });

    it('should require other actors at location', () => {
      const otherActorsPrerequisite =
        drawAttentionToBreastsAction.prerequisites[2];
      expect(
        otherActorsPrerequisite.logic.hasOtherActorsAtLocation
      ).toBeDefined();
      expect(otherActorsPrerequisite.logic.hasOtherActorsAtLocation).toEqual([
        'actor',
      ]);
    });

    it('should have meaningful failure messages', () => {
      const breastFailure =
        drawAttentionToBreastsAction.prerequisites[0].failure_message;
      const clothingFailure =
        drawAttentionToBreastsAction.prerequisites[1].failure_message;
      const otherActorsFailure =
        drawAttentionToBreastsAction.prerequisites[2].failure_message;

      expect(breastFailure).toContain('breasts');
      expect(clothingFailure).toContain('clothing');
      expect(clothingFailure).toContain('upper torso');
      expect(otherActorsFailure).toContain('nobody here');

      // Messages should be descriptive and user-friendly
      expect(breastFailure.length).toBeGreaterThan(20);
      expect(clothingFailure.length).toBeGreaterThan(20);
      expect(otherActorsFailure.length).toBeGreaterThan(20);
    });
  });
});

describe('Seduction Mod: Draw Attention to Breasts hugging restrictions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:draw_attention_to_breasts',
      drawAttentionToBreastsRule,
      eventIsActionDrawAttentionToBreasts
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('rejects the action when the actor is currently hugging someone', async () => {
    const scenario = testFixture.createStandardActorTarget(['Brielle', 'Harper'], {
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
