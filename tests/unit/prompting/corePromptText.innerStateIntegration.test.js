/**
 * @file Tests for Inner State Integration content in corePromptText.json
 * Verifies that the new Inner State Integration protocol is present
 * and that old Inner State Expression content has been removed.
 */

import { beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const corePromptTextPath = path.resolve(
  process.cwd(),
  'data/prompts/corePromptText.json'
);

describe('Inner State Integration Content Verification', () => {
  let corePromptText;

  beforeAll(() => {
    const jsonContent = fs.readFileSync(corePromptTextPath, 'utf-8');
    corePromptText = JSON.parse(jsonContent);
  });

  describe('New Content Presence', () => {
    test('should contain INNER STATE INTEGRATION header instead of INNER STATE EXPRESSION', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'INNER STATE EXPRESSION (CRITICAL)'
      );
    });

    test('should contain inner_state_integration XML wrapper', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        '<inner_state_integration>'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        '</inner_state_integration>'
      );
    });

    test('should contain STATE INTEGRATION PROTOCOL section', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'STATE INTEGRATION PROTOCOL (do this BEFORE writing; do not print this protocol):'
      );
    });

    test('should contain Primary/Secondary/Modifier driver instructions', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Primary: strongest intensity emotion (dominates)'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Secondary: second-strongest (shapes tone)'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Modifier: one additional listed emotion OR sexual_state effect'
      );
    });

    test('should contain PER-FIELD STATE SIGNAL MINIMUMS section', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'PER-FIELD STATE SIGNAL MINIMUMS (must satisfy all):'
      );
    });

    test('should contain thoughts field requirement with concrete effect mandate', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'thoughts: MUST clearly reflect Primary + Secondary AND at least one concrete effect'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'No generic "I\'m sad" narration'
      );
    });

    test('should contain action field requirement with contradiction justification rule', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'action: MUST be plausible under Primary emotion'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'MUST justify the contradiction inside thoughts as resistance/denial/refusal'
      );
    });

    test('should contain speech field requirement with rhythm and word choice mandate', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'speech: If non-empty, it MUST be colored by Primary/Secondary (rhythm + word choice)'
      );
    });

    test('should contain notes field requirement preserving facts-only rule', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'notes: Still facts-only, but state can affect which facts are prioritized'
      );
    });

    test('should contain SEXUAL STATE RULE section', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'SEXUAL STATE RULE (applies even if no sexual content is present):'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'High repulsion/inhibition should suppress flirtation/intimacy'
      );
    });

    test('should contain CONFLICT RULE for persona vs state', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'CONFLICT RULE (persona vs state):'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'show that as deflection (brittle humor, contempt, procedural thinking, silence, refusal)'
      );
    });

    test('should contain the fail condition statement', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Fail condition: any turn where thoughts/action/speech could be swapped to a different inner_state with minimal edits'
      );
    });
  });

  describe('Old Content Removal', () => {
    test('should NOT contain old SPEECH COLORING section with intensity patterns', () => {
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'Match emotional intensity to speech patterns:'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'High arousal emotions (anger, excitement, fear): Urgent, clipped, energetic speech'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'Low arousal emotions (sadness, melancholy): Slower, quieter, more hesitant speech'
      );
    });

    test('should NOT contain old THOUGHTS COLORING examples', () => {
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'Your internal monologue must REFLECT the listed emotions'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'If feeling "fear: strong", thoughts should show anxiety, worry, threat assessment'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'If feeling "curiosity: noticeable", thoughts should show interest, questions, investigation'
      );
      expect(corePromptText.finalLlmInstructionText).not.toContain(
        'Sexual states affect WHAT you notice (who you look at, what details you observe)'
      );
    });
  });

  describe('Thoughts Coloring Section', () => {
    test('should contain the new simplified THOUGHTS COLORING section', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'THOUGHTS COLORING:'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.'
      );
    });
  });

  describe('Backward Compatibility - Adjacent Sections Unchanged', () => {
    test('should maintain SPEECH CONTENT RULE section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'SPEECH CONTENT RULE (CRITICAL):'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Do NOT recap or summarize prior dialogue'
      );
    });

    test('should maintain ACTION SELECTION section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'ACTION SELECTION:'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Let emotions guide which action "feels right" in character'
      );
    });

    test('should maintain INTENSITY SCALING section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'INTENSITY SCALING (use emotional intensity labels as guides):'
      );
    });

    test('should maintain ACTION VARIETY GUIDANCE section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'ACTION VARIETY GUIDANCE:'
      );
    });

    test('should maintain NOTES RULES section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain('NOTES RULES');
      expect(corePromptText.finalLlmInstructionText).toContain(
        'Only record brand-new, critical facts'
      );
    });

    test('should maintain NOTE SUBJECT TYPES section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'NOTE SUBJECT TYPES (Select ONE per note):'
      );
      expect(corePromptText.finalLlmInstructionText).toContain('1. entity');
      expect(corePromptText.finalLlmInstructionText).toContain('2. event');
      expect(corePromptText.finalLlmInstructionText).toContain('3. plan');
      expect(corePromptText.finalLlmInstructionText).toContain('4. knowledge');
      expect(corePromptText.finalLlmInstructionText).toContain('5. state');
      expect(corePromptText.finalLlmInstructionText).toContain('6. other');
    });

    test('should maintain CRITICAL DISTINCTION section unchanged', () => {
      expect(corePromptText.finalLlmInstructionText).toContain(
        'CRITICAL DISTINCTION - THOUGHTS vs SPEECH:'
      );
      expect(corePromptText.finalLlmInstructionText).toContain(
        "MANDATORY RULE: The 'thoughts' and 'speech' fields MUST contain meaningfully different content"
      );
    });
  });
});
