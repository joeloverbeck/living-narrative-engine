import NotesQueryService from '../../../src/ai/notesQueryService.js';

describe('NotesQueryService', () => {
  let service;
  let sampleNotes;

  beforeEach(() => {
    service = new NotesQueryService();

    // Sample notes for testing
    sampleNotes = [
      {
        text: 'John seems nervous about the meeting',
        subject: 'John',
        context: 'tavern conversation',
        tags: ['emotion', 'politics'],
        timestamp: '2024-01-15T10:00:00Z',
      },
      {
        text: 'Sarah is preparing for battle',
        subject: 'Sarah',
        context: 'training grounds',
        tags: ['combat', 'preparation'],
        timestamp: '2024-01-15T11:00:00Z',
      },
      {
        text: 'The market is crowded today',
        subject: 'Market',
        context: 'morning patrol',
        tags: ['location', 'observation'],
        timestamp: '2024-01-15T09:00:00Z',
      },
      {
        text: 'John mentioned Sarah',
        subject: 'John',
        context: 'tavern conversation',
        tags: ['relationship'],
        timestamp: '2024-01-15T10:30:00Z',
      },
      {
        text: 'Legacy note without structure', // Legacy format
      },
    ];
  });

  describe('queryBySubject', () => {
    test('should find notes by exact subject match', () => {
      const results = service.queryBySubject(sampleNotes, 'John', {
        exact: true,
      });
      expect(results).toHaveLength(2);
      expect(results.every((note) => note.subject === 'John')).toBe(true);
    });

    test('should find notes by partial subject match', () => {
      const results = service.queryBySubject(sampleNotes, 'joh', {
        exact: false,
      });
      expect(results).toHaveLength(2);
    });

    test('should be case insensitive', () => {
      const results = service.queryBySubject(sampleNotes, 'JOHN');
      expect(results).toHaveLength(2);
    });

    test('should return empty array for no matches', () => {
      const results = service.queryBySubject(sampleNotes, 'Unknown');
      expect(results).toEqual([]);
    });

    test('should handle invalid inputs', () => {
      expect(service.queryBySubject(null, 'John')).toEqual([]);
      expect(service.queryBySubject(sampleNotes, null)).toEqual([]);
      expect(service.queryBySubject([], 'John')).toEqual([]);
    });

    test('should ignore legacy notes without subjects', () => {
      const results = service.queryBySubject(sampleNotes, 'Legacy');
      expect(results).toHaveLength(0);
    });
  });

  describe('queryByContext', () => {
    test('should find notes by exact context match', () => {
      const results = service.queryByContext(
        sampleNotes,
        'tavern conversation',
        { exact: true }
      );
      expect(results).toHaveLength(2);
      expect(
        results.every((note) => note.context === 'tavern conversation')
      ).toBe(true);
    });

    test('should find notes by partial context match', () => {
      const results = service.queryByContext(sampleNotes, 'tavern');
      expect(results).toHaveLength(2);
    });

    test('should be case insensitive', () => {
      const results = service.queryByContext(sampleNotes, 'TAVERN');
      expect(results).toHaveLength(2);
    });

    test('should handle notes without context', () => {
      const results = service.queryByContext(sampleNotes, 'legacy');
      expect(results).toHaveLength(0);
    });
  });

  describe('queryByTags', () => {
    test('should find notes with single tag', () => {
      const results = service.queryByTags(sampleNotes, 'emotion');
      expect(results).toHaveLength(1);
      expect(results[0].subject).toBe('John');
    });

    test('should find notes with any of multiple tags', () => {
      const results = service.queryByTags(sampleNotes, ['emotion', 'combat']);
      expect(results).toHaveLength(2);
    });

    test('should find notes with all required tags', () => {
      const results = service.queryByTags(
        sampleNotes,
        ['emotion', 'politics'],
        { requireAll: true }
      );
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('emotion');
      expect(results[0].tags).toContain('politics');
    });

    test('should be case insensitive', () => {
      const results = service.queryByTags(sampleNotes, 'EMOTION');
      expect(results).toHaveLength(1);
    });

    test('should handle notes without tags', () => {
      const results = service.queryByTags(sampleNotes, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    test('should accept string or array input', () => {
      const stringResults = service.queryByTags(sampleNotes, 'emotion');
      const arrayResults = service.queryByTags(sampleNotes, ['emotion']);
      expect(stringResults).toEqual(arrayResults);
    });
  });

  describe('queryByText', () => {
    test('should find notes containing text', () => {
      const results = service.queryByText(sampleNotes, 'nervous');
      expect(results).toHaveLength(1);
      expect(results[0].text).toContain('nervous');
    });

    test('should search in subject when enabled', () => {
      const results = service.queryByText(sampleNotes, 'Sarah', {
        searchSubject: true,
      });
      expect(results).toHaveLength(2); // One in text, one in subject
    });

    test('should search in context when enabled', () => {
      const results = service.queryByText(sampleNotes, 'patrol', {
        searchContext: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0].context).toContain('patrol');
    });

    test('should perform exact match when specified', () => {
      const results = service.queryByText(
        sampleNotes,
        'Legacy note without structure',
        { exact: true }
      );
      expect(results).toHaveLength(1);
    });

    test('should be case insensitive', () => {
      const results = service.queryByText(sampleNotes, 'NERVOUS');
      expect(results).toHaveLength(1);
    });
  });

  describe('queryByTimeRange', () => {
    test('should find notes within time range', () => {
      const results = service.queryByTimeRange(
        sampleNotes,
        '2024-01-15T09:30:00Z',
        '2024-01-15T10:30:00Z'
      );
      expect(results).toHaveLength(2);
    });

    test('should include boundary times', () => {
      const results = service.queryByTimeRange(
        sampleNotes,
        '2024-01-15T10:00:00Z',
        '2024-01-15T10:00:00Z'
      );
      expect(results).toHaveLength(1);
      expect(results[0].timestamp).toBe('2024-01-15T10:00:00Z');
    });

    test('should handle Date objects', () => {
      const results = service.queryByTimeRange(
        sampleNotes,
        new Date('2024-01-15T09:30:00Z'),
        new Date('2024-01-15T10:30:00Z')
      );
      expect(results).toHaveLength(2);
    });

    test('should exclude notes without timestamps', () => {
      const results = service.queryByTimeRange(
        sampleNotes,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      );
      expect(results).toHaveLength(4); // Excludes legacy note
    });

    test('should handle invalid dates', () => {
      const results = service.queryByTimeRange(sampleNotes, 'invalid', 'date');
      expect(results).toEqual([]);
    });
  });

  describe('query (complex queries)', () => {
    test('should combine multiple criteria', () => {
      const results = service.query(sampleNotes, {
        subject: 'John',
        context: 'tavern',
      });
      expect(results).toHaveLength(2);
      expect(
        results.every(
          (note) => note.subject === 'John' && note.context.includes('tavern')
        )
      ).toBe(true);
    });

    test('should apply all filters in sequence', () => {
      const results = service.query(sampleNotes, {
        tags: 'emotion',
        startDate: '2024-01-15T09:00:00Z',
        endDate: '2024-01-15T11:00:00Z',
      });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('emotion');
    });

    test('should support options for each criterion', () => {
      const results = service.query(sampleNotes, {
        subject: 'joh',
        tags: ['emotion', 'politics'],
        options: {
          subject: { exact: false },
          tags: { requireAll: true },
        },
      });
      expect(results).toHaveLength(1);
    });

    test('should return all notes if no criteria specified', () => {
      const results = service.query(sampleNotes, {});
      expect(results).toHaveLength(5);
    });
  });

  describe('getAllSubjects', () => {
    test('should return sorted unique subjects', () => {
      const subjects = service.getAllSubjects(sampleNotes);
      expect(subjects).toEqual(['John', 'Market', 'Sarah']);
    });

    test('should handle empty notes', () => {
      expect(service.getAllSubjects([])).toEqual([]);
      expect(service.getAllSubjects(null)).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    test('should return sorted unique tags', () => {
      const tags = service.getAllTags(sampleNotes);
      expect(tags).toEqual([
        'combat',
        'emotion',
        'location',
        'observation',
        'politics',
        'preparation',
        'relationship',
      ]);
    });

    test('should handle notes without tags', () => {
      const notesWithoutTags = [{ text: 'Note 1' }, { text: 'Note 2' }];
      expect(service.getAllTags(notesWithoutTags)).toEqual([]);
    });
  });

  describe('getAllContexts', () => {
    test('should return sorted unique contexts', () => {
      const contexts = service.getAllContexts(sampleNotes);
      expect(contexts).toEqual([
        'morning patrol',
        'tavern conversation',
        'training grounds',
      ]);
    });
  });

  describe('getStatistics', () => {
    test('should calculate correct statistics', () => {
      const stats = service.getStatistics(sampleNotes);

      expect(stats.total).toBe(5);
      expect(stats.structured).toBe(4);
      expect(stats.legacy).toBe(1);

      expect(stats.bySubject).toEqual({
        John: 2,
        Sarah: 1,
        Market: 1,
      });

      expect(stats.byTag).toEqual({
        emotion: 1,
        politics: 1,
        combat: 1,
        preparation: 1,
        location: 1,
        observation: 1,
        relationship: 1,
      });

      expect(stats.byContext).toEqual({
        'tavern conversation': 2,
        'training grounds': 1,
        'morning patrol': 1,
      });
    });

    test('should handle empty notes', () => {
      const stats = service.getStatistics([]);
      expect(stats.total).toBe(0);
      expect(stats.structured).toBe(0);
      expect(stats.legacy).toBe(0);
      expect(stats.bySubject).toEqual({});
      expect(stats.byTag).toEqual({});
      expect(stats.byContext).toEqual({});
    });

    test('should handle invalid input', () => {
      const stats = service.getStatistics(null);
      expect(stats.total).toBe(0);
    });
  });
});
