// tests/utils/locationUtils.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getExitByDirection,
  getAvailableExits,
} from '../../src/utils/locationUtils.js';
import { EXITS_COMPONENT_ID } from '../../src/constants/componentIds.js';

/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

/**
 * Helper to create a mock location entity with exits.
 *
 * @param {string} id - Location identifier.
 * @param {any} exitsData - Value to return for the exits component.
 * @returns {object} Mocked entity object.
 */
function createMockLocation(id, exitsData) {
  return {
    id,
    getComponentData: jest.fn((componentId) => {
      if (componentId === EXITS_COMPONENT_ID) {
        return exitsData;
      }
      return undefined;
    }),
  };
}

describe('locationUtils', () => {
  /** @type {IEntityManager} */
  let mockEntityManager;

  beforeEach(() => {
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.debug.mockReset();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };
  });

  describe('getExitByDirection', () => {
    it('should return the matching exit (case-insensitive)', () => {
      const exits = [
        { direction: 'North', target: 'loc2' }, // CHANGED targetLocationId to target
        { direction: 'south', target: 'loc3' }, // CHANGED targetLocationId to target
      ];
      const location = createMockLocation('loc1', exits);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getExitByDirection(
        'loc1',
        'north',
        mockEntityManager,
        mockLogger
      );

      expect(result).toEqual({ direction: 'North', target: 'loc2' }); // CHANGED targetLocationId to target
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('loc1');
    });

    it('should return null when direction is not found', () => {
      const exits = [{ direction: 'east', target: 'loc2' }]; // CHANGED targetLocationId to target
      const location = createMockLocation('loc1', exits);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getExitByDirection(
        'loc1',
        'west',
        mockEntityManager,
        mockLogger
      );

      expect(result).toBeNull();
    });

    it('should return null when exits component is missing', () => {
      const location = createMockLocation('loc1', null);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getExitByDirection(
        'loc1',
        'north',
        mockEntityManager,
        mockLogger
      );

      expect(result).toBeNull();
    });

    it('should return null when location id cannot be resolved', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      const result = getExitByDirection(
        'missing',
        'north',
        mockEntityManager,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should validate exit target ID', () => {
      // CHANGED test name
      const exits = [{ direction: 'north', target: '' }]; // CHANGED targetLocationId to target
      const location = createMockLocation('loc1', exits);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getExitByDirection(
        'loc1',
        'north',
        mockEntityManager,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getAvailableExits', () => {
    it('should return only valid exits', () => {
      const exits = [
        { direction: 'north', target: 'loc2' }, // CHANGED targetLocationId to target
        { direction: '', target: 'loc3' }, // CHANGED targetLocationId to target (will be invalid due to empty direction)
        { direction: 'south', target: '' }, // CHANGED targetLocationId to target (will be invalid due to empty target)
        { direction: 'east', target: 'loc4' }, // CHANGED targetLocationId to target
      ];
      const location = createMockLocation('loc1', exits);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getAvailableExits('loc1', mockEntityManager, mockLogger);

      expect(result).toEqual([
        { direction: 'north', target: 'loc2' }, // CHANGED targetLocationId to target
        { direction: 'east', target: 'loc4' }, // CHANGED targetLocationId to target
      ]);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // This should still be 2, as two exits are invalid
    });

    it('should return empty array when exits component missing', () => {
      const location = createMockLocation('loc1', null);
      mockEntityManager.getEntityInstance.mockReturnValue(location);

      const result = getAvailableExits('loc1', mockEntityManager, mockLogger);

      expect(result).toEqual([]);
    });

    it('should return empty array when location not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      const result = getAvailableExits('loc1', mockEntityManager, mockLogger);

      expect(result).toEqual([]);
    });
  });
});
