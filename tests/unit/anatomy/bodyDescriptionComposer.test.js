import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;

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

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
      generateDescription: jest.fn(),
      generateSimpleDescription: jest.fn(),
    };

    // Create composer instance
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  describe('composeDescription', () => {
    it('should return empty string for null entity', async () => {
      const result = await composer.composeDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string for entity without anatomy:body component', async () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      };
      const result = await composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string for entity without body.root', async () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({}),
      };
      const result = await composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string when no parts found', async () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValue({ body: { root: 'root-1' } }),
      };
      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should compose complete body description', async () => {
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

      const result = await composer.composeDescription(bodyEntity);

      expect(result).toContain('Build: slender');
      expect(result).toContain('Hair: long black hair');
      expect(result).toContain('Eyes: piercing blue eyes');
      expect(result).toContain('Torso: a muscular torso');
      expect(result).toContain('Arms: strong arms');
      // Ensure the structure is correct
      expect(result.split('\n')).toHaveLength(5); // Build, Hair, Eyes, Torso, Arms
    });

    it('should use default values when anatomyFormattingService not provided', async () => {
      composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        partDescriptionGenerator: mockPartDescriptionGenerator,
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

      const result = await composer.composeDescription(bodyEntity);

      expect(result).toBeTruthy();
      // Should use default description order and grouped parts
    });

    it('should handle parts without subType', async () => {
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

      const result = await composer.composeDescription(bodyEntity);

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
    it('should extract build from body.descriptors first', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { descriptors: { build: 'athletic' } } };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'muscular' }; // Should be ignored
          }
          return null;
        }),
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('athletic');
    });

    it('should fallback to entity-level component when body.descriptors not present', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } }; // No descriptors
          }
          if (componentId === 'descriptors:build') {
            return { build: 'slim' };
          }
          return null;
        }),
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('slim');
    });

    it('should return empty string when neither body.descriptors nor entity-level exists', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue(null),
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string for invalid entity', () => {
      const result = composer.extractBuildDescription(null);
      expect(result).toBe('');
    });
  });

  describe('extractBodyCompositionDescription', () => {
    it('should extract composition from body.descriptors first', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { descriptors: { composition: 'lean' } } };
          }
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'chubby' }; // Should be ignored
          }
          return null;
        }),
      };

      const result = composer.extractBodyCompositionDescription(entity);
      expect(result).toBe('lean');
    });

    it('should fallback to entity-level component when body.descriptors not present', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } }; // No descriptors
          }
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyCompositionDescription(entity);
      expect(result).toBe('average');
    });
  });

  describe('extractBodyHairDescription', () => {
    it('should extract density from body.descriptors first', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { descriptors: { density: 'moderate' } } };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'hairy' }; // Should be ignored
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(entity);
      expect(result).toBe('moderate');
    });

    it('should fallback to entity-level component when body.descriptors not present', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } }; // No descriptors
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'sparse' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(entity);
      expect(result).toBe('sparse');
    });
  });

  describe('extractSkinColorDescription', () => {
    it('should extract skinColor from body.descriptors first', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { descriptors: { skinColor: 'olive' } } };
          }
          if (componentId === 'descriptors:skin_color') {
            return { skinColor: 'pale' }; // Should be ignored
          }
          return null;
        }),
      };

      const result = composer.extractSkinColorDescription(entity);
      expect(result).toBe('olive');
    });

    it('should fallback to entity-level component when body.descriptors not present', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso-1' } }; // No descriptors
          }
          if (componentId === 'descriptors:skin_color') {
            return { skinColor: 'bronze' };
          }
          return null;
        }),
      };

      const result = composer.extractSkinColorDescription(entity);
      expect(result).toBe('bronze');
    });

    it('should return empty string when neither body.descriptors nor entity-level exists', () => {
      const entity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue(null),
      };

      const result = composer.extractSkinColorDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string for invalid entity', () => {
      const result = composer.extractSkinColorDescription(null);
      expect(result).toBe('');
    });
  });

  describe('Body-Level Descriptor Integration', () => {
    const createEntityWithAllDescriptors = () => ({
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { root: 'torso-1' } };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        if (componentId === 'descriptors:body_composition') {
          return { composition: 'lean' };
        }
        if (componentId === 'descriptors:body_hair') {
          return { density: 'moderate' };
        }
        return null;
      }),
    });

    beforeEach(() => {
      // Need at least one part for composeDescription to proceed past the empty check
      mockBodyGraphService.getAllParts.mockReturnValue(['dummy-part-1']);
      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(new Set());

      // Mock the dummy part entity
      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'dummy-part-1') {
          return {
            hasComponent: jest.fn().mockReturnValue(true),
            getComponentData: jest.fn().mockReturnValue({ subType: 'dummy' }),
          };
        }
        return null;
      });
    });

    describe('All Three Body-Level Descriptors', () => {
      it('should integrate build, body_composition, and body_hair in configured order', async () => {
        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'body_composition',
          'body_hair',
        ]);

        const entity = createEntityWithAllDescriptors();
        const result = await composer.composeDescription(entity);
        const lines = result.split('\n');

        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Build: athletic');
        expect(lines[1]).toBe('Body composition: lean');
        expect(lines[2]).toBe('Body hair: moderate');
      });

      it('should handle reverse order', async () => {
        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'body_hair',
          'body_composition',
          'build',
        ]);

        const entity = createEntityWithAllDescriptors();
        const result = await composer.composeDescription(entity);
        const lines = result.split('\n');

        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Body hair: moderate');
        expect(lines[1]).toBe('Body composition: lean');
        expect(lines[2]).toBe('Build: athletic');
      });

      it('should skip missing descriptors without creating empty lines', async () => {
        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'body_composition',
          'body_hair',
        ]);

        const entity = {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === ANATOMY_BODY_COMPONENT_ID) {
              return { body: { root: 'torso-1' } };
            }
            if (componentId === 'descriptors:build') {
              return { build: 'athletic' };
            }
            if (componentId === 'descriptors:body_hair') {
              return { density: 'light' };
            }
            // Missing body_composition
            return null;
          }),
        };

        const result = await composer.composeDescription(entity);
        const lines = result.split('\n').filter((line) => line.trim());

        expect(lines).toHaveLength(2);
        expect(lines).toEqual(['Build: athletic', 'Body hair: light']);
        expect(result).not.toContain('Body composition:');
      });
    });

    describe('Duplicate Prevention', () => {
      it('should prevent duplicate descriptors when listed multiple times', async () => {
        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'body_composition',
          'body_composition', // Duplicate
          'body_hair',
          'build', // Duplicate
        ]);

        const entity = createEntityWithAllDescriptors();
        const result = await composer.composeDescription(entity);

        // Count occurrences
        const buildMatches = (result.match(/Build:/g) || []).length;
        const compositionMatches = (result.match(/Body composition:/g) || [])
          .length;
        const hairMatches = (result.match(/Body hair:/g) || []).length;

        expect(buildMatches).toBe(1);
        expect(compositionMatches).toBe(1);
        expect(hairMatches).toBe(1);
      });
    });

    describe('Equipment Integration', () => {
      it('should integrate equipment description when equipmentDescriptionService is provided', async () => {
        const mockEquipmentService = {
          generateEquipmentDescription: jest
            .fn()
            .mockResolvedValue('Wearing leather armor'),
        };

        composer = new BodyDescriptionComposer({
          bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
          bodyGraphService: mockBodyGraphService,
          entityFinder: mockEntityFinder,
          anatomyFormattingService: mockAnatomyFormattingService,
          partDescriptionGenerator: mockPartDescriptionGenerator,
          equipmentDescriptionService: mockEquipmentService,
        });

        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'equipment',
          'body_composition',
        ]);

        const entity = Object.assign(createEntityWithAllDescriptors(), {
          id: 'test-entity-id',
        });
        const result = await composer.composeDescription(entity);
        const lines = result.split('\n');

        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Build: athletic');
        expect(lines[1]).toBe('Wearing leather armor');
        expect(lines[2]).toBe('Body composition: lean');
        expect(
          mockEquipmentService.generateEquipmentDescription
        ).toHaveBeenCalledWith('test-entity-id');
      });

      it('should skip equipment when equipmentDescriptionService returns empty description', async () => {
        const mockEquipmentService = {
          generateEquipmentDescription: jest.fn().mockResolvedValue(''),
        };

        composer = new BodyDescriptionComposer({
          bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
          bodyGraphService: mockBodyGraphService,
          entityFinder: mockEntityFinder,
          anatomyFormattingService: mockAnatomyFormattingService,
          partDescriptionGenerator: mockPartDescriptionGenerator,
          equipmentDescriptionService: mockEquipmentService,
        });

        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'equipment',
          'body_composition',
        ]);

        const entity = Object.assign(createEntityWithAllDescriptors(), {
          id: 'test-entity-id',
        });
        const result = await composer.composeDescription(entity);
        const lines = result.split('\n');

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Build: athletic');
        expect(lines[1]).toBe('Body composition: lean');
        expect(result).not.toContain('equipment');
      });

      it('should handle equipment without equipmentDescriptionService', async () => {
        mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
          'build',
          'equipment',
          'body_composition',
        ]);

        const entity = createEntityWithAllDescriptors();
        const result = await composer.composeDescription(entity);
        const lines = result.split('\n');

        // Should skip equipment when service not provided
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Build: athletic');
        expect(lines[1]).toBe('Body composition: lean');
        expect(result).not.toContain('equipment');
      });
    });

    describe('Edge Case Validation', () => {
      it('should handle entities with invalid getComponentData method', () => {
        const invalidEntity = {
          getComponentData: 'not a function', // Invalid type
        };

        const buildResult = composer.extractBuildDescription(invalidEntity);
        const compositionResult =
          composer.extractBodyCompositionDescription(invalidEntity);
        const hairResult = composer.extractBodyHairDescription(invalidEntity);

        expect(buildResult).toBe('');
        expect(compositionResult).toBe('');
        expect(hairResult).toBe('');
      });

      it('should handle entities without hasComponent method in groupPartsByType', () => {
        const partIds = ['invalid-entity-1'];

        mockEntityFinder.getEntityInstance.mockImplementation((id) => {
          if (id === 'invalid-entity-1') {
            return {
              // Missing hasComponent method
              getComponentData: jest.fn(),
            };
          }
          return null;
        });

        const result = composer.groupPartsByType(partIds);
        expect(result.size).toBe(0);
      });

      it('should handle entities without getComponentData method in groupPartsByType', () => {
        const partIds = ['invalid-entity-2'];

        mockEntityFinder.getEntityInstance.mockImplementation((id) => {
          if (id === 'invalid-entity-2') {
            return {
              hasComponent: jest.fn().mockReturnValue(true),
              // Missing getComponentData method
            };
          }
          return null;
        });

        const result = composer.groupPartsByType(partIds);
        expect(result.size).toBe(0);
      });
    });
  });
});
