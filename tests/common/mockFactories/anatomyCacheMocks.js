/**
 * @file Mock factories for anatomy cache services
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock AnatomyClothingCache service
 *
 * @returns {object} Mock cache service
 */
export function createMockAnatomyClothingCache() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clearType: jest.fn(),
    clearAll: jest.fn(),
    invalidateEntity: jest.fn(),
    invalidatePattern: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalSize: 0,
      totalItems: 0,
      memoryUsage: 0,
      memoryUsageMB: 0,
      maxMemoryUsageMB: 100,
      caches: {},
    }),
  };
}