/**
 * @file Integration tests for enhanced LLM prompt with simplified note taxonomy
 * @description Validates the 6-type taxonomy system in LLM prompts
 * @version 2.0 - Updated for simplified taxonomy (LLMROLPROARCANA-002)
 * @see data/prompts/corePromptText.json
 * @see src/constants/subjectTypes.js
 * @see data/mods/core/components/notes.component.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import corePromptText from '../../../data/prompts/corePromptText.json';
import coreNotesComponent from '../../../data/mods/core/components/notes.component.json';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('Enhanced LLM Prompt Instructions Integration (Simplified Taxonomy)', () => {
  let ajv;
  let validateNote;

  beforeEach(() => {
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Create a validator for individual notes
    validateNote = ajv.compile({
      $id: 'test://note-validator',
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1 },
        subject: { type: 'string', minLength: 1 },
        subjectType: {
          type: 'string',
          enum: coreNotesComponent.dataSchema.properties.notes.items.properties
            .subjectType.enum,
        },
        context: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['text', 'subject', 'subjectType'],
    });
  });

  describe('Simplified Taxonomy Structure', () => {
    it('should contain all 6 simplified subject types', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      // Check for the 6 new types
      expect(promptText).toContain('entity');
      expect(promptText).toContain('event');
      expect(promptText).toContain('plan');
      expect(promptText).toContain('knowledge');
      expect(promptText).toContain('state');
      expect(promptText).toContain('other');
    });

    it('should have exactly 6 subject types in schema enum', () => {
      const enumValues =
        coreNotesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;
      expect(enumValues).toHaveLength(6);
      expect(enumValues).toEqual([
        'entity',
        'event',
        'plan',
        'knowledge',
        'state',
        'other',
      ]);
    });

    it('should include NOTE SUBJECT TYPES section', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('NOTE SUBJECT TYPES (Select ONE per note)');
    });

    it('should describe entity type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('1. entity - Describing who/what/where');
      expect(promptText).toContain('people, places, things, creatures, organizations');
    });

    it('should describe event type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('2. event - Describing past occurrences');
      expect(promptText).toContain('things that already happened');
    });

    it('should describe plan type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('3. plan - Describing future intentions');
      expect(promptText).toContain('what you intend to do (not yet executed)');
    });

    it('should describe knowledge type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('4. knowledge - Information, theories, observations');
      expect(promptText).toContain('what you know, noticed, or theorize');
    });

    it('should describe state type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('5. state - Mental/emotional/psychological conditions');
      expect(promptText).toContain('feelings or complex mental states');
    });

    it('should describe other type correctly', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('6. other - Anything not clearly fitting above');
      expect(promptText).toContain('Uncertain or abstract concepts');
    });
  });

  describe('Schema Validation', () => {
    it('should validate notes with all 6 subject types', () => {
      const testNotes = [
        {
          text: 'John is a merchant',
          subject: 'John',
          subjectType: 'entity',
        },
        {
          text: 'Battle occurred yesterday',
          subject: 'Battle',
          subjectType: 'event',
        },
        {
          text: 'Will investigate tomorrow',
          subject: 'Investigation Plan',
          subjectType: 'plan',
        },
        {
          text: 'Town guard changes at midnight',
          subject: 'Guard Schedule',
          subjectType: 'knowledge',
        },
        {
          text: 'Feeling increasingly anxious',
          subject: 'My Mental State',
          subjectType: 'state',
        },
        {
          text: 'Miscellaneous observation',
          subject: 'Random',
          subjectType: 'other',
        },
      ];

      testNotes.forEach((note) => {
        const result = validateNote(note);
        if (!result) {
          console.error('Validation failed for:', note);
          console.error('Errors:', validateNote.errors);
        }
        expect(result).toBe(true);
      });
    });

    it('should reject notes with old subject types', () => {
      const oldTypeNotes = [
        {
          text: 'Test',
          subject: 'Test',
          subjectType: 'character', // Old type
        },
        {
          text: 'Test',
          subject: 'Test',
          subjectType: 'location', // Old type
        },
        {
          text: 'Test',
          subject: 'Test',
          subjectType: 'emotion', // Old type
        },
      ];

      oldTypeNotes.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(false);
        expect(validateNote.errors[0].keyword).toBe('enum');
      });
    });
  });

  describe('Prompt Examples Validation', () => {
    it('should validate entity examples from prompt', () => {
      const entityExamples = [
        {
          text: 'Registrar Copperplate seems nervous',
          subject: 'Registrar Copperplate',
          subjectType: 'entity',
        },
        {
          text: 'The Crown and Quill tavern is crowded',
          subject: 'The Crown and Quill tavern',
          subjectType: 'entity',
        },
        {
          text: 'Found an enchanted lute',
          subject: 'enchanted lute',
          subjectType: 'entity',
        },
      ];

      entityExamples.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(true);
      });
    });

    it('should validate event examples from prompt', () => {
      const eventExamples = [
        {
          text: 'Bertram offered job posting',
          subject: 'Job Offer',
          subjectType: 'event',
        },
        {
          text: 'Fight broke out at bar',
          subject: 'Bar Fight',
          subjectType: 'event',
        },
      ];

      eventExamples.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(true);
      });
    });

    it('should validate plan examples from prompt', () => {
      const planExamples = [
        {
          text: 'Will investigate the sewers tomorrow',
          subject: 'Sewer Investigation',
          subjectType: 'plan',
        },
        {
          text: 'Planning to perform at festival',
          subject: 'Festival Performance',
          subjectType: 'plan',
        },
      ];

      planExamples.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(true);
      });
    });

    it('should validate knowledge examples from prompt', () => {
      const knowledgeExamples = [
        {
          text: 'Copperplate keeps secrets',
          subject: 'Copperplate Behavior',
          subjectType: 'knowledge',
        },
        {
          text: 'Town guard changes at midnight',
          subject: 'Guard Schedule',
          subjectType: 'knowledge',
        },
      ];

      knowledgeExamples.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(true);
      });
    });

    it('should validate state examples from prompt', () => {
      const stateExamples = [
        {
          text: 'Feeling increasingly feral',
          subject: 'My Mental State',
          subjectType: 'state',
        },
        {
          text: 'Conflicted about artistic integrity',
          subject: 'Internal Conflict',
          subjectType: 'state',
        },
      ];

      stateExamples.forEach((note) => {
        const result = validateNote(note);
        expect(result).toBe(true);
      });
    });
  });

  describe('Priority Guidelines', () => {
    it('should include PRIORITY GUIDELINES section', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      expect(promptText).toContain('PRIORITY GUIDELINES:');
      expect(promptText).toContain('HIGH: Character secrets, survival plans, critical deadlines');
      expect(promptText).toContain('MEDIUM: Behavioral patterns, theories, relationships');
      expect(promptText).toContain('LOW: Routine events, common knowledge');
    });
  });

  describe('Token Efficiency', () => {
    it('should be significantly shorter than old 19-type taxonomy', () => {
      const promptText = corePromptText.finalLlmInstructionText;
      const notesSection = promptText.substring(
        promptText.indexOf('NOTE SUBJECT TYPES'),
        promptText.indexOf('PRIORITY GUIDELINES')
      );

      // New taxonomy should be under 1100 characters (old was ~1200, achieving ~10% reduction)
      expect(notesSection.length).toBeLessThan(1100);
    });

    it('should enumerate all types in a single clear list', () => {
      const promptText = corePromptText.finalLlmInstructionText;

      // Should have exactly 6 numbered items (1-6)
      const numberedSection = promptText.substring(
        promptText.indexOf('1. entity'),
        promptText.indexOf('PRIORITY GUIDELINES')
      );
      const numberedItems = numberedSection.match(/^\d\.\s+\w+\s+-/gm) || [];
      expect(numberedItems.length).toBe(6);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain required note structure', () => {
      const noteSchema = coreNotesComponent.dataSchema.properties.notes.items;
      expect(noteSchema.required).toContain('text');
      expect(noteSchema.required).toContain('subject');
      expect(noteSchema.required).toContain('subjectType');
    });

    it('should have default subjectType of "other"', () => {
      const subjectTypeSchema =
        coreNotesComponent.dataSchema.properties.notes.items.properties.subjectType;
      expect(subjectTypeSchema.default).toBe('other');
    });

    it('should maintain optional context field', () => {
      const noteSchema = coreNotesComponent.dataSchema.properties.notes.items;
      expect(noteSchema.properties.context).toBeDefined();
      expect(noteSchema.properties.context.type).toBe('string');
    });
  });

  describe('Constants Integration', () => {
    it('should have matching constants in subjectTypes.js', () => {
      expect(SUBJECT_TYPES.ENTITY).toBe('entity');
      expect(SUBJECT_TYPES.EVENT).toBe('event');
      expect(SUBJECT_TYPES.PLAN).toBe('plan');
      expect(SUBJECT_TYPES.KNOWLEDGE).toBe('knowledge');
      expect(SUBJECT_TYPES.STATE).toBe('state');
      expect(SUBJECT_TYPES.OTHER).toBe('other');
    });

    it('should have all constants matching schema enum values', () => {
      const enumValues =
        coreNotesComponent.dataSchema.properties.notes.items.properties.subjectType.enum;
      const constantValues = Object.values(SUBJECT_TYPES);

      expect(constantValues.sort()).toEqual(enumValues.sort());
    });
  });
});
