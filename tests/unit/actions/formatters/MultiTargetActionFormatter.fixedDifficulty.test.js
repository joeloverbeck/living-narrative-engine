/**
 * @file Test suite for MultiTargetActionFormatter fixed-difficulty chance-based actions
 * @description Tests that fixed-difficulty actions with generateCombinations: true
 * correctly resolve the {chance} placeholder without requiring a target skill.
 *
 * This addresses the issue where warding:draw_salt_boundary was being filtered out
 * because the {chance} placeholder wasn't being resolved for fixed-difficulty actions
 * that only have a primary target.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - fixed-difficulty chance-based actions', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let entityManager;
  let mockChanceCalculationService;

  beforeEach(() => {
    // Setup logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Mock base formatter (not used in multi-target formatting)
    baseFormatter = {
      format: jest.fn(),
    };

    // Mock entity manager
    entityManager = {
      getEntityInstance: jest.fn(),
    };

    // Mock chance calculation service
    mockChanceCalculationService = {
      calculateForDisplay: jest.fn().mockReturnValue({
        chance: 65,
        displayText: '65%',
        breakdown: {
          actorSkill: 85,
          targetSkill: 0,
          baseChance: 65,
          finalChance: 65,
          modifiers: [],
          formula: 'linear',
        },
      }),
    };

    // Create formatter instance
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  describe('fixed-difficulty actions with primary target only', () => {
    it('should resolve {chance} placeholder for fixed-difficulty actions without targetSkill', () => {
      // Setup action definition matching warding:draw_salt_boundary
      const actionDef = {
        id: 'warding:draw_salt_boundary',
        name: 'Draw Salt Boundary',
        description:
          'Attempt to create a protective salt boundary around a corrupted target.',
        template: 'draw salt boundary around {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: {
            scope: 'warding:corrupted_actors',
            placeholder: 'target',
            description: 'Corrupted actor to ward',
          },
        },
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          fixedDifficulty: 50,
          formula: 'linear',
          actorSkill: {
            component: 'skills:warding_skill',
            property: 'value',
            default: 10,
          },
          bounds: {
            min: 5,
            max: 95,
          },
          // Note: NO targetSkill section (fixed-difficulty doesn't need opponent skill)
        },
      };

      // Setup resolved targets - single corrupted target
      const resolvedTargets = {
        primary: [
          {
            id: 'corrupted_entity_1',
            displayName: 'Corrupted Entity',
            type: 'entity',
          },
        ],
      };

      // Target definitions from the action
      const targetDefinitions = actionDef.targets;

      // Format the action with chance calculation service
      // Note: chanceCalculationService and actorId must be in options (4th param)
      // targetDefinitions must be in deps (5th param)
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'ward_caster_1',
        },
        { targetDefinitions }
      );

      // Assert the result
      expect(result.ok).toBe(true);
      expect(result.value).toBeDefined();
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(1);

      // Verify the {chance} placeholder was resolved
      const command = result.value[0].command;
      expect(command).toBe(
        'draw salt boundary around Corrupted Entity (65% chance)'
      );
      expect(command).not.toContain('{chance}');

      // Verify the chance calculation service was called correctly
      // Note: primaryTargetId is now passed for modifier context, even for fixed_difficulty
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'ward_caster_1',
        primaryTargetId: 'corrupted_entity_1', // Passed for modifier context
        secondaryTargetId: undefined,
        tertiaryTargetId: undefined,
        actionDef,
      });
    });

    it('should resolve {chance} for fixed-difficulty actions with multiple primary targets', () => {
      const actionDef = {
        id: 'warding:draw_salt_boundary',
        name: 'Draw Salt Boundary',
        template: 'draw salt boundary around {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: {
            scope: 'warding:corrupted_actors',
            placeholder: 'target',
          },
        },
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          fixedDifficulty: 50,
          formula: 'linear',
          actorSkill: {
            component: 'skills:warding_skill',
            property: 'value',
            default: 10,
          },
          bounds: { min: 5, max: 95 },
        },
      };

      // Multiple corrupted targets
      const resolvedTargets = {
        primary: [
          { id: 'corrupted_1', displayName: 'First Demon' },
          { id: 'corrupted_2', displayName: 'Second Demon' },
          { id: 'corrupted_3', displayName: 'Third Demon' },
        ],
      };

      const targetDefinitions = actionDef.targets;

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'ward_caster_1',
        },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(3);

      // All commands should have {chance} resolved
      const commands = result.value.map((item) => item.command);
      expect(commands).toEqual([
        'draw salt boundary around First Demon (65% chance)',
        'draw salt boundary around Second Demon (65% chance)',
        'draw salt boundary around Third Demon (65% chance)',
      ]);

      // None should contain unresolved placeholder
      commands.forEach((cmd) => {
        expect(cmd).not.toContain('{chance}');
      });

      // Chance calculation should be called for each target
      expect(
        mockChanceCalculationService.calculateForDisplay
      ).toHaveBeenCalledTimes(3);
    });
  });

  describe('contested actions with targetSkill', () => {
    it('should still work for opposed actions with explicit targetRole', () => {
      // Contested action like swing_at_target
      const actionDef = {
        id: 'combat:swing_at_target',
        name: 'Swing at Target',
        template: 'swing at {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          secondary: {
            scope: 'combat:enemies',
            placeholder: 'target',
          },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          formula: 'ratio',
          actorSkill: {
            component: 'skills:melee_skill',
            property: 'value',
            default: 10,
          },
          targetSkill: {
            targetRole: 'secondary',
            component: 'skills:defense_skill',
            property: 'value',
            default: 10,
          },
          bounds: { min: 5, max: 95 },
        },
      };

      const resolvedTargets = {
        secondary: [{ id: 'enemy_1', displayName: 'Goblin' }],
      };

      const targetDefinitions = actionDef.targets;

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'fighter_1',
        },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).toBe('swing at Goblin (65% chance)');

      // Should pass primaryTargetId for contested actions (with all target role IDs)
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'fighter_1',
        primaryTargetId: 'enemy_1',
        secondaryTargetId: 'enemy_1', // secondary = primary when used as context source
        tertiaryTargetId: undefined,
        actionDef,
      });
    });

    it('should fallback to primary target for contested actions without explicit targetRole', () => {
      // Contested action without explicit targetRole
      const actionDef = {
        id: 'grappling:grab',
        name: 'Grab',
        template: 'grab {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: {
            scope: 'nearby:actors',
            placeholder: 'target',
          },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          formula: 'ratio',
          actorSkill: {
            component: 'skills:grappling_skill',
            property: 'value',
            default: 10,
          },
          // targetSkill exists but NO targetRole specified
          targetSkill: {
            component: 'skills:defense_skill',
            property: 'value',
            default: 10,
          },
          bounds: { min: 5, max: 95 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Opponent' }],
      };

      const targetDefinitions = actionDef.targets;

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'grappler_1',
        },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).toBe('grab Opponent (65% chance)');

      // Should fallback to primary target since no targetRole specified
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'grappler_1',
        primaryTargetId: 'target_1', // Falls back to primary
        secondaryTargetId: undefined,
        tertiaryTargetId: undefined,
        actionDef,
      });
    });
  });

  describe('edge cases', () => {
    it('should reject commands with unresolved {chance} when chanceCalculationService is not provided', () => {
      const actionDef = {
        id: 'warding:draw_salt_boundary',
        name: 'Draw Salt Boundary',
        template: 'draw salt boundary around {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'warding:corrupted_actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          fixedDifficulty: 50,
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'corrupted_1', displayName: 'Demon' }],
      };

      // Note: chanceCalculationService should be in options (4th param), so omit it there
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          // NO chanceCalculationService provided
          actorId: 'ward_caster_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      // When chance can't be calculated, {chance} remains unresolved
      // The formatter rejects commands with unresolved placeholders (correct behavior)
      // This causes the action to not be available in the action discovery pipeline
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(0); // Empty because unresolved placeholders are rejected
    });

    it('should reject commands with unresolved {chance} when actorId is not provided', () => {
      const actionDef = {
        id: 'warding:draw_salt_boundary',
        name: 'Draw Salt Boundary',
        template: 'draw salt boundary around {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'warding:corrupted_actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          fixedDifficulty: 50,
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'corrupted_1', displayName: 'Demon' }],
      };

      // Note: actorId should be in options (4th param), so omit it there
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          // NO actorId provided
        },
        { targetDefinitions: actionDef.targets }
      );

      // When chance can't be calculated (no actorId), {chance} remains unresolved
      // The formatter rejects commands with unresolved placeholders
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(0); // Empty because unresolved placeholders are rejected
    });

    it('should handle actions without chanceBased config', () => {
      const actionDef = {
        id: 'movement:walk_to',
        name: 'Walk To',
        template: 'walk to {destination}',
        generateCombinations: true,
        targets: {
          primary: { scope: 'nearby:locations', placeholder: 'destination' },
        },
        // NO chanceBased config
      };

      const resolvedTargets = {
        primary: [{ id: 'location_1', displayName: 'Market Square' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        {
          debug: true,
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'walker_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe('walk to Market Square');

      // Chance calculation should not be called
      expect(
        mockChanceCalculationService.calculateForDisplay
      ).not.toHaveBeenCalled();
    });
  });
});
