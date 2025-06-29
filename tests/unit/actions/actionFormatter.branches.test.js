import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { targetFormatterMap } from '../../../src/actions/formatters/targetFormatters.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../../src/constants/actionTargetTypes.js';
import { createMockLogger } from '../../common/mockFactories';

/** @description Tests for branches not covered in other suites. */
describe('formatActionCommand uncovered branches', () => {
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

  it('returns validation error when targetContext is missing', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const result = formatter.format(
      actionDef,
      null,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn }
    );
    expect(result).toEqual({
      ok: false,
      error: 'formatActionCommand: Invalid or missing targetContext.',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'formatActionCommand: Invalid or missing targetContext.',
      })
    );
  });

  it('returns validation error when displayNameFn is not a function', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    const result = formatter.format(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn: null }
    );
    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: getEntityDisplayName utility function is not available.',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'formatActionCommand: getEntityDisplayName utility function is not available.',
      })
    );
  });

  it('wraps plain string formatter results', () => {
    const actionDef = { id: 'core:test', template: 'test {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    const customMap = {
      ...targetFormatterMap,
      entity: jest.fn(() => 'custom'),
    };
    const result = formatter.format(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { displayNameFn, formatterMap: customMap }
    );
    expect(result).toEqual({ ok: true, value: 'custom' });
  });

  it('throws when logger is missing and inputs are invalid', () => {
    const actionDef = { id: 'core:test', template: 'test {target}' };
    expect(() => formatter.format(actionDef, null, entityManager)).toThrow(
      'formatActionCommand: logger is required.'
    );
  });

  it('throws when safeEventDispatcher is missing', () => {
    const actionDef = { id: 'core:wait', template: 'wait' };
    const context = { type: TARGET_TYPE_NONE };
    expect(() =>
      formatter.format(actionDef, context, entityManager, { logger })
    ).toThrow('Missing required dependency: safeEventDispatcher.');
  });
});
