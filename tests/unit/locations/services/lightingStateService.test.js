/**
 * @file Unit tests for LightingStateService
 * @description Tests the service that determines location lighting state
 * based on naturally_dark marker and lit entities/inventory items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LightingStateService } from '../../../../src/locations/services/lightingStateService.js';

describe('LightingStateService', () => {
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
  });

  describe('Constructor validation', () => {
    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new LightingStateService({
            entityManager: null,
            logger: mockLogger,
          })
      ).toThrow(/Missing required dependency: entityManager/);
    });

    it('should throw if entityManager lacks required methods', () => {
      const invalidEntityManager = {
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
        // missing getEntitiesInLocation
      };

      expect(
        () =>
          new LightingStateService({
            entityManager: invalidEntityManager,
            logger: mockLogger,
          })
      ).toThrow(/Invalid or missing method 'getEntitiesInLocation'/);
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new LightingStateService({
            entityManager: mockEntityManager,
            logger: null,
          })
      ).toThrow(/Missing required dependency: logger/);
    });

    it('should throw if logger lacks required methods', () => {
      const invalidLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        // missing warn and error
      };

      expect(
        () =>
          new LightingStateService({
            entityManager: mockEntityManager,
            logger: invalidLogger,
          })
      ).toThrow(/Invalid or missing method 'warn'/);
    });

    it('should successfully construct with valid dependencies', () => {
      const service = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      expect(service).toBeInstanceOf(LightingStateService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LightingStateService initialized.'
      );
    });
  });

  describe('getLocationLightingState', () => {
    let service;

    beforeEach(() => {
      service = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
    });

    it('should return isLit=true with empty lightSources when location has NO naturally_dark component', () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = service.getLocationLightingState('location:outdoor_plaza');

      expect(result).toEqual({ isLit: true, lightSources: [] });
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'location:outdoor_plaza',
        'locations:naturally_dark'
      );
      expect(mockEntityManager.getEntitiesInLocation).not.toHaveBeenCalled();
    });

    it('should return isLit=true with lightSources when a lit entity is in the location', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:dark_cave') {
          return component === 'locations:naturally_dark';
        }
        if (entityId === 'entity:torch') {
          return component === 'lighting:is_lit';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:torch'])
      );

      const result = service.getLocationLightingState('location:dark_cave');

      expect(result).toEqual({
        isLit: true,
        lightSources: ['entity:torch'],
      });
    });

    it('should return isLit=true with lightSources when a lit item is in inventory', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:dark_cave') {
          return component === 'locations:naturally_dark';
        }
        if (entityId === 'item:lantern') {
          return component === 'lighting:is_lit';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:actor'])
      );
      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'entity:actor') {
          return { items: ['item:lantern'] };
        }
        return undefined;
      });

      const result = service.getLocationLightingState('location:dark_cave');

      expect(result).toEqual({
        isLit: true,
        lightSources: ['item:lantern'],
      });
    });

    it('should return isLit=false with empty lightSources when naturally_dark and no lit sources are present', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:dark_cave') {
          return component === 'locations:naturally_dark';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:actor'])
      );
      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'entity:actor') {
          return { items: [] };
        }
        return undefined;
      });

      const result = service.getLocationLightingState('location:dark_cave');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });
  });

  describe('isLocationLit convenience method', () => {
    let service;

    beforeEach(() => {
      service = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
    });

    it('should return true for naturally lit locations (no naturally_dark marker)', () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = service.isLocationLit('location:sunny_meadow');

      expect(result).toBe(true);
    });

    it('should return false for dark locations (naturally_dark with no light sources)', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:pitch_black_room') {
          return component === 'locations:naturally_dark';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());

      const result = service.isLocationLit('location:pitch_black_room');

      expect(result).toBe(false);
    });

    it('should return true for artificially lit locations (naturally_dark with light sources)', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:candlelit_room') {
          return component === 'locations:naturally_dark';
        }
        if (entityId === 'entity:candle_1') {
          return component === 'lighting:is_lit';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:candle_1'])
      );

      const result = service.isLocationLit('location:candlelit_room');

      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    let service;

    beforeEach(() => {
      service = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
    });

    it('should handle undefined entities set gracefully (returns empty array)', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:test') {
          return component === 'locations:naturally_dark';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(undefined);

      const result = service.getLocationLightingState('location:test');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });

    it('should handle null inventory items property gracefully', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:test') {
          return component === 'locations:naturally_dark';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:actor'])
      );
      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'entity:actor') {
          return { items: null };
        }
        return undefined;
      });

      const result = service.getLocationLightingState('location:test');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });

    it('should log appropriate debug messages for lighting state queries', () => {
      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        if (entityId === 'location:debug_test') {
          return component === 'locations:naturally_dark';
        }
        if (entityId === 'entity:light_1') {
          return component === 'lighting:is_lit';
        }
        return false;
      });
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set(['entity:light_1'])
      );

      service.getLocationLightingState('location:debug_test');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('location:debug_test')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('naturally_dark=true')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('light sources=1')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('isLit=true')
      );
    });

    it('should log debug message for naturally lit locations', () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      service.getLocationLightingState('location:sunny');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('naturally lit')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('location:sunny')
      );
    });
  });
});
