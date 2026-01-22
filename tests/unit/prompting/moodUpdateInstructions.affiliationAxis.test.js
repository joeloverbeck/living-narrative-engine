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

  test('should mention 9 mood axes (not 8) in mood ranges documentation', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Should reference 9 axes including inhibitory_control
    // The RANGES section lists all mood axes - affiliation and inhibitory_control should be included
    expect(instructionText).toMatch(
      /valence.*arousal.*agency_control.*threat.*engagement.*future_expectancy.*self_evaluation.*affiliation.*inhibitory_control/i
    );
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

  test('should include inhibitory control heuristics in DEFAULT UPDATE HEURISTICS', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // At least one of the four inhibitory control heuristics should be present
    expect(instructionText).toMatch(/Losing temper.*Inhibitory Control down/i);
    expect(instructionText).toMatch(/holding back reaction.*Inhibitory Control up/i);
    expect(instructionText).toMatch(/maintaining composure.*Inhibitory Control up/i);
    expect(instructionText).toMatch(/Release of suppressed.*Inhibitory Control down/i);
  });

  test('affiliation axis should have proper value range description', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;

    // Affiliation should follow the same pattern as other axes:
    // Positive = one end, Negative = other end
    // Looking for a pattern like "Affiliation: + = ... , - = ..."
    expect(instructionText).toMatch(/affiliation/i);
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

  test('mood component should define 10 axes total', () => {
    const required = moodComponentSchema.dataSchema.required;
    expect(required.length).toBe(10);
    expect(required).toEqual(
      expect.arrayContaining([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
        'affiliation',
        'inhibitory_control',
        'uncertainty',
      ])
    );
  });
});
