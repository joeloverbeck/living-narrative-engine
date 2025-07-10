import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../../common/mockFactories.js';

// Mock dependencies used by EntityConstructionFactory
jest.mock('../../../../src/entities/entity.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return { __esModule: true, default: jestMock.fn() };
});

jest.mock('../../../../src/entities/entityInstanceData.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return { __esModule: true, default: jestMock.fn() };
});

jest.mock('../../../../src/entities/utils/defaultComponentInjector.js', () => {
  const { jest: jestMock } = require('@jest/globals');
  return { __esModule: true, injectDefaultComponents: jestMock.fn() };
});

import Entity from '../../../../src/entities/entity.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';
import { injectDefaultComponents } from '../../../../src/entities/utils/defaultComponentInjector.js';
import EntityConstructionFactory from '../../../../src/entities/factories/EntityConstructionFactory.js';

/** @type {ReturnType<typeof createMockLogger>} */
let logger;
let validateAndClone;
let factory;

beforeEach(() => {
  jest.clearAllMocks();
  logger = createMockLogger();
  validateAndClone = jest.fn((id, data) => data);
  factory = new EntityConstructionFactory({ logger, validateAndClone });
});

describe('EntityConstructionFactory constructor', () => {
  it('throws when validateAndClone is not a function', () => {
    expect(
      () => new EntityConstructionFactory({ logger, validateAndClone: null })
    ).toThrow('validateAndClone must be a function');
  });
});

describe('validateConstructionParams', () => {
  it('throws for invalid definition', () => {
    expect(() => factory.validateConstructionParams(null, 'id', {})).toThrow(
      'definition must be an object'
    );
  });

  it('throws for invalid instanceId', () => {
    expect(() => factory.validateConstructionParams({}, '', {})).toThrow(
      'instanceId must be a non-empty string'
    );
  });

  it('throws for invalid components', () => {
    expect(() => factory.validateConstructionParams({}, 'id', 'bad')).toThrow(
      'components must be an object or null'
    );
  });

  it('does not throw for valid inputs', () => {
    expect(() =>
      factory.validateConstructionParams({}, 'id', {})
    ).not.toThrow();
  });
});

describe('constructEntity', () => {
  it('creates entity and applies defaults', () => {
    const dataObj = { instance: true };
    const entityObj = { id: 'e1' };
    EntityInstanceData.mockReturnValue(dataObj);
    Entity.mockReturnValue(entityObj);
    const result = factory.constructEntity({}, 'e1', {}, 'def', 'created.');

    expect(EntityInstanceData).toHaveBeenCalledWith('e1', {}, {}, logger);
    expect(Entity).toHaveBeenCalledWith(dataObj);
    expect(injectDefaultComponents).toHaveBeenCalledWith(
      entityObj,
      logger,
      validateAndClone
    );
    expect(result).toBe(entityObj);
    expect(logger.info).toHaveBeenCalled();
  });

  it('rethrows when EntityInstanceData creation fails', () => {
    const error = new Error('fail');
    EntityInstanceData.mockImplementation(() => {
      throw error;
    });
    expect(() =>
      factory.constructEntity({}, 'e1', {}, 'def', 'created.')
    ).toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create EntityInstanceData')
    );
  });

  it('rethrows when Entity creation fails', () => {
    EntityInstanceData.mockReturnValue({});
    const error = new Error('entity fail');
    Entity.mockImplementation(() => {
      throw error;
    });
    expect(() =>
      factory.constructEntity({}, 'e1', {}, 'def', 'created.')
    ).toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create Entity wrapper')
    );
  });

  it('rethrows when default component injection fails', () => {
    EntityInstanceData.mockReturnValue({});
    Entity.mockReturnValue({ id: 'e1' });
    const error = new Error('inject fail');
    injectDefaultComponents.mockImplementation(() => {
      throw error;
    });
    expect(() =>
      factory.constructEntity({}, 'e1', {}, 'def', 'created.')
    ).toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to apply default components')
    );
  });
});

describe('createMinimalEntity', () => {
  it('creates entity without applying defaults', () => {
    const dataObj = { instance: true };
    const entityObj = { id: 'e2' };
    EntityInstanceData.mockReturnValue(dataObj);
    Entity.mockReturnValue(entityObj);
    const result = factory.createMinimalEntity({}, 'e2', { a: 1 });
    expect(result).toBe(entityObj);
    expect(injectDefaultComponents).not.toHaveBeenCalled();
  });
});
