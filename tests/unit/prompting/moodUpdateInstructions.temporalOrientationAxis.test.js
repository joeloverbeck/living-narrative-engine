// tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js
// -----------------------------------------------------------------------------
// Tests that verify the temporal_orientation mood axis is properly included in
// the LLM prompt instructions for mood updates.
// @see specs/temporal-orientation-axis.md
// @see TEMORIAXI-007
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

describe('moodUpdateOnlyInstructionText temporal_orientation axis', () => {
  test('should mention temporal_orientation axis in AXIS DEFINITIONS section', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/temporal.?orientation/i);
  });

  test('should define temporal_orientation with past/present/future semantics', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // The definition should include key semantic terms
    expect(instructionText).toMatch(/past-focused|past focused/i);
    expect(instructionText).toMatch(/future-focused|future focused/i);
    expect(instructionText).toMatch(/present-focused|present focused/i);
  });

  test('should include temporal_orientation in the OUTPUT FORMAT JSON example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // The JSON output format should include temporal_orientation
    expect(instructionText).toMatch(/"temporal_orientation":\s*\.\.\./);
  });

  test('should mention 11 mood axes in mood ranges documentation', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Should reference 11 axes including temporal_orientation
    expect(instructionText).toMatch(
      /valence.*arousal.*agency_control.*threat.*engagement.*future_expectancy.*temporal_orientation.*self_evaluation.*affiliation.*inhibitory_control.*uncertainty/i
    );
  });

  test('should include temporal_orientation in EVENT ARCHETYPES', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // The flow/present-moment archetype should reference temporal_orientation
    expect(instructionText).toMatch(/Flow.*present-moment/i);
    expect(instructionText).toMatch(/temporal_orientation/i);
  });

  test('should document distinction from future_expectancy', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // The distinction should be explicitly documented
    expect(instructionText).toMatch(
      /distinct from Future Expectancy|hope.*hopelessness.*not time direction/i
    );
  });

  test('should mention nostalgic as example of past-focused state', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    // Examples showing temporal_orientation usage
    expect(instructionText).toMatch(/nostalgia|nostalgic/i);
  });

  test('should mention flow state as present-focused example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/flow.*present|present.*flow/i);
  });

  test('should mention mindfulness as present-focused example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/mindfulness|grounding in present/i);
  });

  test('should mention planning as future-focused example', () => {
    const instructionText = corePromptText.moodUpdateOnlyInstructionText;
    expect(instructionText).toMatch(/planning.*future|anticipat/i);
  });
});

describe('mood component schema alignment for temporal_orientation', () => {
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

  test('mood component should define temporal_orientation axis', () => {
    const properties = moodComponentSchema.dataSchema.properties;
    expect(properties.temporal_orientation).toBeDefined();
  });

  test('temporal_orientation in mood component should have correct range (-100 to 100)', () => {
    const temporalOrientation =
      moodComponentSchema.dataSchema.properties.temporal_orientation;
    expect(temporalOrientation.minimum).toBe(-100);
    expect(temporalOrientation.maximum).toBe(100);
  });

  test('temporal_orientation should be in required axes list', () => {
    const required = moodComponentSchema.dataSchema.required;
    expect(required).toContain('temporal_orientation');
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

  test('temporal_orientation should have default value of 0', () => {
    const temporalOrientation =
      moodComponentSchema.dataSchema.properties.temporal_orientation;
    expect(temporalOrientation.default).toBe(0);
  });

  test('temporal_orientation description should explain mental time direction', () => {
    const temporalOrientation =
      moodComponentSchema.dataSchema.properties.temporal_orientation;
    expect(temporalOrientation.description).toMatch(/future-focused/i);
    expect(temporalOrientation.description).toMatch(/past-focused/i);
    expect(temporalOrientation.description).toMatch(/mental time direction/i);
  });
});
