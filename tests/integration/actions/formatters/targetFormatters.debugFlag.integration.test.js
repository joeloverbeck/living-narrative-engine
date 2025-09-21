import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { formatEntityTarget } from '../../../../src/actions/formatters/targetFormatters.js';

const createLogger = () => ({
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
});

describe('targetFormatters debug flag integration', () => {
  let logger;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = createLogger();
    entityManager = { getEntityInstance: jest.fn() };
    displayNameFn = jest.fn();
  });

  it('suppresses debug logging when the entity exists but debug flag is false', () => {
    const context = { entityId: 'npc-007' };
    const entity = { id: 'npc-007' };
    entityManager.getEntityInstance.mockReturnValue(entity);
    displayNameFn.mockReturnValue('Silent Operative');

    const result = formatEntityTarget('Shadow {target}', context, {
      actionId: 'stealth:shadow-strike',
      entityManager,
      displayNameFn,
      logger,
      debug: false,
    });

    expect(result).toEqual({ ok: true, value: 'Shadow Silent Operative' });
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('npc-007');
    expect(displayNameFn).toHaveBeenCalledWith(entity, 'npc-007', logger);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
