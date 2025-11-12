import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { RecipeConstraintEvaluator } from '../../../src/anatomy/recipeConstraintEvaluator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
  constructor() {
    this.#componentsByEntity = new Map();
  }

  #componentsByEntity;

  addEntity(entityId, components = {}) {
    const componentMap = new Map();
    for (const [componentId, data] of Object.entries(components)) {
      componentMap.set(componentId, data);
    }
    this.#componentsByEntity.set(entityId, componentMap);
  }

  getComponentData(entityId, componentId) {
    return this.#componentsByEntity.get(entityId)?.get(componentId);
  }

  getAllComponentTypesForEntity(entityId) {
    const components = this.#componentsByEntity.get(entityId);
    return components ? Array.from(components.keys()) : [];
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('RecipeConstraintEvaluator integration', () => {
  let entityManager;
  let logger;
  let evaluator;

  beforeEach(() => {
    entityManager = new InMemoryEntityManager();
    logger = createLogger();
    evaluator = new RecipeConstraintEvaluator({ entityManager, logger });
  });

  it('surfaces errors from requires, excludes, and slot count constraints with real metadata aggregation', () => {
    entityManager.addEntity('torso', {
      'anatomy:part': { subType: 'torso' },
      'core:strength': { rating: 2 },
    });
    entityManager.addEntity('left-arm', {
      'anatomy:part': { subType: 'arm' },
      'core:strength': { rating: 1 },
      'core:dexterity': { rating: 1 },
    });
    entityManager.addEntity('right-arm', {
      'anatomy:part': { subType: 'arm' },
      'core:dexterity': { rating: 2 },
    });
    entityManager.addEntity('head', {
      'anatomy:part': { subType: 'head' },
      'core:vision': { acuity: '20/20' },
    });

    const recipe = {
      constraints: {
        requires: [
          {
            partTypes: ['arm', 'torso'],
            components: ['core:strength', 'core:fusion'],
            validation: {
              minItems: 1,
              explanation: 'Arms and torso must share fusion implants.',
            },
          },
        ],
        excludes: [
          {
            components: ['core:strength', 'core:dexterity'],
            validation: {
              errorMessage:
                'custom exclude: strength implants clash with dexterity implants',
              explanation: 'Cybernetic tuning prohibits mixed implants.',
            },
          },
        ],
      },
      slots: {
        limbs: { type: 'leg', count: 2 },
        torsoSlot: { type: 'torso', count: { exact: 2 } },
        armSlotMin: { type: 'arm', count: { min: 3 } },
        armSlotMax: { type: 'arm', count: { max: 1 } },
      },
    };

    const result = evaluator.evaluateConstraints(
      ['torso', 'left-arm', 'right-arm', 'head'],
      recipe
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Required constraint not satisfied'),
        'custom exclude: strength implants clash with dexterity implants',
        "Slot 'limbs': expected exactly 2 parts of type 'leg' but found 0",
        "Slot 'torsoSlot': expected exactly 2 parts of type 'torso' but found 1",
        "Slot 'armSlotMin': expected at least 3 parts of type 'arm' but found 2",
        "Slot 'armSlotMax': expected at most 1 parts of type 'arm' but found 2",
      ])
    );
    expect(result.warnings).toEqual([]);

    expect(logger.debug).toHaveBeenCalledWith(
      'Constraint explanation: Arms and torso must share fusion implants.'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('RecipeConstraintEvaluator: Evaluating constraints')
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      'RecipeConstraintEvaluator: All constraints satisfied'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RecipeConstraintEvaluator: Constraints failed with 6 errors'
    );
  });

  it('reports warnings for recommended slot counts when no hard constraints fail', () => {
    entityManager.addEntity('head', {
      'anatomy:part': { subType: 'head' },
      'core:vision': { acuity: '20/20' },
    });
    entityManager.addEntity('torso', {
      'anatomy:part': { subType: 'torso' },
      'core:stability': { rating: 'balanced' },
    });

    const recipe = {
      constraints: {
        requires: [
          {
            partTypes: ['head'],
            components: ['core:vision'],
          },
        ],
      },
      slots: {
        headAssembly: { type: 'head', count: { recommended: 2 } },
      },
    };

    const result = evaluator.evaluateConstraints(['head', 'torso'], recipe);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      "Slot 'headAssembly': recommended 2 parts of type 'head' but found 1",
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      'RecipeConstraintEvaluator: Constraints passed with 1 warnings'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws when constructed without required collaborators', () => {
    expect(() => new RecipeConstraintEvaluator({ logger })).toThrow(
      InvalidArgumentError
    );
    expect(() => new RecipeConstraintEvaluator({ entityManager })).toThrow(
      'logger is required'
    );
  });
});
