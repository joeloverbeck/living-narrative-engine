import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';
import { ValidationContext } from '../../../src/anatomy/validation/validationContext.js';
import { SocketLimitRule } from '../../../src/anatomy/validation/rules/socketLimitRule.js';
import { PartTypeCompatibilityRule } from '../../../src/anatomy/validation/rules/partTypeCompatibilityRule.js';
import { RecipeConstraintRule } from '../../../src/anatomy/validation/rules/recipeConstraintRule.js';
import { RecipeConstraintEvaluator } from '../../../src/anatomy/recipeConstraintEvaluator.js';
import { ValidationRule } from '../../../src/anatomy/validation/validationRule.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
  constructor() {
    this.#componentsByEntity = new Map();
  }

  #componentsByEntity;

  addEntity(entityId, components = {}) {
    const entityComponents = new Map();
    for (const [componentId, data] of Object.entries(components)) {
      entityComponents.set(componentId, data);
    }
    this.#componentsByEntity.set(entityId, entityComponents);
  }

  setComponent(entityId, componentId, data) {
    if (!this.#componentsByEntity.has(entityId)) {
      this.#componentsByEntity.set(entityId, new Map());
    }
    this.#componentsByEntity.get(entityId).set(componentId, data);
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

describe('ValidationRuleChain integration with real rules', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = new InMemoryEntityManager();
    logger = createLogger();
  });

  it('executes anatomy validation rules end-to-end and aggregates issues from each module', async () => {
    entityManager.addEntity('torso-1', {
      'anatomy:sockets': {
        sockets: [{ id: 'shoulder-left', allowedTypes: ['arm'] }],
      },
    });

    entityManager.addEntity('left-arm', {
      'anatomy:joint': { parentId: 'torso-1', socketId: 'shoulder-left' },
      'anatomy:part': { subType: 'hand' },
    });

    const socketOccupancy = new Set(['torso-1:missing-socket']);

    const recipe = {
      constraints: {
        requires: [
          {
            partTypes: ['hand'],
            components: ['core:strength'],
          },
        ],
      },
      slots: {
        hands: { type: 'hand', count: { min: 2 } },
      },
    };

    const context = new ValidationContext({
      entityIds: ['torso-1', 'left-arm'],
      recipe,
      socketOccupancy,
      entityManager,
      logger,
    });

    const chain = new ValidationRuleChain({ logger });

    expect(() => chain.addRule(null)).toThrow(InvalidArgumentError);

    const constraintEvaluator = new RecipeConstraintEvaluator({
      entityManager,
      logger,
    });

    chain
      .addRule(new SocketLimitRule())
      .addRule(new PartTypeCompatibilityRule())
      .addRule(
        new RecipeConstraintRule({
          recipeConstraintEvaluator: constraintEvaluator,
        })
      );

    await chain.execute(context);

    expect(chain.getRuleCount()).toBe(3);
    expect(chain.getRuleNames()).toEqual([
      'Socket Limit Validation',
      'Part Type Compatibility',
      'Recipe Constraint Validation',
    ]);

    const issues = context.getIssues();
    expect(issues).toHaveLength(4);
    expect(context.hasErrors()).toBe(true);
    expect(context.getErrors()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Socket 'missing-socket' not found"),
        expect.stringContaining("Part type 'hand' not allowed"),
        expect.stringContaining('Required constraint not satisfied'),
        expect.stringContaining(
          "Slot 'hands': expected at least 2 parts of type 'hand'"
        ),
      ])
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'ValidationRuleChain: Executing 3 validation rules'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'ValidationRuleChain: Completed validation with 4 errors and 0 warnings'
    );
  });

  it('skips inapplicable rules and records failures without stopping the chain', async () => {
    entityManager.addEntity('torso-1', {
      'anatomy:sockets': {
        sockets: [{ id: 'shoulder-left', allowedTypes: ['arm', '*'] }],
      },
    });

    entityManager.addEntity('left-arm', {
      'anatomy:joint': { parentId: 'torso-1', socketId: 'shoulder-left' },
      'anatomy:part': { subType: 'arm' },
    });

    const context = new ValidationContext({
      entityIds: ['torso-1', 'left-arm'],
      recipe: {},
      socketOccupancy: new Set(['torso-1:shoulder-left']),
      entityManager,
      logger,
    });

    class ExplodingRule extends ValidationRule {
      get ruleId() {
        return 'exploding-rule';
      }

      get ruleName() {
        return 'Exploding Rule';
      }

      shouldApply() {
        return true;
      }

      async validate() {
        throw new Error('kaboom');
      }
    }

    const chain = new ValidationRuleChain({ logger })
      .addRule(new RecipeConstraintRule({}))
      .addRule(new SocketLimitRule())
      .addRule(new ExplodingRule());

    await chain.execute(context);

    const issues = context.getIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'error',
      message: expect.stringContaining(
        "Validation rule 'Exploding Rule' failed: kaboom"
      ),
      ruleId: 'exploding-rule',
    });

    expect(logger.debug).toHaveBeenCalledWith(
      "ValidationRuleChain: Skipping rule 'Recipe Constraint Validation' - shouldApply returned false"
    );
    expect(logger.error).toHaveBeenCalledWith(
      "ValidationRuleChain: Error executing rule 'Exploding Rule'",
      expect.objectContaining({ error: 'kaboom' })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'ValidationRuleChain: Completed validation with 1 errors and 0 warnings'
    );
  });

  it('fails fast when validation chain configuration is invalid', () => {
    expect(() => new ValidationRuleChain({})).toThrow(InvalidArgumentError);

    const chain = new ValidationRuleChain({ logger });

    expect(() => chain.addRule({ ruleName: 'Broken Rule' })).toThrow(
      InvalidArgumentError
    );
  });
});
