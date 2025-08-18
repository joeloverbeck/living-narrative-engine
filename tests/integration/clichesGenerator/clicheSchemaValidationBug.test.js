/**
 * @file Integration test to reproduce cliches generation schema validation bug
 * Tests demonstrate the mismatch between ClicheGenerator output and schema expectations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';

describe('Clichés Schema Validation Bug', () => {
  let ajv;
  let clicheSchema;

  beforeEach(() => {
    // Initialize AJV validator
    ajv = new Ajv({ allErrors: true, strict: false });

    // Load the cliche schema
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/cliche.schema.json'
    );
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    clicheSchema = JSON.parse(schemaContent);
  });

  describe('llmMetadata field mismatch', () => {
    it('should fail validation with ClicheGenerator field names', () => {
      // This reproduces the exact error from the logs
      const clicheData = {
        directionId: 'test-direction-id',
        conceptId: 'test-concept-id',
        categories: {
          names: ['Generic Warrior'],
          physicalDescriptions: ['Perfect physique'],
          personalityTraits: ['Stoic'],
          skillsAbilities: ['Best fighter'],
          typicalLikes: ['Training'],
          typicalDislikes: ['Weakness'],
          commonFears: ['Vulnerability'],
          genericGoals: ['Be strongest'],
          backgroundElements: ['Tragic past'],
          overusedSecrets: ['Hidden soft side'],
          speechPatterns: ['Few words'],
        },
        tropesAndStereotypes: ['The invincible warrior'],
        llmMetadata: {
          // These are the field names ClicheGenerator produces
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 1365,
          responseTokens: 1508,
          processingTime: 48241,
          promptVersion: '1.0.0',
          enhanced: false,
          qualityMetrics: null,
          validationWarnings: [],
          recommendations: [],
        },
      };

      const validate = ajv.compile(clicheSchema);
      const isValid = validate(clicheData);

      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Check specific errors
      const additionalPropErrors = validate.errors.filter(
        (e) =>
          e.keyword === 'additionalProperties' &&
          e.instancePath === '/llmMetadata'
      );

      expect(additionalPropErrors.length).toBeGreaterThan(0);

      // Verify the specific fields causing issues
      const problematicFields = additionalPropErrors.map(
        (e) => e.params.additionalProperty
      );
      expect(problematicFields).toContain('modelId');
      expect(problematicFields).toContain('promptTokens');
      expect(problematicFields).toContain('responseTokens');
      expect(problematicFields).toContain('processingTime');
    });

    it('should pass validation with correct schema field names', () => {
      const clicheData = {
        directionId: 'test-direction-id',
        conceptId: 'test-concept-id',
        categories: {
          names: ['Generic Warrior'],
          physicalDescriptions: ['Perfect physique'],
          personalityTraits: ['Stoic'],
          skillsAbilities: ['Best fighter'],
          typicalLikes: ['Training'],
          typicalDislikes: ['Weakness'],
          commonFears: ['Vulnerability'],
          genericGoals: ['Be strongest'],
          backgroundElements: ['Tragic past'],
          overusedSecrets: ['Hidden soft side'],
          speechPatterns: ['Few words'],
        },
        tropesAndStereotypes: ['The invincible warrior'],
        llmMetadata: {
          // Correct field names per schema
          model: 'openrouter-claude-sonnet-4',
          tokens: 2873, // Total tokens
          responseTime: 48241,
          promptVersion: '1.0.0',
          temperature: 0.7,
        },
      };

      const validate = ajv.compile(clicheSchema);
      const isValid = validate(clicheData);

      if (!isValid) {
        console.log(
          'Validation errors:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(isValid).toBe(true);
    });

    it('should demonstrate the field mapping needed', () => {
      // This shows how to transform ClicheGenerator output to schema-compliant format
      const generatorOutput = {
        modelId: 'openrouter-claude-sonnet-4',
        promptTokens: 1365,
        responseTokens: 1508,
        processingTime: 48241,
        promptVersion: '1.0.0',
      };

      const schemaCompliant = {
        model: generatorOutput.modelId,
        tokens: generatorOutput.promptTokens + generatorOutput.responseTokens,
        responseTime: generatorOutput.processingTime,
        promptVersion: generatorOutput.promptVersion,
      };

      // Verify the mapped object would pass schema validation
      const testData = {
        directionId: 'test',
        conceptId: 'test',
        categories: {
          names: ['Test'],
          physicalDescriptions: ['Test'],
          personalityTraits: ['Test'],
          skillsAbilities: ['Test'],
          typicalLikes: ['Test'],
          typicalDislikes: ['Test'],
          commonFears: ['Test'],
          genericGoals: ['Test'],
          backgroundElements: ['Test'],
          overusedSecrets: ['Test'],
          speechPatterns: ['Test'],
        },
        tropesAndStereotypes: ['Test'],
        llmMetadata: schemaCompliant,
      };

      const validate = ajv.compile(clicheSchema);
      const isValid = validate(testData);

      expect(isValid).toBe(true);
    });
  });
});
