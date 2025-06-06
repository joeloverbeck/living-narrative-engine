// tests/promptElementAssemblers/ThoughtsSectionAssembler.test.js
import { ThoughtsSectionAssembler } from '../../../src/prompting/assembling/thoughtsSectionAssembler.js';
import { describe, expect, test } from '@jest/globals';

describe('ThoughtsSectionAssembler.assemble()', () => {
  const assembler = new ThoughtsSectionAssembler();
  const placeholderResolver = { resolve: (str) => str };

  test('returns an empty string when thoughtsArray is missing or empty', () => {
    expect(assembler.assemble({}, {}, placeholderResolver, null)).toBe('');
    expect(
      assembler.assemble({}, { thoughtsArray: [] }, placeholderResolver, null)
    ).toBe('');
  });

  // --- CORRECTED TEST CASE ---
  test('correctly renders a single thought using the provided config', () => {
    const promptData = { thoughtsArray: ['OnlyThought'] };

    // The component now relies on the config for its structure.
    const elementCfg = {
      prefix: 'Your most recent thoughts (oldest first):\n\n',
      suffix: '\n',
    };

    // The expected output is now a clean combination of prefix + body + suffix.
    const expected =
      'Your most recent thoughts (oldest first):\n\n- OnlyThought\n';

    expect(
      assembler.assemble(elementCfg, promptData, placeholderResolver, null)
    ).toBe(expected);
  });

  // --- CORRECTED TEST CASE ---
  test('correctly renders multiple thoughts using the provided config', () => {
    const promptData = { thoughtsArray: ['T1', 'T2'] };

    // Use the same configuration.
    const elementCfg = {
      prefix: 'Your most recent thoughts (oldest first):\n\n',
      suffix: '\n',
    };

    // The expected output correctly lists multiple thoughts.
    const expected =
      'Your most recent thoughts (oldest first):\n\n- T1\n- T2\n';

    expect(
      assembler.assemble(elementCfg, promptData, placeholderResolver, null)
    ).toBe(expected);
  });
});
