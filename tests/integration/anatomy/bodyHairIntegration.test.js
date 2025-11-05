import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Hair Integration', () => {
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

  it('should extract body hair from a complete entity', () => {
    // Create a mock entity that matches the expected interface
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_hair') {
          return { density: 'moderate' };
        }
        return null;
      }),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('moderate');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_hair'
    );
  });

  it('should handle entity without body hair component', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockReturnValue(null),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('');
  });

  it('should work with realistic entity data structure', () => {
    // Simulate a more realistic entity with multiple components
    const mockEntity = {
      id: 'test-entity-123',
      hasComponent: jest.fn().mockImplementation((componentId) => {
        const components = [
          'descriptors:body_hair',
          'descriptors:build',
          'anatomy:body',
        ];
        return components.includes(componentId);
      }),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        const componentData = {
          'descriptors:body_hair': { density: 'light' },
          'descriptors:build': { build: 'athletic' },
          'anatomy:body': { body: { root: 'torso' } },
        };
        return componentData[componentId] || null;
      }),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('light');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_hair'
    );
    expect(mockEntity.hasComponent).not.toHaveBeenCalled(); // Method shouldn't call hasComponent
  });

  it('should handle entity with partial component data', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_hair') {
          // Entity has the component but density field is missing
          return { someOtherField: 'value' };
        }
        return null;
      }),
    };

    const result = composer.extractBodyHairDescription(mockEntity);
    expect(result).toBe('');
  });

  it('should work alongside other descriptors', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'lean' };
        }
        if (componentId === 'descriptors:body_hair') {
          return { density: 'light' };
        }
        return null;
      }),
    };

    // Each extraction should work independently
    const hairResult = composer.extractBodyHairDescription(mockEntity);
    expect(hairResult).toBe('light');

    // Other extractors should still work
    const buildResult = composer.extractBuildDescription(mockEntity);
    expect(buildResult).toBe('athletic');

    const compositionResult =
      composer.extractBodyCompositionDescription(mockEntity);
    expect(compositionResult).toBe('lean');
  });

  it('should handle all valid body hair density values in integration context', () => {
    const validValues = [
      'hairless',
      'sparse',
      'light',
      'moderate',
      'hairy',
      'very-hairy',
    ];

    validValues.forEach((densityValue) => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'descriptors:body_hair') {
            return { density: densityValue };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe(densityValue);
    });
  });

  it('should integrate properly with other extraction methods', () => {
    const mockEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'descriptors:body_hair') {
          return { hairDensity: 'hairy' };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'stocky' };
        }
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'chubby' };
        }
        return null;
      }),
    };

    // Test all three methods work independently
    const hairResult = composer.extractBodyHairDescription(mockEntity);
    const buildResult = composer.extractBuildDescription(mockEntity);
    const compositionResult =
      composer.extractBodyCompositionDescription(mockEntity);

    expect(hairResult).toBe('hairy');
    expect(buildResult).toBe('stocky');
    expect(compositionResult).toBe('chubby');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_hair'
    );
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:build'
    );
    expect(mockEntity.getComponentData).toHaveBeenCalledWith(
      'descriptors:body_composition'
    );
  });
});
