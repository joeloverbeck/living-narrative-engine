import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import coreNotesComponent from '../../../data/mods/core/components/notes.component.json';

describe('SubjectType Enum Integration', () => {
  let ajv;
  let validateNote;

  beforeEach(() => {
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Register the notes component schema
    const coreNotesDataSchema = {
      ...coreNotesComponent.dataSchema,
      $id: 'core:notes',
      title: 'core:notes data',
    };

    ajv.addSchema(coreNotesDataSchema);

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

  it('should validate notes with new subject types through full pipeline', () => {
    const testNotes = [
      {
        text: 'Intend to walk into freezing woods on December 24',
        subject: 'December 24 plan',
        subjectType: 'plan',
        context: 'my decision',
        timestamp: '2025-01-04T12:00:00Z',
      },
      {
        text: 'Must survive 122 days until April 27, 1973',
        subject: 'survival timeline',
        subjectType: 'event',
        context: 'critical deadline',
        timestamp: '2025-01-04T12:01:00Z',
      },
      {
        text: 'My ontological framework may be fundamentally incomplete',
        subject: 'reality model uncertainty',
        subjectType: 'knowledge',
        context: 'witnessing impossible phenomena',
        timestamp: '2025-01-04T12:02:00Z',
      },
      {
        text: 'Uses term "miracle" casually when describing claimed abilities',
        subject: "Jon Ureña's language patterns",
        subjectType: 'knowledge',
        context: 'communication style analysis',
        timestamp: '2025-01-04T12:03:00Z',
      },
      {
        text: 'May have knowledge of December 24 plan without being told',
        subject: "Jon Ureña's knowledge",
        subjectType: 'knowledge',
        context: 'unexplained awareness',
        timestamp: '2025-01-04T12:04:00Z',
      },
      {
        text: 'Wrestling with existential dread about nature of reality',
        subject: 'my psychological state',
        subjectType: 'state',
        context: 'after witnessing time manipulation',
        timestamp: '2025-01-04T12:05:00Z',
      },
    ];

    // Test each note validates correctly
    testNotes.forEach((note) => {
      const result = validateNote(note);
      if (!result) {
        console.error('Validation failed for note:', note);
        console.error('Errors:', validateNote.errors);
      }
      expect(result).toBe(true);
    });
  });

  it('should validate all 6 subject types individually', () => {
    const allSubjectTypes = [
      'entity',
      'event',
      'plan',
      'knowledge',
      'state',
      'other',
    ];

    allSubjectTypes.forEach((subjectType) => {
      const note = {
        text: `Test note for ${subjectType}`,
        subject: `Test subject`,
        subjectType,
        context: 'test context',
        timestamp: '2025-01-04T12:00:00Z',
      };

      const result = validateNote(note);
      if (!result) {
        console.error(`Validation failed for subjectType: ${subjectType}`);
        console.error('Errors:', validateNote.errors);
      }
      expect(result).toBe(true);
    });
  });

  it('should reject invalid subject types', () => {
    const invalidNote = {
      text: 'Test note',
      subject: 'Test subject',
      subjectType: 'invalid_type',
      context: 'test context',
      timestamp: '2025-01-04T12:00:00Z',
    };

    const result = validateNote(invalidNote);
    expect(result).toBe(false);
    expect(validateNote.errors).toBeDefined();
    expect(validateNote.errors.length).toBeGreaterThan(0);
    expect(validateNote.errors[0].keyword).toBe('enum');
  });

  it('should validate notes component with mixed subject types', () => {
    const notesComponent = {
      notes: [
        {
          text: 'Character observation',
          subject: 'Jon Ureña',
          subjectType: 'entity',
        },
        {
          text: 'Future plan',
          subject: 'December 24 intention',
          subjectType: 'plan',
        },
        {
          text: 'Temporal constraint',
          subject: '122 days survival',
          subjectType: 'event',
        },
        {
          text: 'Theoretical framework',
          subject: 'Reality model',
          subjectType: 'knowledge',
        },
      ],
    };

    const validateComponent = ajv.compile({
      $ref: 'core:notes#',
    });

    const result = validateComponent(notesComponent);
    if (!result) {
      console.error('Component validation failed');
      console.error('Errors:', validateComponent.errors);
    }
    expect(result).toBe(true);
  });

  it('should validate new taxonomy types', () => {
    const newTaxonomyNotes = [
      {
        text: 'Character note',
        subject: 'Player',
        subjectType: 'entity',
      },
      {
        text: 'Location note',
        subject: 'Market Square',
        subjectType: 'entity',
      },
      {
        text: 'Event note',
        subject: 'Council Meeting',
        subjectType: 'event',
      },
      {
        text: 'Uncategorized note',
        subject: 'Something else',
        subjectType: 'other',
      },
    ];

    newTaxonomyNotes.forEach((note) => {
      const result = validateNote(note);
      if (!result) {
        console.error('New taxonomy note validation failed:', note);
        console.error('Errors:', validateNote.errors);
      }
      expect(result).toBe(true);
    });
  });
});
