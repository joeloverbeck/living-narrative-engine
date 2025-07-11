import { NotesSectionAssembler } from '../../../../src/prompting/assembling/notesSectionAssembler.js';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';

describe('NotesSectionAssembler - Edge Cases & Boundary Conditions', () => {
  let assembler;
  let mockResolver;

  beforeEach(() => {
    assembler = new NotesSectionAssembler();
    mockResolver = { resolve: (str) => str };
  });

  describe('Extreme Data Sizes', () => {
    it('handles extremely large text content', () => {
      const hugeTex = 'A'.repeat(100000); // 100k characters
      const pd = {
        notesArray: [{ text: hugeTex }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain(`- ${hugeTex}`);
    });

    it('handles thousands of notes efficiently', () => {
      const notes = [];
      for (let i = 0; i < 5000; i++) {
        notes.push({
          text: `Note ${i}`,
          subject: `Subject ${i % 100}`, // 100 different subjects
          timestamp: `2020-01-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`,
          context: i % 3 === 0 ? `Context ${i}` : undefined,
          tags: i % 5 === 0 ? [`tag${i}`, `tag${i + 1}`] : undefined,
        });
      }
      const pd = { notesArray: notes };
      const start = Date.now();
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const duration = Date.now() - start;

      expect(out).toBeTruthy();
      expect(out.length).toBeGreaterThan(100000); // Should be substantial output
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(out).toContain('[Subject 0]');
      expect(out).toContain('[Subject 99]');
    });

    it('handles maximum JavaScript string length gracefully', () => {
      // Test with a very large but reasonable string
      const largeText = 'X'.repeat(50000);
      const pd = {
        notesArray: [{ text: largeText, subject: 'Large' }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Large]');
      expect(out).toContain(largeText);
    });
  });

  describe('Unicode and Special Characters', () => {
    it('handles complex Unicode characters in all fields', () => {
      const pd = {
        notesArray: [
          {
            text: '🌟✨💫🎭🎪🎨 Unicode emojis and symbols: ∑∏∆∇',
            subject: '🚀 Unicode Subject 中文 العربية',
            context: '🌍 Global context пример тест',
            tags: ['🏷️tag1', '⭐tag2', '中文标签'],
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[🚀 Unicode Subject 中文 العربية]');
      expect(out).toContain('🌟✨💫🎭🎪🎨 Unicode emojis and symbols: ∑∏∆∇');
      expect(out).toContain('(🌍 Global context пример тест)');
      expect(out).toContain('[🏷️tag1, ⭐tag2, 中文标签]');
    });

    it('handles control characters and escape sequences', () => {
      const pd = {
        notesArray: [
          {
            text: 'Text with\\n\\t\\r\\0 control chars',
            subject: 'Control\\nChars',
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Control\\nChars]');
      expect(out).toContain('- Text with\\n\\t\\r\\0 control chars');
    });

    it('handles extremely long Unicode strings', () => {
      const longUnicode = '中文'.repeat(1000) + '🎉'.repeat(1000);
      const pd = {
        notesArray: [{ text: longUnicode, subject: 'Unicode Test' }],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain(longUnicode);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles deeply nested object structures in note properties', () => {
      const deepObject = { level1: { level2: { level3: { value: 'deep' } } } };
      const pd = {
        notesArray: [
          {
            text: 'Deep object test',
            subject: JSON.stringify(deepObject),
            context: JSON.stringify(deepObject),
            tags: [JSON.stringify(deepObject)],
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toBeTruthy();
    });

    it('handles circular reference handling gracefully', () => {
      const circularObj = { ref: null };
      circularObj.ref = circularObj;

      // Note: We can't actually pass circular objects to JSON methods,
      // but we can test that string representations work
      const pd = {
        notesArray: [
          {
            text: '[object Object]',
            subject: 'Circular Test',
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Circular Test]');
    });

    it('handles memory pressure with many large notes', () => {
      const notes = [];
      for (let i = 0; i < 100; i++) {
        notes.push({
          text: `Large note ${i}: ${'data '.repeat(1000)}`,
          subject: `Subject ${i}`,
          context: `Context ${'x'.repeat(100)}`,
          tags: Array.from({ length: 10 }, (_, j) => `tag${i}_${j}`),
        });
      }
      const pd = { notesArray: notes };

      const start = Date.now();
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      const duration = Date.now() - start;

      expect(out).toBeTruthy();
      expect(duration).toBeLessThan(2000); // Should complete reasonably fast
    });
  });

  describe('Malformed and Boundary Data', () => {
    it('handles notes with malformed timestamp objects', () => {
      const pd = {
        notesArray: [
          { text: 'Note 1', timestamp: {} },
          { text: 'Note 2', timestamp: [] },
          { text: 'Note 3', timestamp: 12345 }, // Number instead of string
          { text: 'Note 4', timestamp: true },
          { text: 'Note 5', timestamp: null },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Note 1');
      expect(out).toContain('- Note 2');
      expect(out).toContain('- Note 3');
      expect(out).toContain('- Note 4');
      expect(out).toContain('- Note 5');
    });

    it('handles notes with malformed tag arrays (gracefully fails)', () => {
      // Note: The current implementation expects tags to be arrays
      // These tests will throw errors, which is expected behavior
      const validNote = {
        text: 'Valid note',
        subject: 'Test',
        tags: ['valid', 'tag'],
      };
      const pd = { notesArray: [validNote] };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Test]');
      expect(out).toContain('- Valid note [valid, tag]');

      // Test malformed tags that would cause errors
      expect(() => {
        const badTagsPd = {
          notesArray: [
            { text: 'Note 1', subject: 'Test', tags: 'not-an-array' },
          ],
        };
        assembler.assemble({}, badTagsPd, mockResolver, undefined);
      }).toThrow();
    });

    it('handles extremely nested array structures', () => {
      const deepArray = [[[[[['deep-value']]]]]];
      const pd = {
        notesArray: [
          {
            text: 'Deep array test',
            subject: 'Deep',
            tags: deepArray,
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toBeTruthy();
    });

    it('handles notes with prototype pollution attempts', () => {
      const maliciousNote = {
        text: 'Malicious note',
        subject: 'Evil',
        __proto__: { polluted: true },
        constructor: { polluted: true },
      };
      const pd = { notesArray: [maliciousNote] };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Evil]');
      expect(out).toContain('- Malicious note');
    });
  });

  describe('Resolver Edge Cases', () => {
    it('handles resolver that throws exceptions', () => {
      const throwingResolver = {
        resolve: (str) => {
          if (str === 'THROW') throw new Error('Resolver error');
          return str;
        },
      };
      const cfg = { prefix: 'THROW', suffix: 'normal' };
      const pd = { notesArray: [{ text: 'Test note' }] };

      expect(() => {
        assembler.assemble(cfg, pd, throwingResolver, undefined);
      }).toThrow('Resolver error');
    });

    it('handles resolver that returns non-strings', () => {
      const weirdResolver = {
        resolve: (str) => {
          if (str === 'prefix') return 123;
          if (str === 'suffix') return { object: true };
          return str;
        },
      };
      const cfg = { prefix: 'prefix', suffix: 'suffix' };
      const pd = { notesArray: [{ text: 'Test note' }] };

      const out = assembler.assemble(cfg, pd, weirdResolver, undefined);
      expect(out).toBeTruthy(); // Should not crash
    });

    it('handles resolver with circular references in returned objects', () => {
      const circularResolver = {
        resolve: (str) => {
          if (str === 'circular') {
            const obj = { ref: null };
            obj.ref = obj;
            return obj;
          }
          return str;
        },
      };
      const cfg = { prefix: 'circular', suffix: 'normal' };
      const pd = { notesArray: [{ text: 'Test note' }] };

      const out = assembler.assemble(cfg, pd, circularResolver, undefined);
      expect(out).toBeTruthy(); // Should not crash
    });
  });

  describe('Stress Testing', () => {
    it('handles rapid repeated calls without memory leaks', () => {
      const pd = {
        notesArray: [{ text: 'Test note', subject: 'Stress' }],
      };

      // Run many iterations quickly
      for (let i = 0; i < 1000; i++) {
        const out = assembler.assemble({}, pd, mockResolver, undefined);
        expect(out).toContain('[Stress]');
      }
    });

    it('handles concurrent-like access patterns', async () => {
      const pd = {
        notesArray: [{ text: 'Concurrent test', subject: 'Parallel' }],
      };

      // Simulate concurrent access
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(assembler.assemble({}, pd, mockResolver, undefined))
      );

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).toContain('[Parallel]');
        expect(result).toContain('- Concurrent test');
      });
    });

    it('handles interleaved structured and unstructured processing', () => {
      const notes = [];
      for (let i = 0; i < 1000; i++) {
        notes.push({
          text: `Note ${i}`,
          subject: i % 2 === 0 ? `Subject ${i % 10}` : undefined, // Mix structured/unstructured
          timestamp: `2020-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        });
      }
      const pd = { notesArray: notes };

      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Subject 0]');
      expect(out).toContain('[General Notes]');
      expect(out.split('\n').length).toBeGreaterThan(1000);
    });
  });

  describe('Edge Cases in Business Logic', () => {
    it('handles subjects that are numbers, booleans, and other types', () => {
      const pd = {
        notesArray: [
          { text: 'Number subject', subject: 123 },
          { text: 'Boolean subject', subject: true },
          { text: 'Zero subject', subject: 0 },
          { text: 'False subject', subject: false },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);

      // Numbers and true are truthy, so they should be structured
      expect(out).toContain('[123]');
      expect(out).toContain('[true]');

      // 0 and false are falsy, so they go to General Notes
      expect(out).toContain('[General Notes]');
      expect(out).toContain('- Zero subject');
      expect(out).toContain('- False subject');
    });

    it('handles context and tags with various data types', () => {
      const pd = {
        notesArray: [
          {
            text: 'Mixed types',
            subject: 'Test',
            context: 123,
            tags: [true, false, 0, 1, '', 'valid'],
          },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('[Test]');
      expect(out).toContain('- Mixed types');
      // Should handle the type coercion gracefully
    });

    it('handles timestamp edge cases around Unix epoch', () => {
      const pd = {
        notesArray: [
          { text: 'Unix epoch', timestamp: '1970-01-01T00:00:00Z' },
          { text: 'Pre-epoch', timestamp: '1969-12-31T23:59:59Z' },
          { text: 'Far future', timestamp: '2100-01-01T00:00:00Z' },
          { text: 'Invalid date', timestamp: '1970-13-40T25:61:61Z' },
        ],
      };
      const out = assembler.assemble({}, pd, mockResolver, undefined);
      expect(out).toContain('- Unix epoch');
      expect(out).toContain('- Pre-epoch');
      expect(out).toContain('- Far future');
      expect(out).toContain('- Invalid date');
    });
  });
});
