import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Anatomy Description Generation - Edge Cases', () => {
  let descriptorFormatter;
  let bodyPartDescriptionBuilder;
  let mockAnatomyFormattingService;

  beforeEach(() => {
    mockAnatomyFormattingService = {
      getDescriptorOrder: jest
        .fn()
        .mockReturnValue([
          'descriptors:color_basic',
          'descriptors:size_category',
          'descriptors:shape_general',
        ]),
      getDescriptorValueKeys: jest
        .fn()
        .mockReturnValue(['value', 'color', 'size']),
      getPairedParts: jest
        .fn()
        .mockReturnValue(new Set(['eye', 'ear', 'arm', 'leg'])),
      getIrregularPlurals: jest.fn().mockReturnValue({ foot: 'feet' }),
      getNoArticleParts: jest.fn().mockReturnValue(new Set(['hair'])),
    };

    descriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
  });

  describe('DescriptorFormatter.extractDescriptors', () => {
    it('should handle null components gracefully', () => {
      const result = descriptorFormatter.extractDescriptors(null);
      expect(result).toEqual([]);
    });

    it('should handle undefined components gracefully', () => {
      const result = descriptorFormatter.extractDescriptors(undefined);
      expect(result).toEqual([]);
    });

    it('should handle non-object components gracefully', () => {
      const result = descriptorFormatter.extractDescriptors('not an object');
      expect(result).toEqual([]);
    });

    it('should handle empty components object', () => {
      const result = descriptorFormatter.extractDescriptors({});
      expect(result).toEqual([]);
    });

    it('should extract valid descriptors from components', () => {
      const components = {
        'descriptors:color_basic': { value: 'blue' },
        'descriptors:size_category': { size: 'large' },
        'core:name': { name: 'test' }, // non-descriptor component
      };

      const result = descriptorFormatter.extractDescriptors(components);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        componentId: 'descriptors:color_basic',
        value: 'blue',
      });
      expect(result).toContainEqual({
        componentId: 'descriptors:size_category',
        value: 'large',
      });
    });

    it('should skip descriptors with null componentData', () => {
      const components = {
        'descriptors:color_basic': { value: 'blue' },
        'descriptors:size_category': null,
      };

      const result = descriptorFormatter.extractDescriptors(components);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        componentId: 'descriptors:color_basic',
        value: 'blue',
      });
    });
  });

  describe('BodyPartDescriptionBuilder.buildDescription', () => {
    it('should handle null entity', () => {
      const result = bodyPartDescriptionBuilder.buildDescription(null);
      expect(result).toBe('');
    });

    it('should handle undefined entity', () => {
      const result = bodyPartDescriptionBuilder.buildDescription(undefined);
      expect(result).toBe('');
    });

    it('should handle entity without components', () => {
      const entity = {};
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('');
    });

    it('should handle entity with null components', () => {
      const entity = { components: null };
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('');
    });

    it('should handle entity without anatomy:part component', () => {
      const entity = {
        components: {
          'core:name': { name: 'test' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('');
    });

    it('should handle entity with anatomy:part but no subType', () => {
      const entity = {
        components: {
          'anatomy:part': {},
        },
      };
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('');
    });

    it('should build description for valid entity with components property', () => {
      const entity = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('blue');
    });

    it('should handle entity with getComponentData method', () => {
      const entity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          return null;
        }),
      };
      const result = bodyPartDescriptionBuilder.buildDescription(entity);
      expect(result).toBe('');
    });
  });

  describe('BodyPartDescriptionBuilder.buildMultipleDescription', () => {
    it('should handle null entities array', () => {
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        null,
        'eye'
      );
      expect(result).toBe('');
    });

    it('should handle empty entities array', () => {
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [],
        'eye'
      );
      expect(result).toBe('');
    });

    it('should handle single entity', () => {
      const entity = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'green' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [entity],
        'eye'
      );
      expect(result).toBe('green');
    });

    it('should handle array with null entities', () => {
      const entity1 = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [entity1, null, undefined],
        'eye'
      );
      // Should still process valid entities
      expect(result).toContain('blue');
    });

    it('should create paired description for matching paired parts', () => {
      const entity1 = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        },
      };
      const entity2 = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [entity1, entity2],
        'eye'
      );
      expect(result).toBe('blue');
    });

    it('should list separately for non-matching paired parts', () => {
      const entity1 = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        },
      };
      const entity2 = {
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'green' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [entity1, entity2],
        'eye'
      );
      expect(result).toEqual(['blue', 'green']);
    });

    it('should handle entities with getComponentData method', () => {
      const entity1 = {
        getComponentData: jest.fn(() => null),
      };
      const entity2 = {
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      };
      const result = bodyPartDescriptionBuilder.buildMultipleDescription(
        [entity1, entity2],
        'arm'
      );
      expect(result).toBe('');
    });
  });

  describe('Integration - Full Description Generation Flow', () => {
    let bodyDescriptionComposer;
    let mockBodyGraphService;
    let mockEntityFinder;

    beforeEach(() => {
      mockBodyGraphService = {
        getAllParts: jest.fn(),
      };

      mockEntityFinder = {
        getEntityInstance: jest.fn(),
      };

      bodyDescriptionComposer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        anatomyFormattingService: mockAnatomyFormattingService,
      });
    });

    it('should handle case where getAllParts returns entity IDs but some entities have no components', () => {
      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-id' },
        }),
      };

      // Mock getAllParts to return entity IDs
      mockBodyGraphService.getAllParts.mockReturnValue([
        'entity1',
        'entity2',
        'entity3',
      ]);

      // Mock entity finder to return entities with various states
      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity1') {
          return {
            id: 'entity1',
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockImplementation((componentId) => {
              if (componentId === 'anatomy:part') {
                return { subType: 'eye' };
              }
              if (componentId === 'core:description') {
                return { text: 'blue' };
              }
              return null;
            }),
            components: {
              'anatomy:part': { subType: 'eye' },
              'descriptors:color_basic': { value: 'blue' },
            },
          };
        } else if (id === 'entity2') {
          // Entity with no components property
          return {
            id: 'entity2',
            hasComponent: jest.fn().mockReturnValue(false),
          };
        } else if (id === 'entity3') {
          // Entity with null components
          return {
            id: 'entity3',
            hasComponent: jest.fn().mockReturnValue(true),
            components: null,
          };
        }
        return null;
      });

      // Should not throw error
      const result = bodyDescriptionComposer.composeDescription(bodyEntity);
      expect(result).toBeDefined();
      expect(result).toContain('Eye: blue');
    });

    it('should handle completely invalid body entity', () => {
      const result = bodyDescriptionComposer.composeDescription(null);
      expect(result).toBe('');
    });

    it('should handle body entity without anatomy:body component', () => {
      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
      };
      const result = bodyDescriptionComposer.composeDescription(bodyEntity);
      expect(result).toBe('');
    });

    it('should handle empty body parts list', () => {
      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-id' },
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = bodyDescriptionComposer.composeDescription(bodyEntity);
      expect(result).toBe('');
    });
  });
});
