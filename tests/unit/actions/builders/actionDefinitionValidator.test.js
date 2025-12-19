/**
 * @file Unit tests for ActionDefinitionValidator
 * @description Comprehensive test suite for the ActionDefinitionValidator class,
 * covering all validation rules, error scenarios, and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionValidator } from '../../../../src/actions/builders/actionDefinitionValidator.js';

describe('ActionDefinitionValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ActionDefinitionValidator();
  });

  /**
   * Helper function to create a valid action definition for testing
   *
   * @returns {object} Valid action definition
   */
  function createValidDefinition() {
    return {
      id: 'test:action',
      name: 'Test Action',
      description: 'A test action',
      scope: 'test:scope',
      template: 'test {target}',
      prerequisites: [],
      required_components: { actor: [] },
    };
  }

  describe('required field validation', () => {
    const requiredFields = [
      { field: 'id', message: 'Action ID is required' },
      { field: 'name', message: 'Action name is required' },
      { field: 'description', message: 'Action description is required' },
      { field: 'scope', message: 'Action scope is required' },
      { field: 'template', message: 'Action template is required' },
    ];

    requiredFields.forEach(({ field, message }) => {
      it(`should require ${field}`, () => {
        const definition = createValidDefinition();
        delete definition[field];

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(message);
      });

      it(`should fail when ${field} is null`, () => {
        const definition = createValidDefinition();
        definition[field] = null;

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(message);
      });

      it(`should fail when ${field} is undefined`, () => {
        const definition = createValidDefinition();
        definition[field] = undefined;

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(message);
      });

      it(`should fail when ${field} is empty string`, () => {
        const definition = createValidDefinition();
        definition[field] = '';

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(message);
      });
    });

    it('should pass validation with all required fields present', () => {
      const definition = createValidDefinition();

      const result = validator.validate(definition);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('ID format validation', () => {
    const validIds = [
      'test:action',
      'core:attack',
      'my_mod:custom_action',
      'namespace123:identifier456',
      'mod_name:action-name',
      'test-namespace:action',
      'a:b',
    ];

    validIds.forEach((id) => {
      it(`should accept valid ID: ${id}`, () => {
        const definition = createValidDefinition();
        definition.id = id;

        const result = validator.validate(definition);
        const idErrors = result.errors.filter((error) =>
          error.includes('namespace:identifier format')
        );
        expect(idErrors).toHaveLength(0);
      });
    });

    const invalidIds = [
      'no-colon',
      'invalid id',
      ':empty-namespace',
      'empty-identifier:',
      'test::double-colon',
      'test:id:extra-colon',
      'test:',
      ':test',
      '',
      'test:id with spaces',
      'тест:action', // non-ASCII characters
      '123test:action', // namespace cannot start with number
      ':123action', // empty namespace
    ];

    invalidIds.forEach((id) => {
      it(`should reject invalid ID: "${id}"`, () => {
        const definition = createValidDefinition();
        definition.id = id;

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        if (id === '') {
          // Empty string is caught by required field validation
          expect(result.errors).toContain('Action ID is required');
        } else {
          expect(result.errors).toContain(
            'Action ID must follow namespace:identifier format (e.g., "core:attack")'
          );
        }
      });
    });
  });

  describe('scope format validation', () => {
    it('should accept "none" as valid scope', () => {
      const definition = createValidDefinition();
      definition.scope = 'none';

      const result = validator.validate(definition);
      const scopeErrors = result.errors.filter((error) =>
        error.includes('Scope must be')
      );
      expect(scopeErrors).toHaveLength(0);
    });

    const validScopes = [
      'none',
      'core:nearby_actors',
      'test:targets',
      'my_mod:custom_scope',
    ];

    validScopes.forEach((scope) => {
      it(`should accept valid scope: ${scope}`, () => {
        const definition = createValidDefinition();
        definition.scope = scope;

        const result = validator.validate(definition);
        const scopeErrors = result.errors.filter((error) =>
          error.includes('Scope must be')
        );
        expect(scopeErrors).toHaveLength(0);
      });
    });

    const invalidScopes = [
      'invalid-scope',
      'no colon',
      ':empty-namespace',
      'empty-identifier:',
      'test::double-colon',
    ];

    invalidScopes.forEach((scope) => {
      it(`should reject invalid scope: "${scope}"`, () => {
        const definition = createValidDefinition();
        definition.scope = scope;

        const result = validator.validate(definition);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Scope must be "none" or follow namespace:identifier format (e.g., "core:nearby_actors")'
        );
      });
    });
  });

  describe('template validation for targeted actions', () => {
    it('should require {target} placeholder for targeted actions', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'action without placeholder';

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Template for targeted actions should include {target} placeholder'
      );
    });

    it('should accept template with {target} for targeted actions', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'action {target}';

      const result = validator.validate(definition);
      const templateErrors = result.errors.filter((error) =>
        error.includes('{target} placeholder')
      );
      expect(templateErrors).toHaveLength(0);
    });

    it('should not require {target} for basic actions (scope: none)', () => {
      const definition = createValidDefinition();
      definition.scope = 'none';
      definition.template = 'basic action';

      const result = validator.validate(definition);
      const templateErrors = result.errors.filter((error) =>
        error.includes('{target} placeholder')
      );
      expect(templateErrors).toHaveLength(0);
    });

    it('should accept multiple {target} placeholders', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'move {target} to {target}';

      const result = validator.validate(definition);
      const templateErrors = result.errors.filter((error) =>
        error.includes('{target} placeholder')
      );
      expect(templateErrors).toHaveLength(0);
    });

    it('should be case sensitive for {target}', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'action {TARGET}'; // uppercase

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Template for targeted actions should include {target} placeholder'
      );
    });
  });

  describe('component validation', () => {
    it('should accept valid component array', () => {
      const definition = createValidDefinition();
      definition.required_components = {
        actor: ['core:position', 'core:health', 'test:component'],
      };

      const result = validator.validate(definition);
      const componentErrors = result.errors.filter((error) =>
        error.includes('component')
      );
      expect(componentErrors).toHaveLength(0);
    });

    it('should accept empty component array', () => {
      const definition = createValidDefinition();
      definition.required_components = { actor: [] };

      const result = validator.validate(definition);
      const componentErrors = result.errors.filter((error) =>
        error.includes('component')
      );
      expect(componentErrors).toHaveLength(0);
    });

    it('should reject non-array component list', () => {
      const definition = createValidDefinition();
      definition.required_components = { actor: 'not-an-array' };

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'required_components.actor must be an array'
      );
    });

    it('should reject non-string component IDs', () => {
      const definition = createValidDefinition();
      definition.required_components = {
        actor: ['core:position', 123, 'core:health'],
      };

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Component at index 1 must be a string');
    });

    it('should validate component ID format', () => {
      const definition = createValidDefinition();
      definition.required_components = {
        actor: ['core:position', 'invalid-id', 'core:health'],
      };

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid component ID at index 1: "invalid-id" (must follow namespace:identifier format)'
      );
    });

    it('should reject missing required_components structure', () => {
      const definition = createValidDefinition();
      definition.required_components = 'not-an-object';

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('required_components must be an object');
    });

    it('should reject missing actor property in required_components', () => {
      const definition = createValidDefinition();
      definition.required_components = {};

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'required_components must have an "actor" property'
      );
    });

    it('should allow undefined required_components (will be caught by other validation)', () => {
      const definition = createValidDefinition();
      delete definition.required_components;

      const result = validator.validate(definition);
      // This will pass component validation but may fail other validations
      const componentErrors = result.errors.filter((error) =>
        error.includes('required_components must be an object')
      );
      expect(componentErrors).toHaveLength(0);
    });
  });

  describe('prerequisite validation', () => {
    it('should accept valid string prerequisites', () => {
      const definition = createValidDefinition();
      definition.prerequisites = ['anatomy:actor-can-move', 'test:condition'];

      const result = validator.validate(definition);
      const prereqErrors = result.errors.filter((error) =>
        error.includes('prerequisite')
      );
      expect(prereqErrors).toHaveLength(0);
    });

    it('should accept valid object prerequisites', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        {
          logic: { condition_ref: 'anatomy:actor-can-move' },
          failure_message: 'Cannot move',
        },
      ];

      const result = validator.validate(definition);
      const prereqErrors = result.errors.filter((error) =>
        error.includes('prerequisite')
      );
      expect(prereqErrors).toHaveLength(0);
    });

    it('should accept object prerequisites without failure_message', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        { logic: { condition_ref: 'anatomy:actor-can-move' } },
      ];

      const result = validator.validate(definition);
      const prereqErrors = result.errors.filter((error) =>
        error.includes('prerequisite')
      );
      expect(prereqErrors).toHaveLength(0);
    });

    it('should accept mixed string and object prerequisites', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        'anatomy:actor-can-move',
        {
          logic: { condition_ref: 'test:condition' },
          failure_message: 'Test failed',
        },
      ];

      const result = validator.validate(definition);
      const prereqErrors = result.errors.filter((error) =>
        error.includes('prerequisite')
      );
      expect(prereqErrors).toHaveLength(0);
    });

    it('should accept empty prerequisite array', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [];

      const result = validator.validate(definition);
      const prereqErrors = result.errors.filter((error) =>
        error.includes('prerequisite')
      );
      expect(prereqErrors).toHaveLength(0);
    });

    it('should reject non-array prerequisites', () => {
      const definition = createValidDefinition();
      definition.prerequisites = 'not-an-array';

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prerequisites must be an array');
    });

    it('should validate string prerequisite ID format', () => {
      const definition = createValidDefinition();
      definition.prerequisites = ['core:valid-condition', 'invalid-format'];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid prerequisite ID at index 1: "invalid-format" (must follow namespace:identifier format)'
      );
    });

    it('should validate object prerequisite condition_ref format', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        { logic: { condition_ref: 'invalid-format' }, failure_message: 'Test' },
      ];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid prerequisite condition_ref at index 0: "invalid-format" (must follow namespace:identifier format)'
      );
    });

    it('should reject object prerequisite without logic.condition_ref', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [{ invalid: 'format' }];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid prerequisite format at index 0: expected string or object with logic.condition_ref'
      );
    });

    it('should reject non-string condition_ref', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [{ logic: { condition_ref: 123 } }];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Prerequisite condition_ref at index 0 must be a string'
      );
    });

    it('should reject non-string failure_message', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        { logic: { condition_ref: 'core:condition' }, failure_message: 123 },
      ];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Prerequisite failure_message at index 0 must be a string'
      );
    });

    it('should reject invalid prerequisite types', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [123, null, undefined];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid prerequisite format at index 0: expected string or object'
      );
      expect(result.errors).toContain(
        'Invalid prerequisite format at index 1: expected string or object'
      );
      expect(result.errors).toContain(
        'Invalid prerequisite format at index 2: expected string or object'
      );
    });
  });

  describe('multiple validation errors', () => {
    it('should report all validation errors', () => {
      const definition = {
        // Missing all required fields
        required_components: 'not-an-object',
        prerequisites: 'not-an-array',
      };

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5); // Should have multiple errors

      // Check for presence of different error types
      expect(
        result.errors.some((error) => error.includes('Action ID is required'))
      ).toBe(true);
      expect(
        result.errors.some((error) => error.includes('Action name is required'))
      ).toBe(true);
      expect(
        result.errors.some((error) =>
          error.includes('required_components must be an object')
        )
      ).toBe(true);
      expect(
        result.errors.some((error) =>
          error.includes('Prerequisites must be an array')
        )
      ).toBe(true);
    });

    it('should validate complex definition with multiple component and prerequisite errors', () => {
      const definition = createValidDefinition();
      definition.id = 'invalid-id';
      definition.scope = 'invalid-scope';
      definition.template = 'no target placeholder';
      definition.required_components = {
        actor: ['valid:component', 'invalid-component', 123],
      };
      definition.prerequisites = [
        'valid:condition',
        'invalid-condition',
        { invalid: 'object' },
      ];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });

  describe('edge cases', () => {
    it('should handle null definition', () => {
      const result = validator.validate(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Definition must be a valid object');
    });

    it('should handle undefined definition', () => {
      const result = validator.validate(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Definition must be a valid object');
    });

    it('should handle non-object definition (string)', () => {
      const result = validator.validate('not-an-object');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Definition must be a valid object');
    });

    it('should handle non-object definition (number)', () => {
      const result = validator.validate(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Definition must be a valid object');
    });

    it('should handle non-object definition (array)', () => {
      const result = validator.validate([]);
      expect(result.isValid).toBe(false);
      // Arrays are objects in JavaScript, so this passes the initial object check
      // and fails on required field validation instead
      expect(result.errors).toContain('Action ID is required');
    });

    it('should handle empty object definition', () => {
      const result = validator.validate({});
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate definition with empty string fields', () => {
      const definition = {
        id: '',
        name: '',
        description: '',
        scope: '',
        template: '',
        prerequisites: [],
        required_components: { actor: [] },
      };

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action ID is required');
      expect(result.errors).toContain('Action name is required');
      expect(result.errors).toContain('Action description is required');
      expect(result.errors).toContain('Action scope is required');
      expect(result.errors).toContain('Action template is required');
    });

    it('should handle definition with extra properties', () => {
      const definition = createValidDefinition();
      definition.extraProperty = 'extra value';
      definition.anotherExtra = 123;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(true); // Extra properties should be ignored
    });

    it('should handle very long arrays', () => {
      const definition = createValidDefinition();
      definition.required_components.actor = Array.from(
        { length: 1000 },
        (_, i) => `test:comp${i}`
      );
      definition.prerequisites = Array.from(
        { length: 1000 },
        (_, i) => `test:cond${i}`
      );

      const result = validator.validate(definition);
      expect(result.isValid).toBe(true);
    });

    it('should handle UTF-8 characters in IDs', () => {
      const definition = createValidDefinition();
      definition.id = 'tëst:açtîön'; // Non-ASCII characters should be rejected

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Action ID must follow namespace:identifier format (e.g., "core:attack")'
      );
    });

    it('should handle special characters in template', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'special chars: !@#$%^&*() {target}';

      const result = validator.validate(definition);
      expect(result.isValid).toBe(true); // Special chars in template should be allowed
    });

    it('should handle nested objects in prerequisites', () => {
      const definition = createValidDefinition();
      definition.prerequisites = [
        {
          logic: {
            condition_ref: 'core:condition',
            nested: { deeply: { nested: 'value' } },
          },
          failure_message: 'Test',
        },
      ];

      const result = validator.validate(definition);
      expect(result.isValid).toBe(true); // Extra nested properties should be ignored
    });

    it('should handle circular references gracefully', () => {
      const definition = createValidDefinition();
      const circular = {};
      circular.self = circular;
      definition.circular = circular;

      // This should not throw an error, just validate normally
      expect(() => validator.validate(definition)).not.toThrow();
    });

    it('should handle definition with null required_components', () => {
      const definition = createValidDefinition();
      definition.required_components = null;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('required_components must be an object');
    });

    it('should handle definition without template but with scope', () => {
      const definition = createValidDefinition();
      delete definition.template;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action template is required');
    });

    it('should handle definition with targeted action missing {target}', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'action without target placeholder';

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Template for targeted actions should include {target} placeholder'
      );
    });

    it('should pass validation when template includes {target} for targeted actions', () => {
      const definition = createValidDefinition();
      definition.scope = 'test:targets';
      definition.template = 'action with {target} placeholder';

      const result = validator.validate(definition);
      const templateErrors = result.errors.filter((error) =>
        error.includes('{target} placeholder')
      );
      expect(templateErrors).toHaveLength(0);
    });

    it('should not require {target} when scope is none', () => {
      const definition = createValidDefinition();
      definition.scope = 'none';
      definition.template = 'basic action without target';

      const result = validator.validate(definition);
      const templateErrors = result.errors.filter((error) =>
        error.includes('{target} placeholder')
      );
      expect(templateErrors).toHaveLength(0);
    });

    it('should handle definition with missing scope but present template', () => {
      const definition = createValidDefinition();
      delete definition.scope;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action scope is required');
    });

    it('should handle definition with null scope', () => {
      const definition = createValidDefinition();
      definition.scope = null;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action scope is required');
    });

    it('should handle definition with null template', () => {
      const definition = createValidDefinition();
      definition.template = null;

      const result = validator.validate(definition);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action template is required');
    });
  });

  describe('validation result structure', () => {
    it('should return correct structure for valid definition', () => {
      const definition = createValidDefinition();
      const result = validator.validate(definition);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return correct structure for invalid definition', () => {
      const definition = {};
      const result = validator.validate(definition);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // All errors should be strings
      result.errors.forEach((error) => {
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(0);
      });
    });
  });
});
