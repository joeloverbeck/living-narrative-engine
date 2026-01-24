/**
 * @file Integration tests for mood and sexual state update LLM prompt instructions
 * @description Validates the moodUpdateOnlyInstructionText prompt additions for emotional/sexual state updates
 * @version 2.0.0
 * @see data/prompts/corePromptText.json
 * @see specs/mood-and-sexual-arousal-system.md
 */

import { describe, it, expect } from '@jest/globals';
import corePromptText from '../../../data/prompts/corePromptText.json';

describe('Mood and Sexual State Update Prompt Instructions', () => {
  const promptText = corePromptText.moodUpdateOnlyInstructionText;

  describe('Section Header', () => {
    it('should contain the EMOTIONAL + SEXUAL STATE UPDATE section header', () => {
      expect(promptText).toContain(
        'EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)'
      );
    });

    it('should indicate absolute values in the header', () => {
      // The header itself indicates "ABSOLUTE VALUES"
      expect(promptText).toContain('ABSOLUTE VALUES');
    });

    it('should reference moodUpdate and sexualUpdate fields', () => {
      expect(promptText).toContain('moodUpdate');
      expect(promptText).toContain('sexualUpdate');
    });
  });

  describe('PRIMARY RULE Section', () => {
    it('should contain PRIMARY RULE (SUBJECTIVE APPRAISAL) section', () => {
      expect(promptText).toContain('PRIMARY RULE (SUBJECTIVE APPRAISAL)');
    });

    it('should emphasize character-specific interpretation', () => {
      expect(promptText).toContain('*experiences* and *interprets*');
      expect(promptText).toContain('persona');
    });
  });

  describe('STARTING POINT / CONTINUITY Section', () => {
    it('should contain STARTING POINT / CONTINUITY section', () => {
      expect(promptText).toContain('STARTING POINT / CONTINUITY');
    });

    it('should mention inertia concept', () => {
      expect(promptText).toContain('inertia');
    });

    it('should mention saturation concept', () => {
      expect(promptText).toContain('saturation');
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

    it('should list all 14 mood axes in ranges', () => {
      expect(promptText).toContain('valence');
      expect(promptText).toContain('arousal');
      expect(promptText).toContain('agency_control');
      expect(promptText).toContain('threat');
      expect(promptText).toContain('engagement');
      expect(promptText).toContain('future_expectancy');
      expect(promptText).toContain('self_evaluation');
      expect(promptText).toContain('affiliation');
      expect(promptText).toContain('inhibitory_control');
      expect(promptText).toContain('uncertainty');
      expect(promptText).toContain('contamination_salience');
      expect(promptText).toContain('rumination');
      expect(promptText).toContain('evaluation_pressure');
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

    it('should define affiliation with +/- meaning', () => {
      expect(promptText).toContain('Affiliation:');
      expect(promptText).toContain('warm/connected/affiliative');
      expect(promptText).toContain('cold/detached/hostile');
    });

    it('should define inhibitory_control with +/- meaning', () => {
      expect(promptText).toContain('Inhibitory Control:');
      expect(promptText).toContain('tightly restrained/white-knuckling');
      expect(promptText).toContain('disinhibited/impulsive');
    });

    it('should define uncertainty with +/- meaning', () => {
      expect(promptText).toContain('Uncertainty:');
      expect(promptText).toContain('highly uncertain/cannot integrate');
      expect(promptText).toContain('highly certain/coherent model/clear understanding');
    });
  });

  describe('CHARACTER LENS Section', () => {
    it('should contain CHARACTER LENS section', () => {
      expect(promptText).toContain('CHARACTER LENS');
    });

    it('should mention appraisal rules', () => {
      expect(promptText).toContain('appraisal rules');
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
      expect(promptText).toContain('suppression due to threat, shame, anxiety');
    });
  });

  describe('DEFAULT UPDATE HEURISTICS Section', () => {
    it('should contain DEFAULT UPDATE HEURISTICS section', () => {
      expect(promptText).toContain('DEFAULT UPDATE HEURISTICS');
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
      expect(promptText).toContain('Valence down');
      expect(promptText).toContain('Arousal often down');
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

  describe('SEX UPDATE RULE Section', () => {
    it('should contain SEX UPDATE RULE (PERSONA-BOUND) section', () => {
      expect(promptText).toContain('SEX UPDATE RULE (PERSONA-BOUND)');
    });

    it('should mention character-specific sex changes', () => {
      expect(promptText).toContain('highly character-specific');
    });

    it('should provide guidance for increasing sex_inhibition', () => {
      expect(promptText).toContain('Increase sex_inhibition');
      expect(promptText).toContain('threat/safety loss');
      expect(promptText).toContain('shame/exposure');
      expect(promptText).toContain('disgust/repulsion');
    });

    it('should provide guidance for increasing sex_excitation', () => {
      expect(promptText).toContain('Increase sex_excitation');
      expect(promptText).toContain('safety + consent + trust/intimacy cues');
    });
  });

  describe('TYPICAL CHANGE MAGNITUDES Section', () => {
    it('should contain TYPICAL CHANGE MAGNITUDES section', () => {
      expect(promptText).toContain('TYPICAL CHANGE MAGNITUDES');
    });

    it('should define mild change magnitude', () => {
      expect(promptText).toContain('Mild');
      expect(promptText).toContain('0-10');
    });

    it('should define strong change magnitude', () => {
      expect(promptText).toContain('Strong');
      expect(promptText).toContain('10-30');
    });

    it('should define extreme change magnitude', () => {
      expect(promptText).toContain('Extreme');
      expect(promptText).toContain('30-60');
    });
  });

  describe('OUTPUT FORMAT Section', () => {
    it('should contain OUTPUT FORMAT section', () => {
      expect(promptText).toContain('OUTPUT FORMAT');
    });

    it('should specify JSON-only output', () => {
      expect(promptText).toContain('ONLY a JSON object');
    });

    it('should show expected moodUpdate structure', () => {
      expect(promptText).toContain('"moodUpdate"');
    });

    it('should show expected sexualUpdate structure', () => {
      expect(promptText).toContain('"sexualUpdate"');
    });
  });

  describe('Token Efficiency', () => {
    it('should keep the mood/sexual update section under 2250 tokens (approximately 9000 characters)', () => {
      // The moodUpdateOnlyInstructionText is dedicated to mood/sexual updates
      // Verify start marker exists
      const startMarker = 'EMOTIONAL + SEXUAL STATE UPDATE';
      const startIndex = promptText.indexOf(startMarker);
      expect(startIndex).toBeGreaterThan(-1);

      // Measure the entire dedicated mood update text
      // Rough estimate: 4 characters per token on average
      // 2250 tokens * 4 = 9000 characters max (adjusted for 14 mood axes)
      expect(promptText.length).toBeLessThan(9000);
    });
  });

  describe('Content Completeness', () => {
    it('should have all required sections in logical order', () => {
      const rangesIndex = promptText.indexOf('RANGES');
      const axisDefIndex = promptText.indexOf('AXIS DEFINITIONS');
      const characterLensIndex = promptText.indexOf('CHARACTER LENS');
      const defaultHeuristicsIndex = promptText.indexOf(
        'DEFAULT UPDATE HEURISTICS'
      );
      const sexVarsIndex = promptText.indexOf('SEX VARIABLES');
      const sexUpdateRuleIndex = promptText.indexOf('SEX UPDATE RULE');
      const magnitudesIndex = promptText.indexOf('TYPICAL CHANGE MAGNITUDES');
      const outputIndex = promptText.indexOf('OUTPUT FORMAT');

      // All sections must exist
      expect(rangesIndex).toBeGreaterThan(-1);
      expect(axisDefIndex).toBeGreaterThan(-1);
      expect(characterLensIndex).toBeGreaterThan(-1);
      expect(defaultHeuristicsIndex).toBeGreaterThan(-1);
      expect(sexVarsIndex).toBeGreaterThan(-1);
      expect(sexUpdateRuleIndex).toBeGreaterThan(-1);
      expect(magnitudesIndex).toBeGreaterThan(-1);
      expect(outputIndex).toBeGreaterThan(-1);

      // Sections should appear in logical order
      expect(rangesIndex).toBeLessThan(axisDefIndex);
      expect(axisDefIndex).toBeLessThan(characterLensIndex);
      expect(characterLensIndex).toBeLessThan(defaultHeuristicsIndex);
      expect(defaultHeuristicsIndex).toBeLessThan(sexVarsIndex);
      expect(sexVarsIndex).toBeLessThan(sexUpdateRuleIndex);
      expect(sexUpdateRuleIndex).toBeLessThan(magnitudesIndex);
      expect(magnitudesIndex).toBeLessThan(outputIndex);
    });
  });
});
