import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { formatActionCommand } from '../../src/actions/actionFormatter.js';

jest.mock('../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(),
}));

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('formatActionCommand additional cases', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  it('returns null when entity context lacks entityId', () => {
    const actionDef = { id: 'core:use', template: 'use {target}' };
    const context = { type: 'entity' };

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('entityId is missing')
    );
  });

  it('returns null when direction context lacks direction', () => {
    const actionDef = { id: 'core:move', template: 'move {direction}' };
    const context = { type: 'direction' };

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('direction string is missing')
    );
  });

  it('warns when none domain template contains placeholders', () => {
    const actionDef = {
      id: 'core:wait',
      template: 'wait {target} {direction}',
    };
    const context = { type: 'none' };

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBe('wait {target} {direction}');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('contains placeholders')
    );
  });

  it('returns null and logs error if placeholder substitution throws', () => {
    const actionDef = { id: 'core:inspect', template: 'inspect {target}' };
    const context = { type: 'entity', entityId: 'e1' };
    entityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = formatActionCommand(actionDef, context, entityManager, {
      logger,
    });

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('placeholder substitution'),
      expect.any(Error)
    );
  });
});
