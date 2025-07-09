import NotesMigrationService from '../../../src/migration/NotesMigrationService.js';

describe('NotesMigrationService', () => {
  let service;

  beforeEach(() => {
    service = new NotesMigrationService();
  });

  describe('extractSubjectFromText', () => {
    test('should extract subject from "X seems..." pattern', () => {
      expect(service.extractSubjectFromText('John seems nervous')).toBe('John');
      expect(service.extractSubjectFromText('Sarah appears tired')).toBe(
        'Sarah'
      );
      expect(service.extractSubjectFromText('The merchant is wealthy')).toBe(
        'merchant'
      );
    });

    test('should extract subject from possessive pattern', () => {
      expect(service.extractSubjectFromText("John's sword is sharp")).toBe(
        'John'
      );
      expect(service.extractSubjectFromText("Sarah's magic is powerful")).toBe(
        'Sarah'
      );
    });

    test('should extract subject from observation pattern', () => {
      expect(service.extractSubjectFromText('Saw John at the market')).toBe(
        'John'
      );
      expect(service.extractSubjectFromText('Noticed the guard sleeping')).toBe(
        'the guard'
      );
    });

    test('should extract subject from location pattern', () => {
      expect(
        service.extractSubjectFromText('At the tavern, crowded and noisy')
      ).toBe('tavern');
      expect(service.extractSubjectFromText('In the market square today')).toBe(
        'market square'
      );
    });

    test('should handle compound names', () => {
      expect(service.extractSubjectFromText('John Smith seems worried')).toBe(
        'John Smith'
      );
      expect(service.extractSubjectFromText("Mary-Jane's house is large")).toBe(
        'Mary-Jane'
      );
    });

    test('should return Unknown for unclear subjects', () => {
      expect(service.extractSubjectFromText('It was a dark night')).toBe(
        'Unknown'
      );
      expect(service.extractSubjectFromText('Something strange happened')).toBe(
        'Something'
      );
      expect(service.extractSubjectFromText('')).toBe('Unknown');
    });

    test('should handle edge cases', () => {
      expect(service.extractSubjectFromText(null)).toBe('Unknown');
      expect(service.extractSubjectFromText(undefined)).toBe('Unknown');
      expect(service.extractSubjectFromText(123)).toBe('Unknown');
    });
  });

  describe('inferTagsFromText', () => {
    test('should infer emotion tags', () => {
      expect(service.inferTagsFromText('He seems very nervous')).toContain(
        'emotion'
      );
      expect(service.inferTagsFromText('He seems very nervous')).toContain(
        'anxiety'
      );
      expect(service.inferTagsFromText('She was incredibly happy')).toContain(
        'happiness'
      );
      expect(service.inferTagsFromText('The merchant looked angry')).toContain(
        'anger'
      );
    });

    test('should infer activity tags', () => {
      expect(service.inferTagsFromText('Engaged in fierce combat')).toContain(
        'combat'
      );
      expect(service.inferTagsFromText('Trading at the market')).toContain(
        'trade'
      );
      expect(service.inferTagsFromText('Council meeting tomorrow')).toContain(
        'politics'
      );
      expect(service.inferTagsFromText('Casting a spell')).toContain('magic');
    });

    test('should infer relationship tags', () => {
      expect(service.inferTagsFromText('Made a new friend today')).toContain(
        'relationship'
      );
      expect(service.inferTagsFromText('Made a new friend today')).toContain(
        'positive'
      );
      expect(service.inferTagsFromText('My sworn enemy appeared')).toContain(
        'negative'
      );
    });

    test('should infer location tags', () => {
      expect(service.inferTagsFromText('Met at the tavern')).toContain(
        'location'
      );
      expect(service.inferTagsFromText('Met at the tavern')).toContain(
        'tavern'
      );
      expect(service.inferTagsFromText('Shopping at the market')).toContain(
        'market'
      );
    });

    test('should always include migrated tag', () => {
      expect(service.inferTagsFromText('Any text')).toContain('migrated');
      expect(service.inferTagsFromText('')).toContain('migrated');
    });

    test('should not have duplicate tags', () => {
      const tags = service.inferTagsFromText(
        'At the market, trading happily with a merchant friend'
      );
      const uniqueTags = [...new Set(tags)];
      expect(tags.length).toBe(uniqueTags.length);
    });
  });

  describe('migrateNote', () => {
    test('should migrate string notes', () => {
      const oldNote = 'John seems nervous';
      const migrated = service.migrateNote(oldNote);

      expect(migrated).toHaveProperty('text', 'John seems nervous');
      expect(migrated).toHaveProperty('subject', 'John');
      expect(migrated).toHaveProperty('context', 'legacy note');
      expect(migrated).toHaveProperty('tags');
      expect(migrated).toHaveProperty('timestamp');
      expect(migrated.tags).toContain('migrated');
    });

    test('should migrate object notes without subject', () => {
      const oldNote = {
        text: 'Sarah appears tired',
        timestamp: '2024-01-15T10:30:00Z',
      };
      const migrated = service.migrateNote(oldNote);

      expect(migrated.text).toBe('Sarah appears tired');
      expect(migrated.subject).toBe('Sarah');
      expect(migrated.context).toBe('legacy note');
      expect(migrated.timestamp).toBe('2024-01-15T10:30:00Z');
    });

    test('should not re-migrate already migrated notes', () => {
      const newNote = {
        text: 'John seems nervous',
        subject: 'John',
        context: 'tavern observation',
        tags: ['emotion', 'anxiety'],
        timestamp: '2024-01-15T10:30:00Z',
      };
      const result = service.migrateNote(newNote);

      expect(result).toEqual(newNote);
    });

    test('should handle null and undefined gracefully', () => {
      const nullMigrated = service.migrateNote(null);
      expect(nullMigrated.text).toBe('null');
      expect(nullMigrated.subject).toBe('Unknown');
      expect(nullMigrated.tags).toContain('unexpected-format');

      const undefinedMigrated = service.migrateNote(undefined);
      expect(undefinedMigrated.text).toBe('undefined');
      expect(undefinedMigrated.subject).toBe('Unknown');
    });

    test('should add timestamp if missing', () => {
      const oldNote = { text: 'Test note' };
      const migrated = service.migrateNote(oldNote);

      expect(migrated.timestamp).toBeDefined();
      expect(new Date(migrated.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('migrateNotes', () => {
    test('should migrate array of mixed notes', () => {
      const notes = [
        'String note about John',
        { text: 'Object note about Sarah' },
        {
          text: 'Already migrated',
          subject: 'Market',
          context: 'morning visit',
        },
      ];

      const migrated = service.migrateNotes(notes);

      expect(migrated).toHaveLength(3);
      expect(migrated[0].subject).toBe('John');
      expect(migrated[1].subject).toBe('Sarah');
      expect(migrated[2].subject).toBe('Market');
    });

    test('should handle empty array', () => {
      expect(service.migrateNotes([])).toEqual([]);
    });

    test('should handle non-array input', () => {
      expect(service.migrateNotes(null)).toEqual([]);
      expect(service.migrateNotes(undefined)).toEqual([]);
      expect(service.migrateNotes('not an array')).toEqual([]);
    });
  });

  describe('isOldFormat', () => {
    test('should identify string notes as old format', () => {
      expect(service.isOldFormat('String note')).toBe(true);
    });

    test('should identify objects without subject as old format', () => {
      expect(service.isOldFormat({ text: 'Note text' })).toBe(true);
      expect(
        service.isOldFormat({ text: 'Note', timestamp: '2024-01-15' })
      ).toBe(true);
    });

    test('should identify objects with subject as new format', () => {
      expect(service.isOldFormat({ text: 'Note', subject: 'John' })).toBe(
        false
      );
    });

    test('should handle edge cases', () => {
      expect(service.isOldFormat(null)).toBe(false);
      expect(service.isOldFormat(undefined)).toBe(false);
      expect(service.isOldFormat(123)).toBe(false);
    });
  });

  describe('needsMigration', () => {
    test('should return true if any note needs migration', () => {
      const notes = [
        { text: 'New note', subject: 'John' },
        'Old string note',
        { text: 'Another new note', subject: 'Sarah' },
      ];
      expect(service.needsMigration(notes)).toBe(true);
    });

    test('should return false if no notes need migration', () => {
      const notes = [
        { text: 'New note', subject: 'John' },
        { text: 'Another new note', subject: 'Sarah' },
      ];
      expect(service.needsMigration(notes)).toBe(false);
    });

    test('should handle empty arrays and non-arrays', () => {
      expect(service.needsMigration([])).toBe(false);
      expect(service.needsMigration(null)).toBe(false);
      expect(service.needsMigration('not an array')).toBe(false);
    });
  });

  describe('getMigrationStats', () => {
    test('should calculate correct statistics', () => {
      const notes = [
        'Old string note',
        { text: 'Old object note' },
        { text: 'New note', subject: 'John' },
        { text: 'Another new note', subject: 'Sarah' },
      ];

      const stats = service.getMigrationStats(notes);

      expect(stats.total).toBe(4);
      expect(stats.oldFormat).toBe(2);
      expect(stats.newFormat).toBe(2);
      expect(stats.needsMigration).toBe(true);
    });

    test('should handle all old format', () => {
      const notes = ['Note 1', 'Note 2', { text: 'Note 3' }];
      const stats = service.getMigrationStats(notes);

      expect(stats.oldFormat).toBe(3);
      expect(stats.newFormat).toBe(0);
      expect(stats.needsMigration).toBe(true);
    });

    test('should handle all new format', () => {
      const notes = [
        { text: 'Note 1', subject: 'John' },
        { text: 'Note 2', subject: 'Sarah' },
      ];
      const stats = service.getMigrationStats(notes);

      expect(stats.oldFormat).toBe(0);
      expect(stats.newFormat).toBe(2);
      expect(stats.needsMigration).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(service.getMigrationStats([])).toEqual({
        total: 0,
        oldFormat: 0,
        newFormat: 0,
        needsMigration: false,
      });

      expect(service.getMigrationStats(null)).toEqual({
        total: 0,
        oldFormat: 0,
        newFormat: 0,
        needsMigration: false,
      });
    });
  });
});
