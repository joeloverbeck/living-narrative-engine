// tests/services/entityDisplayDataProvider.test.js

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { EntityDisplayDataProvider } from '../../../src/entities/entityDisplayDataProvider.js';
import {
  NAME_COMPONENT_ID,
  PORTRAIT_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { LOGGER_INFO_METHOD_ERROR } from '../../common/constants.js';

describe('EntityDisplayDataProvider', () => {
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockLocationDisplayService;
  let service;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(), // Added for constructor test
      info: jest.fn(), // Added for completeness
    };
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };
    mockLocationDisplayService = {
      getLocationDetails: jest.fn(),
      getLocationPortraitData: jest.fn(),
    };
    service = new EntityDisplayDataProvider({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      locationDisplayService: mockLocationDisplayService,
    });
  });

  // Constructor Tests
  describe('Constructor', () => {
    it('should throw an error if entityManager is missing or invalid', () => {
      expect(
        () =>
          new EntityDisplayDataProvider({
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow('Missing required dependency: entityManager.');
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: {},
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(
        "Invalid or missing method 'getEntityInstance' on dependency 'entityManager'."
      );
    });

    it('should throw an error if locationDisplayService is missing or invalid', () => {
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow('Missing required dependency: locationDisplayService.');
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
            locationDisplayService: {},
          })
      ).toThrow(
        "Invalid or missing method 'getLocationDetails' on dependency 'locationDisplayService'."
      );
    });

    it('should throw an error if logger is missing or invalid', () => {
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow('Missing required dependency: logger.');
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            logger: {},
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow(LOGGER_INFO_METHOD_ERROR);
    });

    it('should throw an error if safeEventDispatcher is missing or invalid', () => {
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency: safeEventDispatcher.');
      expect(
        () =>
          new EntityDisplayDataProvider({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: {},
          })
      ).toThrow(
        "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
      );
    });

    it('should instantiate successfully with valid dependencies', () => {
      expect(service).toBeInstanceOf(EntityDisplayDataProvider);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[EntityDisplayDataProvider] Service instantiated.'
      );
    });
  });

  // getEntityName
  describe('getEntityName', () => {
    it('should return entity name from NAME_COMPONENT', () => {
      const mockEntity = {
        id: 'player1',
        getComponentData: jest.fn().mockReturnValue({ text: 'Hero Name' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const name = service.getEntityName('player1');
      expect(name).toBe('Hero Name');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'player1'
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        NAME_COMPONENT_ID
      );
    });

    it('should return entity.id if NAME_COMPONENT is missing or text is invalid', () => {
      const mockEntityNoNameComp = {
        id: 'npcNoNameComp',
        getComponentData: jest.fn().mockReturnValue(null), // No name component
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityNoNameComp);
      expect(service.getEntityName('npcNoNameComp')).toBe('npcNoNameComp');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "getEntityDisplayName: Entity 'npcNoNameComp' has no usable name from 'core:name' component. Falling back to entity ID."
      );

      const mockEntityEmptyName = {
        id: 'npcEmptyName',
        getComponentData: jest.fn().mockReturnValue({ text: '  ' }), // Empty name
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityEmptyName);
      expect(service.getEntityName('npcEmptyName')).toBe('npcEmptyName');
    });

    it('should return defaultName if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      const name = service.getEntityName('nonExistent', 'Default Hero');
      expect(name).toBe('Default Hero');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Entity with ID 'nonExistent' not found. Returning default name."
        )
      );
    });

    it('should return defaultName if entityId is null or empty', () => {
      expect(service.getEntityName(null, 'Default')).toBe('Default');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
      expect(service.getEntityName('', 'Default')).toBe('Default');
    });
  });

  // getEntityPortraitPath
  describe('getEntityPortraitPath', () => {
    it('should return correct portrait path', () => {
      const mockEntity = {
        id: 'player1',
        definitionId: 'core:player',
        getComponentData: jest
          .fn()
          .mockReturnValue({ imagePath: 'portraits/hero.png' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const path = service.getEntityPortraitPath('player1');
      expect(path).toBe('/data/mods/core/portraits/hero.png');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        PORTRAIT_COMPONENT_ID
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Constructed portrait path for 'player1': /data/mods/core/portraits/hero.png"
        )
      );
    });

    it('should return null if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(service.getEntityPortraitPath('nonExistent')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'nonExistent' not found.")
      );
    });

    it('should return null if PORTRAIT_COMPONENT is missing or imagePath is invalid', () => {
      const mockEntityNoPortrait = {
        id: 'player1',
        definitionId: 'core:player',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityNoPortrait);
      expect(service.getEntityPortraitPath('player1')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Entity 'player1' has no valid PORTRAIT_COMPONENT_ID data or imagePath."
        )
      );

      const mockEntityEmptyPath = {
        id: 'player2',
        definitionId: 'core:player',
        getComponentData: jest.fn().mockReturnValue({ imagePath: '  ' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityEmptyPath);
      expect(service.getEntityPortraitPath('player2')).toBeNull();
    });

    it('should return null if modId cannot be extracted from definitionId', () => {
      const mockEntity = {
        id: 'player1',
        definitionId: 'invalidDefinitionId', // No colon
        getComponentData: jest
          .fn()
          .mockReturnValue({ imagePath: 'portraits/hero.png' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      expect(service.getEntityPortraitPath('player1')).toBeNull();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message:
            "Entity definitionId 'invalidDefinitionId' has invalid format. Expected format 'modId:entityName'.",
          details: expect.objectContaining({
            raw: JSON.stringify({
              definitionId: 'invalidDefinitionId',
              expectedFormat: 'modId:entityName',
              functionName: 'extractModId',
            }),
            stack: expect.any(String),
          }),
        })
      );
    });

    it('should return null if entityId is null or empty', () => {
      expect(service.getEntityPortraitPath(null)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
      expect(service.getEntityPortraitPath('')).toBeNull();
    });
  });

  // getEntityDescription
  describe('getEntityDescription', () => {
    it('should return entity description from DESCRIPTION_COMPONENT', () => {
      const mockEntity = {
        id: 'item1',
        getComponentData: jest.fn().mockReturnValue({ text: 'A shiny item.' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const desc = service.getEntityDescription('item1');
      expect(desc).toBe('A shiny item.');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
    });

    it('should return defaultDescription if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      const desc = service.getEntityDescription(
        'nonExistent',
        'No description.'
      );
      expect(desc).toBe('No description.');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'nonExistent' not found.")
      );
    });

    it('should return defaultDescription if DESCRIPTION_COMPONENT is missing', () => {
      const mockEntityNoDesc = {
        id: 'item1',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityNoDesc);
      const desc = service.getEntityDescription('item1', 'Mysterious object.');
      expect(desc).toBe('Mysterious object.');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Entity 'item1' found, but no valid DESCRIPTION_COMPONENT_ID data."
        )
      );
    });

    it('should return defaultDescription if entityId is null or empty', () => {
      expect(service.getEntityDescription(null, 'Default Desc')).toBe(
        'Default Desc'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
    });
  });

  // getEntityLocationId
  describe('getEntityLocationId', () => {
    it('should return locationId from POSITION_COMPONENT', () => {
      const mockEntity = {
        id: 'player1',
        getComponentData: jest.fn().mockReturnValue({ locationId: 'room101' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      const locId = service.getEntityLocationId('player1');
      expect(locId).toBe('room101');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        POSITION_COMPONENT_ID
      );
    });

    it('should return null if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(service.getEntityLocationId('nonExistent')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'nonExistent' not found.")
      );
    });

    it('should return null if POSITION_COMPONENT or locationId is missing/invalid', () => {
      const mockEntityNoPos = {
        id: 'player1',
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityNoPos);
      expect(service.getEntityLocationId('player1')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Entity 'player1' found, but no valid POSITION_COMPONENT_ID data or locationId."
        )
      );

      const mockEntityEmptyLocId = {
        id: 'player2',
        getComponentData: jest.fn().mockReturnValue({ locationId: '  ' }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityEmptyLocId);
      expect(service.getEntityLocationId('player2')).toBeNull();
    });

    it('should return null if entityId is null or empty', () => {
      expect(service.getEntityLocationId(null)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
    });
  });

  // getCharacterDisplayInfo
  describe('getCharacterDisplayInfo', () => {
    it('should return compiled character info', () => {
      const mockEntity = {
        id: 'char1',
        definitionId: 'mod:char_type',
        getComponentData: jest.fn((componentId) => {
          if (componentId === NAME_COMPONENT_ID)
            return { text: 'Character Name' };
          if (componentId === DESCRIPTION_COMPONENT_ID)
            return { text: 'Character Description' };
          if (componentId === PORTRAIT_COMPONENT_ID)
            return { imagePath: 'path/to/image.png' };
          return null;
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // DON'T spy on other methods of the same service instance if we want to test their integration
      // jest.spyOn(service, 'getEntityName').mockReturnValue('Character Name');
      // jest.spyOn(service, 'getEntityDescription').mockReturnValue('Character Description');
      // jest.spyOn(service, 'getEntityPortraitPath').mockReturnValue('/data/mods/mod/path/to/image.png');

      const info = service.getCharacterDisplayInfo('char1');

      expect(info).toEqual({
        id: 'char1',
        name: 'Character Name', // This will now come from the actual getEntityName logic
        description: 'Character Description', // From actual getEntityDescription
        portraitPath: '/data/mods/mod/path/to/image.png', // From actual getEntityPortraitPath
      });
      // Verify that getComponentData was called by the internal methods
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        NAME_COMPONENT_ID
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        PORTRAIT_COMPONENT_ID
      );
    });

    it('should return null if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);
      expect(service.getCharacterDisplayInfo('nonExistent')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'nonExistent' not found.")
      );
    });

    it('should use entityId as name if NAME_COMPONENT is missing', () => {
      const mockEntityNoName = {
        id: 'charNoName',
        definitionId: 'mod:char_type',
        getComponentData: jest.fn((componentId) => {
          if (componentId === DESCRIPTION_COMPONENT_ID) return { text: 'Desc' };
          return null; // NAME_COMPONENT returns null
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntityNoName);
      // No spies on internal methods needed here if we trust them from other tests

      const info = service.getCharacterDisplayInfo('charNoName');
      expect(info.name).toBe('charNoName'); // Verifies the fallback in getEntityName
      expect(info.description).toBe('Desc');
      expect(info.portraitPath).toBeNull();
    });

    it('should return null if entityId is null or empty', () => {
      expect(service.getCharacterDisplayInfo(null)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
    });

    describe('location-based delegates', () => {
      it('getLocationDetails delegates to service', () => {
        mockLocationDisplayService.getLocationDetails.mockReturnValue({
          name: 'n',
          description: 'd',
          exits: [],
        });
        const result = service.getLocationDetails('loc1');
        expect(
          mockLocationDisplayService.getLocationDetails
        ).toHaveBeenCalledWith('loc1');
        expect(result).toEqual({ name: 'n', description: 'd', exits: [] });
      });

      it('getLocationPortraitData delegates to service', () => {
        mockLocationDisplayService.getLocationPortraitData.mockReturnValue({
          imagePath: '/path/img.png',
          altText: 'alt',
        });
        const result = service.getLocationPortraitData('loc1');
        expect(
          mockLocationDisplayService.getLocationPortraitData
        ).toHaveBeenCalledWith('loc1');
        expect(result).toEqual({ imagePath: '/path/img.png', altText: 'alt' });
      });
    });
  });
});
