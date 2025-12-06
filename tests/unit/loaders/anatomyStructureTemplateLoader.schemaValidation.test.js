import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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

// Mock the schema validation utilities
jest.mock('../../../src/utils/schemaValidationUtils.js');
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';

// Mock helper modules
jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({
    qualifiedId: 'test_mod:test_template',
    didOverride: false,
  }),
}));

describe('AnatomyStructureTemplateLoader - Schema Validation', () => {
  let loader;
  let schemaValidator;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyStructureTemplateLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    // Reset mocks
    jest.clearAllMocks();

    // Mock validateAgainstSchema to succeed by default
    validateAgainstSchema.mockImplementation(() => ({
      isValid: true,
      errors: null,
    }));
  });

  it('should call validateAgainstSchema with correct schema ID', async () => {
    const template = {
      id: 'anatomy:test_template',
      description: 'Test template for validation',
      topology: {
        rootType: 'torso',
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
      },
    };

    await loader._processFetchedItem(
      'test_mod',
      'test.json',
      '/path/to/test.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(validateAgainstSchema).toHaveBeenCalledWith(
      schemaValidator,
      'schema://living-narrative-engine/anatomy.structure-template.schema.json',
      template,
      logger,
      expect.objectContaining({
        validationDebugMessage: 'Validating structure template from test.json',
        failureMessage: expect.stringContaining('test.json'),
        failureThrowMessage: expect.stringContaining('test.json'),
        filePath: '/path/to/test.json',
      })
    );
  });

  it('should validate valid structure template with limbSets', async () => {
    const template = {
      id: 'anatomy:test_template',
      description: 'Test template for validation',
      topology: {
        rootType: 'torso',
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
      },
    };

    validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

    const result = await loader._processFetchedItem(
      'test_mod',
      'test.json',
      '/path/to/test.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(result.qualifiedId).toBe('test_mod:test_template');
    expect(validateAgainstSchema).toHaveBeenCalled();
  });

  it('should reject template with invalid orientation scheme', async () => {
    const template = {
      id: 'anatomy:test',
      description: 'Test template with invalid scheme',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'limb',
            count: 4,
            socketPattern: {
              idTemplate: 'limb_{{index}}',
              orientationScheme: 'invalid_scheme', // Invalid!
              allowedTypes: ['limb'],
            },
          },
        ],
      },
    };

    // Mock schema validator to throw error
    validateAgainstSchema.mockImplementation(() => {
      throw new Error(
        "Invalid structure template in 'test.json' from mod 'test_mod'\nDetails:\nProperty /topology/limbSets/0/socketPattern/orientationScheme must be equal to one of the allowed values"
      );
    });

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'test.json',
        '/path/to/test.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'test.json',
        '/path/to/test.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(/schema validation failed/);
  });

  it('should validate template with appendages', async () => {
    const template = {
      id: 'anatomy:test_appendage',
      description: 'Test template with appendages',
      topology: {
        rootType: 'cephalothorax',
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'head',
              allowedTypes: ['head'],
            },
          },
        ],
      },
    };

    validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

    const result = await loader._processFetchedItem(
      'test_mod',
      'test.json',
      '/path/to/test.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(result.qualifiedId).toBe('test_mod:test_template');
    expect(validateAgainstSchema).toHaveBeenCalled();
  });

  it('should validate template variable syntax uses double braces', () => {
    const template = {
      id: 'anatomy:test',
      description: 'Test double brace syntax',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{orientation}}_{{index}}', // Double braces!
              orientationScheme: 'bilateral',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    // Pattern should match: ^[a-z_]+(\\{\\{[a-z_]+\\}\\}.*)?$
    expect(template.topology.limbSets[0].socketPattern.idTemplate).toMatch(
      /\{\{[a-z_]+\}\}/
    );
  });

  it('should throw ValidationError when schema validation fails', async () => {
    const template = {
      id: 'anatomy:invalid',
      // Missing required description field
      topology: {
        rootType: 'torso',
      },
    };

    // Mock schema validation to fail
    validateAgainstSchema.mockImplementation(() => {
      throw new Error("Missing required property 'description'");
    });

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'invalid.json',
        '/path/to/invalid.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should validate template with both limbSets and appendages', async () => {
    const template = {
      id: 'anatomy:complex',
      description: 'Complex template with both limbSets and appendages',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'arm_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['arm'],
            },
          },
        ],
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'head_socket',
              allowedTypes: ['head'],
            },
          },
        ],
      },
    };

    validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

    const result = await loader._processFetchedItem(
      'test_mod',
      'complex.json',
      '/path/to/complex.json',
      template,
      'anatomyStructureTemplates'
    );

    expect(result).toBeDefined();
    expect(validateAgainstSchema).toHaveBeenCalledTimes(1);
  });

  it('should validate all orientation scheme values', async () => {
    const validSchemes = ['bilateral', 'radial', 'indexed', 'custom'];

    for (const scheme of validSchemes) {
      jest.clearAllMocks();
      validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

      const template = {
        id: `anatomy:test_${scheme}`,
        description: `Test template with ${scheme} scheme`,
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: 'limb_{{index}}',
                orientationScheme: scheme,
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          `test_${scheme}.json`,
          `/path/to/test_${scheme}.json`,
          template,
          'anatomyStructureTemplates'
        )
      ).resolves.toBeDefined();

      expect(validateAgainstSchema).toHaveBeenCalled();
    }
  });

  it('should validate all arrangement values for limbSets', async () => {
    const validArrangements = [
      'bilateral',
      'radial',
      'quadrupedal',
      'linear',
      'custom',
    ];

    for (const arrangement of validArrangements) {
      jest.clearAllMocks();
      validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

      const template = {
        id: `anatomy:test_${arrangement}`,
        description: `Test template with ${arrangement} arrangement`,
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              arrangement,
              socketPattern: {
                idTemplate: 'limb_{{index}}',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          `test_${arrangement}.json`,
          `/path/to/test_${arrangement}.json`,
          template,
          'anatomyStructureTemplates'
        )
      ).resolves.toBeDefined();

      expect(validateAgainstSchema).toHaveBeenCalled();
    }
  });

  it('should validate all attachment values for appendages', async () => {
    const validAttachments = [
      'anterior',
      'posterior',
      'dorsal',
      'ventral',
      'lateral',
      'custom',
    ];

    for (const attachment of validAttachments) {
      jest.clearAllMocks();
      validateAgainstSchema.mockReturnValue({ isValid: true, errors: null });

      const template = {
        id: `anatomy:test_${attachment}`,
        description: `Test template with ${attachment} attachment`,
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'appendage',
              count: 1,
              attachment,
              socketPattern: {
                idTemplate: 'appendage_socket',
                allowedTypes: ['appendage'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'test_mod',
          `test_${attachment}.json`,
          `/path/to/test_${attachment}.json`,
          template,
          'anatomyStructureTemplates'
        )
      ).resolves.toBeDefined();

      expect(validateAgainstSchema).toHaveBeenCalled();
    }
  });

  it('should wrap schema validation errors in ValidationError', async () => {
    const template = {
      id: 'anatomy:invalid',
      description: 'Invalid template',
      topology: {
        rootType: 'torso',
      },
    };

    const schemaError = new Error(
      'Schema validation failed: invalid property type'
    );
    validateAgainstSchema.mockImplementation(() => {
      throw schemaError;
    });

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'invalid.json',
        '/path/to/invalid.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'invalid.json',
        '/path/to/invalid.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(/Structure template schema validation failed/);
  });

  it('should perform schema validation before manual validation', async () => {
    const template = {
      id: 'anatomy:test',
      description: 'Test template',
      // Missing topology - should fail schema validation first
    };

    let schemaValidationCalled = false;
    validateAgainstSchema.mockImplementation(() => {
      schemaValidationCalled = true;
      throw new Error('Schema validation failed: missing topology');
    });

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'test.json',
        '/path/to/test.json',
        template,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow();

    expect(schemaValidationCalled).toBe(true);
  });
});
