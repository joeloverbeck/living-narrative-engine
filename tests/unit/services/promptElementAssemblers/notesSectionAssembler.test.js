import { NotesSectionAssembler } from '../../../../src/prompting/assembling/notesSectionAssembler.js';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';

const mockResolver = { resolve: (str) => str };
const mockResolverWithPlaceholders = {
  resolve: (str, context) => {
    if (str === '{{prefix}}') return 'NOTES:';
    if (str === '{{suffix}}') return 'END_NOTES';
    return str;
  },
};

describe('NotesSectionAssembler', () => {
  let assembler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    assembler = new NotesSectionAssembler();
  });

  describe('Parameter Validation', () => {
    it('returns empty string when elementConfig is null', () => {
      const out = assembler.assemble(
        null,
        { notesArray: [] },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when promptData is null', () => {
      const out = assembler.assemble({}, null, mockResolver, undefined);
      expect(out).toBe('');
    });

    it('returns empty string when placeholderResolver is null', () => {
      const out = assembler.assemble({}, { notesArray: [] }, null, undefined);
      expect(out).toBe('');
    });

    it('returns empty string when elementConfig is undefined', () => {
      const out = assembler.assemble(
        undefined,
        { notesArray: [] },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when promptData is undefined', () => {
      const out = assembler.assemble({}, undefined, mockResolver, undefined);
      expect(out).toBe('');
    });

    it('returns empty string when placeholderResolver is undefined', () => {
      const out = assembler.assemble(
        {},
        { notesArray: [] },
        undefined,
        undefined
      );
      expect(out).toBe('');
    });
  });

  describe('Empty and Invalid Notes Arrays', () => {
    it('returns empty string when notesArray is absent', () => {
      const out = assembler.assemble({}, {}, mockResolver, undefined);
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is null', () => {
      const out = assembler.assemble(
        {},
        { notesArray: null },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is undefined', () => {
      const out = assembler.assemble(
        {},
        { notesArray: undefined },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is empty', () => {
      const out = assembler.assemble(
        {},
        { notesArray: [] },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is not an array', () => {
      const out = assembler.assemble(
        {},
        { notesArray: 'not an array' },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is a number', () => {
      const out = assembler.assemble(
        {},
        { notesArray: 123 },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });

    it('returns empty string when notesArray is an object', () => {
      const out = assembler.assemble(
        {},
        { notesArray: {} },
        mockResolver,
        undefined
      );
      expect(out).toBe('');
    });
  });

  describe('Legacy Notes (Unstructured)', () => {
    it('renders single note with prefix/suffix providing header', () => {
      const cfg = { prefix: '', suffix: '' };
      const pd = {
        notesArray: [{ text: 'Buy milk', timestamp: '2000-01-01T00:00:00Z' }],
      };
      const out = assembler.assemble(cfg, pd, mockResolver, undefined);
      expect(out).toBe('\n- Buy milk\n');
    });

    it('sorts by timestamp ascending', () => {
      const pd = {
        notesArray: [
          { text: 'second', timestamp: '2024-06-01T00:00:00Z' },
          { text: 'first', timestamp: '2021-01-01T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      expect(lines[0]).toBe('- first');
      expect(lines[1]).toBe('- second');
    });

    it('handles notes without timestamps (places at end)', () => {
      const pd = {
        notesArray: [
          { text: 'no timestamp' },
          { text: 'has timestamp', timestamp: '2020-01-01T00:00:00Z' },
          { text: 'also no timestamp' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      expect(lines[0]).toBe('- has timestamp');
      expect(lines[1]).toBe('- no timestamp');
      expect(lines[2]).toBe('- also no timestamp');
    });

    it('handles invalid timestamp formats gracefully', () => {
      const pd = {
        notesArray: [
          { text: 'invalid timestamp', timestamp: 'not-a-date' },
          { text: 'valid timestamp', timestamp: '2020-01-01T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      // NaN in timestamp comparison has unpredictable sort order
      expect(lines).toHaveLength(2);
      expect(lines).toContain('- valid timestamp');
      expect(lines).toContain('- invalid timestamp');
    });

    it('handles multiple notes with same timestamp', () => {
      const pd = {
        notesArray: [
          { text: 'note A', timestamp: '2020-01-01T00:00:00Z' },
          { text: 'note B', timestamp: '2020-01-01T00:00:00Z' },
          { text: 'note C', timestamp: '2020-01-01T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('- note A');
      expect(lines[1]).toBe('- note B');
      expect(lines[2]).toBe('- note C');
    });

    it('handles empty text in notes', () => {
      const pd = {
        notesArray: [
          { text: '', timestamp: '2020-01-01T00:00:00Z' },
          { text: 'valid text', timestamp: '2020-01-02T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      expect(lines[0]).toBe('- ');
      expect(lines[1]).toBe('- valid text');
    });
  });

  describe('Structured Notes', () => {
    it('detects structured notes by presence of subject field', () => {
      const pd = {
        notesArray: [{ text: 'Buy milk', subject: 'Shopping' }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Shopping]');
      expect(out).toContain('- Buy milk');
    });

    it('groups notes by subject', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping' },
          { text: 'Buy bread', subject: 'Shopping' },
          { text: 'Call mom', subject: 'Personal' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Personal]');
      expect(out).toContain('[Shopping]');
      expect(out).toContain('- Buy milk');
      expect(out).toContain('- Buy bread');
      expect(out).toContain('- Call mom');
    });

    it('sorts subjects alphabetically', () => {
      const pd = {
        notesArray: [
          { text: 'Note 1', subject: 'Zebra' },
          { text: 'Note 2', subject: 'Alpha' },
          { text: 'Note 3', subject: 'Beta' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      const alphaIndex = lines.findIndex((line) => line === '[Alpha]');
      const betaIndex = lines.findIndex((line) => line === '[Beta]');
      const zebraIndex = lines.findIndex((line) => line === '[Zebra]');
      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });

    it('sorts notes within subjects by timestamp', () => {
      const pd = {
        notesArray: [
          {
            text: 'Second note',
            subject: 'Test',
            timestamp: '2020-01-02T00:00:00Z',
          },
          {
            text: 'First note',
            subject: 'Test',
            timestamp: '2020-01-01T00:00:00Z',
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      const firstIndex = lines.findIndex((line) => line === '- First note');
      const secondIndex = lines.findIndex((line) => line === '- Second note');
      expect(firstIndex).toBeLessThan(secondIndex);
    });

    it('handles notes with context', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping', context: 'grocery store' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk (grocery store)');
    });

    it('handles notes with tags', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping', tags: ['urgent', 'food'] },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk [urgent, food]');
    });

    it('handles notes with both context and tags', () => {
      const pd = {
        notesArray: [
          {
            text: 'Buy milk',
            subject: 'Shopping',
            context: 'grocery store',
            tags: ['urgent', 'food'],
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk (grocery store) [urgent, food]');
    });

    it('handles empty tags array', () => {
      const pd = {
        notesArray: [{ text: 'Buy milk', subject: 'Shopping', tags: [] }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk');
      expect(out).not.toContain('[]');
    });

    it('handles null/undefined context', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping', context: null },
          { text: 'Buy bread', subject: 'Shopping', context: undefined },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk');
      expect(out).toContain('- Buy bread');
      expect(out).not.toContain('(null)');
      expect(out).not.toContain('(undefined)');
    });

    it('handles null/undefined tags', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping', tags: null },
          { text: 'Buy bread', subject: 'Shopping', tags: undefined },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Buy milk');
      expect(out).toContain('- Buy bread');
      expect(out).not.toContain('[null]');
      expect(out).not.toContain('[undefined]');
    });
  });

  describe('Mixed Structured and Unstructured Notes', () => {
    it('handles mix of structured and unstructured notes', () => {
      const pd = {
        notesArray: [
          { text: 'Buy milk', subject: 'Shopping' },
          { text: 'Random thought' }, // No subject
          { text: 'Call mom', subject: 'Personal' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Personal]');
      expect(out).toContain('[Shopping]');
      expect(out).toContain('[General Notes]');
      expect(out).toContain('- Random thought');
    });

    it('places unstructured notes in General Notes section at end', () => {
      const pd = {
        notesArray: [
          { text: 'Unstructured note 1' },
          { text: 'Structured note', subject: 'Test' },
          { text: 'Unstructured note 2' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      const testIndex = lines.findIndex((line) => line === '[Test]');
      const generalIndex = lines.findIndex(
        (line) => line === '[General Notes]'
      );
      expect(testIndex).toBeLessThan(generalIndex);
    });

    it('sorts unstructured notes by timestamp in General Notes section', () => {
      const pd = {
        notesArray: [
          { text: 'Second unstructured', timestamp: '2020-01-02T00:00:00Z' },
          { text: 'Structured note', subject: 'Test' },
          { text: 'First unstructured', timestamp: '2020-01-01T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      const firstIndex = lines.findIndex(
        (line) => line === '- First unstructured'
      );
      const secondIndex = lines.findIndex(
        (line) => line === '- Second unstructured'
      );
      expect(firstIndex).toBeLessThan(secondIndex);
    });

    it('handles unstructured notes without timestamps in General Notes', () => {
      const pd = {
        notesArray: [
          { text: 'No timestamp' },
          { text: 'Structured note', subject: 'Test' },
          { text: 'Has timestamp', timestamp: '2020-01-01T00:00:00Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const lines = out.trim().split('\n');
      const hasTimestampIndex = lines.findIndex(
        (line) => line === '- Has timestamp'
      );
      const noTimestampIndex = lines.findIndex(
        (line) => line === '- No timestamp'
      );
      expect(hasTimestampIndex).toBeLessThan(noTimestampIndex);
    });
  });

  describe('Prefix and Suffix Resolution', () => {
    it('resolves prefix and suffix with placeholder resolver', () => {
      const cfg = { prefix: '{{prefix}}', suffix: '{{suffix}}' };
      const pd = {
        notesArray: [{ text: 'Test note' }],
      };
      const out = assembler.assemble(
        cfg,
        pd,
        mockResolverWithPlaceholders,
        undefined
      );
      expect(out).toBe('NOTES:\n- Test note\nEND_NOTES');
    });

    it('handles empty prefix and suffix', () => {
      const cfg = { prefix: '', suffix: '' };
      const pd = {
        notesArray: [{ text: 'Test note' }],
      };
      const out = assembler.assemble(cfg, pd, mockResolver, undefined);
      expect(out).toBe('\n- Test note\n');
    });

    it('handles undefined prefix and suffix', () => {
      const cfg = {};
      const pd = {
        notesArray: [{ text: 'Test note' }],
      };
      const out = assembler.assemble(cfg, pd, mockResolver, undefined);
      expect(out).toBe('\n- Test note\n');
    });

    it('handles null configuration for wrappers', () => {
      const pd = {
        notesArray: [{ text: 'Test note' }],
      };
      const out = assembler.assemble(null, pd, mockResolver, undefined);
      expect(out).toBe(''); // Should fail validation and return empty
    });
  });

  describe('Edge Cases', () => {
    it('handles very long note text', () => {
      const longText = 'A'.repeat(1000);
      const pd = {
        notesArray: [{ text: longText }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain(`- ${longText}`);
    });

    it('handles special characters in text', () => {
      const pd = {
        notesArray: [
          { text: 'Text with <html> tags & symbols @#$%' },
          { text: 'Unicode: 中文 🎉 ñ' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Text with <html> tags & symbols @#$%');
      expect(out).toContain('- Unicode: 中文 🎉 ñ');
    });

    it('handles special characters in subjects', () => {
      const pd = {
        notesArray: [
          { text: 'Note 1', subject: 'Subject with <html> & symbols' },
          { text: 'Note 2', subject: 'Unicode: 中文 🎉' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Subject with <html> & symbols]');
      expect(out).toContain('[Unicode: 中文 🎉]');
    });

    it('handles whitespace-only text', () => {
      const pd = {
        notesArray: [{ text: '   ' }, { text: '\t\n' }, { text: 'Valid text' }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Valid text');
      expect(out).toContain('-    ');
      expect(out).toContain('- \t\n');
    });

    it('handles empty subject string (treated as unstructured)', () => {
      const pd = {
        notesArray: [
          { text: 'Note with empty subject', subject: '' },
          { text: 'Note with normal subject', subject: 'Normal' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      // Empty string subject is falsy, so note goes to General Notes section
      expect(out).toContain('[Normal]');
      expect(out).toContain('[General Notes]');
      expect(out).toContain('- Note with empty subject');
      expect(out).toContain('- Note with normal subject');
    });

    it('handles whitespace-only subject', () => {
      const pd = {
        notesArray: [{ text: 'Note with whitespace subject', subject: '   ' }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[   ]');
    });

    it('handles large number of notes efficiently', () => {
      const notes = [];
      for (let i = 0; i < 1000; i++) {
        notes.push({
          text: `Note ${i}`,
          subject: `Subject ${i % 10}`,
          timestamp: `2020-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        });
      }
      const pd = { notesArray: notes };
      const start = Date.now();
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const duration = Date.now() - start;
      expect(out).toBeTruthy();
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
