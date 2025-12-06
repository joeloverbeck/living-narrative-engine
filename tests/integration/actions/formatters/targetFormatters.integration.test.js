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

const createLogger = () => ({
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
});

describe('targetFormatters integration', () => {
  let logger;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = createLogger();
    entityManager = { getEntityInstance: jest.fn() };
    displayNameFn = jest.fn();
  });

  it('returns error when entity target is missing the entityId', () => {
    const result = formatEntityTarget(
      'Approach {target}',
      {},
      {
        actionId: 'movement:approach',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: Target context type is \'entity\' but entityId is missing for action movement:approach. Template: "Approach {target}"',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Target context type is \'entity\' but entityId is missing for action movement:approach. Template: "Approach {target}"'
    );
    expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(displayNameFn).not.toHaveBeenCalled();
  });

  it('formats entity targets using display names and supports custom placeholders', () => {
    const context = { entityId: 'npc-42', placeholder: 'enemy' };
    const entity = { id: 'npc-42' };
    entityManager.getEntityInstance.mockReturnValue(entity);
    displayNameFn.mockReturnValue('Shadow Operative');

    const result = formatEntityTarget('Neutralize {enemy}', context, {
      actionId: 'stealth:neutralize',
      entityManager,
      displayNameFn,
      logger,
      debug: true,
    });

    expect(result).toEqual({ ok: true, value: 'Neutralize Shadow Operative' });
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-42');
    expect(displayNameFn).toHaveBeenCalledWith(entity, 'npc-42', logger);
    expect(logger.debug).toHaveBeenCalledWith(
      ' -> Found entity npc-42, display name: "Shadow Operative"'
    );
  });

  it('falls back to entity id and warns when lookup fails', () => {
    const result = formatEntityTarget(
      'Observe {target}',
      { entityId: 'guard-1' },
      {
        actionId: 'intel:observe',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Observe guard-1' });
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Could not find entity instance for ID guard-1 (action: intel:observe). Using ID as fallback name.'
    );
    expect(displayNameFn).not.toHaveBeenCalled();
  });

  it('keeps commands intact for none targets while emitting diagnostics', () => {
    const result = formatNoneTarget(
      'Take a deep breath {target}',
      {},
      {
        actionId: 'mindfulness:breathe',
        logger,
        debug: true,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Take a deep breath {target}' });
    expect(logger.debug).toHaveBeenCalledWith(
      ' -> No target type, using template as is.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Action mindfulness:breathe has target_domain \'none\' but template "Take a deep breath {target}" contains placeholders.'
    );
  });

  it('returns template unchanged without warnings when no placeholder is present', () => {
    const result = formatNoneTarget(
      'Take a deep breath',
      {},
      {
        actionId: 'mindfulness:breathe',
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({ ok: true, value: 'Take a deep breath' });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('exposes default formatter map', () => {
    expect(targetFormatterMap[TARGET_TYPE_ENTITY]).toBe(formatEntityTarget);
    expect(targetFormatterMap[TARGET_TYPE_NONE]).toBe(formatNoneTarget);
  });
});
