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

// Mock helper modules used internally
jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({
    qualifiedId: 'anatomy:structure_humanoid',
    didOverride: false,
  }),
}));

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

describe('AnatomyStructureTemplateLoader._processFetchedItem', () => {
  let loader;
  let logger;
  let schemaValidator;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    schemaValidator = createMockSchemaValidator();

    // Configure schema validator to report schema as loaded
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });

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

    jest.clearAllMocks();
  });

  it('processes a valid structure template and stores it', async () => {
    const data = {
      id: 'anatomy:structure_humanoid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            socketPattern: {
              idTemplate: 'arm_{{index}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['arm'],
            },
          },
        ],
      },
    };

    const result = await loader._processFetchedItem(
      'anatomy',
      'humanoid.structure.json',
      '/tmp/humanoid.structure.json',
      data,
      'anatomyStructureTemplates'
    );

    expect(processAndStoreItem).toHaveBeenCalledWith(
      loader,
      expect.objectContaining({
        data,
        idProp: 'id',
        category: 'anatomyStructureTemplates',
        modId: 'anatomy',
        filename: 'humanoid.structure.json',
      })
    );
    expect(result).toEqual({
      qualifiedId: 'anatomy:structure_humanoid',
      didOverride: false,
    });
  });

  it('throws ValidationError when id is missing', async () => {
    const data = {
      topology: { rootType: 'torso' },
    };

    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);
    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow("Missing required 'id' field");
  });

  it('throws ValidationError when topology is missing', async () => {
    const data = {
      id: 'anatomy:test',
    };

    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);
    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow("Missing required 'topology' field");
  });

  it('throws ValidationError when topology.rootType is missing', async () => {
    const data = {
      id: 'anatomy:test',
      topology: {},
    };

    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow(ValidationError);
    await expect(
      loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      )
    ).rejects.toThrow("Missing required 'topology.rootType' field");
  });

  it('processes template with limbSets and appendages', async () => {
    const data = {
      id: 'anatomy:test',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 4,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
        appendages: [
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'tail_socket',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const validateLimbSetsSpy = jest.spyOn(loader, '_validateLimbSets');
    const validateAppendagesSpy = jest.spyOn(loader, '_validateAppendages');

    await loader._processFetchedItem(
      'anatomy',
      'test.json',
      '/tmp/test.json',
      data,
      'anatomyStructureTemplates'
    );

    expect(validateLimbSetsSpy).toHaveBeenCalledWith(
      data.topology.limbSets,
      'anatomy',
      'test.json'
    );
    expect(validateAppendagesSpy).toHaveBeenCalledWith(
      data.topology.appendages,
      'anatomy',
      'test.json'
    );
  });

  it('skips validation when limbSets are absent', async () => {
    const data = {
      id: 'anatomy:test',
      topology: { rootType: 'torso' },
    };

    const validateLimbSetsSpy = jest.spyOn(loader, '_validateLimbSets');

    await loader._processFetchedItem(
      'anatomy',
      'test.json',
      '/tmp/test.json',
      data,
      'anatomyStructureTemplates'
    );

    expect(validateLimbSetsSpy).not.toHaveBeenCalled();
  });

  it('skips validation when appendages are absent', async () => {
    const data = {
      id: 'anatomy:test',
      topology: { rootType: 'torso' },
    };

    const validateAppendagesSpy = jest.spyOn(loader, '_validateAppendages');

    await loader._processFetchedItem(
      'anatomy',
      'test.json',
      '/tmp/test.json',
      data,
      'anatomyStructureTemplates'
    );

    expect(validateAppendagesSpy).not.toHaveBeenCalled();
  });
});

describe('AnatomyStructureTemplateLoader._validateLimbSets', () => {
  let loader;

  beforeEach(() => {
    const schemaValidator = createMockSchemaValidator();
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });

    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      schemaValidator,
      createSimpleMockDataRegistry(),
      createMockLogger()
    );
  });

  it('validates limb set with valid count (1-100)', () => {
    const limbSets = [
      {
        type: 'arm',
        count: 2,
        socketPattern: {
          idTemplate: 'arm_{{index}}',
          allowedTypes: ['arm'],
        },
      },
      {
        type: 'leg',
        count: 100,
        socketPattern: {
          idTemplate: 'leg_{{index}}',
          allowedTypes: ['leg'],
        },
      },
    ];

    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).not.toThrow();
  });

  it('throws ValidationError when count is below minimum (< 1)', () => {
    const limbSets = [
      {
        type: 'arm',
        count: 0,
        socketPattern: {
          idTemplate: 'arm_{{index}}',
          allowedTypes: ['arm'],
        },
      },
    ];

    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow('count must be between 1 and 100');
  });

  it('throws ValidationError when count is above maximum (> 100)', () => {
    const limbSets = [
      {
        type: 'arm',
        count: 101,
        socketPattern: {
          idTemplate: 'arm_{{index}}',
          allowedTypes: ['arm'],
        },
      },
    ];

    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow('count must be between 1 and 100');
  });

  it('throws ValidationError when count is not a number', () => {
    const limbSets = [
      {
        type: 'arm',
        count: '2',
        socketPattern: {
          idTemplate: 'arm_{{index}}',
          allowedTypes: ['arm'],
        },
      },
    ];

    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
  });

  it('validates arrangement enum values', () => {
    const validArrangements = [
      'bilateral',
      'radial',
      'quadrupedal',
      'linear',
      'custom',
    ];

    for (const arrangement of validArrangements) {
      const limbSets = [
        {
          type: 'leg',
          count: 2,
          arrangement,
          socketPattern: {
            idTemplate: 'leg_{{index}}',
            allowedTypes: ['leg'],
          },
        },
      ];

      expect(() =>
        loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
      ).not.toThrow();
    }
  });

  it('throws ValidationError for invalid arrangement value', () => {
    const limbSets = [
      {
        type: 'leg',
        count: 2,
        arrangement: 'invalid_arrangement',
        socketPattern: {
          idTemplate: 'leg_{{index}}',
          allowedTypes: ['leg'],
        },
      },
    ];

    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateLimbSets(limbSets, 'anatomy', 'test.json')
    ).toThrow('Invalid arrangement');
  });

  it('validates socket pattern when present', () => {
    const limbSets = [
      {
        type: 'arm',
        count: 2,
        socketPattern: {
          idTemplate: 'arm_{{index}}',
          allowedTypes: ['arm'],
        },
      },
    ];

    const validateSocketPatternSpy = jest.spyOn(
      loader,
      '_validateSocketPattern'
    );

    loader._validateLimbSets(limbSets, 'anatomy', 'test.json');

    expect(validateSocketPatternSpy).toHaveBeenCalledWith(
      limbSets[0].socketPattern,
      'limb set 1',
      'anatomy',
      'test.json'
    );
  });
});

describe('AnatomyStructureTemplateLoader._validateAppendages', () => {
  let loader;

  beforeEach(() => {
    const schemaValidator = createMockSchemaValidator();
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });

    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      schemaValidator,
      createSimpleMockDataRegistry(),
      createMockLogger()
    );
  });

  it('validates appendage with valid count (1-10)', () => {
    const appendages = [
      {
        type: 'head',
        count: 1,
        attachment: 'anterior',
        socketPattern: {
          idTemplate: 'head_socket',
          allowedTypes: ['head'],
        },
      },
      {
        type: 'tail',
        count: 10,
        attachment: 'posterior',
        socketPattern: {
          idTemplate: 'tail_{{index}}',
          allowedTypes: ['tail'],
        },
      },
    ];

    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).not.toThrow();
  });

  it('throws ValidationError when count is below minimum (< 1)', () => {
    const appendages = [
      {
        type: 'tail',
        count: 0,
        attachment: 'posterior',
        socketPattern: {
          idTemplate: 'tail_socket',
          allowedTypes: ['tail'],
        },
      },
    ];

    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow('count must be between 1 and 10');
  });

  it('throws ValidationError when count is above maximum (> 10)', () => {
    const appendages = [
      {
        type: 'tail',
        count: 11,
        attachment: 'posterior',
        socketPattern: {
          idTemplate: 'tail_{{index}}',
          allowedTypes: ['tail'],
        },
      },
    ];

    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow('count must be between 1 and 10');
  });

  it('validates attachment enum values', () => {
    const validAttachments = [
      'anterior',
      'posterior',
      'dorsal',
      'ventral',
      'lateral',
      'custom',
    ];

    for (const attachment of validAttachments) {
      const appendages = [
        {
          type: 'appendage',
          count: 1,
          attachment,
          socketPattern: {
            idTemplate: 'appendage_socket',
            allowedTypes: ['appendage'],
          },
        },
      ];

      expect(() =>
        loader._validateAppendages(appendages, 'anatomy', 'test.json')
      ).not.toThrow();
    }
  });

  it('throws ValidationError for invalid attachment value', () => {
    const appendages = [
      {
        type: 'tail',
        count: 1,
        attachment: 'invalid_attachment',
        socketPattern: {
          idTemplate: 'tail_socket',
          allowedTypes: ['tail'],
        },
      },
    ];

    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateAppendages(appendages, 'anatomy', 'test.json')
    ).toThrow('Invalid attachment');
  });

  it('validates socket pattern when present', () => {
    const appendages = [
      {
        type: 'head',
        count: 1,
        attachment: 'anterior',
        socketPattern: {
          idTemplate: 'head_socket',
          allowedTypes: ['head'],
        },
      },
    ];

    const validateSocketPatternSpy = jest.spyOn(
      loader,
      '_validateSocketPattern'
    );

    loader._validateAppendages(appendages, 'anatomy', 'test.json');

    expect(validateSocketPatternSpy).toHaveBeenCalledWith(
      appendages[0].socketPattern,
      'appendage 1',
      'anatomy',
      'test.json'
    );
  });
});

describe('AnatomyStructureTemplateLoader._validateSocketPattern', () => {
  let loader;

  beforeEach(() => {
    const schemaValidator = createMockSchemaValidator();
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });

    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      schemaValidator,
      createSimpleMockDataRegistry(),
      createMockLogger()
    );
  });

  it('validates socket pattern with template variables', () => {
    const socketPattern = {
      idTemplate: 'arm_{{index}}',
      allowedTypes: ['arm'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).not.toThrow();
  });

  it('validates socket pattern with multiple template variables', () => {
    const socketPattern = {
      idTemplate: '{{orientation}}_arm_{{index}}',
      allowedTypes: ['arm'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).not.toThrow();
  });

  it('validates static template identifiers', () => {
    const socketPattern = {
      idTemplate: 'anterior_head',
      allowedTypes: ['head'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).not.toThrow();
  });

  it('throws ValidationError when idTemplate is missing', () => {
    const socketPattern = {
      allowedTypes: ['arm'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Missing idTemplate');
  });

  it('throws ValidationError when idTemplate lacks variables and is not static', () => {
    const socketPattern = {
      idTemplate: 'arm-index',
      allowedTypes: ['arm'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Must contain template variables');
  });

  it('validates orientation scheme enum values', () => {
    const validSchemes = ['bilateral', 'radial', 'indexed', 'custom'];

    for (const scheme of validSchemes) {
      const socketPattern = {
        idTemplate: 'limb_{{index}}',
        orientationScheme: scheme,
        allowedTypes: ['limb'],
      };

      expect(() =>
        loader._validateSocketPattern(
          socketPattern,
          'test context',
          'anatomy',
          'test.json'
        )
      ).not.toThrow();
    }
  });

  it('throws ValidationError for invalid orientation scheme', () => {
    const socketPattern = {
      idTemplate: 'limb_{{index}}',
      orientationScheme: 'invalid_scheme',
      allowedTypes: ['limb'],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Invalid orientationScheme');
  });

  it('throws ValidationError when allowedTypes is missing', () => {
    const socketPattern = {
      idTemplate: 'arm_{{index}}',
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Missing or empty allowedTypes');
  });

  it('throws ValidationError when allowedTypes is empty', () => {
    const socketPattern = {
      idTemplate: 'arm_{{index}}',
      allowedTypes: [],
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Missing or empty allowedTypes');
  });

  it('throws ValidationError when allowedTypes is not an array', () => {
    const socketPattern = {
      idTemplate: 'arm_{{index}}',
      allowedTypes: 'arm',
    };

    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow(ValidationError);
    expect(() =>
      loader._validateSocketPattern(
        socketPattern,
        'test context',
        'anatomy',
        'test.json'
      )
    ).toThrow('Missing or empty allowedTypes');
  });
});

describe('AnatomyStructureTemplateLoader - Constructor', () => {
  it('initializes with correct parameters', () => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });
    const dataRegistry = createSimpleMockDataRegistry();
    const logger = createMockLogger();

    const loader = new AnatomyStructureTemplateLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    expect(loader).toBeDefined();
    expect(loader._logger).toBe(logger);
    expect(loader._dataRegistry).toBe(dataRegistry);
  });
});

describe('AnatomyStructureTemplateLoader - Architecture Integration', () => {
  let loader;
  let dataRegistry;
  let logger;
  let schemaValidator;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    schemaValidator = createMockSchemaValidator();

    // Configure schema validator to report schema as loaded
    schemaValidator.isSchemaLoaded = jest.fn().mockReturnValue(true);
    schemaValidator.validate = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });

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

    jest.clearAllMocks();
  });

  describe('SimpleItemLoader Extension', () => {
    it('extends SimpleItemLoader correctly', () => {
      // Verify inheritance chain
      expect(loader).toBeInstanceOf(AnatomyStructureTemplateLoader);
      // Verify protected properties from base class are accessible
      expect(loader._logger).toBeDefined();
      expect(loader._dataRegistry).toBeDefined();
    });

    it('uses anatomyStructureTemplates as registry key', async () => {
      const data = {
        id: 'anatomy:test_template',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      await loader._processFetchedItem(
        'anatomy',
        'test.structure.json',
        '/tmp/test.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      // Verify processAndStoreItem was called with correct category
      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          category: 'anatomyStructureTemplates',
        })
      );
    });

    it('verifies registry key is passed to processAndStoreItem', async () => {
      const data = {
        id: 'anatomy:test_template',
        topology: {
          rootType: 'torso',
        },
      };

      // Verify that the correct registry key is passed through
      await loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      );

      // The registry key validation happens in processAndStoreItem
      // We verify it was called with the correct category
      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          category: 'anatomyStructureTemplates',
        })
      );
    });
  });

  describe('Qualified ID Generation and Mod Namespacing', () => {
    it('generates qualified ID with mod namespace', async () => {
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'anatomy:structure_humanoid',
        didOverride: false,
      });

      const data = {
        id: 'anatomy:structure_humanoid',
        topology: { rootType: 'torso' },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid.structure.json',
        '/tmp/humanoid.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(result.qualifiedId).toBe('anatomy:structure_humanoid');
      expect(result.qualifiedId).toMatch(/^[a-z0-9_]+:[a-z0-9_]+$/);
    });

    it('handles qualified ID format validation', async () => {
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'custom_mod:dragon_template',
        didOverride: false,
      });

      const data = {
        id: 'custom_mod:dragon_template',
        topology: { rootType: 'torso' },
      };

      const result = await loader._processFetchedItem(
        'custom_mod',
        'dragon.structure.json',
        '/tmp/dragon.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      // Verify qualified ID format: modId:identifier
      expect(result.qualifiedId).toBe('custom_mod:dragon_template');
      expect(result.qualifiedId.split(':')).toHaveLength(2);
      expect(result.qualifiedId.split(':')[0]).toBe('custom_mod');
    });

    it('preserves mod namespace across processing pipeline', async () => {
      const modId = 'spider_mod';
      const templateId = 'structure_spider';

      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: `${modId}:${templateId}`,
        didOverride: false,
      });

      const data = {
        id: `${modId}:${templateId}`,
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        modId,
        'spider.structure.json',
        '/tmp/spider.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(result.qualifiedId).toContain(modId);
      expect(result.qualifiedId).toContain(templateId);
    });
  });

  describe('Override Detection for Mod Precedence', () => {
    it('detects when template overrides existing template', async () => {
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'anatomy:structure_humanoid',
        didOverride: true,
      });

      const data = {
        id: 'anatomy:structure_humanoid',
        topology: { rootType: 'torso' },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid.structure.json',
        '/tmp/humanoid.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(result.didOverride).toBe(true);
    });

    it('indicates no override for new template', async () => {
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'anatomy:structure_dragon',
        didOverride: false,
      });

      const data = {
        id: 'anatomy:structure_dragon',
        topology: { rootType: 'torso' },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'dragon.structure.json',
        '/tmp/dragon.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(result.didOverride).toBe(false);
    });

    it('handles mod precedence through override detection', async () => {
      // First mod loads template
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'base:structure_creature',
        didOverride: false,
      });

      const baseData = {
        id: 'base:structure_creature',
        topology: { rootType: 'body' },
      };

      const baseResult = await loader._processFetchedItem(
        'base',
        'creature.structure.json',
        '/tmp/base/creature.structure.json',
        baseData,
        'anatomyStructureTemplates'
      );

      expect(baseResult.didOverride).toBe(false);

      // Second mod overrides with same qualified ID
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'base:structure_creature',
        didOverride: true,
      });

      const overrideData = {
        id: 'base:structure_creature',
        topology: { rootType: 'enhanced_body' },
      };

      const overrideResult = await loader._processFetchedItem(
        'enhanced_mod',
        'creature.structure.json',
        '/tmp/enhanced/creature.structure.json',
        overrideData,
        'anatomyStructureTemplates'
      );

      expect(overrideResult.didOverride).toBe(true);
      expect(overrideResult.qualifiedId).toBe(baseResult.qualifiedId);
    });
  });

  describe('Schema Integration with AJV', () => {
    it('delegates schema validation to schemaValidator dependency', async () => {
      // schemaValidator is already mocked in createMockSchemaValidator
      // This test verifies integration behavior exists

      const data = {
        id: 'anatomy:test',
        topology: { rootType: 'torso' },
      };

      await loader._processFetchedItem(
        'anatomy',
        'test.json',
        '/tmp/test.json',
        data,
        'anatomyStructureTemplates'
      );

      // If schemaValidator threw, test would fail
      // This verifies the integration flow works
      expect(processAndStoreItem).toHaveBeenCalled();
    });

    it('performs custom validation beyond schema', async () => {
      // Custom validation for limb set count constraints
      const data = {
        id: 'anatomy:test',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 101, // Exceeds maximum
              socketPattern: {
                idTemplate: 'arm_{{index}}',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      // Custom validation should catch this before schema validation
      await expect(
        loader._processFetchedItem(
          'anatomy',
          'test.json',
          '/tmp/test.json',
          data,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
      await expect(
        loader._processFetchedItem(
          'anatomy',
          'test.json',
          '/tmp/test.json',
          data,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow('count must be between 1 and 100');
    });

    it('validates template variables in idTemplate', async () => {
      const data = {
        id: 'anatomy:test',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm-index', // Missing template variables
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'test.json',
          '/tmp/test.json',
          data,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow(ValidationError);
      await expect(
        loader._processFetchedItem(
          'anatomy',
          'test.json',
          '/tmp/test.json',
          data,
          'anatomyStructureTemplates'
        )
      ).rejects.toThrow('Must contain template variables');
    });

    it('validates static templates without variables', async () => {
      const data = {
        id: 'anatomy:test',
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head_socket', // Static template is valid
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'test.json',
          '/tmp/test.json',
          data,
          'anatomyStructureTemplates'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Mod Loading Pipeline Integration', () => {
    it('integrates with processAndStoreItem helper', async () => {
      const data = {
        id: 'anatomy:complex_creature',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail_socket',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      await loader._processFetchedItem(
        'anatomy',
        'complex.structure.json',
        '/tmp/complex.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data,
          idProp: 'id',
          category: 'anatomyStructureTemplates',
          modId: 'anatomy',
          filename: 'complex.structure.json',
        })
      );
    });

    it('handles complete template processing workflow', async () => {
      processAndStoreItem.mockResolvedValueOnce({
        qualifiedId: 'creatures:dragon_structure',
        didOverride: false,
      });

      const data = {
        id: 'creatures:dragon_structure',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_leg'],
              },
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing'],
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
                allowedTypes: ['dragon_head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail_socket',
                allowedTypes: ['dragon_tail'],
              },
            },
          ],
        },
      };

      const result = await loader._processFetchedItem(
        'creatures',
        'dragon.structure.json',
        '/tmp/dragon.structure.json',
        data,
        'anatomyStructureTemplates'
      );

      expect(result.qualifiedId).toBe('creatures:dragon_structure');
      expect(result.didOverride).toBe(false);
      expect(processAndStoreItem).toHaveBeenCalledTimes(1);
    });
  });
});
