/**
 * @file Tests for PromptDataFormatter cognitive ledger section
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

const buildCognitiveLedgerSection = (settledList, openList) => `<cognitive_ledger>
SETTLED CONCLUSIONS (treat as already integrated; do not re-argue unless NEW evidence appears):
${settledList}

OPEN QUESTIONS (allowed to think about now):
${openList}

NO RE-DERIVATION RULE (HARD):
- THOUGHTS may reference a settled conclusion only as a short tag.
- If you feel compelled to re-derive a settled point, convert that impulse into an in-character loop-break and move on.
</cognitive_ledger>`;

describe('PromptDataFormatter - Cognitive Ledger Section', () => {
  let formatter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    formatter = new PromptDataFormatter({ logger: mockLogger });
  });

  test('returns empty string when cognitiveLedger is null', () => {
    expect(formatter.formatCognitiveLedgerSection(null)).toBe('');
  });

  test('returns empty string when cognitiveLedger is undefined', () => {
    expect(formatter.formatCognitiveLedgerSection(undefined)).toBe('');
  });

  test('returns XML with placeholders when both arrays are empty', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: [],
      open_questions: [],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection('- [None yet]', '- [None yet]')
    );
  });

  test('returns XML with populated settled_conclusions list', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['We are safe', 'The door is locked'],
      open_questions: [],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection(
        '- We are safe\n- The door is locked',
        '- [None yet]'
      )
    );
  });

  test('returns XML with populated open_questions list', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: [],
      open_questions: ['Where did the key go?', 'Who was there?'],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection(
        '- [None yet]',
        '- Where did the key go?\n- Who was there?'
      )
    );
  });

  test('returns XML with both arrays populated', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['I promised to help'],
      open_questions: ['How to get inside?'],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection(
        '- I promised to help',
        '- How to get inside?'
      )
    );
  });

  test('handles missing settled_conclusions property', () => {
    const result = formatter.formatCognitiveLedgerSection({
      open_questions: ['What next?'],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection('- [None yet]', '- What next?')
    );
  });

  test('handles missing open_questions property', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['We have the map'],
    });

    expect(result).toBe(
      buildCognitiveLedgerSection('- We have the map', '- [None yet]')
    );
  });

  test('output contains cognitive_ledger tags', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['One'],
      open_questions: ['Two'],
    });

    expect(result).toContain('<cognitive_ledger>');
    expect(result).toContain('</cognitive_ledger>');
  });

  test('output contains NO RE-DERIVATION RULE section', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['One'],
      open_questions: ['Two'],
    });

    expect(result).toContain('NO RE-DERIVATION RULE (HARD):');
  });

  test('each list item is prefixed with a dash and space', () => {
    const result = formatter.formatCognitiveLedgerSection({
      settled_conclusions: ['Alpha', 'Beta'],
      open_questions: ['Gamma'],
    });
    const lines = result.split('\n');

    expect(lines).toContain('- Alpha');
    expect(lines).toContain('- Beta');
    expect(lines).toContain('- Gamma');
  });
});
