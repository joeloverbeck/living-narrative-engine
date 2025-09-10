/**
 * @file Integration tests for the seduction:draw_attention_to_breasts action.
 * @description Tests basic action properties and structure validation using the action property helpers.
 */

import { describe, it, expect } from '@jest/globals';
import drawAttentionToBreastsAction from '../../../../data/mods/seduction/actions/draw_attention_to_breasts.action.json';
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

    it('should have no component requirements or restrictions', () => {
      validateComponentRequirements(drawAttentionToBreastsAction, {
        required: {},
      });
    });

    it('should have prerequisites for breasts and upper torso clothing', () => {
      validatePrerequisites(drawAttentionToBreastsAction.prerequisites, {
        count: 2,
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

    it('should have meaningful failure messages', () => {
      const breastFailure =
        drawAttentionToBreastsAction.prerequisites[0].failure_message;
      const clothingFailure =
        drawAttentionToBreastsAction.prerequisites[1].failure_message;

      expect(breastFailure).toContain('breasts');
      expect(clothingFailure).toContain('clothing');
      expect(clothingFailure).toContain('upper torso');

      // Messages should be descriptive and user-friendly
      expect(breastFailure.length).toBeGreaterThan(20);
      expect(clothingFailure.length).toBeGreaterThan(20);
    });
  });
});
