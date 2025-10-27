import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('BodyBlueprintFactory uncovered branches', () => {
  let deps;

  beforeEach(() => {
    deps = {
      entityManager: {},
      dataRegistry: { get: jest.fn() },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      eventDispatcher: { dispatch: jest.fn() },
      eventDispatchService: {
        safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
      },
      recipeProcessor: {
        loadRecipe: jest.fn(),
        processRecipe: jest.fn(),
        mergeSlotRequirements: jest.fn(),
      },
      partSelectionService: { selectPart: jest.fn() },
      socketManager: {
        validateSocketAvailability: jest.fn(),
        occupySocket: jest.fn(),
        generatePartName: jest.fn(),
      },
      entityGraphBuilder: {
        createRootEntity: jest.fn(),
        createAndAttachPart: jest.fn(),
        setEntityName: jest.fn(),
        getPartType: jest.fn(),
        cleanupEntities: jest.fn().mockResolvedValue(undefined),
      },
      constraintEvaluator: {
        evaluateConstraints: jest
          .fn()
          .mockReturnValue({ valid: true, errors: [], warnings: [] }),
      },
      validator: {
        validateGraph: jest
          .fn()
          .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
      },
      socketGenerator: {
        generateSockets: jest.fn().mockReturnValue([]),
      },
      slotGenerator: {
        generateBlueprintSlots: jest.fn().mockReturnValue({}),
      },
    };
  });

  describe('constructor parameter validation', () => {
    const paramNames = [
      'dataRegistry',
      'logger',
      'eventDispatcher',
      'eventDispatchService',
      'recipeProcessor',
      'partSelectionService',
      'socketManager',
      'entityGraphBuilder',
      'constraintEvaluator',
      'validator',
      'socketGenerator',
      'slotGenerator',
    ];

    for (const name of paramNames) {
      it(`throws if ${name} is missing`, () => {
        const localDeps = { ...deps, [name]: undefined };
        expect(() => new BodyBlueprintFactory(localDeps)).toThrow(
          InvalidArgumentError
        );
      });
    }
  });

  describe('createAnatomyGraph edge cases', () => {
    const blueprintId = 'bp';
    const recipeId = 'rc';
    let factory;
    let blueprint;
    let recipe;

    beforeEach(() => {
      blueprint = {
        id: blueprintId,
        root: 'core:torso',
        slots: { slotA: { parent: null, socket: 'sA', requirements: {} } },
      };
      recipe = { recipeId, slots: {} };
      deps.dataRegistry.get.mockImplementation((type, id) =>
        type === 'anatomyBlueprints' && id === blueprintId ? blueprint : null
      );
      deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
      deps.recipeProcessor.processRecipe.mockReturnValue(recipe);
      deps.recipeProcessor.mergeSlotRequirements.mockReturnValue({});
      deps.entityGraphBuilder.createRootEntity.mockReturnValue('root1');
      deps.entityGraphBuilder.createAndAttachPart.mockReturnValue('child1');
      deps.entityGraphBuilder.getPartType.mockReturnValue('part');
      deps.socketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: { id: 'sA', allowedTypes: ['any'] },
      });
      deps.partSelectionService.selectPart.mockResolvedValue('def1');
      factory = new BodyBlueprintFactory(deps);
    });

    it('throws when parent slot is missing', async () => {
      blueprint.slots.child = {
        parent: 'missing',
        socket: 'sB',
        requirements: {},
      };
      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId)
      ).rejects.toThrow(ValidationError);
      expect(deps.eventDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Failed to process blueprint slot'),
        })
      );
    });

    it('skips optional slot when no part selected', async () => {
      blueprint.slots.optional = {
        parent: null,
        socket: 'sB',
        optional: true,
        requirements: {},
      };
      deps.partSelectionService.selectPart
        .mockResolvedValueOnce('def1')
        .mockResolvedValueOnce(null);
      deps.socketManager.validateSocketAvailability.mockReturnValue({
        valid: true,
        socket: { id: 'sB', allowedTypes: [] },
      });
      const result = await factory.createAnatomyGraph(blueprintId, recipeId);
      expect(result.entities).toEqual(['root1', 'child1']);
    });

    it('throws when socket validation returns error', async () => {
      deps.socketManager.validateSocketAvailability.mockReturnValue({
        valid: false,
        error: 'bad socket',
      });
      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId)
      ).rejects.toThrow(ValidationError);
      expect(deps.eventDispatchService.safeDispatchEvent).toHaveBeenCalled();
    });

    it('throws when no part found for required slot', async () => {
      deps.partSelectionService.selectPart.mockResolvedValue(null);
      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId)
      ).rejects.toThrow(ValidationError);
      expect(deps.eventDispatchService.safeDispatchEvent).toHaveBeenCalled();
    });

    it('detects circular slot dependency', async () => {
      blueprint.slots = {
        a: { parent: 'b', socket: 'sA', requirements: {} },
        b: { parent: 'a', socket: 'sB', requirements: {} },
      };
      await expect(
        factory.createAnatomyGraph(blueprintId, recipeId)
      ).rejects.toThrow(ValidationError);
    });
  });
});
