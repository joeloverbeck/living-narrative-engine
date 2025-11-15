/**
 * @file Unit tests for MemoryManager service.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MemoryManager } from '../../../../src/characterBuilder/services/memoryManager.js';

describe('MemoryManager', () => {
  /** @type {import('../../../../src/interfaces/ILogger.js').ILogger} */
  let logger;
  /** @type {MemoryManager} */
  let service;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new MemoryManager({ logger, contextName: 'TestMemoryManager' });
  });

  it('stores and retrieves weak references', () => {
    const key = {};
    const value = { state: 'cached' };

    service.setWeakReference(key, value);

    expect(service.getWeakReference(key)).toBe(value);
  });

  it('logs warning and throws when setting with invalid key', () => {
    expect(() => service.setWeakReference(null, {})).toThrow(
      'WeakMap key must be an object'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TestMemoryManager: Failed to set weak reference - key must be an object',
      { keyType: 'object' }
    );
  });

  it('returns undefined and warns when getting with invalid key', () => {
    expect(service.getWeakReference('not-an-object')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'TestMemoryManager: Cannot get weak reference - key must be an object',
      { keyType: 'string' }
    );
  });

  it('tracks objects weakly and reports tracking state', () => {
    const tracked = {};

    service.trackWeakly(tracked);
    service.trackWeakly(tracked);

    expect(service.isWeaklyTracked(tracked)).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warning and throws when tracking invalid objects', () => {
    expect(() => service.trackWeakly(undefined)).toThrow(
      'WeakSet value must be an object'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TestMemoryManager: Failed to track object - value must be an object',
      { valueType: 'undefined' }
    );
  });

  it('returns false and warns when checking invalid object tracking', () => {
    expect(service.isWeaklyTracked('invalid')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'TestMemoryManager: Cannot check weak tracking - value must be an object',
      { valueType: 'string' }
    );
  });

  it('clears tracked references', () => {
    const key = {};
    const value = {};
    const tracked = {};

    service.setWeakReference(key, value);
    service.trackWeakly(tracked);

    service.clear();

    expect(service.getWeakReference(key)).toBeUndefined();
    expect(service.isWeaklyTracked(tracked)).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      'TestMemoryManager: Cleared weak references'
    );
  });
});
