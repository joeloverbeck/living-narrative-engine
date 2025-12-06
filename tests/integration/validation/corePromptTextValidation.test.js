/**
 * @file Tests for corePromptText.json schema validation
 * Validates that the prompt text file conforms to its schema
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { readFile } from 'fs/promises';

describe('Core Prompt Text Validation', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('corePromptText.json Schema Compliance', () => {
    it('should validate corePromptText.json against prompt-text schema', async () => {
      // Arrange
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      // Act & Assert
      expect(() => {
        schemaValidator.validateAgainstSchema(
          promptTextData,
          'schema://living-narrative-engine/prompt-text.schema.json'
        );
      }).not.toThrow();
    });

    it('should contain all required fields', async () => {
      // Arrange
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      // Assert required fields exist
      expect(promptTextData).toHaveProperty('coreTaskDescriptionText');
      expect(promptTextData).toHaveProperty(
        'characterPortrayalGuidelinesTemplate'
      );
      expect(promptTextData).toHaveProperty('nc21ContentPolicyText');
      expect(promptTextData).toHaveProperty('finalLlmInstructionText');
      expect(promptTextData).toHaveProperty('actionTagRulesContent');
    });

    it('should have string values for all fields', async () => {
      // Arrange
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      // Assert all values are strings
      expect(typeof promptTextData.coreTaskDescriptionText).toBe('string');
      expect(typeof promptTextData.characterPortrayalGuidelinesTemplate).toBe(
        'string'
      );
      expect(typeof promptTextData.nc21ContentPolicyText).toBe('string');
      expect(typeof promptTextData.finalLlmInstructionText).toBe('string');
      expect(typeof promptTextData.actionTagRulesContent).toBe('string');
    });
  });
});
