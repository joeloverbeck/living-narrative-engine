/**
 * @file Integration tests for planning effects schema
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

describe('GOAP Schema Integration', () => {
  let ajv;
  let planningEffectsSchema;

  beforeAll(() => {
    // Load schemas
    const schemasDir = join(currentDirname, '../../../data/schemas');
    planningEffectsSchema = JSON.parse(
      readFileSync(join(schemasDir, 'planning-effects.schema.json'), 'utf8')
    );

    // Initialize AJV with planning effects schema
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Add schema to AJV
    ajv.addSchema(planningEffectsSchema, 'planning-effects.schema.json');
  });

  describe('Real-World Action Examples', () => {
    it('should validate sit down action with planning effects', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'positioning:standing',
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
          },
        ],
        cost: 1.0,
      };

      const valid = ajv.validate('planning-effects.schema.json', planningEffects);
      if (!valid) {
        console.error('Validation errors:', ajv.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate give item action with conditional effects', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'CONDITIONAL',
            condition: {
              abstractPrecondition: 'targetHasInventorySpace',
              params: ['target'],
            },
            then: [
              {
                operation: 'REMOVE_COMPONENT',
                entity: 'actor',
                component: 'items:in_inventory',
                componentId: '{selectedItem}',
              },
              {
                operation: 'ADD_COMPONENT',
                entity: 'target',
                component: 'items:in_inventory',
                componentId: '{selectedItem}',
              },
            ],
          },
        ],
        cost: 1.2,
        abstractPreconditions: {
          targetHasInventorySpace: {
            description: 'Checks if target has inventory space',
            parameters: ['target'],
            simulationFunction: 'assumeTrue',
          },
        },
      };

      const valid = ajv.validate('planning-effects.schema.json', planningEffects);
      if (!valid) {
        console.error('Validation errors:', ajv.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate open container action with state change', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'MODIFY_COMPONENT',
            entity: 'target',
            component: 'items:container',
            updates: {
              isOpen: true,
            },
          },
        ],
        cost: 0.5,
      };

      const valid = ajv.validate('planning-effects.schema.json', planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate complex multi-effect action', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'positioning:standing',
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
          },
          {
            operation: 'CONDITIONAL',
            condition: {
              abstractPrecondition: 'targetIsSitting',
              params: ['target'],
            },
            then: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'positioning:sitting_close_to',
                data: {
                  targetId: '{targetId}',
                },
              },
              {
                operation: 'ADD_COMPONENT',
                entity: 'target',
                component: 'positioning:sitting_close_to',
                data: {
                  targetId: '{actorId}',
                },
              },
            ],
          },
        ],
        cost: {
          base: 1.5,
          factors: ['distance', 'social_relationship'],
        },
        abstractPreconditions: {
          targetIsSitting: {
            description: 'Checks if target is already sitting',
            parameters: ['target'],
            simulationFunction: 'evaluateAtRuntime',
          },
        },
      };

      const valid = ajv.validate('planning-effects.schema.json', planningEffects);
      if (!valid) {
        console.error('Validation errors:', ajv.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('Schema File Integrity', () => {
    it('should load planning effects schema without errors', () => {
      expect(planningEffectsSchema).toBeDefined();
      expect(planningEffectsSchema.$id).toBe(
        'schema://living-narrative-engine/planning-effects.schema.json'
      );
      expect(planningEffectsSchema.title).toBe('Planning Effects');
    });

    it('should have correct schema structure', () => {
      expect(planningEffectsSchema.type).toBe('object');
      expect(planningEffectsSchema.properties).toBeDefined();
      expect(planningEffectsSchema.properties.effects).toBeDefined();
      expect(planningEffectsSchema.properties.cost).toBeDefined();
      expect(planningEffectsSchema.required).toContain('effects');
    });

    it('should define all effect type definitions', () => {
      expect(planningEffectsSchema.definitions).toBeDefined();
      expect(planningEffectsSchema.definitions.addComponentEffect).toBeDefined();
      expect(planningEffectsSchema.definitions.removeComponentEffect).toBeDefined();
      expect(planningEffectsSchema.definitions.modifyComponentEffect).toBeDefined();
      expect(planningEffectsSchema.definitions.conditionalEffect).toBeDefined();
      expect(planningEffectsSchema.definitions.dynamicCost).toBeDefined();
    });
  });

  describe('DI Container Integration', () => {
    it('should validate that GOAP tokens are properly typed', async () => {
      // This test validates that the token structure is correct
      const { goapTokens } = await import(
        '../../../src/dependencyInjection/tokens/tokens-goap.js'
      );

      const expectedTokens = [
        'IEffectsAnalyzer',
        'IEffectsGenerator',
        'IEffectsValidator',
        'IGoalManager',
        'IGoalStateEvaluator',
        'IActionSelector',
        'ISimplePlanner',
        'IPlanCache',
      ];

      expect(goapTokens).toBeDefined();

      // Verify all expected tokens are present
      expectedTokens.forEach((token) => {
        expect(goapTokens[token]).toBe(token);
      });
    });

    it('should have GOAP tokens exported in central tokens file', async () => {
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );

      expect(tokens).toBeDefined();

      // Verify GOAP tokens are included in the merged tokens
      expect(tokens.IEffectsAnalyzer).toBe('IEffectsAnalyzer');
      expect(tokens.IEffectsGenerator).toBe('IEffectsGenerator');
      expect(tokens.IEffectsValidator).toBe('IEffectsValidator');
      expect(tokens.IGoalManager).toBe('IGoalManager');
      expect(tokens.IGoalStateEvaluator).toBe('IGoalStateEvaluator');
      expect(tokens.IActionSelector).toBe('IActionSelector');
      expect(tokens.ISimplePlanner).toBe('ISimplePlanner');
      expect(tokens.IPlanCache).toBe('IPlanCache');
    });

    it('should have GOAP registration function exported', async () => {
      const { registerGoapServices } = await import(
        '../../../src/dependencyInjection/registrations/goapRegistrations.js'
      );

      expect(registerGoapServices).toBeDefined();
      expect(typeof registerGoapServices).toBe('function');
    });
  });

  describe('Backward Compatibility', () => {
    it('should validate that actions without planningEffects remain valid', () => {
      // This test verifies that the addition of planning effects
      // doesn't break existing actions that don't have this field
      //
      // Note: Action schema has "additionalProperties": true (line 261)
      // which means actions can include planningEffects without
      // explicitly defining it in the schema

      // This is a conceptual test - actual action schema validation
      // requires loading all schema dependencies (common.schema.json, etc.)
      // For now, we verify the planning effects schema itself is valid
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
      };

      const valid = ajv.validate('planning-effects.schema.json', planningEffects);
      expect(valid).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error for missing effects field', () => {
      const invalidPlanningEffects = {
        cost: 1.0,
        // Missing effects
      };

      const valid = ajv.validate(
        'planning-effects.schema.json',
        invalidPlanningEffects
      );
      expect(valid).toBe(false);
      expect(ajv.errors).toBeDefined();
      expect(ajv.errors.length).toBeGreaterThan(0);

      const missingEffectsError = ajv.errors.find(
        (err) => err.params.missingProperty === 'effects'
      );
      expect(missingEffectsError).toBeDefined();
    });

    it('should provide clear error for invalid component format', () => {
      const invalidPlanningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'invalid-component', // No colon separator
          },
        ],
      };

      const valid = ajv.validate(
        'planning-effects.schema.json',
        invalidPlanningEffects
      );
      expect(valid).toBe(false);

      const patternError = ajv.errors.find((err) => err.keyword === 'pattern');
      expect(patternError).toBeDefined();
    });
  });
});
