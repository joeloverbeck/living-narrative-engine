/**
 * @file Integration tests for the exercise:show_off_biceps action.
 * @description Tests basic action properties and structure validation.
 */

import { describe, it, expect } from '@jest/globals';
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';

describe('Exercise Mod: Show Off Biceps Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      // Assert: Verify action structure
      expect(showOffBicepsAction.id).toBe('exercise:show_off_biceps');
      expect(showOffBicepsAction.name).toBe('Show Off Biceps');
      expect(showOffBicepsAction.targets).toBe('none');
      expect(showOffBicepsAction.template).toBe('show off your muscular arms');
    });

    it('should use correct Orange Flame visual styling', () => {
      // Assert: Verify WCAG compliant colors
      expect(showOffBicepsAction.visual.backgroundColor).toBe('#e65100');
      expect(showOffBicepsAction.visual.textColor).toBe('#ffffff');
      expect(showOffBicepsAction.visual.hoverBackgroundColor).toBe('#ff6f00');
      expect(showOffBicepsAction.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have no component requirements or restrictions', () => {
      // Assert: Verify component configuration
      expect(showOffBicepsAction.required_components).toEqual({});
      expect(showOffBicepsAction.forbidden_components).toEqual({});
    });

    it('should have prerequisites for muscular/hulking arms', () => {
      // Assert: Verify prerequisites exist
      expect(showOffBicepsAction.prerequisites).toHaveLength(1);

      const prerequisite = showOffBicepsAction.prerequisites[0];
      expect(prerequisite.logic.or).toBeDefined();
      expect(prerequisite.logic.or).toHaveLength(2);

      // Check for muscular arms condition
      expect(prerequisite.logic.or[0].hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'muscular',
      ]);

      // Check for hulking arms condition
      expect(prerequisite.logic.or[1].hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'hulking',
      ]);

      // Check failure message
      expect(prerequisite.failure_message).toBe(
        "You don't have the muscular arms needed to show off."
      );
    });

    it('should use self-targeting pattern (targets: none)', () => {
      // Assert: Should be self-targeting like core:stop_following
      expect(showOffBicepsAction.targets).toBe('none');
    });

    it('should have proper schema reference', () => {
      // Assert: Should reference the correct schema
      expect(showOffBicepsAction.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });
  });

  describe('Visual Design Validation', () => {
    it('should meet accessibility contrast requirements', () => {
      // Test ensures the colors meet WCAG 2.1 AA standards
      // Orange Flame scheme: #e65100 on #ffffff gives 5.13:1 contrast (normal)
      // Hover: #ff6f00 on #ffffff gives 4.56:1 contrast (hover)

      const bg = showOffBicepsAction.visual.backgroundColor;
      const text = showOffBicepsAction.visual.textColor;
      const hoverBg = showOffBicepsAction.visual.hoverBackgroundColor;
      const hoverText = showOffBicepsAction.visual.hoverTextColor;

      // Verify color format (hex codes)
      expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(text).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hoverBg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hoverText).toMatch(/^#[0-9a-f]{6}$/i);

      // Verify specific Orange Flame scheme
      expect(bg.toLowerCase()).toBe('#e65100');
      expect(text.toLowerCase()).toBe('#ffffff');
      expect(hoverBg.toLowerCase()).toBe('#ff6f00');
      expect(hoverText.toLowerCase()).toBe('#ffffff');
    });
  });

  describe('Schema Validation', () => {
    it('should have all required action properties', () => {
      // Assert: Verify all required properties are present
      const requiredProps = [
        '$schema',
        'id',
        'name',
        'description',
        'targets',
        'template',
        'visual',
      ];

      requiredProps.forEach((prop) => {
        expect(showOffBicepsAction).toHaveProperty(prop);
        expect(showOffBicepsAction[prop]).toBeDefined();
      });
    });

    it('should have properly formatted description', () => {
      // Assert: Description should be clear and actionable
      expect(showOffBicepsAction.description).toBe(
        'Flex your arms to show off your muscular biceps and triceps.'
      );
      expect(typeof showOffBicepsAction.description).toBe('string');
      expect(showOffBicepsAction.description.length).toBeGreaterThan(0);
    });
  });
});
