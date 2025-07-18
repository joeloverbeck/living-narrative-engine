import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
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
  let formatter;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = createMockLogger();
    dispatcher = { dispatch: jest.fn() };
    displayNameFn = jest.fn();
    formatter = new ActionCommandFormatter();
    jest.clearAllMocks();
  });

  it('exports default target formatter map', () => {
    expect(targetFormatterMap).toEqual(
      expect.objectContaining({
        entity: expect.any(Function),
        none: expect.any(Function),
      })
    );
  });

  it('returns error when entity context lacks entityId', () => {
    const actionDef = { id: 'core:use', template: 'use {target}' };
    const context = { type: TARGET_TYPE_ENTITY };

    const result = formatter.format(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      { displayNameFn }
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('entityId is missing')
    );
  });

  it('warns when none domain template contains placeholders', () => {
    const actionDef = {
      id: 'core:wait',
      template: 'wait {target}',
    };
    const context = { type: TARGET_TYPE_NONE };

    formatter.format(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      { displayNameFn }
    );

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

    const result = formatter.format(
      actionDef,
      context,
      entityManager,
      {
        logger,
        safeEventDispatcher: dispatcher,
      },
      { displayNameFn }
    );

    expect(result.ok).toBe(false);
    expect(result.details).toBe('boom');
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
      entity: jest.fn(() => ({ ok: true, value: 'test-value' })),
    };

    const result = formatter.format(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn, formatterMap: customMap }
    );

    expect(result).toEqual({ ok: true, value: 'test-value' });
    expect(customMap.entity).toHaveBeenCalled();
  });
});
