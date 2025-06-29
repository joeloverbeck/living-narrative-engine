import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import LocationDisplayService from '../../../src/entities/services/locationDisplayService.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { LocationNotFoundError } from '../../../src/errors/locationNotFoundError.js';

describe('LocationDisplayService', () => {
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let service;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    mockSafeEventDispatcher = { dispatch: jest.fn() };
    service = new LocationDisplayService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  describe('getLocationDetails', () => {
    it('should return compiled location details with exits', () => {
      const mockLocationEntity = {
        id: 'loc1',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Grand Hall' };
          if (componentId === DESCRIPTION_COMPONENT_ID)
            return { text: 'A vast hall.' };
          if (componentId === EXITS_COMPONENT_ID)
            return [
              { direction: 'north', target: 'loc2' },
              { direction: 'south', target: 'loc3' },
              { direction: 'a secret passage', target: 'loc_secret' },
              { target: 'loc_no_dir' },
              null,
              { direction: '  ', target: 'loc_empty_dir' },
            ];
          return null;
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);

      const details = service.getLocationDetails('loc1');

      expect(details).toEqual({
        name: 'Grand Hall',
        description: 'A vast hall.',
        exits: [
          { description: 'north', target: 'loc2', id: 'loc2' },
          { description: 'south', target: 'loc3', id: 'loc3' },
          {
            description: 'a secret passage',
            target: 'loc_secret',
            id: 'loc_secret',
          },
          {
            description: 'Unspecified Exit',
            target: 'loc_no_dir',
            id: 'loc_no_dir',
          },
          {
            description: 'Unspecified Exit',
            target: 'loc_empty_dir',
            id: 'loc_empty_dir',
          },
        ],
      });
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('loc1');
      expect(mockLocationEntity.getComponentData).toHaveBeenCalledWith(
        NAME_COMPONENT_ID
      );
      expect(mockLocationEntity.getComponentData).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
      expect(mockLocationEntity.getComponentData).toHaveBeenCalledWith(
        EXITS_COMPONENT_ID
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid exit item in exits component for location 'loc1'"
        ),
        expect.any(Object)
      );
    });

    it('should throw LocationNotFoundError if location entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(() => service.getLocationDetails('missing')).toThrow(
        LocationNotFoundError
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Location entity with ID 'missing' not found.")
      );
    });

    it('should handle EXITS_COMPONENT_ID data being present but not an array', () => {
      const mockLocationEntity = {
        id: 'loc_bad_exits',
        getComponentData: jest.fn((id) => {
          if (id === EXITS_COMPONENT_ID) return { not_an_array: 'bad_data' };
          return null;
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);

      service.getLocationDetails('loc_bad_exits');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Exits component data for location 'loc_bad_exits' is present but not an array."
        ),
        expect.any(Object)
      );
    });

    it('should throw LocationNotFoundError if locationEntityId is null or empty', () => {
      expect(() => service.getLocationDetails(null)).toThrow(
        LocationNotFoundError
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty locationEntityId')
      );
    });
  });

  describe('getLocationPortraitData', () => {
    it('should return portrait data with alt text', () => {
      const mockEntity = {
        id: 'loc1',
        definitionId: 'core:loc',
        getComponentData: jest.fn().mockReturnValue({
          imagePath: 'images/loc.png',
          altText: 'Location Alt',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = service.getLocationPortraitData('loc1');

      expect(result).toEqual({
        imagePath: '/data/mods/core/images/loc.png',
        altText: 'Location Alt',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Constructed portrait path for location 'loc1': /data/mods/core/images/loc.png"
        )
      );
    });

    it('should return null if portrait component missing', () => {
      const mockEntity = {
        id: 'loc2',
        definitionId: 'core:loc',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const result = service.getLocationPortraitData('loc2');
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Location entity 'loc2' has no valid PORTRAIT_COMPONENT_ID data or imagePath."
        )
      );
    });

    it('should return null if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(service.getLocationPortraitData('missing')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Location entity with ID 'missing' not found.")
      );
    });

    it('should return null if locationEntityId is null or empty', () => {
      expect(service.getLocationPortraitData(null)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty locationEntityId')
      );
    });
  });
});
