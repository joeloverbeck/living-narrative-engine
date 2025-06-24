import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import {
  formatActionCommand,
  targetFormatterMap,
} from '../../../src/actions/actionFormatter.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  DIRECTION as TARGET_TYPE_DIRECTION,
  NONE as TARGET_TYPE_NONE,
} from '../../../src/constants/actionTargetTypes.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('formatActionCommand additional cases', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let displayNameFn;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = createMockLogger();
    dispatcher = { dispatch: jest.fn() };
    displayNameFn = jest.fn();
    jest.clearAllMocks();
  });

  it('exports default target formatter map', () => {
    expect(targetFormatterMap).toEqual(
      expect.objectContaining({
        entity: expect.any(Function),
        direction: expect.any(Function),
        none: expect.any(Function),
      })
    );
  });

  it('returns error when entity context lacks entityId', () => {
    const actionDef = { id: 'core:use', template: 'use {target}' };
    const context = { type: TARGET_TYPE_ENTITY };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      displayNameFn
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('entityId is missing')
    );
  });

  it('returns error when direction context lacks direction', () => {
    const actionDef = { id: 'core:move', template: 'move {direction}' };
    const context = { type: TARGET_TYPE_DIRECTION };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      displayNameFn
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('direction string is missing')
    );
  });

  it('warns when none domain template contains placeholders', () => {
    const actionDef = {
      id: 'core:wait',
      template: 'wait {target} {direction}',
    };
    const context = { type: TARGET_TYPE_NONE };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      displayNameFn
    );

    expect(result).toEqual({ ok: true, value: 'wait {target} {direction}' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('contains placeholders')
    );
  });

  it('returns error and logs event if placeholder substitution throws', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    entityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      displayNameFn
    );

    expect(result.ok).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('placeholder substitution'),
      })
    );
  });

  it('allows overriding the target formatter map', () => {
    const actionDef = { id: 'core:test', template: 'test {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => 'test-value'),
    };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      displayNameFn,
      customMap
    );

    expect(result).toEqual({ ok: true, value: 'test-value' });
    expect(customMap.entity).toHaveBeenCalled();
  });
});
