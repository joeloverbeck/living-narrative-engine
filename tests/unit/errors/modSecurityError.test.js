/**
 * @file Unit tests for ModSecurityError security semantics.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ModSecurityError,
  SecurityLevel,
} from '../../../src/errors/modSecurityError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';

/**
 * Helper to create a ModSecurityError with deterministic context fields for assertions.
 *
 * @param {SecurityLevel} level - Security severity level for the error.
 * @param {object} [context] - Additional context to pass into the error.
 * @returns {ModSecurityError} Fresh error instance for the supplied level.
 */
function createError(level, context = { file: 'mods/example.json' }) {
  return new ModSecurityError('Security violation detected', level, context);
}

describe('ModSecurityError', () => {
  it('extends ModValidationError and enriches context details', () => {
    const causeContext = { file: 'mods/bad.json', rule: 'path-traversal' };
    const error = createError(SecurityLevel.CRITICAL, causeContext);

    expect(error).toBeInstanceOf(ModSecurityError);
    expect(error).toBeInstanceOf(ModValidationError);
    expect(error.name).toBe('ModSecurityError');
    expect(error.code).toBe('SECURITY_VIOLATION');
    expect(error.recoverable).toBe(false);
    expect(error.getSeverity()).toBe('critical');
    expect(error.isRecoverable()).toBe(false);
    expect(error.securityLevel).toBe(SecurityLevel.CRITICAL);

    const context = error.context;
    expect(context).toMatchObject({
      file: 'mods/bad.json',
      rule: 'path-traversal',
      securityLevel: SecurityLevel.CRITICAL,
      requiresAudit: true,
    });
    expect(Date.parse(context.reportedAt)).not.toBeNaN();
  });

  describe('isCritical()', () => {
    it.each([
      [true, SecurityLevel.CRITICAL],
      [true, SecurityLevel.HIGH],
      [false, SecurityLevel.MEDIUM],
      [false, SecurityLevel.LOW],
    ])('returns %s when severity is %s', (expected, level) => {
      const error = createError(level);
      expect(error.isCritical()).toBe(expected);
      expect(error.context.requiresAudit).toBe(
        level === SecurityLevel.CRITICAL || level === SecurityLevel.HIGH
      );
    });
  });

  describe('generateIncidentReport()', () => {
    it.each([
      [
        SecurityLevel.CRITICAL,
        [
          'Log security incident',
          'Review mod source',
          'Quarantine mod immediately',
          'Perform security audit',
          'Notify security team',
        ],
        true,
      ],
      [
        SecurityLevel.HIGH,
        [
          'Log security incident',
          'Review mod source',
          'Block mod loading',
          'Investigate mod author',
        ],
        true,
      ],
      [
        SecurityLevel.MEDIUM,
        ['Log security incident', 'Review mod source', 'Flag mod for review'],
        false,
      ],
      [
        SecurityLevel.LOW,
        ['Log security incident', 'Review mod source'],
        false,
      ],
    ])(
      'produces incident report with recommended actions for %s level',
      (level, expectedActions, notify) => {
        const error = createError(level, { module: 'demo-mod' });

        const report = error.generateIncidentReport();

        expect(report).toMatchObject({
          incidentType: 'SECURITY_VIOLATION',
          severity: level,
          message: 'Security violation detected',
          requiresNotification: notify,
        });
        expect(report.timestamp).toBe(error.timestamp);
        expect(report.context).toMatchObject({
          module: 'demo-mod',
          securityLevel: level,
        });
        expect(report.recommendedActions).toEqual(expectedActions);
      }
    );
  });
});
