import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ComponentExistenceValidationRule } from '../../../../../src/anatomy/validation/rules/componentExistenceValidationRule.js';
import { LoadTimeValidationContext } from '../../../../../src/anatomy/validation/loadTimeValidationContext.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('ComponentExistenceValidationRule', () => {
  let validationRule;
  let testBed;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock data registry
    mockDataRegistry = testBed.createMock('dataRegistry', ['get', 'getAll']);

    // Configure getAll to return empty object by default to prevent TypeError
    mockDataRegistry.getAll.mockReturnValue({});

    validationRule = new ComponentExistenceValidationRule({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('ruleId and ruleName', () => {
    it('should have correct rule ID', () => {
      expect(validationRule.ruleId).toBe('component-existence');
    });

    it('should have correct rule name', () => {
      expect(validationRule.ruleName).toBe(
        'Component Existence Validation'
      );
    });
  });

  describe('shouldApply', () => {
    it('should return true when context has recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': {} },
      });

      expect(validationRule.shouldApply(context)).toBe(true);
    });

    it('should return false when context has no recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: {},
      });

      expect(validationRule.shouldApply(context)).toBe(false);
    });
  });

  describe('slot validation', () => {
    it('should detect missing component in slot tags', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            tags: ['anatomy:part', 'anatomy:horned'],
          },
        },
      };

      // Mock: anatomy:part exists, anatomy:horned does not
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'components' && id === 'anatomy:part') {
          return { id: 'anatomy:part' };
        }
        return undefined;
      });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        message: "Component 'anatomy:horned' does not exist",
        context: {
          recipeId: 'test:recipe',
          componentId: 'anatomy:horned',
          location: {
            type: 'slot',
            name: 'head',
            field: 'tags',
          },
        },
      });
      expect(issues[0].suggestion).toContain(
        'data/mods/anatomy/components/horned.component.json'
      );
    });

    it('should detect missing component in slot notTags', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          torso: {
            notTags: ['anatomy:winged'],
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        context: {
          componentId: 'anatomy:winged',
          location: {
            type: 'slot',
            name: 'torso',
            field: 'notTags',
          },
        },
      });
    });

    it('should detect missing component in slot properties', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            properties: {
              'anatomy:scaled': { coverage: 'full' },
            },
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        context: {
          componentId: 'anatomy:scaled',
          location: {
            type: 'slot',
            name: 'head',
            field: 'properties',
          },
        },
      });
    });

    it('should emit a warning and skip slot properties that are not plain objects', async () => {
      mockLogger.warn.mockClear();
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            properties: ['invalid'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "ComponentExistenceValidationRule: slot 'head' properties must be a plain object; received array"
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'warning',
        type: 'INVALID_PROPERTY_OBJECT',
        context: {
          location: {
            type: 'slot',
            name: 'head',
            field: 'properties',
          },
          receivedType: 'array',
        },
      });
    });

    it('should pass when all slot components exist', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            tags: ['anatomy:part'],
            notTags: ['anatomy:horned'],
            properties: {
              'anatomy:scaled': { coverage: 'full' },
            },
          },
        },
      };

      // All components exist
      mockDataRegistry.get.mockReturnValue({ id: 'mock-component' });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });
  });

  describe('pattern validation', () => {
    it('should detect missing component in pattern tags (v1 matches)', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matches: ['head', 'neck'],
            tags: ['anatomy:scaled'],
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        context: {
          componentId: 'anatomy:scaled',
          location: {
            type: 'pattern',
            name: 'head,neck',
            field: 'tags',
            index: 0,
          },
        },
      });
    });

    it('should detect missing component in pattern tags (v2 matchesPattern)', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matchesPattern: '*_wing',
            tags: ['anatomy:feathered'],
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        context: {
          componentId: 'anatomy:feathered',
          location: {
            type: 'pattern',
            name: '*_wing',
            field: 'tags',
          },
        },
      });
    });

    it('should detect missing component in pattern tags (v2 matchesGroup)', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matchesGroup: 'limbs',
            notTags: ['anatomy:clawed'],
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        context: {
          componentId: 'anatomy:clawed',
          location: {
            type: 'pattern',
            name: 'limbs',
            field: 'notTags',
          },
        },
      });
    });

    it('should detect missing component in pattern tags (v2 matchesAll)', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matchesAll: true,
            tags: ['anatomy:living'],
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        context: {
          location: {
            type: 'pattern',
            name: 'matchesAll',
            field: 'tags',
          },
        },
      });
    });

    it('should detect missing component in pattern properties', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matchesPattern: '*',
            properties: {
              'anatomy:bioluminescent': { intensity: 'bright' },
            },
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        context: {
          componentId: 'anatomy:bioluminescent',
          location: {
            type: 'pattern',
            name: '*',
            field: 'properties',
          },
        },
      });
    });

    it('should warn and skip pattern properties that are not plain objects', async () => {
      mockLogger.warn.mockClear();
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            properties: ['invalid'],
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "ComponentExistenceValidationRule: pattern 'pattern-0' properties must be a plain object; received array"
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'warning',
        type: 'INVALID_PROPERTY_OBJECT',
        context: {
          location: {
            type: 'pattern',
            name: 'pattern-0',
            field: 'properties',
            index: 0,
          },
          receivedType: 'array',
        },
      });
    });

    it('should pass when all pattern components exist', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [
          {
            matchesPattern: '*',
            tags: ['anatomy:part'],
            notTags: ['anatomy:horned'],
            properties: {
              'anatomy:scaled': { coverage: 'full' },
            },
          },
        ],
      };

      mockDataRegistry.get.mockReturnValue({ id: 'mock-component' });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });
  });

  describe('constraint validation', () => {
    it('should detect missing component in constraints.requires', async () => {
      const recipe = {
        id: 'test:recipe',
        constraints: {
          requires: [
            {
              components: ['anatomy:winged', 'anatomy:feathered'],
            },
          ],
        },
      };

      // Mock: anatomy:winged exists, anatomy:feathered does not
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'components' && id === 'anatomy:winged') {
          return { id: 'anatomy:winged' };
        }
        return undefined;
      });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        context: {
          componentId: 'anatomy:feathered',
          location: {
            type: 'constraint',
            name: 'requires',
            field: 'components',
            index: 0,
          },
        },
      });
    });

    it('should detect missing component in constraints.excludes', async () => {
      const recipe = {
        id: 'test:recipe',
        constraints: {
          excludes: [
            {
              components: ['anatomy:undead'],
            },
          ],
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        context: {
          componentId: 'anatomy:undead',
          location: {
            type: 'constraint',
            name: 'excludes',
            field: 'components',
            index: 0,
          },
        },
      });
    });

    it('should pass when all constraint components exist', async () => {
      const recipe = {
        id: 'test:recipe',
        constraints: {
          requires: [{ components: ['anatomy:winged'] }],
          excludes: [{ components: ['anatomy:undead'] }],
        },
      };

      mockDataRegistry.get.mockReturnValue({ id: 'mock-component' });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle recipe with no slots', async () => {
      const recipe = {
        id: 'test:recipe',
        patterns: [],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle recipe with no patterns', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {},
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle recipe with no constraints', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {},
        patterns: [],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle empty tags/notTags arrays', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            tags: [],
            notTags: [],
          },
        },
        patterns: [
          {
            matchesPattern: '*',
            tags: [],
            notTags: [],
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle empty properties object', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            properties: {},
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle component ID without namespace', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            tags: ['part'],
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].context.componentId).toBe('part');
      expect(issues[0].suggestion).toContain('data/mods/*/components/part');
    });

    it('should detect multiple missing components across all locations', async () => {
      const recipe = {
        id: 'test:recipe',
        slots: {
          head: {
            tags: ['anatomy:missing1'],
          },
        },
        patterns: [
          {
            matchesPattern: '*',
            tags: ['anatomy:missing2'],
          },
        ],
        constraints: {
          requires: [{ components: ['anatomy:missing3'] }],
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(3);
      expect(issues.map((i) => i.context.componentId)).toEqual([
        'anatomy:missing1',
        'anatomy:missing2',
        'anatomy:missing3',
      ]);
    });
  });

  describe('multiple recipes', () => {
    it('should validate all recipes in context', async () => {
      const recipes = {
        'test:recipe1': {
          id: 'test:recipe1',
          slots: {
            head: { tags: ['anatomy:missing1'] },
          },
        },
        'test:recipe2': {
          id: 'test:recipe2',
          slots: {
            torso: { tags: ['anatomy:missing2'] },
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes,
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(2);
      expect(issues[0].context.recipeId).toBe('test:recipe1');
      expect(issues[1].context.recipeId).toBe('test:recipe2');
    });
  });
});
