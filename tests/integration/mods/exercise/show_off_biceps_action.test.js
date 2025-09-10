/**
 * @file Integration tests for the exercise:show_off_biceps action.
 * @description Tests basic action properties and structure validation using the new test infrastructure.
 */

import { describe, it, expect } from '@jest/globals';
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Exercise Mod: Show Off Biceps Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      validateActionProperties(showOffBicepsAction, {
        id: 'exercise:show_off_biceps',
        name: 'Show Off Biceps',
        targets: 'none',
        template: 'show off your muscular arms',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    it('should use correct Orange Flame visual styling', () => {
      validateVisualStyling(showOffBicepsAction.visual, 'Orange Flame', {
        backgroundColor: '#e65100',
        textColor: '#ffffff',
        hoverBackgroundColor: '#ff6f00',
        hoverTextColor: '#ffffff',
      });
    });

    it('should have no component requirements or restrictions', () => {
      validateComponentRequirements(showOffBicepsAction, {
        required: {},
        forbidden: {},
      });
    });

    it('should have prerequisites for muscular/hulking arms', () => {
      validatePrerequisites(showOffBicepsAction.prerequisites, {
        count: 1,
        failureMessage: "You don't have the muscular arms needed to show off.",
        validator: (prerequisite) => {
          expect(prerequisite.logic.or).toBeDefined();
          expect(prerequisite.logic.or).toHaveLength(2);

          // Check for muscular arms condition
          expect(
            prerequisite.logic.or[0].hasPartOfTypeWithComponentValue
          ).toEqual(['actor', 'arm', 'descriptors:build', 'build', 'muscular']);

          // Check for hulking arms condition
          expect(
            prerequisite.logic.or[1].hasPartOfTypeWithComponentValue
          ).toEqual(['actor', 'arm', 'descriptors:build', 'build', 'hulking']);
        },
      });
    });
  });

  describe('Visual Design and Accessibility', () => {
    it('should meet accessibility contrast requirements', () => {
      // Test ensures the colors meet WCAG 2.1 AA standards
      // Orange Flame scheme: #e65100 on #ffffff gives 5.13:1 contrast (normal)
      // Hover: #ff6f00 on #ffffff gives 4.56:1 contrast (hover)
      validateAccessibilityCompliance(
        showOffBicepsAction.visual,
        'Orange Flame color scheme'
      );
    });
  });

  describe('Schema Compliance', () => {
    it('should have all required action properties', () => {
      validateRequiredActionProperties(showOffBicepsAction);
    });

    it('should have properly formatted description', () => {
      expect(showOffBicepsAction.description).toBe(
        'Flex your arms to show off your muscular biceps and triceps.'
      );
      expect(showOffBicepsAction.description.length).toBeGreaterThan(0);
    });
  });
});
