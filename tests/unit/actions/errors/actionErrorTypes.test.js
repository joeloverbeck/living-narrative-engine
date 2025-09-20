/**
 * @file Unit tests for action error type enumerations.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ERROR_PHASES,
  FIX_TYPES,
  EVALUATION_STEP_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';

describe('actionErrorTypes', () => {
  it('should enumerate all error phases with canonical identifiers', () => {
    expect(ERROR_PHASES).toEqual({
      DISCOVERY: 'discovery',
      VALIDATION: 'validation',
      EXECUTION: 'execution',
      SCOPE_RESOLUTION: 'scope_resolution',
    });

    const phaseValues = Object.values(ERROR_PHASES);
    expect(new Set(phaseValues).size).toBe(phaseValues.length);
  });

  it('should provide fix type categories used by downstream services', () => {
    expect(FIX_TYPES).toEqual({
      MISSING_COMPONENT: 'missing_component',
      INVALID_STATE: 'invalid_state',
      CONFIGURATION: 'configuration',
      MISSING_PREREQUISITE: 'missing_prerequisite',
      INVALID_TARGET: 'invalid_target',
      SCOPE_RESOLUTION: 'scope_resolution',
    });

    for (const value of Object.values(FIX_TYPES)) {
      expect(value).toMatch(/^[a-z_]+$/);
    }
  });

  it('should declare evaluation step identifiers for tracing integrations', () => {
    expect(EVALUATION_STEP_TYPES).toEqual({
      PREREQUISITE: 'prerequisite',
      SCOPE: 'scope',
      VALIDATION: 'validation',
      TARGET_RESOLUTION: 'target_resolution',
      CONDITION_REF: 'condition_ref',
      JSON_LOGIC: 'json_logic',
    });

    const stepValues = Object.values(EVALUATION_STEP_TYPES);
    expect(stepValues.sort()).toEqual([...new Set(stepValues)].sort());
  });
});
