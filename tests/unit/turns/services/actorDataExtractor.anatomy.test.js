// tests/unit/turns/services/actorDataExtractor.anatomy.test.js
// --- FILE START ---

import { ActorDataExtractor } from '../../../../src/turns/services/actorDataExtractor.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

describe('ActorDataExtractor - Anatomy Handling', () => {
  let extractor;
  let mockAnatomyDescriptionService;
  let mockEntityFinder;
  let mockEntity;

  beforeEach(() => {
    // Mock the anatomy description service
    mockAnatomyDescriptionService = {
      getOrGenerateBodyDescription: jest.fn(),
    };

    // Mock the entity finder
    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    // Create the extractor with mocks
    extractor = new ActorDataExtractor({
      anatomyDescriptionService: mockAnatomyDescriptionService,
      entityFinder: mockEntityFinder,
    });

    // Create a mock entity with proper API methods
    mockEntity = {
      id: 'test-actor-id',
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };
  });

  describe('extractPromptData with anatomy description', () => {
    test('should use anatomy description when entity has anatomy:body component', () => {
      // Setup: Entity has anatomy:body component
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      const anatomyDescription = 'A tall figure with piercing eyes';
      mockAnatomyDescriptionService.getOrGenerateBodyDescription.mockReturnValue(
        anatomyDescription
      );

      // Act
      const actorState = {};
      const result = extractor.extractPromptData(actorState, 'test-actor-id');

      // Assert
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(
        'test-actor-id'
      );
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(
        mockAnatomyDescriptionService.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(result.description).toBe(anatomyDescription + '.');
    });

    test('should fall back to description component when entity lacks anatomy:body', () => {
      // Setup: Entity does NOT have anatomy:body component
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(false);
      const componentDescription = 'A regular description';

      // Act
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: componentDescription },
      };
      const result = extractor.extractPromptData(actorState, 'test-actor-id');

      // Assert
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(
        mockAnatomyDescriptionService.getOrGenerateBodyDescription
      ).not.toHaveBeenCalled();
      expect(result.description).toBe(componentDescription + '.');
    });

    test('should use default description when no anatomy or description component exists', () => {
      // Setup: No entity found
      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Act
      const actorState = {};
      const result = extractor.extractPromptData(actorState, 'test-actor-id');

      // Assert
      expect(result.description).toBe('No description available.');
    });

    test('should handle when anatomyDescriptionService returns null', () => {
      // Setup: Entity has anatomy:body but service returns null
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockAnatomyDescriptionService.getOrGenerateBodyDescription.mockReturnValue(
        null
      );
      const fallbackDescription = 'Fallback description';

      // Act
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: fallbackDescription },
      };
      const result = extractor.extractPromptData(actorState, 'test-actor-id');

      // Assert
      expect(result.description).toBe(fallbackDescription + '.');
    });

    test('should not crash when entity is undefined (the original bug)', () => {
      // Setup: Entity finder returns undefined
      mockEntityFinder.getEntityInstance.mockReturnValue(undefined);

      // Act & Assert - should not throw
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: 'Some description' },
      };
      expect(() => {
        extractor.extractPromptData(actorState, 'test-actor-id');
      }).not.toThrow();

      const result = extractor.extractPromptData(actorState, 'test-actor-id');
      expect(result.description).toBe('Some description.');
    });

    test('should handle missing anatomyDescriptionService gracefully', () => {
      // Create extractor without anatomy service
      const extractorNoAnatomy = new ActorDataExtractor({
        anatomyDescriptionService: null,
        entityFinder: mockEntityFinder,
      });

      // Setup
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      const fallbackDescription = 'Regular description';

      // Act
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: fallbackDescription },
      };
      const result = extractorNoAnatomy.extractPromptData(
        actorState,
        'test-actor-id'
      );

      // Assert - should fall back to component description
      expect(result.description).toBe(fallbackDescription + '.');
    });

    test('should handle missing entityFinder gracefully', () => {
      // Create extractor without entity finder
      const extractorNoFinder = new ActorDataExtractor({
        anatomyDescriptionService: mockAnatomyDescriptionService,
        entityFinder: null,
      });

      const fallbackDescription = 'Regular description';

      // Act
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: fallbackDescription },
      };
      const result = extractorNoFinder.extractPromptData(
        actorState,
        'test-actor-id'
      );

      // Assert - should fall back to component description
      expect(result.description).toBe(fallbackDescription + '.');
    });

    test('should prefer anatomy description over component description when both exist', () => {
      // Setup: Both anatomy and component descriptions exist
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      const anatomyDescription = 'Anatomy-based description';
      const componentDescription = 'Component-based description';
      mockAnatomyDescriptionService.getOrGenerateBodyDescription.mockReturnValue(
        anatomyDescription
      );

      // Act
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: componentDescription },
      };
      const result = extractor.extractPromptData(actorState, 'test-actor-id');

      // Assert - anatomy description should be used with terminal punctuation
      expect(result.description).toBe(anatomyDescription + '.');
    });

    test('should handle hasComponent method throwing an error', () => {
      // Setup: hasComponent throws an error
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockImplementation(() => {
        throw new Error('hasComponent error');
      });

      const fallbackDescription = 'Fallback description';

      // Act & Assert - should not crash
      const actorState = {
        [DESCRIPTION_COMPONENT_ID]: { text: fallbackDescription },
      };
      expect(() => {
        extractor.extractPromptData(actorState, 'test-actor-id');
      }).not.toThrow();

      const result = extractor.extractPromptData(actorState, 'test-actor-id');
      expect(result.description).toBe(fallbackDescription + '.');
    });
  });
});

// --- FILE END ---
