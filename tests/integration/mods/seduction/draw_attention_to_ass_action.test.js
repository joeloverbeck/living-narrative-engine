/**
 * @file Integration tests for the seduction:draw_attention_to_ass action.
 * @description Tests basic action properties and structure validation using the action property helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import drawAttentionToAssAction from '../../../../data/mods/seduction/actions/draw_attention_to_ass.action.json';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import drawAttentionToAssRule from '../../../../data/mods/seduction/rules/draw_attention_to_ass.rule.json';
import eventIsActionDrawAttentionToAss from '../../../../data/mods/seduction/conditions/event-is-action-draw-attention-to-ass.condition.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Seduction Mod: Draw Attention to Ass Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      validateActionProperties(drawAttentionToAssAction, {
        id: 'seduction:draw_attention_to_ass',
        name: 'Draw Attention to Ass',
        targets: 'none',
        template: 'draw attention to your ass',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    it('should use correct orange visual styling', () => {
      validateVisualStyling(
        drawAttentionToAssAction.visual,
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
      validateComponentRequirements(drawAttentionToAssAction, {
        required: {},
        forbidden: { actor: ['positioning:hugging'] },
      });
    });

    it('should have prerequisites for ass cheeks and lower torso clothing', () => {
      validatePrerequisites(drawAttentionToAssAction.prerequisites, {
        count: 2,
      });
    });
  });

  describe('Visual Design and Accessibility', () => {
    it('should meet accessibility contrast requirements', () => {
      // Test ensures the colors meet WCAG 2.1 AA standards
      // Orange theme: #f57f17 on #000000 and hover colors provide adequate contrast

      validateAccessibilityCompliance(
        drawAttentionToAssAction.visual,
        'Orange color scheme'
      );
    });
  });

  describe('Schema Compliance', () => {
    it('should have all required action properties', () => {
      validateRequiredActionProperties(drawAttentionToAssAction);
    });

    it('should have properly formatted description', () => {
      expect(drawAttentionToAssAction.description).toBe(
        'Angle and position yourself to flatter your buttocks, drawing attention to your ass in an alluring manner.'
      );
      expect(drawAttentionToAssAction.description.length).toBeGreaterThan(
        0
      );
    });

    it('should be self-targeting action', () => {
      expect(drawAttentionToAssAction.targets).toBe('none');
    });

    it('should have appropriate action template', () => {
      expect(drawAttentionToAssAction.template).toBe(
        'draw attention to your ass'
      );
      expect(drawAttentionToAssAction.template).toMatch(/^[a-z]/); // starts with lowercase
    });
  });

  describe('Prerequisites Logic Validation', () => {
    it('should require ass_cheek body part', () => {
      const assPrerequisite = drawAttentionToAssAction.prerequisites[0];
      expect(assPrerequisite.logic.hasPartOfType).toBeDefined();
      expect(assPrerequisite.logic.hasPartOfType).toEqual([
        'actor',
        'ass_cheek',
      ]);
    });

    it('should require lower torso clothing', () => {
      const clothingPrerequisite =
        drawAttentionToAssAction.prerequisites[1];
      expect(clothingPrerequisite.logic.hasClothingInSlot).toBeDefined();
      expect(clothingPrerequisite.logic.hasClothingInSlot).toEqual([
        'actor',
        'torso_lower',
      ]);
    });

    it('should have meaningful failure messages', () => {
      const assFailure =
        drawAttentionToAssAction.prerequisites[0].failure_message;
      const clothingFailure =
        drawAttentionToAssAction.prerequisites[1].failure_message;

      expect(assFailure).toContain('ass cheeks');
      expect(clothingFailure).toContain('clothing');
      expect(clothingFailure).toContain('lower torso');

      // Messages should be descriptive and user-friendly
      expect(assFailure.length).toBeGreaterThan(20);
      expect(clothingFailure.length).toBeGreaterThan(20);
    });
  });
});

describe('Seduction Mod: Draw Attention to Ass hugging restrictions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:draw_attention_to_ass',
      drawAttentionToAssRule,
      eventIsActionDrawAttentionToAss
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
