/**
 * @file Schema validation tests for multi-target action examples
 */

import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ strict: false });

describe('Multi-Target Action Examples - Schema Validation', () => {
  let actionSchema;
  let commonSchema;

  beforeAll(() => {
    // Load the schemas
    const commonSchemaPath = join(process.cwd(), 'data/schemas/common.schema.json');
    const actionSchemaPath = join(process.cwd(), 'data/schemas/action.schema.json');
    const conditionContainerSchemaPath = join(process.cwd(), 'data/schemas/condition-container.schema.json');
    const jsonLogicSchemaPath = join(process.cwd(), 'data/schemas/json-logic.schema.json');
    
    commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));
    actionSchema = JSON.parse(readFileSync(actionSchemaPath, 'utf8'));
    const conditionContainerSchema = JSON.parse(readFileSync(conditionContainerSchemaPath, 'utf8'));
    const jsonLogicSchema = JSON.parse(readFileSync(jsonLogicSchemaPath, 'utf8'));
    
    // Add schemas to AJV
    ajv.addSchema(commonSchema, 'common.schema.json');
    ajv.addSchema(jsonLogicSchema, 'json-logic.schema.json');
    ajv.addSchema(conditionContainerSchema, 'condition-container.schema.json');
    ajv.addSchema(actionSchema, 'action.schema.json');
  });

  describe('Basic Multi-Target Action', () => {
    it('should validate throw item at target action', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/basic_multi_target.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const validate = ajv.compile(actionSchema);
      const isValid = validate(actionDef);
      
      if (!isValid) {
        console.log('Validation errors:', JSON.stringify(validate.errors, null, 2));
      }
      
      expect(isValid).toBe(true);
    });

    it('should have correct target structure', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/basic_multi_target.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      expect(actionDef.targets).toBeDefined();
      expect(actionDef.targets.primary).toBeDefined();
      expect(actionDef.targets.secondary).toBeDefined();
      
      expect(actionDef.targets.primary.scope).toBe('examples:throwable_items');
      expect(actionDef.targets.primary.placeholder).toBe('item');
      
      expect(actionDef.targets.secondary.scope).toBe('examples:throw_targets');
      expect(actionDef.targets.secondary.placeholder).toBe('target');
    });

    it('should have matching template placeholders', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/basic_multi_target.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const template = actionDef.template;
      const primaryPlaceholder = actionDef.targets.primary.placeholder;
      const secondaryPlaceholder = actionDef.targets.secondary.placeholder;

      expect(template).toContain(`{${primaryPlaceholder}}`);
      expect(template).toContain(`{${secondaryPlaceholder}}`);
    });
  });

  describe('Context-Dependent Action', () => {
    it('should validate unlock container with key action', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/context_dependent.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const validate = ajv.compile(actionSchema);
      const isValid = validate(actionDef);
      
      if (!isValid) {
        console.log('Validation errors:', JSON.stringify(validate.errors, null, 2));
      }
      
      expect(isValid).toBe(true);
    });

    it('should have contextFrom dependency', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/context_dependent.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      expect(actionDef.targets.secondary.contextFrom).toBe('primary');
    });

    it('should not generate combinations', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/context_dependent.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      expect(actionDef.generateCombinations).toBe(false);
    });
  });

  describe('Optional Targets Action', () => {
    it('should validate give item to character action', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/optional_targets.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const validate = ajv.compile(actionSchema);
      const isValid = validate(actionDef);
      
      if (!isValid) {
        console.log('Validation errors:', JSON.stringify(validate.errors, null, 2));
      }
      
      expect(isValid).toBe(true);
    });

    it('should have optional tertiary target', () => {
      const actionPath = join(process.cwd(), 'data/mods/examples/actions/optional_targets.action.json');
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      expect(actionDef.targets.tertiary).toBeDefined();
      expect(actionDef.targets.tertiary.optional).toBe(true);
    });
  });

  describe('All Examples', () => {
    const exampleFiles = [
      'basic_multi_target.action.json',
      'context_dependent.action.json',
      'optional_targets.action.json'
    ];

    exampleFiles.forEach(filename => {
      it(`should have required schema properties: ${filename}`, () => {
        const actionPath = join(process.cwd(), 'data/mods/examples/actions', filename);
        const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

        expect(actionDef.id).toBeDefined();
        expect(actionDef.name).toBeDefined();
        expect(actionDef.description).toBeDefined();
        expect(actionDef.template).toBeDefined();
        expect(actionDef.targets).toBeDefined();
      });

      it(`should have valid JSON Logic prerequisites: ${filename}`, () => {
        const actionPath = join(process.cwd(), 'data/mods/examples/actions', filename);
        const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

        if (actionDef.prerequisites) {
          actionDef.prerequisites.forEach(prereq => {
            expect(prereq.logic).toBeDefined();
            expect(typeof prereq.logic).toBe('object');
            expect(prereq.failure_message).toBeDefined();
            expect(typeof prereq.failure_message).toBe('string');
          });
        }
      });
    });
  });
});