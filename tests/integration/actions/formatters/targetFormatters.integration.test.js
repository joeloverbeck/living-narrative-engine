/**
 * @file Integration tests for target formatters
 * @description Ensures entity and none target formatters resolve placeholders, logging, and mapping correctly.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  formatEntityTarget,
  formatNoneTarget,
  targetFormatterMap,
} from '../../../../src/actions/formatters/targetFormatters.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../../../src/constants/actionTargetTypes.js';

/**
 * Creates a lightweight logger mock used by the formatters.
 *
 * @returns {{ warn: jest.Mock, debug: jest.Mock }}
 */
function createLogger() {
  return {
    warn: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a minimal entity manager mock that returns predefined entities.
 *
 * @param {Record<string, object>} entities - Map of entity ids to instances.
 * @returns {{ getEntityInstance: jest.Mock }}
 */
function createEntityManager(entities = {}) {
  return {
    getEntityInstance: jest.fn((id) => entities[id] ?? null),
  };
}

describe('target formatters integration', () => {
  let logger;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = createLogger();
    entityManager = createEntityManager();
    displayNameFn = jest.fn((entity, fallback) => entity?.name ?? fallback);
  });

  describe('formatEntityTarget', () => {
    it('returns an error when entityId is missing from the context', () => {
      const result = formatEntityTarget('Greet {target}', {}, {
        actionId: 'demo:greet',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        "formatActionCommand: Target context type is 'entity' but entityId is missing for action demo:greet. Template: \"Greet {target}\""
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "formatActionCommand: Target context type is 'entity' but entityId is missing for action demo:greet. Template: \"Greet {target}\""
      );
      expect(displayNameFn).not.toHaveBeenCalled();
    });

    it('replaces the target placeholder using resolved entity names and emits debug logs', () => {
      entityManager = createEntityManager({
        'npc-1': { id: 'npc-1', name: 'Captain Meridian' },
      });
      const context = ActionTargetContext.forEntity('npc-1');

      const result = formatEntityTarget('Salute {target}', context, {
        actionId: 'demo:salute',
        entityManager,
        displayNameFn,
        logger,
        debug: true,
      });

      expect(result).toEqual({ ok: true, value: 'Salute Captain Meridian' });
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-1');
      expect(displayNameFn).toHaveBeenCalledWith(
        { id: 'npc-1', name: 'Captain Meridian' },
        'npc-1',
        logger
      );
      expect(logger.debug).toHaveBeenCalledWith(
        ' -> Found entity npc-1, display name: "Captain Meridian"'
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('falls back to entity id when resolution fails and honours custom placeholders', () => {
      const context = {
        entityId: 'npc-2',
        placeholder: 'partner',
      };

      const result = formatEntityTarget('Approach {partner}', context, {
        actionId: 'demo:approach',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      });

      expect(result).toEqual({ ok: true, value: 'Approach npc-2' });
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-2');
      expect(displayNameFn).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'formatActionCommand: Could not find entity instance for ID npc-2 (action: demo:approach). Using ID as fallback name.'
      );
    });
  });

  describe('formatNoneTarget', () => {
    it('logs debug output and warns when placeholders exist despite a none domain', () => {
      const context = ActionTargetContext.noTarget();

      const result = formatNoneTarget('Hold position {target}', context, {
        actionId: 'demo:hold',
        logger,
        debug: true,
      });

      expect(result).toEqual({ ok: true, value: 'Hold position {target}' });
      expect(logger.debug).toHaveBeenCalledWith(
        ' -> No target type, using template as is.'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "formatActionCommand: Action demo:hold has target_domain 'none' but template \"Hold position {target}\" contains placeholders."
      );
    });

    it('returns the template unchanged without additional warnings when no placeholder is present', () => {
      const context = ActionTargetContext.noTarget();

      const result = formatNoneTarget('Hold position', context, {
        actionId: 'demo:hold',
        logger,
        debug: false,
      });

      expect(result).toEqual({ ok: true, value: 'Hold position' });
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  it('exposes default formatter mappings for entity and none target types', () => {
    expect(targetFormatterMap[TARGET_TYPE_ENTITY]).toBe(formatEntityTarget);
    expect(targetFormatterMap[TARGET_TYPE_NONE]).toBe(formatNoneTarget);
  });
});
