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

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
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
    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
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
    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
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
    loader = new AnatomyStructureTemplateLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
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
