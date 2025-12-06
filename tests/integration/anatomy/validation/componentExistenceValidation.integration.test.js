/**
 * @file Integration tests for Component Existence Validation
 * @description Tests the full component existence validation integration with real data registry
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ComponentExistenceValidationRule } from '../../../../src/anatomy/validation/rules/componentExistenceValidationRule.js';
import { LoadTimeValidationContext } from '../../../../src/anatomy/validation/loadTimeValidationContext.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ComponentExistenceValidation Integration', () => {
  let testBed;
  let mockLogger;
  let dataRegistry;
  let validationRule;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create real data registry
    dataRegistry = new InMemoryDataRegistry({ logger: mockLogger });

    validationRule = new ComponentExistenceValidationRule({
      logger: mockLogger,
      dataRegistry,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Real Data Registry Integration', () => {
    it('should pass validation when all components exist in registry', async () => {
      // Store components in registry
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        description: 'Base anatomy part',
      });
      dataRegistry.store('components', 'anatomy:scaled', {
        id: 'anatomy:scaled',
        description: 'Scaled component',
      });
      dataRegistry.store('components', 'anatomy:winged', {
        id: 'anatomy:winged',
        description: 'Winged component',
      });

      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:part', 'anatomy:scaled'],
          },
        },
        patterns: [
          {
            matchesPattern: '*_wing',
            tags: ['anatomy:winged'],
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should detect missing component when not in registry', async () => {
      // Only store anatomy:part
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        description: 'Base anatomy part',
      });

      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:part', 'anatomy:horned'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        type: 'COMPONENT_NOT_FOUND',
        message: "Component 'anatomy:horned' does not exist",
        context: {
          recipeId: 'anatomy:dragon',
          componentId: 'anatomy:horned',
          location: {
            type: 'slot',
            name: 'head',
            field: 'tags',
          },
        },
      });
    });

    it('should detect multiple missing components across different locations', async () => {
      // Store only one component
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        description: 'Base anatomy part',
      });

      const recipe = {
        id: 'anatomy:red_dragon',
        slots: {
          head: {
            tags: ['anatomy:part', 'anatomy:horned'], // horned missing
          },
        },
        patterns: [
          {
            matchesPattern: '*',
            tags: ['anatomy:scaled'], // scaled missing
          },
        ],
        constraints: {
          requires: [
            {
              components: ['anatomy:winged'], // winged missing
            },
          ],
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:red_dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(3);

      const componentIds = issues.map((i) => i.context.componentId);
      expect(componentIds).toContain('anatomy:horned');
      expect(componentIds).toContain('anatomy:scaled');
      expect(componentIds).toContain('anatomy:winged');
    });

    it('should handle multiple recipes with mixed validation results', async () => {
      // Store some components
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        description: 'Base anatomy part',
      });
      dataRegistry.store('components', 'anatomy:scaled', {
        id: 'anatomy:scaled',
        description: 'Scaled component',
      });

      const recipes = {
        'anatomy:dragon': {
          id: 'anatomy:dragon',
          slots: {
            head: {
              tags: ['anatomy:part', 'anatomy:horned'], // horned missing
            },
          },
        },
        'anatomy:snake': {
          id: 'anatomy:snake',
          slots: {
            body: {
              tags: ['anatomy:part', 'anatomy:scaled'], // all present
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes,
      });

      const issues = await validationRule.validate(context);

      // Only dragon should have errors
      expect(issues).toHaveLength(1);
      expect(issues[0].context.recipeId).toBe('anatomy:dragon');
      expect(issues[0].context.componentId).toBe('anatomy:horned');
    });

    it('should validate components with fully qualified IDs', async () => {
      // Store component with namespace
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        modId: 'anatomy',
      });

      const recipe = {
        id: 'anatomy:humanoid',
        slots: {
          torso: {
            tags: ['anatomy:part'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:humanoid': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });

    it('should provide actionable error messages with file paths', async () => {
      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:horned'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].suggestion).toBe(
        'Create component at: data/mods/anatomy/components/horned.component.json'
      );
    });

    it('should handle components from different mods', async () => {
      // Store components from different mods
      dataRegistry.store('components', 'anatomy:part', {
        id: 'anatomy:part',
        modId: 'anatomy',
      });
      dataRegistry.store('components', 'magic:arcane', {
        id: 'magic:arcane',
        modId: 'magic',
      });

      const recipe = {
        id: 'anatomy:arcane_dragon',
        slots: {
          head: {
            tags: ['anatomy:part', 'magic:arcane'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:arcane_dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });
  });

  describe('Validation Rule Chain Integration', () => {
    it('should add issues to LoadTimeValidationContext', async () => {
      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:missing_component'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      // Validate using the rule
      const issues = await validationRule.validate(context);

      // Manually add issues to context (normally done by ValidationRuleChain)
      context.addIssues(issues);

      // Verify issues are in context
      expect(context.hasErrors()).toBe(true);
      expect(context.getErrors()).toHaveLength(1);
      expect(context.getErrors()[0]).toContain('anatomy:missing_component');
    });

    it('should categorize issues by severity', async () => {
      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:missing1', 'anatomy:missing2'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await validationRule.validate(context);
      context.addIssues(issues);

      expect(context.getIssuesBySeverity('error')).toHaveLength(2);
      expect(context.getIssuesBySeverity('warning')).toHaveLength(0);
    });

    it('should include ruleId in all issues', async () => {
      const recipe = {
        id: 'anatomy:dragon',
        slots: {
          head: {
            tags: ['anatomy:missing'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(
        issues.every((issue) => issue.ruleId === 'component-existence')
      ).toBe(true);
    });
  });

  describe('Edge Cases with Real Registry', () => {
    it('should handle empty registry', async () => {
      const recipe = {
        id: 'anatomy:test',
        slots: {
          head: {
            tags: ['anatomy:part'],
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:test': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].context.componentId).toBe('anatomy:part');
    });

    it('should handle recipe with all component types', async () => {
      // Store all required components
      [
        'anatomy:part',
        'anatomy:scaled',
        'anatomy:winged',
        'anatomy:clawed',
      ].forEach((id) => {
        dataRegistry.store('components', id, { id });
      });

      const recipe = {
        id: 'anatomy:complete',
        slots: {
          head: {
            tags: ['anatomy:part'],
            notTags: ['anatomy:scaled'],
            properties: {
              'anatomy:clawed': { length: 'long' },
            },
          },
        },
        patterns: [
          {
            matchesPattern: '*_wing',
            tags: ['anatomy:winged'],
          },
        ],
        constraints: {
          requires: [{ components: ['anatomy:part'] }],
          excludes: [{ components: ['anatomy:scaled'] }],
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:complete': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(0);
    });
  });
});
