import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LegacyTargetCompatibilityLayer } from '../../../../../../src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';
import { createMockLogger } from '../../../../../common/mockFactories/loggerMocks.js';

describe('LegacyTargetCompatibilityLayer', () => {
  let layer;
  let mockLogger;
  let mockActor;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActor = {
      id: 'actor-123',
      components: {},
    };

    layer = new LegacyTargetCompatibilityLayer({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with logger', () => {
      expect(layer).toBeInstanceOf(LegacyTargetCompatibilityLayer);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('initialized'),
        expect.objectContaining({ service: 'LegacyTargetCompatibilityLayer' })
      );
    });

    it('should throw if logger is missing', () => {
      expect(() => new LegacyTargetCompatibilityLayer({})).toThrow();
    });
  });

  describe('isLegacyAction', () => {
    it('should identify string targets as legacy', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      expect(layer.isLegacyAction(actionDef)).toBe(true);
    });

    it('should identify scope property as legacy', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'actor.items',
      };
      expect(layer.isLegacyAction(actionDef)).toBe(true);
    });

    it('should identify targetType as legacy', () => {
      const actionDef = {
        id: 'test-action',
        targetType: 'partner',
      };
      expect(layer.isLegacyAction(actionDef)).toBe(true);
    });

    it('should identify targetCount as legacy', () => {
      const actionDef = {
        id: 'test-action',
        targetCount: 2,
      };
      expect(layer.isLegacyAction(actionDef)).toBe(true);
    });

    it('should identify modern multi-target actions as non-legacy', () => {
      const actionDef = {
        id: 'test-action',
        targets: {
          primary: { scope: 'actor.partners' },
        },
      };
      expect(layer.isLegacyAction(actionDef)).toBe(false);
    });

    it('should handle null/undefined input', () => {
      expect(layer.isLegacyAction(null)).toBe(false);
      expect(layer.isLegacyAction(undefined)).toBe(false);
      expect(layer.isLegacyAction('string')).toBe(false);
    });

    it('should handle actions with both scope and targets', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'actor.items',
        targets: { primary: { scope: 'actor.partners' } },
      };
      // If targets exists as object, it's not legacy even with scope
      expect(layer.isLegacyAction(actionDef)).toBe(false);
    });

    it('should identify combined legacy fields', () => {
      const actionDef = {
        id: 'test-action',
        targetType: 'partner',
        targetCount: 1,
      };
      expect(layer.isLegacyAction(actionDef)).toBe(true);
    });

    it('should log debug information', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
      };

      layer.isLegacyAction(actionDef);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('isLegacyAction'),
        expect.objectContaining({
          service: 'LegacyTargetCompatibilityLayer',
          operation: 'isLegacyAction',
          actionId: 'test-action',
          hasStringTargets: true,
          hasScopeOnly: false,
          hasLegacyFields: false,
          isLegacy: true,
        })
      );
    });
  });

  describe('convertLegacyFormat', () => {
    it('should convert string targets format', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(true);
      expect(result.targetDefinitions).toBeDefined();
      expect(result.targetDefinitions.primary).toEqual({
        scope: 'actor.partners',
        placeholder: 'partner',
        description: 'Partner entities',
      });
    });

    it('should convert scope property format', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'actor.items',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(true);
      expect(result.targetDefinitions.primary).toEqual({
        scope: 'actor.items',
        placeholder: 'item',
        description: 'Items held by the actor',
      });
    });

    it('should convert targetType format', () => {
      const actionDef = {
        id: 'test-action',
        targetType: 'partner',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(true);
      expect(result.targetDefinitions.primary).toEqual({
        scope: 'actor.partners',
        placeholder: 'partner',
        description: 'Partner entities',
      });
    });

    it('should convert all targetType mappings', () => {
      const testCases = [
        {
          targetType: 'actor',
          expectedScope: 'actor',
          expectedPlaceholder: 'actor',
        },
        {
          targetType: 'self',
          expectedScope: 'self',
          expectedPlaceholder: 'self',
        },
        {
          targetType: 'partner',
          expectedScope: 'actor.partners',
          expectedPlaceholder: 'partner',
        },
        {
          targetType: 'item',
          expectedScope: 'actor.items',
          expectedPlaceholder: 'item',
        },
        {
          targetType: 'location',
          expectedScope: 'actor.location',
          expectedPlaceholder: 'location',
        },
        {
          targetType: 'unknown',
          expectedScope: 'none',
          expectedPlaceholder: 'target',
        },
      ];

      testCases.forEach(
        ({ targetType, expectedScope, expectedPlaceholder }) => {
          const actionDef = {
            id: 'test-action',
            targetType,
          };

          const result = layer.convertLegacyFormat(actionDef, mockActor);

          expect(result.targetDefinitions.primary.scope).toBe(expectedScope);
          expect(result.targetDefinitions.primary.placeholder).toBe(
            expectedPlaceholder
          );
        }
      );
    });

    it('should handle none scope with optional flag', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'none',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(true);
      expect(result.targetDefinitions.primary.optional).toBe(true);
    });

    it('should use custom placeholder if provided', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
        placeholder: 'companion',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.targetDefinitions.primary.placeholder).toBe('companion');
    });

    it('should derive placeholder from template tokens when available', () => {
      const actionDef = {
        id: 'template-action',
        targets: 'actor.partners',
        template: 'Interact with {friendAlias} today',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.targetDefinitions.primary.placeholder).toBe('friendAlias');
    });

    it('should use targetDescription if provided', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
        targetDescription: 'Custom description',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.targetDefinitions.primary.description).toBe(
        'Custom description'
      );
    });

    it('should return error for non-legacy actions', () => {
      const actionDef = {
        id: 'test-action',
        targets: { primary: { scope: 'actor.partners' } },
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(false);
      expect(result.error).toBe('Action is not in legacy format');
    });

    it('should handle unexpected template structures by returning an error', () => {
      const actionDef = {
        id: 'error-action',
        targets: 'actor.partners',
        template: {},
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.isLegacy).toBe(true);
      expect(result.error).toContain('Failed to convert legacy format');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('convertLegacyFormat'),
        expect.objectContaining({
          service: 'LegacyTargetCompatibilityLayer',
          operation: 'convertLegacyFormat',
          actionId: 'error-action',
          error: expect.stringContaining('match'),
        })
      );
    });

    it('should validate required parameters', () => {
      expect(() => layer.convertLegacyFormat(null, mockActor)).toThrow(
        'Missing required parameters'
      );
      expect(() => layer.convertLegacyFormat({ id: 'test' }, null)).toThrow(
        'Missing required parameters'
      );
    });

    it('should handle scope priority correctly', () => {
      // targets (string) should take priority over scope
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
        scope: 'actor.items',
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.targetDefinitions.primary.scope).toBe('actor.partners');
    });

    it('should generate default scope for empty action', () => {
      const actionDef = {
        id: 'test-action',
        targetCount: 1, // Make it legacy but without explicit scope
      };

      const result = layer.convertLegacyFormat(actionDef, mockActor);

      expect(result.targetDefinitions.primary.scope).toBe('none');
      expect(result.targetDefinitions.primary.placeholder).toBe('target');
    });

    it('should log successful conversion', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
      };

      layer.convertLegacyFormat(actionDef, mockActor);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('convertLegacyFormat'),
        expect.objectContaining({
          service: 'LegacyTargetCompatibilityLayer',
          operation: 'convertLegacyFormat',
          actionId: 'test-action',
          scope: 'actor.partners',
          placeholder: 'partner',
          converted: true,
        })
      );
    });
  });

  describe('getMigrationSuggestion', () => {
    it('should suggest migration for string targets', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
        otherProp: 'value',
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);
      const parsed = JSON.parse(suggestion);

      expect(parsed).toEqual({
        id: 'test-action',
        targets: {
          primary: {
            scope: 'actor.partners',
            placeholder: 'partner',
          },
        },
        otherProp: 'value',
      });
    });

    it('should suggest migration for scope property', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'actor.items',
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);
      const parsed = JSON.parse(suggestion);

      expect(parsed.targets.primary.scope).toBe('actor.items');
      expect(parsed.targets.primary.placeholder).toBe('item');
    });

    it('should suggest migration for targetType', () => {
      const actionDef = {
        id: 'test-action',
        targetType: 'self',
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);
      const parsed = JSON.parse(suggestion);

      expect(parsed.targets.primary.scope).toBe('self');
      expect(parsed.targets.primary.placeholder).toBe('self');
    });

    it('should add optional flag for none scope', () => {
      const actionDef = {
        id: 'test-action',
        scope: 'none',
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);
      const parsed = JSON.parse(suggestion);

      expect(parsed.targets.primary.optional).toBe(true);
    });

    it('should exclude legacy properties from suggestion', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
        scope: 'old-scope',
        targetType: 'old-type',
        targetCount: 2,
        keepMe: true,
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);
      const parsed = JSON.parse(suggestion);

      expect(parsed.targets).toBeDefined();
      expect(parsed.scope).toBeUndefined();
      expect(parsed.targetType).toBeUndefined();
      expect(parsed.targetCount).toBeUndefined();
      expect(parsed.keepMe).toBe(true);
    });

    it('should return message for non-legacy actions', () => {
      const actionDef = {
        id: 'test-action',
        targets: { primary: { scope: 'actor.partners' } },
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);

      expect(suggestion).toBe('Action is already in modern format');
    });

    it('should validate required parameters', () => {
      expect(() => layer.getMigrationSuggestion(null)).toThrow(
        'Missing required parameters'
      );
    });

    it('should produce valid JSON', () => {
      const actionDef = {
        id: 'test-action',
        targets: 'actor.partners',
      };

      const suggestion = layer.getMigrationSuggestion(actionDef);

      expect(() => JSON.parse(suggestion)).not.toThrow();
      expect(suggestion).toMatch(/^{[\s\S]*}$/); // Basic JSON structure check
    });
  });

  describe('validateConversion', () => {
    it('should validate correct conversion', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'partner',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing primary target', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {};

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Modern format must include a primary target'
      );
    });

    it('should detect scope mismatch', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.items',
          placeholder: 'partner',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Scope mismatch: legacy='actor.partners', modern='actor.items'"
      );
    });

    it('should detect placeholder mismatch', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'item',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Placeholder mismatch: expected='partner', actual='item'"
      );
    });

    it('should detect unexpected additional targets', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'partner',
        },
        secondary: {
          scope: 'actor.items',
          placeholder: 'item',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Legacy actions should only have primary target, found: primary, secondary'
      );
    });

    it('should validate targetType conversions', () => {
      const legacyAction = {
        id: 'test-action',
        targetType: 'partner',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'partner',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(true);
    });

    it('should validate scope property conversions', () => {
      const legacyAction = {
        id: 'test-action',
        scope: 'actor.items',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.items',
          placeholder: 'item',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.items',
          placeholder: 'item',
        },
        secondary: {
          scope: 'actor.location',
          placeholder: 'location',
        },
      };

      const result = layer.validateConversion(legacyAction, modernTargets);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // scope mismatch, placeholder mismatch, additional targets
    });

    it('should validate required parameters', () => {
      expect(() => layer.validateConversion(null, {})).toThrow(
        'Missing required parameters'
      );
      expect(() => layer.validateConversion({}, null)).toThrow(
        'Missing required parameters'
      );
    });

    it('should log validation results', () => {
      const legacyAction = {
        id: 'test-action',
        targets: 'actor.partners',
      };
      const modernTargets = {
        primary: {
          scope: 'actor.partners',
          placeholder: 'partner',
        },
      };

      layer.validateConversion(legacyAction, modernTargets);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('validateConversion'),
        expect.objectContaining({
          service: 'LegacyTargetCompatibilityLayer',
          operation: 'validateConversion',
          actionId: 'test-action',
          valid: true,
          errorCount: 0,
        })
      );
    });
  });

  describe('placeholder generation', () => {
    it('should generate appropriate placeholders for different scopes', () => {
      const testCases = [
        { scope: 'actor.partners', expected: 'partner' },
        { scope: 'some.partners.test', expected: 'partner' },
        { scope: 'actor.items', expected: 'item' },
        { scope: 'inventory.items', expected: 'item' },
        { scope: 'actor.location', expected: 'location' },
        { scope: 'current.location', expected: 'location' },
        { scope: 'self', expected: 'self' },
        { scope: 'actor', expected: 'actor' },
        { scope: 'custom.scope', expected: 'target' },
      ];

      testCases.forEach(({ scope, expected }) => {
        const actionDef = {
          id: 'test-action',
          targets: scope,
        };

        const result = layer.convertLegacyFormat(actionDef, mockActor);
        expect(result.targetDefinitions.primary.placeholder).toBe(expected);
      });
    });
  });

  describe('description generation', () => {
    it('should generate appropriate descriptions for different scopes', () => {
      const testCases = [
        { scope: 'actor.partners', expected: 'Partner entities' },
        { scope: 'actor.items', expected: 'Items held by the actor' },
        { scope: 'actor.location', expected: 'Current location' },
        { scope: 'self', expected: 'The actor themselves' },
        { scope: 'actor', expected: 'The acting entity' },
        { scope: 'none', expected: 'No target required' },
        { scope: 'custom.scope', expected: 'Target from scope: custom.scope' },
      ];

      testCases.forEach(({ scope, expected }) => {
        const actionDef = {
          id: 'test-action',
          targets: scope,
        };

        const result = layer.convertLegacyFormat(actionDef, mockActor);
        expect(result.targetDefinitions.primary.description).toBe(expected);
      });
    });
  });
});
