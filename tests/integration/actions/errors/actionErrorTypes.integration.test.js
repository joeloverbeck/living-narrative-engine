import { describe, it, expect } from '@jest/globals';
import {
  ERROR_PHASES,
  FIX_TYPES,
  EVALUATION_STEP_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

/**
 * @description Helper to compare object keys without caring about order while
 * ensuring the exported enumerations remain complete and stable.
 * @param {Record<string, string>} actual - The enumeration exported by the module under test.
 * @param {Record<string, string>} expected - The expected enumeration shape and values.
 * @returns {void}
 */
function expectEnumToMatch(actual, expected) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  expect(actual).toEqual(expected);
}

describe('actionErrorTypes integration', () => {
  it('exposes all supported error phases used by the action pipeline', () => {
    expectEnumToMatch(ERROR_PHASES, {
      DISCOVERY: 'discovery',
      VALIDATION: 'validation',
      EXECUTION: 'execution',
      SCOPE_RESOLUTION: 'scope_resolution',
    });

    // Guard to ensure downstream systems can rely on the complete set.
    expect(Object.values(ERROR_PHASES)).toContain('validation');
    expect(new Set(Object.values(ERROR_PHASES)).size).toBe(4);
  });

  it('documents every fix type that downstream services can emit', () => {
    expectEnumToMatch(FIX_TYPES, {
      MISSING_COMPONENT: 'missing_component',
      INVALID_STATE: 'invalid_state',
      CONFIGURATION: 'configuration',
      MISSING_PREREQUISITE: 'missing_prerequisite',
      INVALID_TARGET: 'invalid_target',
      SCOPE_RESOLUTION: 'scope_resolution',
    });

    // Ensure each fix type has a human readable segment for UI surfacing.
    for (const value of Object.values(FIX_TYPES)) {
      expect(value).toMatch(/[a-z]+(_[a-z]+)*/);
    }
  });

  it('provides evaluation step types for trace visualization tooling', () => {
    expectEnumToMatch(EVALUATION_STEP_TYPES, {
      PREREQUISITE: 'prerequisite',
      SCOPE: 'scope',
      VALIDATION: 'validation',
      TARGET_RESOLUTION: 'target_resolution',
      CONDITION_REF: 'condition_ref',
      JSON_LOGIC: 'json_logic',
    });

    // Consumers render traces in the order provided; confirm stability.
    expect(Object.entries(EVALUATION_STEP_TYPES)).toEqual([
      ['PREREQUISITE', 'prerequisite'],
      ['SCOPE', 'scope'],
      ['VALIDATION', 'validation'],
      ['TARGET_RESOLUTION', 'target_resolution'],
      ['CONDITION_REF', 'condition_ref'],
      ['JSON_LOGIC', 'json_logic'],
    ]);
  });
});
