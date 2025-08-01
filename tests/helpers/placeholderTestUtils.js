/**
 * @file test/helpers/placeholderTestUtils.js
 * @description Test utilities for placeholder resolution
 */

import { jest } from '@jest/globals';

export class PlaceholderTestUtils {
  /**
   * Create mock event payload with target information
   *
   * @param {object} options - Payload configuration
   * @returns {object} - Mock event payload
   */
  static createMockEventPayload(options = {}) {
    const defaults = {
      type: 'core:attempt_action',
      actorId: 'test_actor',
      actionId: 'test:action',
      primaryId: 'test_primary_entity',
      secondaryId: 'test_secondary_entity',
      tertiaryId: null,
      targets: {
        primary: {
          entityId: 'test_primary_entity',
          placeholder: 'primary',
          description: 'Test Primary Entity',
        },
        secondary: {
          entityId: 'test_secondary_entity',
          placeholder: 'secondary',
          description: 'Test Secondary Entity',
        },
      },
    };

    return { ...defaults, ...options };
  }

  /**
   * Assert validation results
   *
   * @param {object} result - Validation result
   * @param {object} expectations - Expected validation outcome
   */
  static assertValidationResult(result, expectations) {
    expect(result.valid).toBe(expectations.valid);
    expect(result.resolved).toEqual(
      expect.arrayContaining(expectations.resolved || [])
    );
    expect(result.missing).toEqual(
      expect.arrayContaining(expectations.missing || [])
    );

    if (expectations.errorCount !== undefined) {
      expect(result.errors).toHaveLength(expectations.errorCount);
    }
  }

  /**
   * Create execution context with mock logger
   *
   * @param {object} eventPayload - Event payload
   * @returns {object} - Execution context
   */
  static createExecutionContext(eventPayload) {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    return {
      evaluationContext: {
        event: { payload: eventPayload },
        actor: { id: eventPayload?.actorId },
        target: { id: eventPayload?.targetId },
      },
      logger: mockLogger,
    };
  }
}
