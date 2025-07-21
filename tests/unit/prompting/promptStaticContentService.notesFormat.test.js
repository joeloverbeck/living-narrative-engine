/**
 * @file Tests for PromptStaticContentService notes format enhancement
 * @description Tests the complete notes format with subjectType introduced in LLM prompt enhancement spec
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { PromptStaticContentService } from '../../../src/prompting/promptStaticContentService.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Updated prompt data with enhanced notes format
const enhancedPromptData = {
  coreTaskDescriptionText: 'Core text',
  characterPortrayalGuidelinesTemplate: 'Guidelines for {{name}}',
  nc21ContentPolicyText: 'Policy',
  finalLlmInstructionText: `NOTES RULES
- Only record brand-new, critical facts (locations, allies, threats, etc.) that may determine your survival, well-being, or prosperity.
- No internal musings, only hard data.
- Each note MUST identify its subject (who/what the note is about)
- Each note MUST include a subjectType from: character, location, item, creature, event, concept, relationship, organization, quest, skill, emotion, other
- Include context when relevant (where/when observed)
- Use tags for categorization (e.g., "combat", "relationship", "location")
- Example format:
  {
    "text": "Seems nervous about the council meeting",
    "subject": "John",
    "subjectType": "character",
    "context": "tavern conversation",
    "tags": ["emotion", "politics"]
  }
- Another example:
  {
    "text": "Guards doubled at the north gate",
    "subject": "City defenses",
    "subjectType": "location",
    "context": "morning patrol",
    "tags": ["security", "observation"]
  }
- Subject type example:
  {
    "text": "Discovered new spell for healing wounds",
    "subject": "Healing Magic",
    "subjectType": "skill",
    "context": "library research",
    "tags": ["magic", "learning"]
  }

Now, based on all the information provided, decide on your character's action and what they will say. Remember: *only visible actions go inside asterisks – never internal thoughts.* Fully BE the character.`,
};

describe('PromptStaticContentService - Enhanced Notes Format', () => {
  let service;
  let mockLoader;

  beforeEach(async () => {
    mockLogger.debug.mockClear();
    mockLoader = {
      loadPromptText: jest.fn().mockResolvedValue(enhancedPromptData),
    };
    service = new PromptStaticContentService({
      logger: mockLogger,
      promptTextLoader: mockLoader,
    });
    await service.initialize();
  });

  describe('getFinalLlmInstructionText - Notes Format Enhancement', () => {
    test('should include subjectType requirement in notes rules', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      expect(finalInstructions).toContain(
        'Each note MUST include a subjectType from: character, location, item, creature, event, concept, relationship, organization, quest, skill, emotion, other'
      );
    });

    test('should include complete list of valid subjectType values', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      const expectedSubjectTypes = [
        'character',
        'location',
        'item',
        'creature',
        'event',
        'concept',
        'relationship',
        'organization',
        'quest',
        'skill',
        'emotion',
        'other',
      ];

      expectedSubjectTypes.forEach((subjectType) => {
        expect(finalInstructions).toContain(subjectType);
      });
    });

    test('should include character example with subjectType', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      expect(finalInstructions).toContain('"subject": "John"');
      expect(finalInstructions).toContain('"subjectType": "character"');
      expect(finalInstructions).toContain('"context": "tavern conversation"');
      expect(finalInstructions).toContain('"tags": ["emotion", "politics"]');
    });

    test('should include location example with subjectType', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      expect(finalInstructions).toContain('"subject": "City defenses"');
      expect(finalInstructions).toContain('"subjectType": "location"');
      expect(finalInstructions).toContain('"context": "morning patrol"');
      expect(finalInstructions).toContain(
        '"tags": ["security", "observation"]'
      );
    });

    test('should include skill example with subjectType', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      expect(finalInstructions).toContain('"subject": "Healing Magic"');
      expect(finalInstructions).toContain('"subjectType": "skill"');
      expect(finalInstructions).toContain('"context": "library research"');
      expect(finalInstructions).toContain('"tags": ["magic", "learning"]');
    });

    test('should include all three example types for comprehensive guidance', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // Verify three distinct examples are present
      const exampleMatches = finalInstructions.match(/"text":/g);
      expect(exampleMatches).toHaveLength(3);

      // Verify different subjectTypes are shown
      expect(finalInstructions).toContain('"subjectType": "character"');
      expect(finalInstructions).toContain('"subjectType": "location"');
      expect(finalInstructions).toContain('"subjectType": "skill"');
    });

    test('should maintain backward compatibility with existing required fields', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // Should still require subject field
      expect(finalInstructions).toContain(
        'Each note MUST identify its subject (who/what the note is about)'
      );

      // Should still mention context and tags
      expect(finalInstructions).toContain(
        'Include context when relevant (where/when observed)'
      );
      expect(finalInstructions).toContain(
        'Use tags for categorization (e.g., "combat", "relationship", "location")'
      );
    });

    test('should preserve action tag rules at the end', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      expect(finalInstructions).toContain(
        'Remember: *only visible actions go inside asterisks – never internal thoughts.* Fully BE the character.'
      );
    });

    test('should provide clear guidance for LLM to generate schema-compliant notes', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // Should clearly indicate that subjectType is required
      expect(finalInstructions).toContain('MUST include a subjectType');

      // Should provide comprehensive examples showing proper format
      expect(finalInstructions).toMatch(
        /\{\s*"text":\s*"[^"]+",\s*"subject":\s*"[^"]+",\s*"subjectType":\s*"[^"]+"/
      );
    });

    test('should align with notes component schema requirements', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // The enhanced format should match the notes.component.json schema
      // which requires text, subject, and subjectType fields
      expect(finalInstructions).toContain('"text":');
      expect(finalInstructions).toContain('"subject":');
      expect(finalInstructions).toContain('"subjectType":');
      expect(finalInstructions).toContain('"context":');
      expect(finalInstructions).toContain('"tags":');
    });
  });

  describe('Notes Format Structure Validation', () => {
    test('should maintain JSON structure in examples', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // Extract example JSON blocks and validate they're properly formatted
      const jsonMatches = finalInstructions.match(/\{\s*"text":[^}]+\}/g);

      expect(jsonMatches).toBeTruthy();
      expect(jsonMatches.length).toBeGreaterThanOrEqual(3);

      // Each example should be valid JSON-like structure
      jsonMatches.forEach((jsonExample) => {
        expect(jsonExample).toContain('"text":');
        expect(jsonExample).toContain('"subject":');
        expect(jsonExample).toContain('"subjectType":');
      });
    });

    test('should show variety in subjectType usage across examples', () => {
      const finalInstructions = service.getFinalLlmInstructionText();

      // Should demonstrate different categories to help LLM understand variety
      const subjectTypeMatches = finalInstructions.match(
        /"subjectType":\s*"([^"]+)"/g
      );

      expect(subjectTypeMatches).toBeTruthy();
      expect(subjectTypeMatches.length).toBeGreaterThanOrEqual(3);

      // Extract the actual values
      const subjectTypes = subjectTypeMatches.map(
        (match) => match.match(/"subjectType":\s*"([^"]+)"/)[1]
      );

      // Should have variety (at least 2 different types)
      const uniqueTypes = new Set(subjectTypes);
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
    });
  });
});
