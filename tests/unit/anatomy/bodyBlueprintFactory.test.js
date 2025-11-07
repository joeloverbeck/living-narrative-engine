import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('BodyBlueprintFactory (Refactored)', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockRecipeProcessor;
  let mockPartSelectionService;
  let mockSocketManager;
  let mockEntityGraphBuilder;
  let mockConstraintEvaluator;
  let mockValidator;

  beforeEach(() => {
    // Create mocks
    mockDataRegistry = {
      get: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRecipeProcessor = {
      loadRecipe: jest.fn(),
      processRecipe: jest.fn(),
      mergeSlotRequirements: jest.fn(),
    };

    mockPartSelectionService = {
      selectPart: jest.fn(),
    };

    mockSocketManager = {
      validateSocketAvailability: jest.fn(),
      occupySocket: jest.fn(),
      generatePartName: jest.fn(),
    };

    mockEntityGraphBuilder = {
      createRootEntity: jest.fn(),
      createAndAttachPart: jest.fn(),
      setEntityName: jest.fn(),
      getPartType: jest.fn(),
      cleanupEntities: jest.fn().mockResolvedValue(undefined),
    };

    mockConstraintEvaluator = {
      evaluateConstraints: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [], warnings: [] }),
    };

    mockValidator = {
      validateGraph: jest
        .fn()
        .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    // Create factory instance
    const mockSocketGenerator = {
      generateSockets: jest.fn().mockReturnValue([]),
    };

    const mockSlotGenerator = {
      generateBlueprintSlots: jest.fn().mockReturnValue({}),
    };

    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      recipeProcessor: mockRecipeProcessor,
      partSelectionService: mockPartSelectionService,
      socketManager: mockSocketManager,
      entityGraphBuilder: mockEntityGraphBuilder,
      constraintEvaluator: mockConstraintEvaluator,
      validator: mockValidator,
      socketGenerator: mockSocketGenerator,
      slotGenerator: mockSlotGenerator,
      recipePatternResolver: {
        resolveRecipePatterns: jest.fn(recipe => recipe),
      },
    });
  });

  describe('constructor', () => {
    it('should throw error if dataRegistry is not provided', () => {
      expect(
        () =>
          new BodyBlueprintFactory({
            entityManager: mockEntityManager,
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
            eventDispatchService: mockEventDispatchService,
            recipeProcessor: mockRecipeProcessor,
            partSelectionService: mockPartSelectionService,
            socketManager: mockSocketManager,
            entityGraphBuilder: mockEntityGraphBuilder,
            constraintEvaluator: mockConstraintEvaluator,
            validator: mockValidator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if recipeProcessor is not provided', () => {
      expect(
        () =>
          new BodyBlueprintFactory({
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
            eventDispatchService: mockEventDispatchService,
            partSelectionService: mockPartSelectionService,
            socketManager: mockSocketManager,
            entityGraphBuilder: mockEntityGraphBuilder,
            constraintEvaluator: mockConstraintEvaluator,
            validator: mockValidator,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should create instance with all required dependencies', () => {
      expect(factory).toBeDefined();
    });
  });

  describe('createAnatomyGraph', () => {
    const blueprintId = 'test:blueprint';
    const recipeId = 'test:recipe';
    const options = { seed: 12345, ownerId: 'owner123' };

    beforeEach(() => {
      // Setup default mock behaviors
      const mockBlueprint = {
        root: 'test:torso',
        slots: {
          head: {
            parent: null,
            socket: 'head_socket',
            requirements: { partType: 'head' },
          },
        },
      };

      const mockRecipe = {
        recipeId: recipeId,
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return mockBlueprint;
        }
        return null;
      });

      mockRecipeProcessor.loadRecipe.mockReturnValue(mockRecipe);
      mockRecipeProcessor.processRecipe.mockReturnValue(mockRecipe);
      mockRecipeProcessor.mergeSlotRequirements.mockReturnValue({
        partType: 'head',
      });

      mockEntityGraphBuilder.createRootEntity.mockReturnValue('root123');
      mockEntityGraphBuilder.createAndAttachPart.mockReturnValue('child123');
      mockEntityGraphBuilder.getPartType.mockReturnValue('head');

      mockSocketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: { id: 'head_socket', allowedTypes: ['head'] },
      });

      mockPartSelectionService.selectPart.mockResolvedValue('test:head');
    });

    it('should create anatomy graph successfully', async () => {
      const result = await factory.createAnatomyGraph(
        blueprintId,
        recipeId,
        options
      );

      expect(result).toEqual({
        rootId: 'root123',
        entities: ['root123', 'child123'],
      });

      expect(mockRecipeProcessor.loadRecipe).toHaveBeenCalledWith(recipeId);
      expect(mockRecipeProcessor.processRecipe).toHaveBeenCalled();
      expect(mockEntityGraphBuilder.createRootEntity).toHaveBeenCalledWith(
        'test:torso',
        expect.any(Object),
        options.ownerId,
        {}
      );
    });

    it('should handle blueprint not found error', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      await expect(
        factory.createAnatomyGraph('invalid:blueprint', recipeId, options)
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle recipe not found error', async () => {
      mockRecipeProcessor.loadRecipe.mockImplementation(() => {
        throw new InvalidArgumentError('Recipe not found');
      });

      await expect(
        factory.createAnatomyGraph(blueprintId, 'invalid:recipe', options)
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle constraint validation failure', async () => {
      mockConstraintEvaluator.evaluateConstraints.mockReturnValue({
        valid: false,
        errors: ['Constraint failed'],
        warnings: [],
      });

      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId, options)
      ).rejects.toThrow(ValidationError);

      expect(mockEntityGraphBuilder.cleanupEntities).toHaveBeenCalled();
    });

    it('should handle graph validation failure', async () => {
      mockValidator.validateGraph.mockResolvedValue({
        valid: false,
        errors: ['Graph validation failed'],
        warnings: [],
      });

      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId, options)
      ).rejects.toThrow(ValidationError);

      expect(mockEntityGraphBuilder.cleanupEntities).toHaveBeenCalled();
    });

    it('should skip optional slots when socket not available', async () => {
      const blueprintWithOptional = {
        root: 'test:torso',
        slots: {
          head: {
            parent: null,
            socket: 'head_socket',
            requirements: { partType: 'head' },
            optional: true,
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(blueprintWithOptional);
      mockSocketManager.validateSocketAvailability.mockReturnValue({
        valid: false,
      });

      const result = await factory.createAnatomyGraph(
        blueprintId,
        recipeId,
        options
      );

      expect(result.entities).toEqual(['root123']); // Only root, no child
    });

    it('should generate and set part name when template provided', async () => {
      mockSocketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: {
          id: 'head_socket',
          allowedTypes: ['head'],
          nameTpl: '{{type}} of {{parent.name}}',
        },
      });
      mockSocketManager.generatePartName.mockReturnValue('head of torso');

      await factory.createAnatomyGraph(blueprintId, recipeId, options);

      expect(mockSocketManager.generatePartName).toHaveBeenCalled();
      expect(mockEntityGraphBuilder.setEntityName).toHaveBeenCalledWith(
        'child123',
        'head of torso'
      );
    });

    it('should pass socket orientation to createAndAttachPart', async () => {
      const socketWithOrientation = {
        id: 'head_socket',
        allowedTypes: ['head'],
        orientation: 'left',
      };

      mockSocketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: socketWithOrientation,
      });

      await factory.createAnatomyGraph(blueprintId, recipeId, options);

      expect(mockEntityGraphBuilder.createAndAttachPart).toHaveBeenCalledWith(
        'root123',
        'head_socket',
        'test:head',
        options.ownerId,
        'left',
        {}
      );
    });

    it('should dispatch error event on failure', async () => {
      const error = new Error('Test error');
      mockRecipeProcessor.loadRecipe.mockImplementation(() => {
        throw error;
      });

      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId, options)
      ).rejects.toThrow(error);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: error.message,
          details: {
            raw: 'BodyBlueprintFactory.createAnatomyGraph',
          },
        }
      );
    });
  });
});
