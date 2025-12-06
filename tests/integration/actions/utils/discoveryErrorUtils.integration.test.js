import { describe, it, expect } from '@jest/globals';
import {
  createActionErrorContext,
  extractTargetId,
} from '../../../../src/actions/utils/discoveryErrorUtils.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';

const buildBaseContext = () => ({
  actionId: 'action:test',
  error: new Error('boom'),
  phase: ERROR_PHASES.VALIDATION,
  targetId: 'entity:target',
  timestamp: Date.now(),
});

describe('discoveryErrorUtils integration', () => {
  describe('createActionErrorContext', () => {
    it('returns the provided context when all required properties are present', () => {
      const context = buildBaseContext();

      const result = createActionErrorContext(context);

      expect(result).toBe(context);
    });

    it('throws when the action identifier is missing', () => {
      const context = { ...buildBaseContext(), actionId: undefined };

      expect(() => createActionErrorContext(context)).toThrow(
        'ActionErrorContext must have actionId'
      );
    });

    it('throws when the underlying error instance is absent', () => {
      const context = { ...buildBaseContext() };
      delete context.error;

      expect(() => createActionErrorContext(context)).toThrow(
        'ActionErrorContext must have error'
      );
    });

    it('throws when the failing phase is not provided', () => {
      const context = { ...buildBaseContext() };
      delete context.phase;

      expect(() => createActionErrorContext(context)).toThrow(
        'ActionErrorContext must have phase'
      );
    });
  });

  describe('extractTargetId', () => {
    it('returns the targetId from an action error context', () => {
      const context = buildBaseContext();

      expect(extractTargetId(context)).toBe('entity:target');
    });

    it('prefers the explicit targetId even when null', () => {
      const context = { ...buildBaseContext(), targetId: null };

      expect(extractTargetId(context)).toBeNull();
    });

    it('extracts the entityId from nested legacy error shapes', () => {
      const legacyError = {
        target: { entityId: 'legacy:nested' },
      };

      expect(extractTargetId(legacyError)).toBe('legacy:nested');
    });

    it('falls back to the top-level entityId when provided', () => {
      const legacyError = { entityId: 'legacy:top' };

      expect(extractTargetId(legacyError)).toBe('legacy:top');
    });

    it('returns null when the error does not expose any target information', () => {
      const errorWithoutTarget = { message: 'no target details' };

      expect(extractTargetId(errorWithoutTarget)).toBeNull();
    });
  });
});
