// tests/integration/ai/notesServiceTagRemoval.test.js

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import fs from 'fs';
import path from 'path';

describe('NotesService Tag Removal Integration Tests', () => {
  let notesService;
  let validator;
  let notesSchema;

  beforeEach(async () => {
    notesService = new NotesService();

    // Create a minimal logger for the validator
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    validator = new AjvSchemaValidator({ logger });

    // Load the notes component schema
    const schemaPath = path.join(
      process.cwd(),
      'data/mods/core/components/notes.component.json'
    );
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    notesSchema = JSON.parse(schemaContent);

    // Add the schema for validation
    await validator.addSchema(notesSchema.dataSchema, 'core:notes');
  });

  afterEach(() => {
    // Clean up
  });

  test('should create notes that validate against the schema without tags field', () => {
    const component = { notes: [] };
    const newNotes = [
      {
        text: 'Integration test note',
        subject: 'Test Subject',
        subjectType: 'entity',
        context: 'Test context',
      },
    ];

    const result = notesService.addNotes(component, newNotes);

    // Verify the note was added
    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);

    // Validate the entire component against the schema
    const validationResult = validator.validate('core:notes', result.component);
    expect(validationResult.isValid).toBe(true);

    // Verify no tags field exists
    expect(result.component.notes[0].tags).toBeUndefined();
  });

  test('should create valid notes even when tags are provided in input', () => {
    const component = { notes: [] };
    const newNotes = [
      {
        text: 'Note with tags in input',
        subject: 'Tagged Subject',
        subjectType: 'entity',
        context: 'Integration test',
        tags: ['should', 'be', 'ignored'], // These should be ignored
      },
    ];

    const result = notesService.addNotes(component, newNotes);

    // Verify the note was added
    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);

    // Validate against schema - should pass because tags are not included
    const validationResult = validator.validate('core:notes', result.component);
    expect(validationResult.isValid).toBe(true);

    // Verify tags were not added
    expect(result.component.notes[0].tags).toBeUndefined();

    // Verify all expected fields are present
    expect(result.component.notes[0].text).toBe('Note with tags in input');
    expect(result.component.notes[0].subject).toBe('Tagged Subject');
    expect(result.component.notes[0].subjectType).toBe('entity');
    expect(result.component.notes[0].context).toBe('Integration test');
    expect(result.component.notes[0].timestamp).toBeDefined();
  });

  test('should handle multiple notes with mixed tag presence correctly', () => {
    const component = { notes: [] };
    const newNotes = [
      {
        text: 'First note',
        subject: 'Subject 1',
        subjectType: 'entity',
        tags: ['tag1'],
      },
      {
        text: 'Second note',
        subject: 'Subject 2',
        subjectType: 'event',
        // No tags field
      },
      {
        text: 'Third note',
        subject: 'Subject 3',
        subjectType: 'entity',
        tags: [],
      },
    ];

    const result = notesService.addNotes(component, newNotes);

    // Verify all notes were added
    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(3);

    // Validate the entire component against the schema
    const validationResult = validator.validate('core:notes', result.component);
    expect(validationResult.isValid).toBe(true);

    // Verify no notes have tags
    result.component.notes.forEach((note) => {
      expect(note.tags).toBeUndefined();
      expect(note.text).toBeDefined();
      expect(note.subject).toBeDefined();
      expect(note.subjectType).toBeDefined();
      expect(note.timestamp).toBeDefined();
    });
  });

  test('should maintain schema compliance with all valid subjectTypes', () => {
    const component = { notes: [] };
    const validSubjectTypes = [
      'entity',
      'event',
      'plan',
      'knowledge',
      'state',
      'other',
    ];

    const newNotes = validSubjectTypes.map((type, index) => ({
      text: `Note for ${type}`,
      subject: `Subject ${index}`,
      subjectType: type,
      tags: ['should-be-ignored'], // Tags should be ignored
    }));

    const result = notesService.addNotes(component, newNotes);

    // Verify all notes were added
    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(validSubjectTypes.length);

    // Validate against schema
    const validationResult = validator.validate('core:notes', result.component);
    expect(validationResult.isValid).toBe(true);

    // Verify none have tags
    result.component.notes.forEach((note, index) => {
      expect(note.tags).toBeUndefined();
      expect(note.subjectType).toBe(validSubjectTypes[index]);
    });
  });

  test('should fail schema validation if tags were to be added (hypothetical)', () => {
    // This test verifies that the schema correctly rejects tags
    const componentWithTags = {
      notes: [
        {
          text: 'Test note',
          subject: 'Test',
          subjectType: 'other',
          timestamp: new Date().toISOString(),
          tags: ['tag1', 'tag2'], // This should fail validation
        },
      ],
    };

    // Validate against schema - should fail due to additionalProperties: false
    const validationResult = validator.validate(
      'core:notes',
      componentWithTags
    );
    expect(validationResult.isValid).toBe(false);

    // Check validation errors
    expect(validationResult.errors).toBeDefined();
    expect(validationResult.errors.length).toBeGreaterThan(0);
    expect(
      validationResult.errors.some((error) =>
        error.message.includes('additional properties')
      )
    ).toBe(true);
  });
});
