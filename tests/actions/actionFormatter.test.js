import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { formatActionCommand } from '../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../src/utils/entityUtils.js';

jest.mock('../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(),
}));

/** Simple mock for logger */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('formatActionCommand', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  it('formats an entity target using the entity display name', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: 'entity', entityId: 'e1' };
    const mockEntity = { id: 'e1' };
    entityManager.getEntityInstance.mockReturnValue(mockEntity);
    getEntityDisplayName.mockReturnValue('The Entity');

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
      debug: true,
    });

    expect(result).toBe('inspect The Entity');
    expect(getEntityDisplayName).toHaveBeenCalledWith(mockEntity, 'e1', logger);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('falls back to entity id when instance is missing', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: 'entity', entityId: 'e1' };
    entityManager.getEntityInstance.mockReturnValue(null);

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBe('inspect e1');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not find entity instance for ID e1')
    );
  });

  it('formats a direction target', () => {
    const actionDef = { id: 'core:move', template: 'move {direction}' };
    const context = { type: 'direction', direction: 'north' };

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBe('move north');
  });

  it('returns null for missing action template', () => {
    const result = formatActionCommand(
      { id: 'bad' },
      { type: 'none' },
      entityManager,
      { logger }
    );
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      expect.any(Object)
    );
  });

  it('throws when entityManager is invalid', () => {
    expect(() =>
      formatActionCommand(
        { id: 'core:use', template: 'use {target}' },
        { type: 'entity', entityId: 'e1' },
        {},
        { logger }
      )
    ).toThrow('formatActionCommand requires a valid EntityManager instance.');
  });

  it('warns on unknown target type', () => {
    const actionDef = { id: 'core:do', template: 'do it' };
    const context = { type: 'mystery' };
    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });
    expect(result).toBe('do it');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown validatedTargetContext type')
    );
  });
});
