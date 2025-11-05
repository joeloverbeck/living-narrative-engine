/**
 * @file Unit test to isolate and test the height descriptor extraction issue
 * @description This test directly tests the BodyDescriptionComposer with a mock entity
 * that has the exact same body component structure that should be generated from Jon Ureña's recipe
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Height Descriptor Issue', () => {
  let bodyDescriptionComposer;
  let mockEntity;
  let mockEntityFinder;
  let mockBodyGraphService;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;
  let mockLogger;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    // Create a mock entity that simulates Jon Ureña's anatomy:body component structure
    mockEntity = {
      id: 'test-entity-id',
      hasComponent: jest.fn((componentId) => {
        return componentId === 'anatomy:body';
      }),
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'anatomy:body') {
          // This is the EXACT structure that should be created by AnatomyGenerationWorkflow
          // when processing Jon Ureña's recipe
          return {
            recipeId: 'p_erotica:jon_urena_recipe',
            blueprintId: 'anatomy:human_male',
            body: {
              root: 'root-entity-id',
              parts: {
                torso: 'torso-entity-id',
                head: 'head-entity-id',
              },
              descriptors: {
                build: 'stocky',
                hairDensity: 'hairy',
                height: 'tall', // This is the key descriptor that should be extracted
              },
            },
          };
        }
        return null;
      }),
    };

    // Configure mocks
    mockBodyGraphService.getAllParts.mockReturnValue(['torso-entity-id']);
    mockEntityFinder.getEntityInstance.mockReturnValue({
      hasComponent: () => true,
      getComponentData: () => ({ subType: 'torso' }),
    });

    // Create the BodyDescriptionComposer instance
    bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: null,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract height descriptor correctly from body component', () => {
    console.log('Testing height descriptor extraction...');

    // Test the height extraction method directly
    const heightDescription =
      bodyDescriptionComposer.extractHeightDescription(mockEntity);

    console.log('Extracted height description:', heightDescription);

    // This should return 'tall' from body.descriptors.height
    expect(heightDescription).toBe('tall');
  });

  it('should include height in body level descriptors', () => {
    console.log('Testing body level descriptors extraction...');

    // Test the extractBodyLevelDescriptors method
    const bodyLevelDescriptors =
      bodyDescriptionComposer.extractBodyLevelDescriptors(mockEntity);

    console.log('Extracted body level descriptors:', bodyLevelDescriptors);

    // Check that height is properly formatted
    expect(bodyLevelDescriptors.height).toBe('Height: tall');
    expect(bodyLevelDescriptors.build).toBe('Build: stocky');
    expect(bodyLevelDescriptors.body_hair).toBe('Body hair: hairy');
  });

  it('should include height in composed description', async () => {
    console.log('Testing full description composition...');

    // Mock the anatomy formatting service to return a description order that includes height
    mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
      'height', // Height should be first
      'build',
      'body_hair',
      'torso',
    ]);

    // Test the full composition
    const composedDescription =
      await bodyDescriptionComposer.composeDescription(mockEntity);

    console.log('Composed description:');
    console.log(composedDescription);

    // Split into lines and check each one
    const lines = composedDescription.split('\n').filter((line) => line.trim());
    console.log('Description lines:', lines);

    // Height should be included in the description
    expect(composedDescription).toContain('Height: tall');
    expect(composedDescription).toContain('Build: stocky');
    expect(composedDescription).toContain('Body hair: hairy');

    // Height should appear first since it's first in the order
    expect(lines[0]).toBe('Height: tall');
  });

  it('should handle entity without height descriptor gracefully', () => {
    console.log('Testing entity without height descriptor...');

    // Create an entity without height in descriptors
    const entityWithoutHeight = {
      ...mockEntity,
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'root-entity-id',
              parts: {},
              descriptors: {
                build: 'stocky',
                hairDensity: 'hairy',
                // height is missing
              },
            },
          };
        }
        return null;
      }),
    };

    const heightDescription =
      bodyDescriptionComposer.extractHeightDescription(entityWithoutHeight);
    const bodyLevelDescriptors =
      bodyDescriptionComposer.extractBodyLevelDescriptors(entityWithoutHeight);

    console.log('Height description without height:', heightDescription);
    console.log('Body descriptors without height:', bodyLevelDescriptors);

    // Should return empty string when height is not present
    expect(heightDescription).toBe('');
    expect(bodyLevelDescriptors.height).toBeUndefined();
    expect(bodyLevelDescriptors.build).toBe('Build: stocky');
    expect(bodyLevelDescriptors.body_hair).toBe('Body hair: hairy');
  });

  it('should test the exact path that should work for Jon Ureña', () => {
    console.log('Testing the exact extraction path for Jon Ureña...');

    // Call the exact same method that would be called in the real system
    const entity = mockEntity;
    const bodyComponent = entity.getComponentData('anatomy:body');

    console.log(
      'Body component structure:',
      JSON.stringify(bodyComponent, null, 2)
    );

    // Test the internal helper method directly
    const privateBodyComponent =
      bodyDescriptionComposer._getBodyComponent?.call?.(
        bodyDescriptionComposer,
        entity
      ) || bodyDescriptionComposer.extractHeightDescription(entity); // Fallback test

    console.log(
      'Height from body component descriptors:',
      bodyComponent?.body?.descriptors?.height
    );

    // This exact check should work
    const heightFromDescriptors = bodyComponent?.body?.descriptors?.height;
    expect(heightFromDescriptors).toBe('tall');

    // And the extraction method should get the same value
    const extractedHeight =
      bodyDescriptionComposer.extractHeightDescription(entity);
    expect(extractedHeight).toBe('tall');
  });
});
