import { NotesSectionAssembler } from '../../../src/services/promptElementAssemblers/notesSectionAssembler.js';
import { describe, expect, it } from '@jest/globals';

const assembler = new NotesSectionAssembler({ logger: console });
const mockResolver = { resolve: (str) => str };

describe('NotesSectionAssembler', () => {
  it('returns empty string when notesArray is absent', () => {
    const out = assembler.assemble({}, {}, mockResolver, undefined);
    expect(out).toBe('');
  });

  it('renders single note with header, list item and suffix/prefix', () => {
    const cfg = { prefix: '', suffix: '' };
    const pd = {
      notesArray: [{ text: 'Buy milk', timestamp: '2000-01-01T00:00:00Z' }],
    };
    const out = assembler.assemble(cfg, pd, mockResolver, undefined);
    expect(out).toBe('\nImportant Things to Remember:\n\n- Buy milk\n\n');
  });

  it('sorts by timestamp ascending', () => {
    const pd = {
      notesArray: [
        { text: 'second', timestamp: '2024-06-01T00:00:00Z' },
        { text: 'first', timestamp: '2021-01-01T00:00:00Z' },
      ],
    };
    const out = assembler.assemble({}, pd, mockResolver, undefined);
    const lines = out.trim().split('\n'); // drop leading blank
    expect(lines[2]).toBe('- first');
    expect(lines[3]).toBe('- second');
  });
});
