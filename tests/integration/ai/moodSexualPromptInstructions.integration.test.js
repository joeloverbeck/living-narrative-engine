/**
 * @file Integration tests for mood and sexual state update LLM prompt instructions
 * @description Validates the MOOANDSEXAROSYS-008 prompt additions for emotional/sexual state updates
 * @version 1.0.0
 * @see data/prompts/corePromptText.json
 * @see specs/mood-and-sexual-arousal-system.md
 */

import { describe, it, expect } from '@jest/globals';
import corePromptText from '../../../data/prompts/corePromptText.json';

describe('Mood and Sexual State Update Prompt Instructions', () => {
  const promptText = corePromptText.finalLlmInstructionText;

  describe('Section Header', () => {
    it('should contain the EMOTIONAL + SEXUAL STATE UPDATE section header', () => {
      expect(promptText).toContain(
        'EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)'
      );
    });

    it('should indicate absolute values not deltas', () => {
      expect(promptText).toContain(
        'Output the new absolute numeric values (not deltas)'
      );
    });

    it('should reference moodUpdate and sexualUpdate fields', () => {
      expect(promptText).toContain('moodUpdate');
      expect(promptText).toContain('sexualUpdate');
    });
  });

  describe('RANGES Section', () => {
    it('should contain RANGES section', () => {
      expect(promptText).toContain('RANGES');
    });

    it('should define mood axes range as [-100..100]', () => {
      expect(promptText).toContain('integers [-100..100]');
    });

    it('should define sex variables range as [0..100]', () => {
      expect(promptText).toContain('integers [0..100]');
    });

    it('should list all 7 mood axes in ranges', () => {
      expect(promptText).toContain('valence');
      expect(promptText).toContain('arousal');
      expect(promptText).toContain('agency_control');
      expect(promptText).toContain('threat');
      expect(promptText).toContain('engagement');
      expect(promptText).toContain('future_expectancy');
      expect(promptText).toContain('self_evaluation');
    });

    it('should list both sex variables in ranges', () => {
      expect(promptText).toContain('sex_excitation');
      expect(promptText).toContain('sex_inhibition');
    });
  });

  describe('AXIS DEFINITIONS Section', () => {
    it('should contain AXIS DEFINITIONS section', () => {
      expect(promptText).toContain('AXIS DEFINITIONS');
    });

    it('should define valence with +/- meaning', () => {
      expect(promptText).toContain('Valence:');
      expect(promptText).toContain('pleasant/rewarding');
      expect(promptText).toContain('unpleasant/aversive');
    });

    it('should define arousal with +/- meaning', () => {
      expect(promptText).toContain('Arousal:');
      expect(promptText).toContain('energized/amped');
      expect(promptText).toContain('depleted/slowed');
    });

    it('should define agency_control with +/- meaning', () => {
      expect(promptText).toContain('Agency/Control:');
      expect(promptText).toContain('in control/assertive');
      expect(promptText).toContain('helpless/powerless');
    });

    it('should define threat with +/- meaning', () => {
      expect(promptText).toContain('Threat:');
      expect(promptText).toContain('endangered/alarmed');
      expect(promptText).toContain('safe/relaxed');
    });

    it('should define engagement with +/- meaning', () => {
      expect(promptText).toContain('Engagement:');
      expect(promptText).toContain('absorbed/attentive');
      expect(promptText).toContain('indifferent/checked out');
    });

    it('should define future_expectancy with +/- meaning', () => {
      expect(promptText).toContain('Future Expectancy:');
      expect(promptText).toContain('hopeful/path forward');
      expect(promptText).toContain('hopeless/future closed');
    });

    it('should define self_evaluation with +/- meaning', () => {
      expect(promptText).toContain('Self-evaluation:');
      expect(promptText).toContain('pride/dignity');
      expect(promptText).toContain('shame/defect/exposed');
    });
  });

  describe('SEX VARIABLES Section', () => {
    it('should contain SEX VARIABLES section', () => {
      expect(promptText).toContain('SEX VARIABLES');
    });

    it('should define sex_excitation as accelerator', () => {
      expect(promptText).toContain('sex_excitation (accelerator)');
      expect(promptText).toContain('sexual interest/readiness');
    });

    it('should define sex_inhibition as brake', () => {
      expect(promptText).toContain('sex_inhibition (brake)');
      expect(promptText).toContain(
        'suppressed by danger, shame, anxiety'
      );
    });
  });

  describe('UPDATE HEURISTICS Section', () => {
    it('should contain UPDATE HEURISTICS section', () => {
      expect(promptText).toContain('UPDATE HEURISTICS');
    });

    it('should provide heuristic for being attacked/threatened', () => {
      expect(promptText).toContain('Being attacked/threatened');
      expect(promptText).toContain('Threat up, Arousal up, Valence down');
    });

    it('should provide heuristic for succeeding/gaining leverage', () => {
      expect(promptText).toContain('Succeeding/gaining leverage');
      expect(promptText).toContain('Agency/Control up, Valence up, Threat down');
    });

    it('should provide heuristic for loss/grief', () => {
      expect(promptText).toContain('Loss/grief');
      expect(promptText).toContain('Valence down, Arousal often down');
    });

    it('should provide heuristic for public humiliation', () => {
      expect(promptText).toContain('Public humiliation');
      expect(promptText).toContain('Self-evaluation down, Valence down, Threat up');
    });

    it('should provide heuristic for boredom/waiting', () => {
      expect(promptText).toContain('Boredom/waiting');
      expect(promptText).toContain('Engagement down, Arousal down');
    });
  });

  describe('SEX UPDATE HEURISTICS Section', () => {
    it('should contain SEX UPDATE HEURISTICS section', () => {
      expect(promptText).toContain('SEX UPDATE HEURISTICS');
    });

    it('should provide heuristic for increasing sex_inhibition', () => {
      expect(promptText).toContain('Increase sex_inhibition');
      expect(promptText).toContain('high Threat');
      expect(promptText).toContain('negative Self-evaluation');
      expect(promptText).toContain('disgust/distress');
    });

    it('should provide heuristic for decreasing sex_inhibition', () => {
      expect(promptText).toContain('Decrease sex_inhibition');
      expect(promptText).toContain('low Threat');
      expect(promptText).toContain('improved Self-evaluation');
      expect(promptText).toContain('calm trust');
    });

    it('should provide heuristic for increasing sex_excitation', () => {
      expect(promptText).toContain('Increase sex_excitation');
      expect(promptText).toContain('attraction/intimacy cues');
      expect(promptText).toContain('positive Valence');
      expect(promptText).toContain('high Engagement');
    });

    it('should provide heuristic for decreasing sex_excitation', () => {
      expect(promptText).toContain('Decrease sex_excitation');
      expect(promptText).toContain('danger');
      expect(promptText).toContain('disgust');
      expect(promptText).toContain('shame');
      expect(promptText).toContain('exhaustion');
    });
  });

  describe('TYPICAL CHANGE MAGNITUDES Section', () => {
    it('should contain TYPICAL CHANGE MAGNITUDES section', () => {
      expect(promptText).toContain('TYPICAL CHANGE MAGNITUDES');
    });

    it('should define mild event magnitude', () => {
      expect(promptText).toContain('Mild event: 5-15 points');
    });

    it('should define strong event magnitude', () => {
      expect(promptText).toContain('Strong event: 15-35 points');
    });

    it('should define extreme event magnitude', () => {
      expect(promptText).toContain('Extreme event: 35-60 points');
    });
  });

  describe('Token Efficiency', () => {
    it('should keep the mood/sexual update section under 800 tokens (approximately 3200 characters)', () => {
      // Extract just the mood/sexual update section
      const startMarker = 'EMOTIONAL + SEXUAL STATE UPDATE';
      const endMarker = 'Now, based on all the information provided';

      const startIndex = promptText.indexOf(startMarker);
      const endIndex = promptText.indexOf(endMarker);

      expect(startIndex).toBeGreaterThan(-1);
      expect(endIndex).toBeGreaterThan(startIndex);

      const moodSexualSection = promptText.substring(startIndex, endIndex);

      // Rough estimate: 4 characters per token on average
      // 800 tokens * 4 = 3200 characters max
      expect(moodSexualSection.length).toBeLessThan(3200);
    });
  });

  describe('Content Completeness', () => {
    it('should have all required sections in logical order', () => {
      const rangesIndex = promptText.indexOf('RANGES');
      const axisDefIndex = promptText.indexOf('AXIS DEFINITIONS');
      const sexVarsIndex = promptText.indexOf('SEX VARIABLES');
      const updateHeuristicsIndex = promptText.indexOf('UPDATE HEURISTICS');
      const sexHeuristicsIndex = promptText.indexOf('SEX UPDATE HEURISTICS');
      const magnitudesIndex = promptText.indexOf('TYPICAL CHANGE MAGNITUDES');

      // All sections must exist
      expect(rangesIndex).toBeGreaterThan(-1);
      expect(axisDefIndex).toBeGreaterThan(-1);
      expect(sexVarsIndex).toBeGreaterThan(-1);
      expect(updateHeuristicsIndex).toBeGreaterThan(-1);
      expect(sexHeuristicsIndex).toBeGreaterThan(-1);
      expect(magnitudesIndex).toBeGreaterThan(-1);

      // Sections should appear in logical order
      expect(rangesIndex).toBeLessThan(axisDefIndex);
      expect(axisDefIndex).toBeLessThan(sexVarsIndex);
      expect(sexVarsIndex).toBeLessThan(updateHeuristicsIndex);
      expect(updateHeuristicsIndex).toBeLessThan(sexHeuristicsIndex);
      expect(sexHeuristicsIndex).toBeLessThan(magnitudesIndex);
    });
  });
});
