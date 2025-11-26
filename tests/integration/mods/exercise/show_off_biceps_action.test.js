/**
 * @file Integration tests for the exercise:show_off_biceps action.
 * @description Tests basic action properties and structure validation using the new test infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import showOffBicepsRule from '../../../../data/mods/exercise/rules/handle_show_off_biceps.rule.json';
import eventIsActionShowOffBiceps from '../../../../data/mods/exercise/conditions/event-is-action-show-off-biceps.condition.json';
import {
  validateActionProperties,
  validateVisualStyling,
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
        forbidden: { actor: ['positioning:hugging'] },
      });
    });

    it('should have prerequisites for muscular/hulking arms AND free grabbing appendages', () => {
      // The action now has 2 prerequisites (GRAPREFORACT-003)
      expect(showOffBicepsAction.prerequisites).toHaveLength(2);

      // First prerequisite: muscular/hulking arms check
      const firstPrereq = showOffBicepsAction.prerequisites[0];
      expect(firstPrereq.logic.or).toBeDefined();
      expect(firstPrereq.logic.or).toHaveLength(2);

      // Check for muscular arms condition
      expect(firstPrereq.logic.or[0].hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'muscular',
      ]);

      // Check for hulking arms condition
      expect(firstPrereq.logic.or[1].hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'hulking',
      ]);

      expect(firstPrereq.failure_message).toBe(
        "You don't have the muscular arms needed to show off."
      );

      // Second prerequisite: two free grabbing appendages check (added by GRAPREFORACT-003)
      const secondPrereq = showOffBicepsAction.prerequisites[1];
      expect(secondPrereq.logic.condition_ref).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
      expect(secondPrereq.failure_message).toBe(
        'You need both arms free to show off your biceps.'
      );
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

describe('Exercise Mod: Show Off Biceps action availability restrictions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'exercise',
      'exercise:show_off_biceps',
      showOffBicepsRule,
      eventIsActionShowOffBiceps
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('blocks execution when the actor is currently hugging someone', async () => {
    const scenario = testFixture.createStandardActorTarget(['Vera', 'Wyatt'], {
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
    ).rejects.toThrow('forbidden component');

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    expect(actorInstance.components['positioning:hugging']).toEqual({
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
  });
});
