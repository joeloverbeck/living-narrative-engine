/**
 * @file Unit tests for LightingStateService
 * @description Tests the service that determines location lighting state
 * based on naturally_dark marker and light_sources components.
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
        // missing getComponentData
      };

      expect(
        () =>
          new LightingStateService({
            entityManager: invalidEntityManager,
            logger: mockLogger,
          })
      ).toThrow(/Invalid or missing method 'getComponentData'/);
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
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should return isLit=false with empty lightSources when location HAS naturally_dark but NO light_sources component', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      const result = service.getLocationLightingState('location:dark_cave');

      expect(result).toEqual({ isLit: false, lightSources: [] });
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location:dark_cave',
        'locations:light_sources'
      );
    });

    it('should return isLit=false with empty lightSources when location HAS naturally_dark AND empty light_sources.sources array', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({ sources: [] });

      const result = service.getLocationLightingState('location:dark_cave');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });

    it('should return isLit=true with lightSources when location HAS naturally_dark AND non-empty light_sources.sources', () => {
      const lightSources = ['entity:lantern_1', 'entity:torch_2'];
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        sources: lightSources,
      });

      const result = service.getLocationLightingState('location:lit_tunnel');

      expect(result).toEqual({ isLit: true, lightSources });
      expect(result.lightSources).toBe(lightSources); // Same array reference
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
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      const result = service.isLocationLit('location:pitch_black_room');

      expect(result).toBe(false);
    });

    it('should return true for artificially lit locations (naturally_dark with light sources)', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        sources: ['entity:candle_1'],
      });

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

    it('should handle undefined lightSourcesData gracefully (returns empty array)', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      const result = service.getLocationLightingState('location:test');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });

    it('should handle null sources property gracefully', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({ sources: null });

      const result = service.getLocationLightingState('location:test');

      expect(result).toEqual({ isLit: false, lightSources: [] });
    });

    it('should log appropriate debug messages for lighting state queries', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        sources: ['entity:light_1'],
      });

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
