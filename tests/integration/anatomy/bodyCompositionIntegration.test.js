import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Composition Integration', () => {
  let composer;

  beforeEach(() => {
    // Create mocks for required dependencies
    const mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    const mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    const mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    const mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    const mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  it('should extract composition from a complete entity', () => {
    // Create a mock entity that matches the expected interface
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'average' };
        }
        return null;
      }),
    };

    const result = composer.extractBodyCompositionDescription(mockEntity);
    expect(result).toBe('average');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_composition'
    );
  });

  it('should work with realistic entity data structure', () => {
    // Simulate a more realistic entity with multiple components
    const mockEntity = {
      id: 'test-entity-123',
      hasComponent: jest.fn().mockImplementation((componentId) => {
        const components = [
          'descriptors:body_composition',
          'descriptors:build',
          'anatomy:body',
        ];
        return components.includes(componentId);
      }),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        const componentData = {
          'descriptors:body_composition': { composition: 'lean' },
          'descriptors:build': { build: 'athletic' },
          'anatomy:body': { body: { root: 'torso' } },
        };
        return componentData[componentId] || null;
      }),
    };

    const result = composer.extractBodyCompositionDescription(mockEntity);
    expect(result).toBe('lean');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_composition'
    );
    expect(mockEntity.hasComponent).not.toHaveBeenCalled(); // Method shouldn't call hasComponent
  });

  it('should handle entity with partial component data', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_composition') {
          // Entity has the component but composition field is missing
          return { someOtherField: 'value' };
        }
        return null;
      }),
    };

    const result = composer.extractBodyCompositionDescription(mockEntity);
    expect(result).toBe('');
  });

  it('should integrate properly with other extraction methods', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'chubby' };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'stocky' };
        }
        return null;
      }),
    };

    // Test both methods work independently
    const compositionResult =
      composer.extractBodyCompositionDescription(mockEntity);
    const buildResult = composer.extractBuildDescription(mockEntity);

    expect(compositionResult).toBe('chubby');
    expect(buildResult).toBe('stocky');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_composition'
    );
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:build'
    );
  });
});
