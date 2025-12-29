/**
 * @file Unit tests for gender descriptor extraction in BodyDescriptionComposer
 * @description Tests the extraction of gender from core:gender component
 * Gender is special - it extracts from entity's core:gender component, not body.descriptors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Gender Descriptor', () => {
  let bodyDescriptionComposer;
  let mockEntity;
  let mockEntityFinder;
  let mockBodyGraphService;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;
  let mockLogger;

  beforeEach(() => {
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

    // Create a mock entity with both anatomy:body and core:gender components
    mockEntity = {
      id: 'test-entity-id',
      hasComponent: jest.fn((componentId) => {
        return componentId === 'anatomy:body' || componentId === 'core:gender';
      }),
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'root-entity-id',
              parts: {},
              descriptors: {
                height: 'tall',
                build: 'athletic',
              },
            },
          };
        }
        if (componentId === 'core:gender') {
          return {
            value: 'female',
          };
        }
        return null;
      }),
    };

    mockBodyGraphService.getAllParts.mockReturnValue([]);
    mockEntityFinder.getEntityInstance.mockReturnValue(null);

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

  describe('extractGenderDescription', () => {
    it('should return gender value when entity has core:gender component', () => {
      const result = bodyDescriptionComposer.extractGenderDescription(mockEntity);
      expect(result).toBe('female');
    });

    it('should return empty string when entity is null', () => {
      const result = bodyDescriptionComposer.extractGenderDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string when entity is undefined', () => {
      const result = bodyDescriptionComposer.extractGenderDescription(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when entity has no hasComponent method', () => {
      const invalidEntity = { id: 'invalid' };
      const result = bodyDescriptionComposer.extractGenderDescription(invalidEntity);
      expect(result).toBe('');
    });

    it('should return empty string when entity lacks core:gender component', () => {
      const entityWithoutGender = {
        id: 'no-gender-entity',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'root', parts: {}, descriptors: {} } };
          }
          return null;
        }),
      };

      const result = bodyDescriptionComposer.extractGenderDescription(entityWithoutGender);
      expect(result).toBe('');
    });

    it('should return empty string when core:gender has no value', () => {
      const entityWithEmptyGender = {
        id: 'empty-gender-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:gender') {
            return {}; // No value property
          }
          return null;
        }),
      };

      const result = bodyDescriptionComposer.extractGenderDescription(entityWithEmptyGender);
      expect(result).toBe('');
    });

    it('should return "male" for male gender', () => {
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'core:gender') {
          return { value: 'male' };
        }
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root', parts: {}, descriptors: {} } };
        }
        return null;
      });

      const result = bodyDescriptionComposer.extractGenderDescription(mockEntity);
      expect(result).toBe('male');
    });

    it('should return "neutral" for neutral gender', () => {
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'core:gender') {
          return { value: 'neutral' };
        }
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root', parts: {}, descriptors: {} } };
        }
        return null;
      });

      const result = bodyDescriptionComposer.extractGenderDescription(mockEntity);
      expect(result).toBe('neutral');
    });
  });

  describe('extractBodyLevelDescriptors - gender integration', () => {
    it('should include formatted gender in body level descriptors', () => {
      const descriptors = bodyDescriptionComposer.extractBodyLevelDescriptors(mockEntity);

      expect(descriptors.gender).toBe('Gender: female');
    });

    it('should not include gender when entity lacks core:gender component', () => {
      const entityWithoutGender = {
        id: 'no-gender-entity',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root',
                parts: {},
                descriptors: { height: 'tall' },
              },
            };
          }
          return null;
        }),
      };

      const descriptors = bodyDescriptionComposer.extractBodyLevelDescriptors(entityWithoutGender);

      expect(descriptors.gender).toBeUndefined();
      expect(descriptors.height).toBe('Height: tall');
    });
  });

  describe('composeDescription - gender ordering', () => {
    it('should include gender before height in composed description', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'gender',
        'height',
        'build',
      ]);

      const description = await bodyDescriptionComposer.composeDescription(mockEntity);
      const lines = description.split('\n').filter((line) => line.trim());

      expect(description).toContain('Gender: female');
      expect(description).toContain('Height: tall');

      // Gender should appear before height
      const genderIndex = lines.findIndex((line) => line.includes('Gender:'));
      const heightIndex = lines.findIndex((line) => line.includes('Height:'));

      expect(genderIndex).toBeLessThan(heightIndex);
    });

    it('should not include gender line when entity has no core:gender', async () => {
      const entityWithoutGender = {
        id: 'no-gender-entity',
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root',
                parts: {},
                descriptors: { height: 'tall' },
              },
            };
          }
          return null;
        }),
      };

      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'gender',
        'height',
      ]);

      const description = await bodyDescriptionComposer.composeDescription(entityWithoutGender);

      expect(description).not.toContain('Gender:');
      expect(description).toContain('Height: tall');
    });

    it('should handle all three gender values correctly in composed description', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue(['gender']);

      // Test male
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'core:gender') return { value: 'male' };
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root', parts: {}, descriptors: {} } };
        }
        return null;
      });
      let description = await bodyDescriptionComposer.composeDescription(mockEntity);
      expect(description).toContain('Gender: male');

      // Test female
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'core:gender') return { value: 'female' };
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root', parts: {}, descriptors: {} } };
        }
        return null;
      });
      description = await bodyDescriptionComposer.composeDescription(mockEntity);
      expect(description).toContain('Gender: female');

      // Test neutral
      mockEntity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'core:gender') return { value: 'neutral' };
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root', parts: {}, descriptors: {} } };
        }
        return null;
      });
      description = await bodyDescriptionComposer.composeDescription(mockEntity);
      expect(description).toContain('Gender: neutral');
    });
  });

  describe('consistency across multiple calls', () => {
    it('should return consistent gender results across multiple calls', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue(['gender', 'height']);

      const result1 = await bodyDescriptionComposer.composeDescription(mockEntity);
      const result2 = await bodyDescriptionComposer.composeDescription(mockEntity);
      const result3 = await bodyDescriptionComposer.composeDescription(mockEntity);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
