/**
 * @file Unit tests for enhanced discoveryErrorUtils
 */

import { describe, it, expect } from '@jest/globals';
import {
  createActionErrorContext,
  extractTargetId,
} from '../../../../src/actions/utils/discoveryErrorUtils.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';

describe('Enhanced discoveryErrorUtils', () => {
  describe('createActionErrorContext', () => {
    const validErrorContext = {
      actionId: 'core:move',
      targetId: 'target123',
      error: new Error('Test error'),
      actionDefinition: { id: 'core:move', name: 'Move' },
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

    it('should pass through a valid ActionErrorContext', () => {
      const result = createActionErrorContext(validErrorContext);
      expect(result).toBe(validErrorContext);
    });

    it('should throw if actionId is missing', () => {
      const invalidContext = { ...validErrorContext };
      delete invalidContext.actionId;

      expect(() => createActionErrorContext(invalidContext)).toThrow(
        'ActionErrorContext must have actionId'
      );
    });

    it('should throw if error is missing', () => {
      const invalidContext = { ...validErrorContext };
      delete invalidContext.error;

      expect(() => createActionErrorContext(invalidContext)).toThrow(
        'ActionErrorContext must have error'
      );
    });

    it('should throw if phase is missing', () => {
      const invalidContext = { ...validErrorContext };
      delete invalidContext.phase;

      expect(() => createActionErrorContext(invalidContext)).toThrow(
        'ActionErrorContext must have phase'
      );
    });

    it('should accept null targetId', () => {
      const contextWithNullTarget = { ...validErrorContext, targetId: null };
      const result = createActionErrorContext(contextWithNullTarget);
      expect(result.targetId).toBeNull();
    });
  });

  describe('extractTargetId', () => {
    it('should extract targetId from ActionErrorContext', () => {
      const errorContext = {
        targetId: 'target123',
        error: new Error('Test'),
      };

      expect(extractTargetId(errorContext)).toBe('target123');
    });

    it('should return null for ActionErrorContext with null targetId', () => {
      const errorContext = {
        targetId: null,
        error: new Error('Test'),
      };

      expect(extractTargetId(errorContext)).toBeNull();
    });

    it('should extract targetId from legacy error.targetId', () => {
      const error = new Error('Test');
      error.targetId = 'legacy123';

      expect(extractTargetId(error)).toBe('legacy123');
    });

    it('should extract targetId from legacy error.target.entityId', () => {
      const error = new Error('Test');
      error.target = { entityId: 'entity456' };

      expect(extractTargetId(error)).toBe('entity456');
    });

    it('should extract targetId from legacy error.entityId', () => {
      const error = new Error('Test');
      error.entityId = 'direct789';

      expect(extractTargetId(error)).toBe('direct789');
    });

    it('should return null if no targetId found', () => {
      const error = new Error('Test');
      expect(extractTargetId(error)).toBeNull();
    });

    it('should prioritize direct targetId over nested properties', () => {
      const error = {
        targetId: 'primary',
        target: { entityId: 'secondary' },
        entityId: 'tertiary',
      };

      expect(extractTargetId(error)).toBe('primary');
    });
  });
});
