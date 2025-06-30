import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import MissingInstanceIdError from '../../../src/errors/missingInstanceIdError.js';
import MissingEntityInstanceError from '../../../src/errors/missingEntityInstanceError.js';

describe('forTest_validateWorldInstances', () => {
  let loader;
  let dataRegistry;

  beforeEach(() => {
    dataRegistry = {
      get: jest.fn(),
      store: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    loader = new WorldLoader(
      { getContentTypeSchemaId: jest.fn() },
      { resolveModContentPath: jest.fn() },
      { fetch: jest.fn() },
      { validate: jest.fn() },
      dataRegistry,
      logger
    );
  });

  it('returns counts when all instances valid', () => {
    dataRegistry.get.mockReturnValue({});
    const worldData = { instances: [{ instanceId: 'a' }, { instanceId: 'b' }] };
    const result = loader.forTest_validateWorldInstances(
      worldData,
      'modA',
      'world.json'
    );
    expect(result).toEqual({ resolved: 2, unresolved: 0, instanceCount: 2 });
  });

  it('throws MissingInstanceIdError when an instance lacks id', () => {
    const worldData = { instances: [{}, { instanceId: 'b' }] };
    expect(() =>
      loader.forTest_validateWorldInstances(worldData, 'modA', 'file.json')
    ).toThrow(MissingInstanceIdError);
  });

  it('throws MissingEntityInstanceError when instance not found', () => {
    dataRegistry.get.mockReturnValue(undefined);
    const worldData = { instances: [{ instanceId: 'x' }] };
    expect(() =>
      loader.forTest_validateWorldInstances(worldData, 'modA', 'file.json')
    ).toThrow(MissingEntityInstanceError);
  });
});
