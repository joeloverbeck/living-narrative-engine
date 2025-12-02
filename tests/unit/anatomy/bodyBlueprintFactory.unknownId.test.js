import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

// Reuse dependency setup similar to other tests
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
    recipePatternResolver: {
      resolveRecipePatterns: jest.fn(recipe => recipe),
    },
    blueprintProcessorService: {
      processBlueprint: jest.fn((blueprint) => blueprint),
    },
  };
});

describe('BodyBlueprintFactory blueprint id fallback', () => {
  it('uses "unknown" when blueprint id is missing in invalid slot error', async () => {
    const blueprint = { root: 'core:torso', slots: {} }; // no id property
    const recipe = { recipeId: 'test-recipe', slots: { bogus: {} } };
    deps.dataRegistry.get.mockReturnValueOnce(blueprint); // for blueprint load
    deps.recipeProcessor.loadRecipe.mockReturnValue(recipe);
    deps.recipeProcessor.processRecipe.mockReturnValue(recipe);

    const factory = new BodyBlueprintFactory(deps);
    await expect(
      factory.createAnatomyGraph('bp', 'test-recipe')
    ).rejects.toThrow(ValidationError);

    // Should dispatch system error and mention "unknown" blueprint id
    expect(deps.eventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining("blueprint 'unknown'"),
      })
    );
  });
});
