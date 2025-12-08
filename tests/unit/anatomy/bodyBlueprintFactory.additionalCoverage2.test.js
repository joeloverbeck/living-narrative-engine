import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createDependencies = () => {
  const dataRegistry = { get: jest.fn() };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
  const eventDispatchService = {
    safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
  };
  const recipeProcessor = {
    loadRecipe: jest.fn(),
    processRecipe: jest.fn(),
    mergeSlotRequirements: jest.fn((requirements, overrides) => ({
      ...(requirements || {}),
      ...(overrides || {}),
    })),
  };
  const partSelectionService = {
    selectPart: jest.fn().mockResolvedValue('anatomy:test_part'),
  };
  const socketManager = {
    validateSocketAvailability: jest.fn().mockReturnValue({
      valid: true,
      socket: {
        id: 'default_socket',
        allowedTypes: ['default'],
        orientation: undefined,
        nameTpl: 'Default {{slot}}',
      },
    }),
    occupySocket: jest.fn(),
    generatePartName: jest.fn().mockReturnValue('Default Part'),
  };
  const entityGraphBuilder = {
    createRootEntity: jest.fn().mockResolvedValue('entity:root'),
    addSocketsToEntity: jest.fn().mockResolvedValue(undefined),
    createAndAttachPart: jest.fn().mockResolvedValue('entity:child'),
    setEntityName: jest.fn().mockResolvedValue(undefined),
    getPartType: jest.fn().mockReturnValue('part:type'),
    cleanupEntities: jest.fn().mockResolvedValue(undefined),
  };
  const constraintEvaluator = {
    evaluateConstraints: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  };
  const validator = {
    validateGraph: jest
      .fn()
      .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
  };
  const socketGenerator = {
    generateSockets: jest.fn().mockReturnValue([]),
  };
  const slotGenerator = {
    generateBlueprintSlots: jest.fn().mockReturnValue({}),
  };
  const recipePatternResolver = {
    resolveRecipePatterns: jest.fn((recipe) => recipe),
  };

  return {
    entityManager: {
      getComponentData: jest.fn().mockReturnValue(undefined),
    },
    dataRegistry,
    logger,
    eventDispatcher,
    eventDispatchService,
    recipeProcessor,
    partSelectionService,
    socketManager,
    entityGraphBuilder,
    constraintEvaluator,
    validator,
    socketGenerator,
    slotGenerator,
    recipePatternResolver,
    blueprintProcessorService: {
      processBlueprint: jest.fn((blueprint) => blueprint),
    },
  };
};

describe('BodyBlueprintFactory additional coverage', () => {
  let deps;

  beforeEach(() => {
    deps = createDependencies();
  });

  describe('constructor dependency validation', () => {
    it.each([
      ['dataRegistry', { dataRegistry: undefined }],
      ['logger', { logger: undefined }],
      ['eventDispatcher', { eventDispatcher: undefined }],
      ['eventDispatchService', { eventDispatchService: undefined }],
      ['recipeProcessor', { recipeProcessor: undefined }],
      ['partSelectionService', { partSelectionService: undefined }],
      ['socketManager', { socketManager: undefined }],
      ['entityGraphBuilder', { entityGraphBuilder: undefined }],
      ['constraintEvaluator', { constraintEvaluator: undefined }],
      ['validator', { validator: undefined }],
      ['socketGenerator', { socketGenerator: undefined }],
      ['slotGenerator', { slotGenerator: undefined }],
      ['recipePatternResolver', { recipePatternResolver: undefined }],
    ])('throws when %s is missing', (_, override) => {
      expect(() => new BodyBlueprintFactory({ ...deps, ...override })).toThrow(
        InvalidArgumentError
      );
    });
  });

  it('processes v2 blueprints through blueprintProcessorService and pattern resolution', async () => {
    const blueprint = {
      id: 'anatomy:v2',
      schemaVersion: '2.0',
      structureTemplate: 'template:humanoid',
      additionalSlots: {
        auxiliary_sensor: {
          parent: null,
          socket: 'aux_socket',
          requirements: { partType: 'sensor' },
        },
      },
    };
    const recipe = {
      recipeId: 'recipe:v2',
      slots: {
        left_upper_arm: { partType: 'arm' },
      },
    };

    const generatedSockets = [
      { id: 'shoulder_socket', orientation: 'forward', nameTpl: 'Shoulder' },
      {
        id: 'upper_arm_socket',
        orientation: undefined,
        nameTpl: 'Arm {{side}}',
      },
      {
        id: 'aux_socket',
        allowedTypes: ['sensor'],
        orientation: undefined,
        nameTpl: 'Auxiliary',
      },
    ];
    const generatedSlots = {
      shoulder: {
        parent: null,
        socket: 'shoulder_socket',
        requirements: { partType: 'shoulder' },
      },
      left_upper_arm: {
        parent: 'shoulder',
        socket: 'upper_arm_socket',
        requirements: { partType: 'arm' },
      },
      auxiliary_sensor: {
        parent: null,
        socket: 'aux_socket',
        requirements: { partType: 'sensor' },
      },
    };

    // The processed blueprint from blueprintProcessorService
    const processedBlueprint = {
      ...blueprint,
      slots: generatedSlots,
      _generatedSockets: generatedSockets,
      _generatedSlots: generatedSlots,
    };

    deps.dataRegistry.get.mockImplementation((type, id) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.blueprintProcessorService.processBlueprint.mockReturnValue(
      processedBlueprint
    );
    deps.validator.validateGraph.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: ['soft warning'],
    });
    deps.socketManager.validateSocketAvailability
      .mockReturnValueOnce({
        valid: true,
        socket: generatedSockets[0],
      })
      .mockReturnValueOnce({
        valid: true,
        socket: { ...generatedSockets[1], orientation: undefined },
      })
      .mockReturnValueOnce({
        valid: true,
        socket: generatedSockets[2],
      });
    deps.partSelectionService.selectPart
      .mockResolvedValueOnce('part:shoulder')
      .mockResolvedValueOnce('part:left_upper_arm')
      .mockResolvedValueOnce('part:auxiliary_sensor');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart
      .mockResolvedValueOnce('entity:shoulder')
      .mockResolvedValueOnce('entity:left_upper_arm')
      .mockResolvedValueOnce('entity:auxiliary');
    deps.entityGraphBuilder.getPartType.mockImplementation((id) => {
      if (id === 'entity:shoulder') return 'shoulder';
      if (id === 'entity:left_upper_arm') return 'arm';
      return 'sensor';
    });

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph('anatomy:v2', 'recipe:v2', {
      ownerId: 'owner:1',
    });

    // Verify blueprintProcessorService was called with the raw blueprint
    expect(
      deps.blueprintProcessorService.processBlueprint
    ).toHaveBeenCalledWith(blueprint);

    expect(
      deps.recipePatternResolver.resolveRecipePatterns
    ).toHaveBeenCalledWith(
      recipe,
      expect.objectContaining({ id: 'anatomy:v2' })
    );
    expect(deps.entityGraphBuilder.addSocketsToEntity).toHaveBeenCalledWith(
      'entity:root',
      generatedSockets
    );
    expect(deps.entityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
      'entity:shoulder',
      'upper_arm_socket',
      'part:left_upper_arm',
      'owner:1',
      'left',
      {}
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('warnings')
    );
    expect(result.rootId).toBe('entity:root');
    expect(result.entities).toEqual([
      'entity:root',
      'entity:shoulder',
      'entity:left_upper_arm',
      'entity:auxiliary',
    ]);
  });

  it('handles v2 blueprints without additional slots by relying on blueprintProcessorService', async () => {
    const blueprint = {
      id: 'anatomy:v2:minimal',
      schemaVersion: '2.0',
      structureTemplate: 'template:minimal',
    };
    const recipe = { recipeId: 'recipe:v2:minimal', slots: {} };

    const generatedSockets = [
      { id: 'core_socket', orientation: undefined, nameTpl: 'Core' },
    ];
    const generatedSlots = {
      core: {
        parent: null,
        socket: 'core_socket',
        requirements: { partType: 'core' },
      },
    };

    // The processed blueprint from blueprintProcessorService
    const processedBlueprint = {
      ...blueprint,
      slots: generatedSlots,
      _generatedSockets: generatedSockets,
      _generatedSlots: generatedSlots,
    };

    deps.dataRegistry.get.mockImplementation((type, id) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.blueprintProcessorService.processBlueprint.mockReturnValue(
      processedBlueprint
    );
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'core_socket',
        allowedTypes: ['core'],
        orientation: undefined,
        nameTpl: 'Core',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('part:core');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(
      'entity:core'
    );
    deps.entityGraphBuilder.getPartType.mockReturnValue('core');

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:v2:minimal',
      'recipe:v2:minimal'
    );

    // Verify blueprintProcessorService was called
    expect(
      deps.blueprintProcessorService.processBlueprint
    ).toHaveBeenCalledWith(blueprint);
    expect(deps.entityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
      'entity:root',
      'core_socket',
      'part:core',
      undefined,
      undefined,
      {}
    );
    expect(result.entities).toEqual(['entity:root', 'entity:core']);
  });

  it('cleans up created entities when constraint validation fails', async () => {
    const blueprint = {
      id: 'anatomy:constraint-failure',
      root: 'anatomy:torso',
      slots: {
        left_arm: {
          parent: null,
          socket: 'arm_socket',
          requirements: { partType: 'arm' },
        },
      },
    };
    const recipe = { recipeId: 'recipe:constraint-failure', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'arm_socket',
        allowedTypes: ['arm'],
        orientation: 'left',
        nameTpl: 'Arm',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('part:left_arm');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(
      'entity:left_arm'
    );
    deps.entityGraphBuilder.getPartType.mockReturnValue('arm');
    deps.constraintEvaluator.evaluateConstraints.mockReturnValue({
      valid: false,
      errors: ['arm limit exceeded'],
    });

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph(
        'anatomy:constraint-failure',
        'recipe:constraint-failure'
      )
    ).rejects.toThrow(ValidationError);
    expect(deps.entityGraphBuilder.cleanupEntities).toHaveBeenCalledWith(
      expect.arrayContaining(['entity:root', 'entity:left_arm'])
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Constraint validation failed')
    );
  });

  it('cleans up created entities when final graph validation fails', async () => {
    const blueprint = {
      id: 'anatomy:graph-failure',
      root: 'anatomy:torso',
      slots: {
        right_leg: {
          parent: null,
          socket: 'leg_socket',
          requirements: { partType: 'leg' },
        },
      },
    };
    const recipe = { recipeId: 'recipe:graph-failure', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'leg_socket',
        allowedTypes: ['leg'],
        orientation: 'right',
        nameTpl: 'Leg',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('part:right_leg');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(
      'entity:right_leg'
    );
    deps.entityGraphBuilder.getPartType.mockReturnValue('leg');
    deps.validator.validateGraph.mockResolvedValue({
      valid: false,
      errors: ['graph invalid'],
      warnings: [],
    });

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph(
        'anatomy:graph-failure',
        'recipe:graph-failure'
      )
    ).rejects.toThrow(ValidationError);
    expect(deps.entityGraphBuilder.cleanupEntities).toHaveBeenCalledWith(
      expect.arrayContaining(['entity:root', 'entity:right_leg'])
    );
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Graph validation failed')
    );
  });

  it('reports invalid recipe slots before building the anatomy graph', async () => {
    const blueprint = {
      id: 'anatomy:humanoid',
      root: 'anatomy:torso',
      slots: {
        head: {
          parent: null,
          socket: 'neck_socket',
          requirements: { partType: 'head' },
        },
      },
    };
    const recipe = {
      recipeId: 'recipe:invalid',
      slots: {
        unknown_slot: {},
      },
    };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph('anatomy:humanoid', 'recipe:invalid')
    ).rejects.toThrow(ValidationError);

    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          raw: expect.stringContaining(
            'BlueprintValidator.validateRecipeSlots'
          ),
        }),
      })
    );
  });

  it('reports invalid recipe slots even when blueprint metadata is incomplete', async () => {
    const blueprint = {
      root: 'anatomy:torso',
    };
    const recipe = {
      recipeId: 'recipe:invalid-incomplete',
      slots: {
        extra_slot: {},
      },
    };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph(
        'anatomy:incomplete',
        'recipe:invalid-incomplete'
      )
    ).rejects.toThrow(ValidationError);
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          raw: expect.stringContaining('"blueprintId":"unknown"'),
        }),
      })
    );
  });

  it('throws when the requested blueprint cannot be found in the registry', async () => {
    const recipe = { recipeId: 'recipe:missing-blueprint', slots: {} };
    deps.dataRegistry.get.mockReturnValue(null);
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph('anatomy:missing', 'recipe:missing-blueprint')
    ).rejects.toThrow(InvalidArgumentError);
    expect(deps.entityGraphBuilder.createRootEntity).not.toHaveBeenCalled();
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          raw: 'BodyBlueprintFactory.createAnatomyGraph',
        }),
      })
    );
  });

  it('throws when blueprintProcessorService throws for missing structure template', async () => {
    const blueprint = {
      id: 'anatomy:v2:missing-template',
      schemaVersion: '2.0',
      structureTemplate: 'template:missing',
    };
    const recipe = { recipeId: 'recipe:v2', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    // blueprintProcessorService throws when structure template is missing
    deps.blueprintProcessorService.processBlueprint.mockImplementation(() => {
      throw new ValidationError(
        'Structure template not found: template:missing'
      );
    });

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph('anatomy:v2:missing-template', 'recipe:v2')
    ).rejects.toThrow(ValidationError);
    expect(
      deps.blueprintProcessorService.processBlueprint
    ).toHaveBeenCalledWith(blueprint);
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          raw: 'BodyBlueprintFactory.createAnatomyGraph',
        }),
      })
    );
  });

  it('allows torso override slots without triggering validation errors', async () => {
    const blueprint = {
      id: 'anatomy:torso-override',
      root: 'anatomy:torso',
    };
    const recipe = {
      recipeId: 'recipe:torso-override',
      slots: {
        torso: { partType: 'enhanced-torso' },
      },
    };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:torso-override',
      'recipe:torso-override'
    );

    expect(result.rootId).toBe('entity:root');
    expect(result.entities).toEqual(['entity:root']);
    expect(deps.eventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches errors when blueprint slots reference unknown parents', async () => {
    const blueprint = {
      id: 'anatomy:invalid_parent',
      root: 'anatomy:torso',
      slots: {
        orphan: {
          parent: 'non_existent',
          socket: 'orphan_socket',
          requirements: {},
        },
      },
    };
    const recipe = { recipeId: 'recipe:invalid_parent', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph(
        'anatomy:invalid_parent',
        'recipe:invalid_parent'
      )
    ).rejects.toThrow(ValidationError);

    expect(deps.eventDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          "Failed to process blueprint slot 'orphan'"
        ),
      })
    );
  });

  it('throws when socket validation fails with an explicit error', async () => {
    const blueprint = {
      id: 'anatomy:socket_error',
      root: 'anatomy:torso',
      slots: {
        left_arm: {
          parent: null,
          socket: 'arm_socket',
          requirements: { partType: 'arm' },
        },
      },
    };
    const recipe = { recipeId: 'recipe:socket_error', slots: {} };

    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: false,
      error: 'Socket locked',
    });
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph('anatomy:socket_error', 'recipe:socket_error')
    ).rejects.toThrow(ValidationError);
    expect(deps.partSelectionService.selectPart).not.toHaveBeenCalled();
  });

  it('skips optional slots when sockets are unavailable without raising errors', async () => {
    const blueprint = {
      id: 'anatomy:optional-socket',
      root: 'anatomy:torso',
      slots: {
        accessory_slot: {
          parent: null,
          socket: 'accessory_socket',
          requirements: { partType: 'accessory' },
          optional: true,
        },
      },
    };
    const recipe = { recipeId: 'recipe:optional-socket', slots: {} };

    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: false,
    });
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:optional-socket',
      'recipe:optional-socket'
    );

    expect(deps.partSelectionService.selectPart).not.toHaveBeenCalled();
    expect(result.entities).toEqual(['entity:root']);
  });

  it('skips optional slots when no matching part is found', async () => {
    const blueprint = {
      id: 'anatomy:optional',
      root: 'anatomy:torso',
      slots: {
        accessory_slot: {
          parent: null,
          socket: 'accessory_socket',
          requirements: { partType: 'accessory' },
          optional: true,
        },
      },
    };
    const recipe = { recipeId: 'recipe:optional', slots: {} };

    deps.partSelectionService.selectPart.mockResolvedValue(null);
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:optional',
      'recipe:optional'
    );

    expect(deps.entityGraphBuilder.createAndAttachPart).not.toHaveBeenCalled();
    expect(result.entities).toEqual(['entity:root']);
  });

  it('throws when a required slot cannot be fulfilled', async () => {
    const blueprint = {
      id: 'anatomy:required-missing',
      root: 'anatomy:torso',
      slots: {
        left_leg: {
          parent: null,
          socket: 'leg_socket',
          requirements: { partType: 'leg' },
        },
      },
    };
    const recipe = { recipeId: 'recipe:required-missing', slots: {} };

    deps.partSelectionService.selectPart.mockResolvedValue(undefined);
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph(
        'anatomy:required-missing',
        'recipe:required-missing'
      )
    ).rejects.toThrow(ValidationError);
    expect(deps.eventDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          "Failed to process blueprint slot 'left_leg'"
        ),
      })
    );
  });

  it('infers slot orientation from the slot key when the socket lacks orientation', async () => {
    const blueprint = {
      id: 'anatomy:orientation',
      root: 'anatomy:torso',
      slots: {
        left_hand: {
          parent: null,
          socket: 'hand_socket',
        },
      },
    };
    const recipe = { recipeId: 'recipe:orientation', slots: {} };

    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'hand_socket',
        allowedTypes: ['hand'],
        orientation: undefined,
        nameTpl: 'Hand',
      },
    });
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);
    await factory.createAnatomyGraph(
      'anatomy:orientation',
      'recipe:orientation'
    );

    expect(deps.entityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
      'entity:root',
      'hand_socket',
      'anatomy:test_part',
      undefined,
      'left',
      {}
    );
  });

  it('handles slots that do not yield a child entity from the graph builder', async () => {
    const blueprint = {
      id: 'anatomy:no-child',
      root: 'anatomy:torso',
      slots: {
        phantom_slot: {
          parent: null,
          socket: 'phantom_socket',
        },
      },
    };
    const recipe = { recipeId: 'recipe:no-child', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'phantom_socket',
        allowedTypes: ['phantom'],
        orientation: undefined,
        nameTpl: 'Phantom',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('part:phantom');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(null);

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:no-child',
      'recipe:no-child'
    );

    expect(deps.socketManager.generatePartName).not.toHaveBeenCalled();
    expect(result.entities).toEqual(['entity:root']);
  });

  it('does not set entity names when the generated name is falsy', async () => {
    const blueprint = {
      id: 'anatomy:no-name',
      root: 'anatomy:torso',
      slots: {
        tool_slot: {
          parent: null,
          socket: 'tool_socket',
        },
      },
    };
    const recipe = { recipeId: 'recipe:no-name', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'tool_socket',
        allowedTypes: ['tool'],
        orientation: undefined,
        nameTpl: 'Tool',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('part:tool');
    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(
      'entity:tool'
    );
    deps.socketManager.generatePartName.mockReturnValue('');

    const factory = new BodyBlueprintFactory(deps);
    await factory.createAnatomyGraph('anatomy:no-name', 'recipe:no-name');

    expect(deps.entityGraphBuilder.setEntityName).not.toHaveBeenCalled();
  });

  it('treats equipment slots as non-anatomy slots when using equipment sockets', async () => {
    const blueprint = {
      id: 'anatomy:equipment-sockets',
      root: 'anatomy:torso',
      slots: {
        weapon_slot: {
          parent: null,
          socket: 'grip',
          requirements: { partType: 'weapon' },
        },
        utility_slot: {
          parent: null,
          socket: 'utility_socket',
          requirements: { strength: 5 },
        },
      },
    };
    const recipe = { recipeId: 'recipe:equipment', slots: {} };

    deps.socketManager.validateSocketAvailability
      .mockReturnValueOnce({
        valid: true,
        socket: {
          id: 'grip',
          allowedTypes: ['weapon'],
          orientation: undefined,
          nameTpl: 'Grip',
        },
      })
      .mockReturnValueOnce({
        valid: true,
        socket: {
          id: 'utility_socket',
          allowedTypes: ['tool'],
          orientation: undefined,
          nameTpl: 'Utility',
        },
      });
    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);
    const result = await factory.createAnatomyGraph(
      'anatomy:equipment-sockets',
      'recipe:equipment'
    );

    expect(deps.entityGraphBuilder.createAndAttachPart).not.toHaveBeenCalled();
    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Skipping equipment slot 'weapon_slot'")
    );
    expect(result.entities).toEqual(['entity:root']);
  });

  it('detects circular dependencies between slots', async () => {
    const blueprint = {
      id: 'anatomy:circular',
      root: 'anatomy:torso',
      slots: {
        left_arm: {
          parent: 'right_arm',
          socket: 'arm_socket',
          requirements: { partType: 'arm' },
        },
        right_arm: {
          parent: 'left_arm',
          socket: 'arm_socket',
          requirements: { partType: 'arm' },
        },
      },
    };
    const recipe = { recipeId: 'recipe:circular', slots: {} };

    deps.dataRegistry.get.mockImplementation((type) => {
      if (type === 'anatomyBlueprints') return blueprint;
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);

    await expect(
      factory.createAnatomyGraph('anatomy:circular', 'recipe:circular')
    ).rejects.toThrow(ValidationError);
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          raw: 'BodyBlueprintFactory.createAnatomyGraph',
        }),
      })
    );
  });

  it('merges entity sockets with generated sockets and applies component overrides', async () => {
    const componentOverrides = {
      'component:musculature': { strength: 5 },
      'component:skin': { color: 'blue' },
    };

    const blueprint = {
      id: 'anatomy:humanoid',
      root: 'anatomy:torso',
      schemaVersion: '1.0',
      slots: {
        left_arm: {
          id: 'slot:left_arm',
          parent: null,
          socket: 'arm_socket',
          requirements: { partType: 'arm' },
        },
      },
      _generatedSockets: [
        {
          id: 'arm_socket',
          allowedTypes: ['arm'],
          orientation: 'left',
          nameTpl: 'Left Arm {{id}}',
        },
      ],
    };

    const recipe = {
      recipeId: 'recipe:humanoid',
      slots: {
        root: { properties: {} },
        left_arm: {
          properties: componentOverrides,
        },
      },
    };

    deps.dataRegistry.get.mockImplementation((type, id) => {
      if (type === 'anatomyBlueprints' && id === 'anatomy:humanoid') {
        return blueprint;
      }
      return null;
    });
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.mergeSlotRequirements.mockReturnValue({
      partType: 'arm',
    });

    deps.entityGraphBuilder.createRootEntity.mockResolvedValue('entity:root');
    deps.entityManager.getComponentData.mockReturnValue({
      sockets: [
        {
          id: 'legacy_socket',
          allowedTypes: ['legacy'],
        },
      ],
    });

    deps.socketManager.validateSocketAvailability.mockReturnValue({
      valid: true,
      socket: {
        id: 'arm_socket',
        allowedTypes: ['arm'],
        orientation: 'left',
        nameTpl: 'Left Arm {{id}}',
      },
    });
    deps.partSelectionService.selectPart.mockResolvedValue('anatomy:left_arm');
    deps.entityGraphBuilder.createAndAttachPart.mockResolvedValue(
      'entity:left_arm'
    );
    deps.entityGraphBuilder.getPartType.mockReturnValue('arm');
    deps.socketManager.generatePartName.mockReturnValue('Left Arm');

    const factory = new BodyBlueprintFactory(deps);

    const result = await factory.createAnatomyGraph(
      'anatomy:humanoid',
      'recipe:humanoid',
      { ownerId: 'entity:owner' }
    );

    expect(result.rootId).toBe('entity:root');
    expect(result.entities).toEqual(['entity:root', 'entity:left_arm']);
    expect(result.slotToPartMappings).toBeInstanceOf(Map);
    expect(Array.from(result.slotToPartMappings.entries())).toEqual([
      [null, 'entity:root'],
      ['left_arm', 'entity:left_arm'],
    ]);

    expect(deps.entityGraphBuilder.addSocketsToEntity).toHaveBeenCalledWith(
      'entity:root',
      [
        expect.objectContaining({ id: 'legacy_socket' }),
        expect.objectContaining({ id: 'arm_socket' }),
      ]
    );
    expect(deps.entityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
      'entity:root',
      'arm_socket',
      'anatomy:left_arm',
      'entity:owner',
      'left',
      componentOverrides
    );
    expect(deps.logger.debug).toHaveBeenCalledWith(
      "SlotResolutionOrchestrator: Will apply 2 component overrides from recipe slot 'left_arm' during entity creation",
      componentOverrides
    );
  });
});
