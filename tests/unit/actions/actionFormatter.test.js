import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../../src/constants/actionTargetTypes.js';
import { createMockLogger } from '../../common/mockFactories';

describe('formatActionCommand', () => {
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

  it('formats an entity target using the entity display name', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    const mockEntity = { id: 'e1' };
    entityManager.getEntityInstance.mockReturnValue(mockEntity);
    displayNameFn.mockReturnValue('The Entity');

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      {
        logger,
        debug: true,
        safeEventDispatcher: dispatcher,
      },
      displayNameFn
    );

    expect(result).toEqual({ ok: true, value: 'inspect The Entity' });
    expect(displayNameFn).toHaveBeenCalledWith(mockEntity, 'e1', logger);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('falls back to entity id when instance is missing', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: TARGET_TYPE_ENTITY, entityId: 'e1' };
    entityManager.getEntityInstance.mockReturnValue(null);

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

    expect(result).toEqual({ ok: true, value: 'inspect e1' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not find entity instance for ID e1')
    );
  });

  it("returns template as-is for 'none' target type", () => {
    const actionDef = { id: 'core:wait', template: 'wait' };
    const context = { type: TARGET_TYPE_NONE };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      displayNameFn
    );

    expect(result).toEqual({ ok: true, value: 'wait' });
  });

  it('returns error for missing action template', () => {
    const result = formatActionCommand(
      { id: 'bad' },
      { type: TARGET_TYPE_NONE },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      displayNameFn
    );
    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: Invalid or missing actionDefinition or template.',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'formatActionCommand: Invalid or missing actionDefinition or template.',
      })
    );
  });

  it('throws when entityManager is invalid', () => {
    expect(() =>
      formatActionCommand(
        { id: 'core:use', template: 'use {target}' },
        { type: TARGET_TYPE_ENTITY, entityId: 'e1' },
        {},
        { logger, safeEventDispatcher: dispatcher },
        displayNameFn
      )
    ).toThrow(
      'formatActionCommand: entityManager parameter must be a valid EntityManager instance.'
    );
  });

  it('warns on unknown target type', () => {
    const actionDef = { id: 'core:do', template: 'do it' };
    const context = { type: 'mystery' };
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
    expect(result).toEqual({ ok: true, value: 'do it' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type')
    );
  });
});
