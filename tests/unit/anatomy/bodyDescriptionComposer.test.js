import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;

  // Helper function to create mock entities with proper interface
  const createMockPartEntity = (subType) => ({
    hasComponent: jest.fn().mockReturnValue(true),
    getComponentData: jest.fn().mockReturnValue({ subType }),
  });

  beforeEach(() => {
    // Create mocks
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    // Create composer instance
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
  });

  describe('composeDescription', () => {
    it('should return empty string for null entity', () => {
      const result = composer.composeDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string for entity without anatomy:body component', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };
      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string for entity without body.root', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({}),
      };
      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string when no parts found', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValue({ body: { root: 'root-1' } }),
      };
      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should compose complete body description', () => {
      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'slender' };
          }
          return null;
        }),
      };

      const partIds = [
        'torso-1',
        'head-1',
        'hair-1',
        'eye-1',
        'eye-2',
        'arm-1',
        'arm-2',
      ];
      mockBodyGraphService.getAllParts.mockReturnValue(partIds);

      // Mock entity lookups
      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        const mockEntity = (subType, description = '') => ({
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType };
            }
            if (componentId === 'core:description' && description) {
              return { text: description };
            }
            if (componentId === 'core:name') {
              // Return names for paired parts
              if (id === 'eye-1') return { text: 'left eye' };
              if (id === 'eye-2') return { text: 'right eye' };
              if (id === 'arm-1') return { text: 'left arm' };
              if (id === 'arm-2') return { text: 'right arm' };
              return { text: subType };
            }
            return null;
          }),
        });

        const entities = {
          'torso-1': mockEntity('torso', 'a muscular torso'),
          'head-1': mockEntity('head'),
          'hair-1': mockEntity('hair', 'long black hair'),
          'eye-1': mockEntity('eye', 'piercing blue eyes'),
          'eye-2': mockEntity('eye', 'piercing blue eyes'),
          'arm-1': mockEntity('arm', 'strong arms'),
          'arm-2': mockEntity('arm', 'strong arms'),
        };
        return entities[id];
      });

      // Mock formatting service
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'build',
        'hair',
        'eye',
        'face',
        'torso',
        'arm',
      ]);
      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(
        new Set(['eye', 'arm'])
      );
      mockAnatomyFormattingService.getPairedParts =
        mockAnatomyFormattingService.getGroupedParts;

      // Mock descriptions
      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation(
        (entity) => {
          const componentData = entity.getComponentData('anatomy:part');
          const subType = componentData?.subType;
          if (subType === 'hair') return 'long black hair';
          if (subType === 'torso') return 'a muscular torso';
          return '';
        }
      );

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation(
        (parts, type) => {
          if (type === 'eye') return 'piercing blue eyes';
          if (type === 'arm') return 'strong arms';
          return '';
        }
      );

      // Mock getPlural
      mockBodyPartDescriptionBuilder.getPlural.mockImplementation((type) => {
        if (type === 'eye') return 'eyes';
        if (type === 'arm') return 'arms';
        if (type === 'hair') return 'hair';
        return type + 's';
      });

      const result = composer.composeDescription(bodyEntity);

      expect(result).toContain('Build: slender');
      expect(result).toContain('Hair: long black hair');
      expect(result).toContain('Eyes: piercing blue eyes');
      expect(result).toContain('Torso: a muscular torso');
      expect(result).toContain('Arms: strong arms');
      // Ensure the structure is correct
      expect(result.split('\n')).toHaveLength(5); // Build, Hair, Eyes, Torso, Arms
    });

    it('should use default values when anatomyFormattingService not provided', () => {
      composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        // No anatomyFormattingService
      });

      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } };
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1', 'eye-1']);
      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        const mockEntity = (subType, description) => ({
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType };
            }
            if (componentId === 'core:description' && description) {
              return { text: description };
            }
            return null;
          }),
        });

        if (id === 'torso-1') return mockEntity('torso', 'a torso');
        if (id === 'eye-1') return mockEntity('eye', 'an eye');
        return null;
      });

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        'a torso'
      );
      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation(
        (parts, type) => {
          if (type === 'torso') return 'a torso';
          if (type === 'eye') return 'an eye';
          return '';
        }
      );
      mockBodyPartDescriptionBuilder.getPlural.mockImplementation((type) => {
        return type + 's';
      });

      const result = composer.composeDescription(bodyEntity);

      expect(result).toBeTruthy();
      // Should use default description order and grouped parts
    });

    it('should handle parts without subType', () => {
      const bodyEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } };
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([
        'torso-1',
        'invalid-1',
      ]);
      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') {
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockImplementation((componentId) => {
              if (componentId === 'anatomy:part') {
                return { subType: 'torso' };
              }
              if (componentId === 'core:description') {
                return { text: 'a torso' };
              }
              return null;
            }),
          };
        }
        if (id === 'invalid-1') {
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({}), // No subType
          };
        }
        return null;
      });

      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'torso',
      ]);
      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(new Set());

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        'a torso'
      );
      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation(
        (parts, type) => {
          if (type === 'torso') return 'a torso';
          return '';
        }
      );
      mockBodyPartDescriptionBuilder.getPlural.mockImplementation((type) => {
        return type + 's';
      });

      const result = composer.composeDescription(bodyEntity);

      expect(result).toContain('Torso: a torso');
    });
  });

  describe('groupPartsByType', () => {
    it('should group parts by subtype', () => {
      const partIds = ['arm-1', 'arm-2', 'leg-1'];

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        const mockEntity = (subType) => ({
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockReturnValue({ subType }),
        });

        const entities = {
          'arm-1': mockEntity('arm'),
          'arm-2': mockEntity('arm'),
          'leg-1': mockEntity('leg'),
        };
        return entities[id];
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(2);
      expect(result.get('arm')).toHaveLength(2);
      expect(result.get('leg')).toHaveLength(1);
    });

    it('should skip null entities', () => {
      const partIds = ['valid-1', 'null-1'];

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'valid-1')
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({ subType: 'arm' }),
          };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });

    it('should skip entities without anatomy:part component', () => {
      const partIds = ['valid-1', 'no-anatomy-1'];

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'valid-1')
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({ subType: 'arm' }),
          };
        if (id === 'no-anatomy-1')
          return {
            hasComponent: jest.fn().mockReturnValue(false),
            getComponentData: jest.fn(),
          };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });

    it('should skip parts without subType', () => {
      const partIds = ['valid-1', 'no-subtype-1'];

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'valid-1')
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({ subType: 'arm' }),
          };
        if (id === 'no-subtype-1')
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({}),
          };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });
  });

  describe('extractBuildDescription', () => {
    it('should extract build description', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ build: 'athletic' }),
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('athletic');
    });

    it('should return empty string without build component', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn().mockReturnValue(null),
      };
      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string with empty build value', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ build: '' }),
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('');
    });
  });
});
