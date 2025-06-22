import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

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
    const context = { type: 'entity', entityId: 'e1' };
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

    expect(result).toBe('inspect The Entity');
    expect(displayNameFn).toHaveBeenCalledWith(mockEntity, 'e1', logger);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('falls back to entity id when instance is missing', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: 'entity', entityId: 'e1' };
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

    expect(result).toBe('inspect e1');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not find entity instance for ID e1')
    );
  });

  it('formats a direction target', () => {
    const actionDef = { id: 'core:move', template: 'move {direction}' };
    const context = { type: 'direction', direction: 'north' };

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

    expect(result).toBe('move north');
  });

  it("returns template as-is for 'none' target type", () => {
    const actionDef = { id: 'core:wait', template: 'wait' };
    const context = { type: 'none' };

    const result = formatActionCommand(
      actionDef,
      context,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      displayNameFn
    );

    expect(result).toBe('wait');
  });

  it('returns null for missing action template', () => {
    const result = formatActionCommand(
      { id: 'bad' },
      { type: 'none' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      displayNameFn
    );
    expect(result).toBeNull();
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
        { type: 'entity', entityId: 'e1' },
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
    expect(result).toBe('do it');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown targetContext type')
    );
  });
});
