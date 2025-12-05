/**
 * @file Unit tests for modifier tag display in MultiTargetActionFormatter
 * @see src/actions/formatters/MultiTargetActionFormatter.js
 * Ticket: DATDRIMODSYS-005
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('MultiTargetActionFormatter - Modifier Tag Display', () => {
  let formatter;
  let mockBaseFormatter;
  let mockLogger;
  let mockChanceCalculationService;

  beforeEach(() => {
    mockBaseFormatter = {
      format: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockChanceCalculationService = {
      calculateForDisplay: jest.fn(),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  describe('tag formatting', () => {
    it('should format single tag correctly', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['target prone'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (65% chance) [target prone]'
      );
    });

    it('should format multiple tags correctly', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 75,
        displayText: '75%',
        activeTags: ['target prone', 'low light', 'flanking'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (75% chance) [target prone] [low light] [flanking]'
      );
    });

    it('should filter empty tags', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['valid tag', '', 'another valid'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (65% chance) [valid tag] [another valid]'
      );
    });

    it('should filter whitespace-only tags', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['  ', 'valid', '   ', '\t', 'also valid'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (65% chance) [valid] [also valid]'
      );
    });

    it('should handle empty activeTags array', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 55,
        displayText: '55%',
        activeTags: [],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe('attack Enemy (55% chance)');
      // No tags should be appended
      expect(result.value[0].command).not.toContain('[');
    });

    it('should handle null activeTags gracefully', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 55,
        displayText: '55%',
        activeTags: null,
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe('attack Enemy (55% chance)');
    });

    it('should handle undefined activeTags gracefully', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 55,
        displayText: '55%',
        // activeTags is undefined
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe('attack Enemy (55% chance)');
    });

    it('should preserve tag order from displayResult', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      // Tags should appear in this exact order
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['first', 'second', 'third'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (65% chance) [first] [second] [third]'
      );
    });

    it('should trim whitespace from tags', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['  padded tag  ', '\ttabbed\t', 'normal'],
        breakdown: {},
      });

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe(
        'attack Enemy (65% chance) [padded tag] [tabbed] [normal]'
      );
    });
  });

  describe('error resilience', () => {
    it('should continue without tags when chance calculation throws', () => {
      const actionDef = {
        id: 'test:action',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee', default: 50 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockImplementation(
        () => {
          throw new Error('Calculation failed');
        }
      );

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      // Should not crash - continues with unresolved {chance}
      // The template may contain unresolved placeholders, which is an error
      // but the formatter shouldn't throw
      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to calculate chance for tag display',
        expect.objectContaining({
          actionId: 'test:action',
          error: 'Calculation failed',
        })
      );
    });
  });

  describe('templates without chance placeholder', () => {
    it('should not append tags when template has no {chance} placeholder', () => {
      const actionDef = {
        id: 'test:action',
        template: 'simple action on {target}',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
        },
        // No chanceBased config - not a chance-based action
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toBe('simple action on Enemy');
      // Chance calculation should not be called
      expect(
        mockChanceCalculationService.calculateForDisplay
      ).not.toHaveBeenCalled();
    });
  });

  describe('parameter passing', () => {
    it('should pass all target role IDs to calculateForDisplay', () => {
      const actionDef = {
        id: 'test:action',
        template: 'cast {spell} on {target} via {catalyst} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { scope: 'test:actors', placeholder: 'target' },
          secondary: { scope: 'test:spells', placeholder: 'spell' },
          tertiary: { scope: 'test:items', placeholder: 'catalyst' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:magic', default: 50 },
          targetSkill: {
            component: 'skills:resistance',
            default: 10,
            targetRole: 'primary',
          },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'target_1', displayName: 'Enemy' }],
        secondary: [{ id: 'spell_1', displayName: 'Fireball' }],
        tertiary: [{ id: 'catalyst_1', displayName: 'Ruby' }],
      };

      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        activeTags: ['magic bonus'],
        breakdown: {},
      });

      formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {
          chanceCalculationService: mockChanceCalculationService,
          actorId: 'actor_1',
        },
        { targetDefinitions: actionDef.targets }
      );

      expect(
        mockChanceCalculationService.calculateForDisplay
      ).toHaveBeenCalledWith({
        actorId: 'actor_1',
        primaryTargetId: 'target_1',
        secondaryTargetId: 'spell_1',
        tertiaryTargetId: 'catalyst_1',
        actionDef,
      });
    });
  });
});
