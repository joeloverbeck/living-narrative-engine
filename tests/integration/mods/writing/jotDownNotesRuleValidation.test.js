/**
 * @file jotDownNotesRuleValidation.test.js
 * @description Integration test to reproduce validation issues with jot_down_notes rule
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs/promises';
import createTestAjv from '../../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { createTestBed } from '../../../common/testBed.js';
import { formatAjvErrorsEnhanced } from '../../../../src/utils/ajvAnyOfErrorFormatter.js';

describe('jot_down_notes Rule Validation', () => {
  let ajv;
  let validator;
  let ruleData;
  let testBed;

  beforeAll(async () => {
    // Use the test AJV instance that has all schemas pre-loaded
    ajv = createTestAjv();
    testBed = createTestBed();

    // Create validator
    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });

    // Load the actual rule file
    const rulePath = './data/mods/writing/rules/handle_jot_down_notes.rule.json';
    const ruleContent = await fs.readFile(rulePath, 'utf-8');
    ruleData = JSON.parse(ruleContent);
  });

  it('should validate the jot_down_notes rule without errors', () => {
    const result = validator.validate(
      'schema://living-narrative-engine/rule.schema.json',
      ruleData
    );

    if (!result.isValid) {
      console.log('\n=== RULE VALIDATION FAILED ===');
      console.log('Number of errors:', result.errors?.length || 0);
      console.log('\nFormatted error message:');
      console.log(result.message);
      console.log('\nRaw errors:', JSON.stringify(result.errors, null, 2));
      console.log('\nRule data:', JSON.stringify(ruleData, null, 2));
      console.log('=== END VALIDATION FAILURE ===\n');
    }

    expect(result.isValid).toBe(true);
  });

  it('should validate each action in the rule individually', () => {
    const actionSchemaId =
      'schema://living-narrative-engine/operation.schema.json';

    ruleData.actions.forEach((action, index) => {
      const result = validator.validate(actionSchemaId, action);

      if (!result.isValid) {
        console.log(`\nAction ${index} (${action.type}) validation failed:`);
        console.log('Formatted message:', result.message);
        console.log('Raw errors:', JSON.stringify(result.errors, null, 2));
        console.log('Action data:', JSON.stringify(action, null, 2));

        // Use the enhanced formatter to get a better error message
        const enhancedMessage = formatAjvErrorsEnhanced(result.errors, action);
        console.log('\nEnhanced error message:');
        console.log(enhancedMessage);
      }

      expect(result.isValid).toBe(true);
    });
  });

  it('should have all required fields in each action', () => {
    ruleData.actions.forEach((action) => {
      expect(action).toHaveProperty('type');
      expect(action).toHaveProperty('parameters');
      expect(typeof action.type).toBe('string');
      expect(typeof action.parameters).toBe('object');
    });
  });
});
