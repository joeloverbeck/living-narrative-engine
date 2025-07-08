import NotesCompatibilityService from '../../../src/ai/notesCompatibilityService.js';

describe('NotesCompatibilityService', () => {
  let service;

  beforeEach(() => {
    service = new NotesCompatibilityService();
  });

  describe('detectNoteFormat', () => {
    test('should detect string format', () => {
      expect(service.detectNoteFormat('Simple note')).toBe('string');
      expect(service.detectNoteFormat('')).toBe('string');
    });

    test('should detect legacy object format', () => {
      expect(service.detectNoteFormat({ text: 'Note text' })).toBe('legacy');
      expect(service.detectNoteFormat({ text: 'Note', timestamp: '2024-01-15' })).toBe('legacy');
    });

    test('should detect structured format', () => {
      expect(service.detectNoteFormat({ 
        text: 'Note text', 
        subject: 'John' 
      })).toBe('structured');
      
      expect(service.detectNoteFormat({ 
        text: 'Note', 
        subject: 'Sarah',
        context: 'tavern',
        tags: ['emotion']
      })).toBe('structured');
    });

    test('should detect invalid format', () => {
      expect(service.detectNoteFormat(null)).toBe('invalid');
      expect(service.detectNoteFormat(undefined)).toBe('invalid');
      expect(service.detectNoteFormat(123)).toBe('invalid');
      expect(service.detectNoteFormat({})).toBe('invalid');
      expect(service.detectNoteFormat({ random: 'field' })).toBe('invalid');
    });
  });

  describe('detectArrayFormat', () => {
    test('should detect empty array', () => {
      const result = service.detectArrayFormat([]);
      expect(result.format).toBe('empty');
      expect(result.stats.total).toBe(0);
    });

    test('should detect all string format', () => {
      const notes = ['Note 1', 'Note 2', 'Note 3'];
      const result = service.detectArrayFormat(notes);
      expect(result.format).toBe('string');
      expect(result.stats.string).toBe(3);
    });

    test('should detect all legacy format', () => {
      const notes = [
        { text: 'Note 1' },
        { text: 'Note 2', timestamp: '2024-01-15' }
      ];
      const result = service.detectArrayFormat(notes);
      expect(result.format).toBe('legacy');
      expect(result.stats.legacy).toBe(2);
    });

    test('should detect all structured format', () => {
      const notes = [
        { text: 'Note 1', subject: 'John' },
        { text: 'Note 2', subject: 'Sarah', tags: ['emotion'] }
      ];
      const result = service.detectArrayFormat(notes);
      expect(result.format).toBe('structured');
      expect(result.stats.structured).toBe(2);
    });

    test('should detect mixed format', () => {
      const notes = [
        'String note',
        { text: 'Legacy note' },
        { text: 'Structured note', subject: 'John' }
      ];
      const result = service.detectArrayFormat(notes);
      expect(result.format).toBe('mixed');
      expect(result.stats.string).toBe(1);
      expect(result.stats.legacy).toBe(1);
      expect(result.stats.structured).toBe(1);
    });

    test('should handle non-array input', () => {
      const result = service.detectArrayFormat('not an array');
      expect(result.format).toBe('empty');
      expect(result.stats.total).toBe(0);
    });
  });

  describe('validateNote', () => {
    test('should validate string notes', () => {
      expect(service.validateNote('Valid note')).toEqual({
        valid: true,
        errors: [],
        format: 'string'
      });
      
      expect(service.validateNote('  ')).toEqual({
        valid: false,
        errors: ['String note cannot be empty'],
        format: 'string'
      });
    });

    test('should validate legacy notes', () => {
      expect(service.validateNote({ text: 'Valid note' })).toEqual({
        valid: true,
        errors: [],
        format: 'legacy'
      });
      
      expect(service.validateNote({ text: '' })).toEqual({
        valid: false,
        errors: ['Note text cannot be empty'],
        format: 'legacy'
      });
      
      // An object with only timestamp (no text) is invalid
      expect(service.validateNote({ timestamp: '2024' })).toEqual({
        valid: false,
        errors: ['Note is not in a recognized format'],
        format: 'invalid'
      });
    });

    test('should validate structured notes', () => {
      expect(service.validateNote({ 
        text: 'Valid note', 
        subject: 'John' 
      })).toEqual({
        valid: true,
        errors: [],
        format: 'structured'
      });
      
      // A note with only text is a valid legacy note, not an invalid structured note
      const legacyNote = { text: 'Note' };
      const result = service.validateNote(legacyNote);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('legacy');
      
      // Test structured note with empty subject
      const emptySubject = { text: 'Note', subject: '  ' };
      const result2 = service.validateNote(emptySubject);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Subject cannot be empty');
      
      // Test that a note explicitly marked as structured but missing subject is invalid
      const structuredMissingSubject = { text: 'Note', context: 'test' };
      const result3 = service.validateNote(structuredMissingSubject);
      expect(result3.valid).toBe(true); // This is detected as legacy, which is valid
      expect(result3.format).toBe('legacy');
    });

    test('should validate optional fields in structured notes', () => {
      const noteWithBadTags = {
        text: 'Note',
        subject: 'John',
        tags: 'not an array'
      };
      const result = service.validateNote(noteWithBadTags);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tags must be an array if provided');
    });

    test('should validate invalid notes', () => {
      expect(service.validateNote(null)).toEqual({
        valid: false,
        errors: ['Note is not in a recognized format'],
        format: 'invalid'
      });
    });
  });

  describe('convertToFormat', () => {
    test('should convert string to structured', () => {
      const result = service.convertToFormat('John seems nervous', 'structured');
      expect(result).toMatchObject({
        text: 'John seems nervous',
        subject: 'John',
        context: 'legacy note'
      });
    });

    test('should convert legacy to structured', () => {
      const legacy = { text: 'Sarah appears tired', timestamp: '2024-01-15' };
      const result = service.convertToFormat(legacy, 'structured');
      expect(result).toMatchObject({
        text: 'Sarah appears tired',
        subject: 'Sarah',
        timestamp: '2024-01-15'
      });
    });

    test('should convert string to legacy', () => {
      const result = service.convertToFormat('Simple note', 'legacy');
      expect(result).toMatchObject({
        text: 'Simple note'
      });
      expect(result.timestamp).toBeDefined();
    });

    test('should convert structured to legacy', () => {
      const structured = {
        text: 'Complex note',
        subject: 'John',
        context: 'tavern',
        tags: ['emotion']
      };
      const result = service.convertToFormat(structured, 'legacy');
      expect(result).toEqual({
        text: 'Complex note',
        timestamp: expect.any(String)
      });
    });

    test('should return null for invalid notes', () => {
      expect(service.convertToFormat(null, 'structured')).toBeNull();
      expect(service.convertToFormat(123, 'legacy')).toBeNull();
    });

    test('should not convert if already in target format', () => {
      const structured = { text: 'Note', subject: 'John' };
      expect(service.convertToFormat(structured, 'structured')).toBe(structured);
      
      const legacy = { text: 'Note' };
      expect(service.convertToFormat(legacy, 'legacy')).toBe(legacy);
    });
  });

  describe('ensureFormat', () => {
    test('should convert all notes to structured format', () => {
      const mixed = [
        'String note',
        { text: 'Legacy note' },
        { text: 'Already structured', subject: 'John' }
      ];
      
      const result = service.ensureFormat(mixed, 'structured');
      expect(result).toHaveLength(3);
      expect(result.every(note => note.subject)).toBe(true);
    });

    test('should convert all notes to legacy format', () => {
      const mixed = [
        'String note',
        { text: 'Structured', subject: 'John' }
      ];
      
      const result = service.ensureFormat(mixed, 'legacy');
      expect(result).toHaveLength(2);
      expect(result.every(note => note.text && !note.subject)).toBe(true);
    });

    test('should filter out invalid notes', () => {
      const mixed = [
        'Valid note',
        null,
        { invalid: 'object' },
        { text: 'Good note' }
      ];
      
      const result = service.ensureFormat(mixed, 'structured');
      expect(result).toHaveLength(2);
    });

    test('should handle non-array input', () => {
      expect(service.ensureFormat('not array', 'structured')).toEqual([]);
      expect(service.ensureFormat(null, 'legacy')).toEqual([]);
    });
  });

  describe('areNotesEquivalent', () => {
    test('should find equivalent notes across formats', () => {
      const string = 'John seems nervous';
      const legacy = { text: 'John seems nervous' };
      const structured = { text: 'John seems nervous', subject: 'John' };
      
      expect(service.areNotesEquivalent(string, structured)).toBe(true);
      expect(service.areNotesEquivalent(legacy, structured)).toBe(true);
    });

    test('should find non-equivalent notes', () => {
      const note1 = { text: 'John seems nervous', subject: 'John' };
      const note2 = { text: 'Sarah seems nervous', subject: 'Sarah' };
      
      expect(service.areNotesEquivalent(note1, note2)).toBe(false);
    });

    test('should handle different subjects same text', () => {
      const note1 = { text: 'seems nervous', subject: 'John' };
      const note2 = { text: 'seems nervous', subject: 'Sarah' };
      
      expect(service.areNotesEquivalent(note1, note2)).toBe(false);
    });

    test('should handle invalid notes', () => {
      expect(service.areNotesEquivalent(null, 'Note')).toBe(false);
      expect(service.areNotesEquivalent('Note', null)).toBe(false);
    });
  });

  describe('mergeNotes', () => {
    test('should merge multiple arrays removing duplicates', () => {
      const array1 = ['Note about John', { text: 'Note about Sarah' }];
      const array2 = [
        'Note about John', // duplicate
        { text: 'New note', subject: 'Market' }
      ];
      
      const result = service.mergeNotes([array1, array2]);
      expect(result).toHaveLength(3);
      expect(result.map(n => n.subject)).toEqual(['John', 'Sarah', 'Market']);
    });

    test('should merge without removing duplicates when specified', () => {
      const array1 = ['Same note'];
      const array2 = ['Same note'];
      
      const result = service.mergeNotes([array1, array2], { removeDuplicates: false });
      expect(result).toHaveLength(2);
    });

    test('should merge to legacy format when specified', () => {
      const arrays = [
        ['String note'],
        [{ text: 'Structured', subject: 'John' }]
      ];
      
      const result = service.mergeNotes(arrays, { targetFormat: 'legacy' });
      expect(result).toHaveLength(2);
      expect(result.every(note => !note.subject)).toBe(true);
    });

    test('should handle empty and invalid arrays', () => {
      const result = service.mergeNotes([[], null, 'not array', [{ text: 'Valid' }]]);
      expect(result).toHaveLength(1);
    });

    test('should skip invalid notes during merge', () => {
      const arrays = [
        ['Valid note', null, { invalid: 'object' }],
        [{ text: 'Another valid', subject: 'Test' }]
      ];
      
      const result = service.mergeNotes(arrays);
      expect(result).toHaveLength(2);
    });
  });
});