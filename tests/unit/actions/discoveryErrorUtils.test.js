import { describe, it, expect } from '@jest/globals';
import {
  createActionErrorContext,
  extractTargetId,
} from '../../../src/actions/utils/discoveryErrorUtils.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

/**
 * @file tests/unit/actions/discoveryErrorUtils.test.js
 * @description Unit tests for discoveryErrorUtils with enhanced error contexts.
 */

describe('Enhanced discoveryErrorUtils', () => {
  it('validates and passes through complete ActionErrorContext', () => {
    const err = new Error('bad');
    const errorContext = {
      actionId: 'a1',
      targetId: 't1',
      error: err,
      actionDefinition: { id: 'a1', name: 'Test Action' },
      actorSnapshot: {
        id: 'actor123',
        components: {},
        location: 'room1',
        metadata: {},
      },
      evaluationTrace: {
        steps: [],
        finalContext: {},
        failurePoint: 'Unknown',
      },
      suggestedFixes: [],
      environmentContext: {},
      timestamp: Date.now(),
      phase: ERROR_PHASES.VALIDATION,
    };

    const result = createActionErrorContext(errorContext);
    expect(result).toBe(errorContext);
  });

  it('throws error if actionId is missing', () => {
    const invalidContext = {
      targetId: 't1',
      error: new Error('bad'),
      phase: ERROR_PHASES.VALIDATION,
    };

    expect(() => createActionErrorContext(invalidContext)).toThrow(
      'ActionErrorContext must have actionId'
    );
  });

  it('throws error if error is missing', () => {
    const invalidContext = {
      actionId: 'a1',
      targetId: 't1',
      phase: ERROR_PHASES.VALIDATION,
    };

    expect(() => createActionErrorContext(invalidContext)).toThrow(
      'ActionErrorContext must have error'
    );
  });

  it('throws error if phase is missing', () => {
    const invalidContext = {
      actionId: 'a1',
      targetId: 't1',
      error: new Error('bad'),
    };

    expect(() => createActionErrorContext(invalidContext)).toThrow(
      'ActionErrorContext must have phase'
    );
  });

  it('extracts targetId from various error shapes', () => {
    expect(extractTargetId({ targetId: 'x' })).toBe('x');
    expect(extractTargetId({ target: { entityId: 'y' } })).toBe('y');
    expect(extractTargetId({ entityId: 'z' })).toBe('z');
    expect(extractTargetId({})).toBeNull();
  });
});
