/**
 * @file Tests for corePromptText.json schema validation and backward compatibility
 * Validates that the prompt text file conforms to its schema and that
 * all non-modified fields remain unchanged after inner_state_integration enhancement.
 *
 * Note: Many backward compatibility tests also exist in:
 * - tests/unit/prompting/corePromptText.innerStateIntegration.test.js (content verification)
 * - tests/integration/prompting/innerStateIntegrationPrompt.integration.test.js (prompt assembly)
 * - tests/e2e/prompting/innerStateIntegrationE2E.test.js (full pipeline)
 *
 * This file provides supplementary validation for schema compliance and field integrity.
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
      expect(promptTextData).toHaveProperty('moodUpdateOnlyInstructionText');
      expect(promptTextData).toHaveProperty('moodUpdateTaskDefinitionText');
      expect(promptTextData).toHaveProperty(
        'moodUpdatePortrayalGuidelinesTemplate'
      );
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
      expect(typeof promptTextData.moodUpdateOnlyInstructionText).toBe(
        'string'
      );
      expect(typeof promptTextData.moodUpdateTaskDefinitionText).toBe('string');
      expect(typeof promptTextData.moodUpdatePortrayalGuidelinesTemplate).toBe(
        'string'
      );
    });
  });

  describe('Unchanged Fields Verification', () => {
    it('should have actionTagRulesContent unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.actionTagRulesContent).toContain('<output_format>');
      expect(promptTextData.actionTagRulesContent).toContain(
        'ACTION TAGS (CRITICAL)'
      );
      expect(promptTextData.actionTagRulesContent).toContain(
        'DIALOGUE FORMATTING'
      );
    });

    it('should have coreTaskDescriptionText unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.coreTaskDescriptionText).toContain(
        'Your sole focus is to BE the character'
      );
      expect(promptTextData.coreTaskDescriptionText).toContain(
        'Decide on one action'
      );
    });

    it('should have moodUpdateTaskDefinitionText unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.moodUpdateTaskDefinitionText).toContain(
        '[CHARACTER_NAME]'
      );
      expect(promptTextData.moodUpdateTaskDefinitionText).toContain(
        'Update mood axes and sexual state values'
      );
    });

    it('should have characterPortrayalGuidelinesTemplate unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.characterPortrayalGuidelinesTemplate).toContain(
        'BEING {{name}}:'
      );
      expect(promptTextData.characterPortrayalGuidelinesTemplate).toContain(
        'Full Embodiment'
      );
      expect(promptTextData.characterPortrayalGuidelinesTemplate).toContain(
        'Inner Voice'
      );
    });

    it('should have moodUpdatePortrayalGuidelinesTemplate unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.moodUpdatePortrayalGuidelinesTemplate).toContain(
        'BEING {{name}}:'
      );
      // Intentionally omits Speech Style (different from characterPortrayalGuidelinesTemplate)
      expect(
        promptTextData.moodUpdatePortrayalGuidelinesTemplate
      ).not.toContain('Speech Style');
    });

    it('should have nc21ContentPolicyText unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(promptTextData.nc21ContentPolicyText).toContain(
        'CONTENT GUIDELINES'
      );
      expect(promptTextData.nc21ContentPolicyText).toContain('RATING: NC-21');
      expect(promptTextData.nc21ContentPolicyText).toContain('NO RESTRICTIONS');
    });

    it('should NOT have inner_state_integration in moodUpdateOnlyInstructionText', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      // Mood update prompt should NOT include inner_state_integration
      // (it uses moodUpdateOnlyInstructionText, not finalLlmInstructionText)
      expect(promptTextData.moodUpdateOnlyInstructionText).not.toContain(
        '<inner_state_integration>'
      );
      expect(promptTextData.moodUpdateOnlyInstructionText).not.toContain(
        'INNER STATE INTEGRATION'
      );
    });
  });

  describe('Inner State Integration Schema Compliance', () => {
    it('should have finalLlmInstructionText as substantial content', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);

      expect(typeof promptTextData.finalLlmInstructionText).toBe('string');
      expect(promptTextData.finalLlmInstructionText.length).toBeGreaterThan(
        1000
      );
    });

    it('should not have malformed JSON escaping', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      // Check for common malformed escape sequences
      expect(text).not.toContain('\\\\n'); // Double-escaped newlines
      expect(text).not.toContain('\\"\\n'); // Weird quote-newline combos
    });

    it('should have exactly one inner_state_integration open/close tag pair', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      const openCount = (text.match(/<inner_state_integration>/g) || []).length;
      const closeCount = (text.match(/<\/inner_state_integration>/g) || [])
        .length;

      expect(openCount).toBe(1);
      expect(closeCount).toBe(1);
    });

    it('should preserve em dash character correctly', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      // The em dash in "HARD CONSTRAINT — NOT FLAVOR" should be preserved
      expect(text).toContain('—'); // Em dash character
      expect(text).toContain('HARD CONSTRAINT — NOT FLAVOR');
    });
  });

  describe('Additional Adjacent Sections Unchanged in finalLlmInstructionText', () => {
    it('should maintain PRIORITY GUIDELINES section unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      expect(text).toContain('PRIORITY GUIDELINES:');
      expect(text).toContain(
        'HIGH: Character secrets, survival plans, critical deadlines'
      );
      expect(text).toContain('MEDIUM: Behavioral patterns, theories, relationships');
      expect(text).toContain('LOW: Routine events, common knowledge');
    });

    it('should maintain VALID/INVALID PATTERNS examples unchanged', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      expect(text).toContain('VALID PATTERNS:');
      expect(text).toContain(
        "[GOOD] thoughts: \"This fool has no idea I'm lying"
      );
      expect(text).toContain('INVALID PATTERNS (NEVER DO THIS):');
      expect(text).toContain("[BAD] thoughts: \"I don't trust him at all\"");
    });

    it('should have final instruction ending with expected content', async () => {
      const promptTextContent = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const promptTextData = JSON.parse(promptTextContent);
      const text = promptTextData.finalLlmInstructionText;

      expect(text).toContain(
        "Now, based on all the information provided, decide on your character's action"
      );
      expect(text).toContain(
        'only visible actions go inside asterisks - never internal thoughts'
      );
      expect(text).toContain('Fully BE the character.');
    });
  });
});
