import { beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const corePromptTextPath = path.resolve(
  process.cwd(),
  'data/prompts/corePromptText.json'
);

describe('corePromptText cognitive ledger instructions', () => {
  let finalLlmInstructionText;

  beforeAll(() => {
    const jsonContent = fs.readFileSync(corePromptTextPath, 'utf-8');
    const corePromptText = JSON.parse(jsonContent);
    finalLlmInstructionText = corePromptText.finalLlmInstructionText;
  });

  test('includes cognitive ledger update rules header', () => {
    expect(finalLlmInstructionText).toContain(
      'COGNITIVE LEDGER UPDATE RULES (CRITICAL):'
    );
  });

  test('requires cognitive_ledger with settled_conclusions and open_questions', () => {
    expect(finalLlmInstructionText).toContain(
      'cognitive_ledger with settled_conclusions and open_questions arrays'
    );
  });

  test('includes ledger update rule section', () => {
    expect(finalLlmInstructionText).toContain('Ledger Update Rule (HARD):');
  });

  test('includes open to settled constraint', () => {
    expect(finalLlmInstructionText).toContain(
      'OPEN → SETTLED only if new evidence appeared in the perception log this turn'
    );
  });

  test('includes settled to open constraint', () => {
    expect(finalLlmInstructionText).toContain(
      'SETTLED → OPEN only if new conflicting evidence appeared this turn'
    );
  });

  test('caps ledger arrays at three items', () => {
    expect(finalLlmInstructionText).toContain('Maximum 3 items per array.');
  });

  test('includes confusion target rule', () => {
    expect(finalLlmInstructionText).toContain('CONFUSION TARGET RULE');
  });

  test('confusion target rule limits to open questions', () => {
    expect(finalLlmInstructionText).toContain(
      'Confusion must attach to open questions only'
    );
  });

  test('cognitive ledger rules appear before CRITICAL DISTINCTION', () => {
    const ledgerIndex = finalLlmInstructionText.indexOf(
      'COGNITIVE LEDGER UPDATE RULES (CRITICAL):'
    );
    const distinctionIndex = finalLlmInstructionText.indexOf(
      'CRITICAL DISTINCTION - THOUGHTS vs SPEECH:'
    );

    expect(ledgerIndex).toBeGreaterThan(-1);
    expect(distinctionIndex).toBeGreaterThan(-1);
    expect(ledgerIndex).toBeLessThan(distinctionIndex);
  });

  test('confusion target rule appears inside inner_state_integration', () => {
    const integrationStart = finalLlmInstructionText.indexOf(
      '<inner_state_integration>'
    );
    const integrationEnd = finalLlmInstructionText.indexOf(
      '</inner_state_integration>'
    );
    const confusionIndex = finalLlmInstructionText.indexOf(
      'CONFUSION TARGET RULE'
    );

    expect(integrationStart).toBeGreaterThan(-1);
    expect(integrationEnd).toBeGreaterThan(-1);
    expect(confusionIndex).toBeGreaterThan(integrationStart);
    expect(confusionIndex).toBeLessThan(integrationEnd);
  });
});
