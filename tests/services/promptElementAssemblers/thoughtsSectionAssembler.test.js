// tests/promptElementAssemblers/ThoughtsSectionAssembler.test.js
import { ThoughtsSectionAssembler } from '../../../src/services/promptElementAssemblers/ThoughtsSectionAssembler.js';
import { describe, expect, test } from '@jest/globals';

describe('ThoughtsSectionAssembler.assemble()', () => {
  const assembler = new ThoughtsSectionAssembler();

  // Minimal stub – we don’t use placeholder resolution in these cases
  const placeholderResolver = { resolve: (str /*, _promptData */) => str };

  test('returns an empty string when thoughtsArray is missing or empty', () => {
    expect(assembler.assemble({}, {}, placeholderResolver, null)).toBe('');

    expect(
      assembler.assemble({}, { thoughtsArray: [] }, placeholderResolver, null)
    ).toBe('');
  });

  test('correctly renders a single thought', () => {
    const promptData = { thoughtsArray: ['OnlyThought'] };

    const expected =
      '\n' +
      'Your most recent thoughts (oldest first):\n' +
      '\n' +
      '- OnlyThought\n' +
      '\n';

    expect(assembler.assemble({}, promptData, placeholderResolver, null)).toBe(
      expected
    );
  });

  test('correctly renders multiple thoughts', () => {
    const promptData = { thoughtsArray: ['T1', 'T2'] };

    const expected =
      '\n' +
      'Your most recent thoughts (oldest first):\n' +
      '\n' +
      '- T1\n' +
      '- T2\n' +
      '\n';

    expect(assembler.assemble({}, promptData, placeholderResolver, null)).toBe(
      expected
    );
  });
});
