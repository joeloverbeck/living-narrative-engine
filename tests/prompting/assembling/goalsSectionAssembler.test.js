import { GoalsSectionAssembler } from '../../../src/prompting/assembling/goalsSectionAssembler.js';
import { describe, expect, test } from '@jest/globals';

describe('GoalsSectionAssembler', () => {
  const noopLog = {
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
  const placeholderResolver = { resolve: (s) => s };
  const cfg = { prefix: '', suffix: '' };
  const assembler = new GoalsSectionAssembler({ logger: noopLog });

  test('empty or missing array → empty string', () => {
    expect(assembler.assemble(cfg, {}, placeholderResolver)).toBe('');
    expect(
      assembler.assemble(cfg, { goalsArray: [] }, placeholderResolver)
    ).toBe('');
  });

  test('single item', () => {
    const pd = {
      goalsArray: [{ text: 'Finish quest', timestamp: '2025-01-01T00:00:00Z' }],
    };
    const expected = '\nYour Goals:\n\n- Finish quest\n\n';
    expect(assembler.assemble(cfg, pd, placeholderResolver)).toBe(expected);
  });

  test('multiple items sort ascending', () => {
    const pd = {
      goalsArray: [
        { text: 'Third', timestamp: '2025-01-03' },
        { text: 'First', timestamp: '2025-01-01' },
        { text: 'Second', timestamp: '2025-01-02' },
      ],
    };
    const expected = '\nYour Goals:\n\n- First\n- Second\n- Third\n\n';
    expect(assembler.assemble(cfg, pd, placeholderResolver)).toBe(expected);
  });

  test('handles invalid timestamps gracefully', () => {
    const pd = {
      goalsArray: [
        { text: 'Valid', timestamp: '2025-01-01' },
        { text: 'Invalid', timestamp: 'not-a-date' },
      ],
    };
    const expected = '\nYour Goals:\n\n- Valid\n- Invalid\n\n';
    expect(assembler.assemble(cfg, pd, placeholderResolver)).toBe(expected);
  });
});
