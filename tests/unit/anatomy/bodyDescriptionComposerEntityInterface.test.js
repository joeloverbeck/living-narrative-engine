import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer Entity Interface Fix', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;

  beforeEach(() => {
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
    });
  });

  describe('Entity Interface Methods', () => {
    it('should use hasComponent and getComponentData instead of direct component access', () => {
      // Create a mock entity with proper interface methods
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
      };

      // Setup mock returns
      mockEntity.hasComponent.mockImplementation((componentId) => {
        return componentId === ANATOMY_BODY_COMPONENT_ID;
      });

      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { root: 'torso-1' } };
        }
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1']);

      // Mock entity lookup
      mockEntityFinder.getEntityInstance.mockReturnValue({
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ subType: 'torso' }),
      });

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        'a torso'
      );

      // Call the method
      const result = composer.composeDescription(mockEntity);

      // Verify Entity interface methods were called
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );

      // Should not throw the error from the console log
      expect(result).toBeTruthy();
    });

    it('should handle entity without anatomy:body component using interface methods', () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };

      const result = composer.composeDescription(mockEntity);

      expect(result).toBe('');
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(mockEntity.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle build descriptor using getComponentData', () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn(),
      };

      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { root: 'torso-1' } };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1']);
      mockEntityFinder.getEntityInstance.mockReturnValue({
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ subType: 'torso' }),
      });

      const result = composer.composeDescription(mockEntity);

      expect(result).toContain('A athletic figure');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:build'
      );
    });

    it('should handle parts using Entity interface in groupPartsByType', () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'torso-1' },
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['part-1', 'part-2']);

      // Mock part entities with proper interface
      const mockPart1 = {
        id: 'part-1',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ subType: 'arm' }),
      };

      const mockPart2 = {
        id: 'part-2',
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-1') return mockPart1;
        if (id === 'part-2') return mockPart2;
        return null;
      });

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue(
        'arms'
      );

      const result = composer.composeDescription(mockEntity);

      // Verify part entities were checked using interface methods
      expect(mockPart1.hasComponent).toHaveBeenCalledWith('anatomy:part');
      expect(mockPart1.getComponentData).toHaveBeenCalledWith('anatomy:part');
      expect(mockPart2.hasComponent).toHaveBeenCalledWith('anatomy:part');
      // Part 2 should not have getComponentData called since hasComponent returned false
      expect(mockPart2.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Error Prevention', () => {
    it('should not throw "Cannot read properties of undefined" error', () => {
      // This test specifically addresses the console error
      const mockEntity = {
        id: 'test-entity',
        // Simulate an entity that might not have all expected methods
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'torso-1' },
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1']);

      // Return entity with proper interface
      mockEntityFinder.getEntityInstance.mockReturnValue({
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ subType: 'torso' }),
      });

      // This should not throw
      expect(() => {
        composer.composeDescription(mockEntity);
      }).not.toThrow();
    });

    it('should handle null entity gracefully', () => {
      const result = composer.composeDescription(null);
      expect(result).toBe('');
    });

    it('should handle undefined entity gracefully', () => {
      const result = composer.composeDescription(undefined);
      expect(result).toBe('');
    });

    it('should handle entity with null component data', () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue(null),
      };

      const result = composer.composeDescription(mockEntity);
      expect(result).toBe('');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with updated test mocks using Entity interface', () => {
      // This ensures our test updates are correct
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } };
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1', 'head-1']);

      const createMockPartEntity = (subType) => ({
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ subType }),
      });

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'torso-1': createMockPartEntity('torso'),
          'head-1': createMockPartEntity('head'),
        };
        return entities[id];
      });

      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation(
        (entity) => {
          const componentData = entity.getComponentData('anatomy:part');
          const subType = componentData?.subType;
          if (subType === 'torso') return 'a muscular torso';
          if (subType === 'head') return 'a noble head';
          return '';
        }
      );

      const result = composer.composeDescription(mockEntity);

      expect(result).toContain('The body has a muscular torso');
    });
  });
});
