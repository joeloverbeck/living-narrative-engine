/**
 * @file Unit tests for EntitySummaryProvider
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EntitySummaryProvider } from '../../../../src/data/providers/entitySummaryProvider.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import {
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_COMPONENT_VALUE_NA,
} from '../../../../src/constants/textDefaults.js';

describe('EntitySummaryProvider', () => {
  let provider;
  let mockEntity;

  beforeEach(() => {
    provider = new EntitySummaryProvider();

    // Create a mock entity with getComponentData method
    mockEntity = {
      id: 'test-entity-123',
      getComponentData: jest.fn(),
    };
  });

  describe('_getComponentText', () => {
    it('returns the default value when the entity is null', () => {
      expect(
        provider._getComponentText(null, NAME_COMPONENT_ID, 'fallback-value')
      ).toBe('fallback-value');
    });

    it('returns the default value when getComponentData is not a function', () => {
      const invalidEntity = { id: 'broken-entity', getComponentData: null };

      expect(
        provider._getComponentText(
          invalidEntity,
          DESCRIPTION_COMPONENT_ID,
          DEFAULT_COMPONENT_VALUE_NA
        )
      ).toBe(DEFAULT_COMPONENT_VALUE_NA);
    });

    it('supports alternate property paths when retrieving text', () => {
      const entity = {
        getComponentData: jest.fn().mockReturnValue({ displayName: '  Ada  ' }),
      };

      expect(
        provider._getComponentText(
          entity,
          NAME_COMPONENT_ID,
          DEFAULT_COMPONENT_VALUE_NA,
          'displayName'
        )
      ).toBe('Ada');
      expect(entity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_ID);
    });

    it('returns the default value when the retrieved text is blank', () => {
      const entity = {
        getComponentData: jest.fn().mockReturnValue({ text: '   ' }),
      };

      expect(
        provider._getComponentText(entity, NAME_COMPONENT_ID, 'no-value')
      ).toBe('no-value');
    });

    it('uses the provider default when no explicit default is supplied', () => {
      const entity = {
        getComponentData: jest.fn().mockReturnValue(undefined),
      };

      expect(provider._getComponentText(entity, NAME_COMPONENT_ID)).toBe(
        DEFAULT_COMPONENT_VALUE_NA
      );
    });
  });

  describe('getSummary', () => {
    it('should return entity summary with name and description', () => {
      // Arrange
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === NAME_COMPONENT_ID) {
          return { text: 'Test Character' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'A test character description' };
        }
        return null;
      });

      // Act
      const result = provider.getSummary(mockEntity);

      // Assert
      expect(result).toEqual({
        id: 'test-entity-123',
        name: 'Test Character',
        description: 'A test character description',
      });
    });

    it('should return null for name if not present', () => {
      // Arrange
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'A test character description' };
        }
        return null;
      });

      // Act
      const result = provider.getSummary(mockEntity);

      // Assert
      expect(result.name).toBeNull();
    });

    it('should return default description if not present', () => {
      // Arrange
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === NAME_COMPONENT_ID) {
          return { text: 'Test Character' };
        }
        return null;
      });

      // Act
      const result = provider.getSummary(mockEntity);

      // Assert
      expect(result.description).toBe(DEFAULT_FALLBACK_DESCRIPTION_RAW);
    });

    describe('apparent age integration', () => {
      it('should include apparent age data when present', () => {
        // Arrange
        const apparentAgeData = {
          minAge: 25,
          maxAge: 30,
          bestGuess: 28,
        };

        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Elena Rodriguez' };
          }
          if (componentId === DESCRIPTION_COMPONENT_ID) {
            return { text: 'A woman with sharp features' };
          }
          if (componentId === APPARENT_AGE_COMPONENT_ID) {
            return apparentAgeData;
          }
          return null;
        });

        // Act
        const result = provider.getSummary(mockEntity);

        // Assert
        expect(result).toEqual({
          id: 'test-entity-123',
          name: 'Elena Rodriguez',
          description: 'A woman with sharp features',
          apparentAge: apparentAgeData,
        });
      });

      it('should not include apparent age when not present', () => {
        // Arrange
        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Test Character' };
          }
          if (componentId === DESCRIPTION_COMPONENT_ID) {
            return { text: 'A test character description' };
          }
          return null;
        });

        // Act
        const result = provider.getSummary(mockEntity);

        // Assert
        expect(result).toEqual({
          id: 'test-entity-123',
          name: 'Test Character',
          description: 'A test character description',
        });
        expect(result.apparentAge).toBeUndefined();
      });

      it('should handle apparent age with only minAge and maxAge', () => {
        // Arrange
        const apparentAgeData = {
          minAge: 30,
          maxAge: 35,
        };

        mockEntity.getComponentData.mockImplementation((componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            return { text: 'Test Character' };
          }
          if (componentId === DESCRIPTION_COMPONENT_ID) {
            return { text: 'Description' };
          }
          if (componentId === APPARENT_AGE_COMPONENT_ID) {
            return apparentAgeData;
          }
          return null;
        });

        // Act
        const result = provider.getSummary(mockEntity);

        // Assert
        expect(result.apparentAge).toEqual(apparentAgeData);
      });
    });

    it('should trim whitespace from text values', () => {
      // Arrange
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === NAME_COMPONENT_ID) {
          return { text: '  Test Character  ' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: '  A test description  ' };
        }
        return null;
      });

      // Act
      const result = provider.getSummary(mockEntity);

      // Assert
      expect(result.name).toBe('Test Character');
      expect(result.description).toBe('A test description');
    });

    it('should handle empty string values', () => {
      // Arrange
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === NAME_COMPONENT_ID) {
          return { text: '' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: '' };
        }
        return null;
      });

      // Act
      const result = provider.getSummary(mockEntity);

      // Assert
      expect(result.name).toBeNull();
      expect(result.description).toBe(DEFAULT_FALLBACK_DESCRIPTION_RAW);
    });
  });
});
