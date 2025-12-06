/**
 * @file Unit tests for target formatter utilities.
 * @see src/actions/formatters/targetFormatters.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  formatEntityTarget,
  formatNoneTarget,
  targetFormatterMap,
} from '../../../../src/actions/formatters/targetFormatters.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../../../src/constants/actionTargetTypes.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('targetFormatters', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  let mockEntityManager;
  let mockDisplayNameFn;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };
    mockDisplayNameFn = jest.fn();
  });

  describe('formatEntityTarget', () => {
    it('should return an error when the target context is missing an entity id', () => {
      const result = formatEntityTarget(
        'swing at {target}',
        {},
        {
          actionId: 'combat:swing',
          entityManager: mockEntityManager,
          displayNameFn: mockDisplayNameFn,
          logger: mockLogger,
          debug: false,
        }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('entityId is missing');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('entityId is missing')
      );
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockDisplayNameFn).not.toHaveBeenCalled();
    });

    it('should format using the entity display name when available and log debug details', () => {
      const command = 'greet {friend}!';
      const context = { entityId: 'npc-42', placeholder: 'friend' };
      const entity = { id: 'npc-42' };
      mockEntityManager.getEntityInstance.mockReturnValue(entity);
      mockDisplayNameFn.mockReturnValue('Friendly NPC');

      const result = formatEntityTarget(command, context, {
        actionId: 'social:greet',
        entityManager: mockEntityManager,
        displayNameFn: mockDisplayNameFn,
        logger: mockLogger,
        debug: true,
      });

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'npc-42'
      );
      expect(mockDisplayNameFn).toHaveBeenCalledWith(
        entity,
        'npc-42',
        mockLogger
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        ' -> Found entity npc-42, display name: "Friendly NPC"'
      );
      expect(result).toEqual({ ok: true, value: 'greet Friendly NPC!' });
    });

    it('should skip debug logging when the flag is false while still formatting with the display name', () => {
      const entity = { id: 'npc-7' };
      mockEntityManager.getEntityInstance.mockReturnValue(entity);
      mockDisplayNameFn.mockReturnValue('Quiet NPC');

      const result = formatEntityTarget(
        'observe {target}',
        { entityId: 'npc-7' },
        {
          actionId: 'stealth:observe',
          entityManager: mockEntityManager,
          displayNameFn: mockDisplayNameFn,
          logger: mockLogger,
          debug: false,
        }
      );

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('npc-7');
      expect(mockDisplayNameFn).toHaveBeenCalledWith(
        entity,
        'npc-7',
        mockLogger
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, value: 'observe Quiet NPC' });
    });

    it('should fall back to the entity id and warn when the entity cannot be found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      const result = formatEntityTarget(
        'inspect {target}',
        { entityId: 'ghost' },
        {
          actionId: 'explore:inspect',
          entityManager: mockEntityManager,
          displayNameFn: mockDisplayNameFn,
          logger: mockLogger,
          debug: false,
        }
      );

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('ghost');
      expect(mockDisplayNameFn).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'formatActionCommand: Could not find entity instance for ID ghost (action: explore:inspect). Using ID as fallback name.'
      );
      expect(result).toEqual({ ok: true, value: 'inspect ghost' });
    });
  });

  describe('formatNoneTarget', () => {
    it('should provide debug output and warn about stray placeholders', () => {
      const result = formatNoneTarget(
        'wait for {target}',
        {},
        {
          actionId: 'utility:wait',
          logger: mockLogger,
          debug: true,
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        ' -> No target type, using template as is.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'formatActionCommand: Action utility:wait has target_domain \'none\' but template "wait for {target}" contains placeholders.'
      );
      expect(result).toEqual({ ok: true, value: 'wait for {target}' });
    });

    it('should return the original command without logging when debug is disabled and there are no placeholders', () => {
      const result = formatNoneTarget(
        'rest now',
        {},
        {
          actionId: 'utility:rest',
          logger: mockLogger,
          debug: false,
        }
      );

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, value: 'rest now' });
    });
  });

  it('should expose the default formatter mapping', () => {
    expect(targetFormatterMap[TARGET_TYPE_ENTITY]).toBe(formatEntityTarget);
    expect(targetFormatterMap[TARGET_TYPE_NONE]).toBe(formatNoneTarget);
  });
});
