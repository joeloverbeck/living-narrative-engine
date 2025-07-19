/**
 * @file Integration test for actions with scope 'none' formatting
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';

describe('Action Scope None Integration', () => {
  let formatter;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    formatter = new ActionCommandFormatter();
  });

  describe('core:wait action formatting', () => {
    it('should format core:wait action without warnings', () => {
      const waitActionDef = {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait for a moment, doing nothing.',
        template: 'wait',
        scope: 'none',
      };

      const targetContext = ActionTargetContext.noTarget();

      const result = formatter.format(
        waitActionDef,
        targetContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('wait');

      // Verify no warnings were logged
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Verify debug logging worked correctly
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Formatting command for action: core:wait, template: "wait", targetType: none'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(' -> No target type, using template as is.')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(' <- Final formatted command: "wait"')
      );
    });

    it('should handle actions with scope none that contain {target} placeholder (edge case)', () => {
      const invalidWaitActionDef = {
        id: 'custom:wait-with-target',
        name: 'Wait With Target',
        description: 'Wait action with invalid template.',
        template: 'wait for {target}',
        scope: 'none',
      };

      const targetContext = ActionTargetContext.noTarget();

      const result = formatter.format(
        invalidWaitActionDef,
        targetContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('wait for {target}'); // Placeholder not replaced for 'none' type

      // Verify warning was logged about placeholder in none-scope action
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Action custom:wait-with-target has target_domain \'none\' but template "wait for {target}" contains placeholders.'
        )
      );
    });
  });

  describe('other actions with scope none', () => {
    it('should format pass action correctly', () => {
      const passActionDef = {
        id: 'core:pass',
        name: 'Pass',
        description: 'Pass the turn without taking any action.',
        template: 'pass',
        scope: 'none',
      };

      const targetContext = ActionTargetContext.noTarget();

      const result = formatter.format(
        passActionDef,
        targetContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: false, // Test without debug logging
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('pass');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should format sleep action correctly', () => {
      const sleepActionDef = {
        id: 'core:sleep',
        name: 'Sleep',
        description: 'Rest and recover energy.',
        template: 'sleep',
        scope: 'none',
      };

      const targetContext = ActionTargetContext.noTarget();

      const result = formatter.format(
        sleepActionDef,
        targetContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('sleep');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('ActionTargetContext.noTarget() properties', () => {
    it('should create target context with correct properties', () => {
      const targetContext = ActionTargetContext.noTarget();

      expect(targetContext).toBeInstanceOf(ActionTargetContext);
      expect(targetContext.type).toBe('none');
      expect(targetContext.entityId).toBeNull();
    });

    it('should be equivalent to new ActionTargetContext("none")', () => {
      const noTarget = ActionTargetContext.noTarget();
      const manualNone = new ActionTargetContext('none');

      expect(noTarget.type).toBe(manualNone.type);
      expect(noTarget.entityId).toBe(manualNone.entityId);
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed action definitions gracefully', () => {
      const malformedActionDef = {
        id: 'malformed:action',
        // missing template
        scope: 'none',
      };

      const targetContext = ActionTargetContext.noTarget();

      const result = formatter.format(
        malformedActionDef,
        targetContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        'Invalid or missing actionDefinition or template'
      );
    });

    it('should handle invalid target context gracefully', () => {
      const waitActionDef = {
        id: 'core:wait',
        template: 'wait',
        scope: 'none',
      };

      // Pass undefined target context (should not happen in practice)
      const result = formatter.format(
        waitActionDef,
        undefined,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid or missing targetContext');
    });

    it('should handle plain object instead of ActionTargetContext (old bug scenario)', () => {
      const waitActionDef = {
        id: 'core:wait',
        template: 'wait',
        scope: 'none',
      };

      // Simulate the old bug where a plain object was passed instead of ActionTargetContext
      const plainObjectContext = { entityId: null, entity: null };

      const result = formatter.format(
        waitActionDef,
        plainObjectContext,
        mockEntityManager,
        {
          logger: mockLogger,
          debug: true,
          safeEventDispatcher: mockSafeEventDispatcher,
        }
      );

      // This should trigger the warning that we're fixing
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Unknown targetContext type: undefined for action core:wait'
        )
      );

      // But should still return the template unmodified
      expect(result.ok).toBe(true);
      expect(result.value).toBe('wait');
    });
  });
});
