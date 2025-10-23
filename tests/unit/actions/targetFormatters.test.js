import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import {
  formatEntityTarget,
  formatNoneTarget,
} from '../../../src/actions/formatters/targetFormatters.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../../src/constants/actionTargetTypes.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

/** @description Unit tests for the target formatter utilities. */
describe('targetFormatters', () => {
  let entityManager;
  let logger;
  let displayNameFn;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = createMockLogger();
    displayNameFn = jest.fn();
  });

  it('returns an error when entityId is missing', () => {
    const result = formatEntityTarget(
      'use {target}',
      { type: TARGET_TYPE_ENTITY },
      {
        actionId: 'core:use',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch('entityId is missing');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('uses display name and logs debug output when entity is found', () => {
    const mockEntity = { id: 'e1' };
    entityManager.getEntityInstance.mockReturnValue(mockEntity);
    displayNameFn.mockReturnValue('Hero');

    const result = formatEntityTarget(
      'attack {target}',
      { type: TARGET_TYPE_ENTITY, entityId: 'e1' },
      {
        actionId: 'core:attack',
        entityManager,
        displayNameFn,
        logger,
        debug: true,
      }
    );
    expect(result).toEqual({ ok: true, value: 'attack Hero' });
    expect(displayNameFn).toHaveBeenCalledWith(mockEntity, 'e1', logger);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('falls back to the id and warns when entity is missing', () => {
    entityManager.getEntityInstance.mockReturnValue(undefined);

    const result = formatEntityTarget(
      'attack {target}',
      { type: TARGET_TYPE_ENTITY, entityId: 'e2' },
      {
        actionId: 'core:attack',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );
    expect(result).toEqual({ ok: true, value: 'attack e2' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not find entity instance')
    );
  });

  it('replaces custom placeholders when provided in the context', () => {
    const entity = { id: 'obj-7' };
    entityManager.getEntityInstance.mockReturnValue(entity);
    displayNameFn.mockReturnValue('Mystic Orb');

    const result = formatEntityTarget(
      'inspect {object}',
      { type: TARGET_TYPE_ENTITY, entityId: 'obj-7', placeholder: 'object' },
      {
        actionId: 'core:inspect',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({ ok: true, value: 'inspect Mystic Orb' });
    expect(displayNameFn).toHaveBeenCalledWith(entity, 'obj-7', logger);
  });

  it('logs debug output for none target when debug flag is true', () => {
    const result = formatNoneTarget(
      'wait',
      { type: TARGET_TYPE_NONE },
      { actionId: 'core:wait', logger, debug: true }
    );
    expect(result).toEqual({ ok: true, value: 'wait' });
    expect(logger.debug).toHaveBeenCalled();
  });

  it('warns when none target template contains placeholders', () => {
    const result = formatNoneTarget(
      'wait {target}',
      { type: TARGET_TYPE_NONE },
      { actionId: 'core:wait', logger, debug: false }
    );
    expect(result).toEqual({ ok: true, value: 'wait {target}' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('contains placeholders')
    );
  });
});
