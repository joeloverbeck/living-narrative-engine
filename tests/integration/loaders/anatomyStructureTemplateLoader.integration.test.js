import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyStructureTemplateLoader from '../../../src/loaders/anatomyStructureTemplateLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

describe('AnatomyStructureTemplateLoader Integration Tests', () => {
  let loader;
  let dataRegistry;
  let schemaValidator;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    schemaValidator = createMockSchemaValidator();

    // Configure schema validator to report schema as loaded
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest.fn().mockReturnValue({ isValid: true, errors: null });

    dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyStructureTemplateLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  });

  describe('Complete Template Loading Workflow', () => {
    it('loads and stores a complete humanoid structure template', async () => {
      const templateData = {
        id: 'anatomy:structure_humanoid',
        description: 'Basic humanoid body structure with bilateral limbs',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: '{{orientation}}_arm_socket',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} arm',
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: '{{orientation}}_leg_socket',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid.structure.json',
        '/data/anatomy/humanoid.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
      expect(result.qualifiedId).toBeDefined();
      expect(dataRegistry.store).toHaveBeenCalled();
    });

    it('loads template with radial limb arrangement', async () => {
      const templateData = {
        id: 'anatomy:structure_octopus',
        description: 'Octopus body structure with radial tentacles',
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'octopus.structure.json',
        '/data/anatomy/octopus.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed')
      );
    });

    it('loads template with quadrupedal arrangement', async () => {
      const templateData = {
        id: 'anatomy:structure_quadruped',
        description: 'Generic quadruped structure',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['leg'],
                positions: [
                  'front_left',
                  'front_right',
                  'rear_left',
                  'rear_right',
                ],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                allowedTypes: ['head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'posterior_tail',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'quadruped.structure.json',
        '/data/anatomy/quadruped.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
      expect(dataRegistry.store).toHaveBeenCalled();
    });

    it('handles optional limb sets and appendages', async () => {
      const templateData = {
        id: 'anatomy:structure_flexible',
        description: 'Flexible structure with optional elements',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              optional: true,
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                allowedTypes: ['arm'],
              },
            },
          ],
          appendages: [
            {
              type: 'wing',
              count: 2,
              attachment: 'dorsal',
              optional: true,
              socketPattern: {
                idTemplate: 'wing_{{index}}',
                allowedTypes: ['wing'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'flexible.structure.json',
        '/data/anatomy/flexible.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Data Registry Integration', () => {
    it('stores template in correct registry category', async () => {
      const templateData = {
        id: 'anatomy:test_template',
        topology: {
          rootType: 'torso',
        },
      };

      await loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(dataRegistry.store).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        expect.any(String),
        expect.objectContaining({
          topology: expect.objectContaining({
            rootType: 'torso',
          }),
        })
      );
    });

    it('prevents template override from different mod', async () => {
      // Pre-populate registry with existing template from different mod
      dataRegistry.has = jest.fn().mockReturnValue(true);
      dataRegistry.get = jest.fn().mockReturnValue({
        _modId: 'core',
        id: 'existing',
        topology: { rootType: 'torso' },
      });

      const templateData = {
        id: 'anatomy:existing',
        topology: {
          rootType: 'cephalothorax',
        },
      };

      // Should throw DuplicateContentError when trying to override from different mod
      await expect(
        loader._processFetchedItem(
          'anatomy',
          'override.json',
          '/tmp/override.json',
          templateData,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow();
    });
  });

  describe('Schema Validation Integration', () => {
    it('works with schema validator service', async () => {
      const templateData = {
        id: 'anatomy:test',
        topology: {
          rootType: 'torso',
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        templateData,
        'anatomyStructureTemplates'
      );

      // Schema validation happens in base class during loading phase
      expect(result).toBeDefined();
      expect(result.qualifiedId).toBeDefined();
    });

    it('should reject invalid template at load time (missing topology)', async () => {
      const invalidTemplate = {
        id: 'anatomy:invalid',
        description: 'Invalid template missing topology field',
        // Missing required topology field
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          'invalid.json',
          '/path/to/invalid.json',
          invalidTemplate,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(/topology/);
    });

    it('should reject invalid template at load time (missing rootType)', async () => {
      const invalidTemplate = {
        id: 'anatomy:invalid',
        description: 'Invalid template missing rootType',
        topology: {
          // Missing required rootType field
          limbSets: [],
        },
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          'invalid.json',
          '/path/to/invalid.json',
          invalidTemplate,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(/rootType/);
    });

    it('should load valid octopoid-style template successfully', async () => {
      const octopoidTemplate = {
        id: 'anatomy:test_octopoid',
        description: 'Octopoid template with radial tentacles',
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'test_mod',
        'octopoid.json',
        '/path/to/octopoid.json',
        octopoidTemplate,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
      expect(result.qualifiedId).toBeDefined();
    });

    it('should validate socket pattern structure', async () => {
      const template = {
        id: 'anatomy:test_socket',
        description: 'Template with socket pattern validation',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'test_mod',
        'socket.json',
        '/path/to/socket.json',
        template,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });

    it('should validate limb set structure with all fields', async () => {
      const template = {
        id: 'anatomy:test_limbset',
        description: 'Template with complete limb set validation',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['leg'],
                positions: ['front_left', 'front_right', 'rear_left', 'rear_right'],
              },
              optional: false,
              arrangementHint: 'quadrupedal stance',
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'test_mod',
        'limbset.json',
        '/path/to/limbset.json',
        template,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });

    it('should validate appendage structure with all fields', async () => {
      const template = {
        id: 'anatomy:test_appendage',
        description: 'Template with complete appendage validation',
        topology: {
          rootType: 'cephalothorax',
          appendages: [
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'posterior_tail',
                allowedTypes: ['tail'],
                nameTpl: '{{type}}',
              },
              optional: false,
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'test_mod',
        'appendage.json',
        '/path/to/appendage.json',
        template,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });

    it('should validate template with double-brace variable syntax', async () => {
      const template = {
        id: 'anatomy:test_variables',
        description: 'Template testing double-brace variable syntax',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'test_mod',
        'variables.json',
        '/path/to/variables.json',
        template,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();

      // Verify double-brace syntax
      const socketPattern = template.topology.limbSets[0].socketPattern;
      expect(socketPattern.idTemplate).toMatch(/\{\{[a-z_]+\}\}/);
    });

    it('should reject template with invalid orientation scheme', async () => {
      const template = {
        id: 'anatomy:invalid_scheme',
        description: 'Template with invalid orientation scheme',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                orientationScheme: 'invalid_orientation_scheme',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          'invalid_scheme.json',
          '/path/to/invalid_scheme.json',
          template,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Error Handling Integration', () => {
    it('propagates ValidationError for invalid limb set count', async () => {
      const templateData = {
        id: 'anatomy:invalid',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 101,
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'invalid.json',
          '/tmp/invalid.json',
          templateData,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('propagates ValidationError for invalid appendage count', async () => {
      const templateData = {
        id: 'anatomy:invalid',
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'tail',
              count: 11,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail_{{index}}',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'invalid.json',
          '/tmp/invalid.json',
          templateData,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('propagates ValidationError for invalid socket pattern', async () => {
      const templateData = {
        id: 'anatomy:invalid',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'invalid-pattern',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'invalid.json',
          '/tmp/invalid.json',
          templateData,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Complex Structure Templates', () => {
    it('loads multi-limb-set template with mixed arrangements', async () => {
      const templateData = {
        id: 'anatomy:structure_centaur',
        description: 'Centaur structure with humanoid upper body and equine lower body',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: '{{orientation}}_arm_socket',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                allowedTypes: ['head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'posterior_tail',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'centaur.structure.json',
        '/data/anatomy/centaur.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed')
      );
    });

    it('loads template with maximum limb count (100)', async () => {
      const templateData = {
        id: 'anatomy:structure_millipede',
        description: 'Many-legged creature',
        topology: {
          rootType: 'segmented_body',
          limbSets: [
            {
              type: 'leg',
              count: 100,
              arrangement: 'linear',
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'millipede.structure.json',
        '/data/anatomy/millipede.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });

    it('loads template with maximum appendage count (10)', async () => {
      const templateData = {
        id: 'anatomy:structure_medusa',
        description: 'Medusa with multiple snake appendages',
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'snake_hair',
              count: 10,
              attachment: 'dorsal',
              socketPattern: {
                idTemplate: 'snake_{{index}}',
                allowedTypes: ['snake'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'medusa.structure.json',
        '/data/anatomy/medusa.structure.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Logging Integration', () => {
    it('logs processing steps correctly', async () => {
      const templateData = {
        id: 'anatomy:test',
        topology: {
          rootType: 'torso',
        },
      };

      await loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        templateData,
        'anatomyStructureTemplates'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Processing fetched item')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully processed')
      );
    });
  });
});
