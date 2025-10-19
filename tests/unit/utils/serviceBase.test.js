/**
 * @file Unit tests for BaseService helper utilities.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseService } from '../../../src/utils/serviceBase.js';
import { initializeServiceLogger } from '../../../src/utils/serviceInitializerUtils.js';

jest.mock('../../../src/utils/serviceInitializerUtils.js', () => ({
  initializeServiceLogger: jest.fn(),
}));

class TestService extends BaseService {
  exposeInit(name, logger, deps) {
    return this._init(name, logger, deps);
  }
}

describe('BaseService', () => {
  const logger = { debug: jest.fn() };
  const dependencies = {
    repository: { value: { fetch: () => null }, requiredMethods: ['fetch'] },
  };

  let service;

  beforeEach(() => {
    service = new TestService();
    initializeServiceLogger.mockReset();
  });

  it('returns the logger produced by initializeServiceLogger', () => {
    const prefixedLogger = { debug: jest.fn(), prefix: 'Test: ' };
    initializeServiceLogger.mockReturnValue(prefixedLogger);

    const result = service.exposeInit('TestService', logger, dependencies);

    expect(result).toBe(prefixedLogger);
    expect(initializeServiceLogger).toHaveBeenCalledWith(
      'TestService',
      logger,
      dependencies
    );
  });

  it('propagates errors thrown by initializeServiceLogger', () => {
    const failure = new Error('init failed');
    initializeServiceLogger.mockImplementation(() => {
      throw failure;
    });

    expect(() =>
      service.exposeInit('TestService', logger, dependencies)
    ).toThrow(failure);
  });
});
