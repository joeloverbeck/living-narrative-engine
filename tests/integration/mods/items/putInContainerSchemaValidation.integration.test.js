/**
 * @file Integration test for put_in_container schema validation
 * Verifies that the container system files have correct structure
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Put In Container Schema Validation', () => {
  describe('Condition File Structure', () => {
    it('should have logic property instead of condition', () => {
      const conditionPath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'conditions',
        'event-is-action-put-in-container.condition.json'
      );
      const conditionData = JSON.parse(readFileSync(conditionPath, 'utf8'));

      // The condition file must use "logic" not "condition"
      expect(conditionData).toHaveProperty('logic');
      expect(conditionData).not.toHaveProperty('condition');
    });

    it('should have correct logic structure', () => {
      const conditionPath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'conditions',
        'event-is-action-put-in-container.condition.json'
      );
      const conditionData = JSON.parse(readFileSync(conditionPath, 'utf8'));

      expect(conditionData.logic).toHaveProperty('==');
      expect(Array.isArray(conditionData.logic['=='])).toBe(true);
      expect(conditionData.logic['=='][1]).toBe('containers:put_in_container');
    });

    it('should have required schema fields', () => {
      const conditionPath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'conditions',
        'event-is-action-put-in-container.condition.json'
      );
      const conditionData = JSON.parse(readFileSync(conditionPath, 'utf8'));

      expect(conditionData).toHaveProperty('id');
      expect(conditionData).toHaveProperty('description');
      expect(conditionData.id).toBe('containers:event-is-action-put-in-container');
    });
  });

  describe('Rule File Structure', () => {
    it('should have PUT_IN_CONTAINER operation with type field', () => {
      const rulePath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'rules',
        'handle_put_in_container.rule.json'
      );
      const ruleData = JSON.parse(readFileSync(rulePath, 'utf8'));

      // Find PUT_IN_CONTAINER operation in the IF else_actions
      const ifOperation = ruleData.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifOperation).toBeDefined();

      const putInContainerOp = ifOperation.parameters.else_actions.find(
        (action) => action.type === 'PUT_IN_CONTAINER'
      );
      expect(putInContainerOp).toBeDefined();
      expect(putInContainerOp).toHaveProperty('type');
      expect(putInContainerOp.type).toBe('PUT_IN_CONTAINER');
      expect(putInContainerOp.parameters).toHaveProperty('actorEntity');
      expect(putInContainerOp.parameters).toHaveProperty('containerEntity');
      expect(putInContainerOp.parameters).toHaveProperty('itemEntity');
    });

    it('should have VALIDATE_CONTAINER_CAPACITY operation with type field', () => {
      const rulePath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'rules',
        'handle_put_in_container.rule.json'
      );
      const ruleData = JSON.parse(readFileSync(rulePath, 'utf8'));

      const validateOp = ruleData.actions.find(
        (action) => action.type === 'VALIDATE_CONTAINER_CAPACITY'
      );
      expect(validateOp).toBeDefined();
      expect(validateOp).toHaveProperty('type');
      expect(validateOp.type).toBe('VALIDATE_CONTAINER_CAPACITY');
      expect(validateOp.parameters).toHaveProperty('containerEntity');
      expect(validateOp.parameters).toHaveProperty('itemEntity');
      expect(validateOp.parameters).toHaveProperty('result_variable');
    });

    it('should have all operations with type field', () => {
      const rulePath = join(
        process.cwd(),
        'data',
        'mods',
        'containers',
        'rules',
        'handle_put_in_container.rule.json'
      );
      const ruleData = JSON.parse(readFileSync(rulePath, 'utf8'));

      // Check all top-level actions have type or macro field
      const validateOperation = (op, path = 'root') => {
        if (op.macro) {
          // Macro reference is valid
          return true;
        }

        if (!op.type) {
          throw new Error(
            `Operation at ${path} missing type field: ${JSON.stringify(op, null, 2)}`
          );
        }

        // Recursively check nested operations
        if (op.parameters) {
          if (op.parameters.then_actions) {
            op.parameters.then_actions.forEach((nestedOp, index) => {
              validateOperation(nestedOp, `${path}.then_actions[${index}]`);
            });
          }
          if (op.parameters.else_actions) {
            op.parameters.else_actions.forEach((nestedOp, index) => {
              validateOperation(nestedOp, `${path}.else_actions[${index}]`);
            });
          }
        }
        return true;
      };

      ruleData.actions.forEach((action, index) => {
        expect(() =>
          validateOperation(action, `actions[${index}]`)
        ).not.toThrow();
      });
    });
  });

  describe('Operation Schema Registration', () => {
    it('should have PUT_IN_CONTAINER registered in operation schema', () => {
      const operationSchemaPath = join(
        process.cwd(),
        'data',
        'schemas',
        'operation.schema.json'
      );
      const operationSchema = JSON.parse(
        readFileSync(operationSchemaPath, 'utf8')
      );

      const putInContainerRef = operationSchema.$defs.Operation.anyOf.find(
        (op) => op.$ref === './operations/putInContainer.schema.json'
      );
      expect(putInContainerRef).toBeDefined();
    });

    it('should have VALIDATE_CONTAINER_CAPACITY registered in operation schema', () => {
      const operationSchemaPath = join(
        process.cwd(),
        'data',
        'schemas',
        'operation.schema.json'
      );
      const operationSchema = JSON.parse(
        readFileSync(operationSchemaPath, 'utf8')
      );

      const validateRef = operationSchema.$defs.Operation.anyOf.find(
        (op) => op.$ref === './operations/validateContainerCapacity.schema.json'
      );
      expect(validateRef).toBeDefined();
    });
  });

  describe('Schema File Consistency', () => {
    it('should have matching schema files for all registered operations', () => {
      const operationSchemaPath = join(
        process.cwd(),
        'data',
        'schemas',
        'operation.schema.json'
      );
      const operationSchema = JSON.parse(
        readFileSync(operationSchemaPath, 'utf8')
      );

      const operationsPath = join(
        process.cwd(),
        'data',
        'schemas',
        'operations'
      );
      const { readdirSync, existsSync } = require('fs');

      // Get all registered operation references
      const registeredRefs = operationSchema.$defs.Operation.anyOf
        .map((op) => op.$ref)
        .filter((ref) => ref && ref.startsWith('./operations/'));

      // Check each registered ref has a corresponding file
      registeredRefs.forEach((ref) => {
        const filename = ref.replace('./operations/', '');
        const fullPath = join(operationsPath, filename);
        expect(existsSync(fullPath)).toBe(true);
      });

      // Get all operation schema files
      const operationFiles = readdirSync(operationsPath)
        .filter((file) => file.endsWith('.schema.json'))
        .filter((file) => !file.includes('base-') && !file.includes('nested-'));

      const registeredFiles = registeredRefs.map((ref) =>
        ref.replace('./operations/', '')
      );

      // Check that all operation schema files are registered
      operationFiles.forEach((file) => {
        expect(registeredFiles).toContain(file);
      });
    });
  });
});
