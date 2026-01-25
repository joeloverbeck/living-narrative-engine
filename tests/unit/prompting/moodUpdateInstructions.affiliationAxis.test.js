// tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js
// -----------------------------------------------------------------------------
// Tests that verify the affiliation mood axis is properly included in the
// LLM prompt instructions for mood updates.
// -----------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Load the prompt text configuration
// -----------------------------------------------------------------------------

let corePromptText;

beforeAll(() => {
  const corePromptTextPath = path.resolve(
    process.cwd(),
    'data/prompts/corePromptText.json'
  );
  corePromptText = JSON.parse(fs.readFileSync(corePromptTextPath, 'utf-8'));
});

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('moodUpdateOnlyInstructionText affiliation axis', () => {
  test('should mention affiliation axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The instruction text should define the affiliation axis
    expect(instructionText).toMatch(/affiliation/i);
  });

  test('should define affiliation with warmth/connectedness semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The definition should include key semantic terms
    expect(instructionText).toMatch(/affiliation.*warm|warm.*affiliation/i);
    expect(instructionText).toMatch(
      /affiliation.*cold|cold.*affiliation|detached/i
    );
  });

  test('should include affiliation in the OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The JSON output format should include affiliation
    // Looking for pattern like "affiliation": ... in the JSON example
    expect(instructionText).toMatch(/"affiliation":\s*\.\.\./);
  });

  test('should mention 11 mood axes in mood ranges documentation', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Should reference 11 axes including temporal_orientation, inhibitory_control and uncertainty
    // The RANGES section lists all mood axes
    expect(instructionText).toMatch(
      /valence.*arousal.*agency_control.*threat.*engagement.*future_expectancy.*temporal_orientation.*self_evaluation.*affiliation.*inhibitory_control.*uncertainty/i
    );
  });

  test('should mention uncertainty axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The instruction text should define the uncertainty axis
    expect(instructionText).toMatch(/uncertainty/i);
  });

  test('should define uncertainty with certain/uncertain semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The definition should include key semantic terms
    expect(instructionText).toMatch(/uncertain|cannot integrate/i);
    expect(instructionText).toMatch(/certain|coherent model/i);
  });

  test('should include uncertainty in the OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The JSON output format should include uncertainty
    expect(instructionText).toMatch(/"uncertainty":\s*\.\.\./);
  });

  test('should include uncertainty in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Uncertainty is covered in the Ambiguity archetype
    expect(instructionText).toMatch(/EVENT ARCHETYPES/);
    expect(instructionText).toMatch(/Ambiguity.*cognitive mismatch/i);
    expect(instructionText).toMatch(/primary:.*uncertainty up/i);
  });

  test('should define inhibitory_control axis with restraint/impulsive semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The definition should include key semantic terms for inhibitory control
    expect(instructionText).toMatch(/Inhibitory Control/i);
    expect(instructionText).toMatch(/restrained|white-knuckling/i);
    expect(instructionText).toMatch(/disinhibited|impulsive/i);
  });

  test('should include inhibitory_control in OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The JSON output format should include inhibitory_control
    expect(instructionText).toMatch(/"inhibitory_control":\s*\.\.\./);
  });

  test('should include inhibitory control in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Inhibitory control appears as common secondary effect in various archetypes
    expect(instructionText).toMatch(/inhibitory_control up.*containing reaction/i);
    expect(instructionText).toMatch(/inhibitory_control.*toward 0/i);
  });

  test('affiliation axis should have proper value range description', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Affiliation should follow the same pattern as other axes:
    // Positive = one end, Negative = other end
    // Looking for a pattern like "Affiliation: + = ... , - = ..."
    expect(instructionText).toMatch(/affiliation/i);
  });
});

describe('moodUpdateOnlyInstructionText contamination_salience axis', () => {
  test('should define contamination_salience axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Contamination Salience/i);
  });

  test('should define contamination_salience with disgust/purity semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/contaminated|revolting|repulsive/i);
    expect(instructionText).toMatch(/pure|clean|uncontaminated/i);
  });

  test('should include contamination_salience in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Disgust / contamination cue archetype covers this
    expect(instructionText).toMatch(/Disgust.*contamination cue/i);
    expect(instructionText).toMatch(/primary:.*contamination_salience up/i);
  });

  test('should include contamination_salience in OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/"contamination_salience":\s*\.\.\./);
  });
});

describe('moodUpdateOnlyInstructionText rumination axis', () => {
  test('should define rumination axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Rumination/i);
  });

  test('should define rumination with perseverating/flexible semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/perseverating|repetitive replay/i);
    expect(instructionText).toMatch(/mentally flexible|easy disengagement/i);
  });

  test('should include rumination in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Rumination appears in loss/grief archetype and flow archetype
    expect(instructionText).toMatch(/Loss.*grief/i);
    expect(instructionText).toMatch(/common:.*rumination up/i);
    // Flow archetype decreases rumination
    expect(instructionText).toMatch(/Flow.*present-moment/i);
    expect(instructionText).toMatch(/rumination down/i);
  });

  test('should include rumination in OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/"rumination":\s*\.\.\./);
  });
});

describe('moodUpdateOnlyInstructionText evaluation_pressure axis', () => {
  test('should define evaluation_pressure axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Evaluation Pressure/i);
  });

  test('should define evaluation_pressure with scrutiny/judgment semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/intensely scrutinized|being judged/i);
    expect(instructionText).toMatch(/not scrutinized|unobserved/i);
  });

  test('should include evaluation_pressure in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Social-evaluative exposure archetype covers this
    expect(instructionText).toMatch(/Social-evaluative exposure.*judged.*watched/i);
    expect(instructionText).toMatch(/primary:.*evaluation_pressure up/i);
    // Warm connection decreases it
    expect(instructionText).toMatch(/common:.*evaluation_pressure down/i);
  });

  test('should include evaluation_pressure in OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/"evaluation_pressure":\s*\.\.\./);
  });
});

describe('moodUpdateOnlyInstructionText newline formatting', () => {
  test('should use actual newlines, not escaped backslash-n in AXIS DEFINITIONS', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // The parsed JSON should have actual newlines, not literal "\n" text
    // If literal "\n" appears, it means double-escaped \\n was in the JSON
    expect(instructionText).not.toContain('\\nContamination Salience');
    expect(instructionText).not.toContain('\\nRumination');
    expect(instructionText).not.toContain('\\nEvaluation Pressure');
  });

  test('should use actual newlines, not escaped backslash-n in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Check archetypes section doesn't have literal "\n" text
    expect(instructionText).not.toContain('\\n# Acute threat');
    expect(instructionText).not.toContain('\\n# Loss');
    expect(instructionText).not.toContain('\\n# Flow');
  });

  test('AXIS DEFINITIONS should have Contamination Salience on its own line', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // When parsed correctly, the axis definition should start on a new line
    // after the previous axis definition
    expect(instructionText).toMatch(
      /Uncertainty:.*\n+Contamination Salience:/
    );
  });

  test('AXIS DEFINITIONS should have Rumination on its own line', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    expect(instructionText).toMatch(
      /Contamination Salience:.*\n+Rumination:/
    );
  });

  test('AXIS DEFINITIONS should have Evaluation Pressure on its own line', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    expect(instructionText).toMatch(/Rumination:.*\n+Evaluation Pressure:/);
  });

  test('EVENT ARCHETYPES should have each archetype on its own section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Each archetype should be separated by newlines
    expect(instructionText).toMatch(/# Acute threat.*\n+primary:/);
    expect(instructionText).toMatch(/# Competence win.*\n+primary:/);
    expect(instructionText).toMatch(/# Loss.*grief.*\n+primary:/);
  });

  test('EVENT ARCHETYPES should have primary and common on separate lines', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Primary and common should be on separate lines within each archetype
    expect(instructionText).toMatch(/primary:.*\n+common:/);
  });

  test('BLENDING RULE section should exist between CHARACTER LENS and EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    const characterLensIndex = instructionText.indexOf('CHARACTER LENS');
    const blendingRuleIndex = instructionText.indexOf('BLENDING RULE');
    const eventArchetypesIndex = instructionText.indexOf('EVENT ARCHETYPES');

    expect(blendingRuleIndex).toBeGreaterThan(characterLensIndex);
    expect(blendingRuleIndex).toBeLessThan(eventArchetypesIndex);
  });
});

describe('mood component schema alignment', () => {
  let moodComponentSchema;

  beforeAll(() => {
    const moodComponentPath = path.resolve(
      process.cwd(),
      'data/mods/core/components/mood.component.json'
    );
    moodComponentSchema = JSON.parse(
      fs.readFileSync(moodComponentPath, 'utf-8')
    );
  });

  test('mood component should define affiliation axis', () => {
    const properties = moodComponentSchema.dataSchema.properties;
    expect(properties.affiliation).toBeDefined();
  });

  test('affiliation in mood component should have correct range (-100 to 100)', () => {
    const affiliation = moodComponentSchema.dataSchema.properties.affiliation;
    expect(affiliation.minimum).toBe(-100);
    expect(affiliation.maximum).toBe(100);
  });

  test('affiliation should be in required axes list', () => {
    const required = moodComponentSchema.dataSchema.required;
    expect(required).toContain('affiliation');
  });

  test('mood component should define 14 axes total', () => {
    const required = moodComponentSchema.dataSchema.required;
    expect(required.length).toBe(14);
    expect(required).toEqual(
      expect.arrayContaining([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'temporal_orientation',
        'self_evaluation',
        'affiliation',
        'inhibitory_control',
        'uncertainty',
        'contamination_salience',
        'rumination',
        'evaluation_pressure',
      ])
    );
  });
});

describe('moodUpdateOnlyInstructionText archetype system', () => {
  test('should contain EVENT ARCHETYPES section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/EVENT ARCHETYPES/);
  });

  test('should have acute threat archetype with primary and common', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Acute threat.*attack/i);
    expect(instructionText).toMatch(/primary:.*threat.*arousal.*valence/i);
    expect(instructionText).toMatch(/common:.*agency_control/i);
  });

  test('should have all 9 event archetypes', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/# Acute threat/);
    expect(instructionText).toMatch(/# Competence win/);
    expect(instructionText).toMatch(/# Loss.*grief/);
    expect(instructionText).toMatch(/# Social-evaluative exposure/);
    expect(instructionText).toMatch(/# Disgust.*contamination/);
    expect(instructionText).toMatch(/# Ambiguity.*cognitive mismatch/);
    expect(instructionText).toMatch(/# Flow.*present-moment/);
    expect(instructionText).toMatch(/# Warm connection.*acceptance/);
    expect(instructionText).toMatch(/# Rejection.*betrayal/);
  });

  test('should NOT contain old granular heuristics format', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Old format was "Being attacked/threatened: Threat up"
    expect(instructionText).not.toMatch(
      /Being attacked\/threatened: Threat up/
    );
    expect(instructionText).not.toMatch(/DEFAULT UPDATE HEURISTICS/);
  });

  test('should include fallback instruction when no archetype fits', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(
      /When no archetype fits.*derive axis effects from persona/i
    );
  });
});

describe('moodUpdateOnlyInstructionText affect_traits reference', () => {
  test('CHARACTER LENS should reference affect_traits', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/affect_traits/);
  });

  test('should mention ruminative_tendency trait', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/ruminative_tendency/);
  });

  test('should mention disgust_sensitivity trait', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/disgust_sensitivity/);
  });

  test('should mention evaluation_sensitivity trait', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/evaluation_sensitivity/);
  });

  test('should mention self_control trait', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/self_control/);
  });

  test('should explain high/low trait value thresholds', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/High values.*>70/);
    expect(instructionText).toMatch(/low values.*<30/);
  });
});

describe('moodUpdateOnlyInstructionText blending rule', () => {
  test('should contain BLENDING RULE section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/BLENDING RULE/);
  });

  test('should provide primary/secondary magnitude guidance', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Primary trigger.*full magnitude/i);
    expect(instructionText).toMatch(/Secondary.*40-60%/i);
  });

  test('should provide guidance for conflicting direction', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(
      /opposite directions.*persona determines winner/i
    );
  });

  test('should provide guidance for same direction effects', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/Same-direction.*stronger magnitude.*NOT sum/i);
  });
});
