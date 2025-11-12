import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import EffectsGenerator from '../../../src/goap/generation/effectsGenerator.js';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

const planningEffectsSchemaPath = join(
  process.cwd(),
  'data/schemas/planning-effects.schema.json'
);
const planningEffectsSchema = JSON.parse(
  readFileSync(planningEffectsSchemaPath, 'utf8')
);

class CapturingLogger {
  constructor() {
    this.entries = {
      info: [],
      warn: [],
      error: [],
      debug: []
    };
  }

  info(...args) {
    this.entries.info.push(args);
  }

  warn(...args) {
    this.entries.warn.push(args);
  }

  error(...args) {
    this.entries.error.push(args);
  }

  debug(...args) {
    this.entries.debug.push(args);
  }
}

class ExceptionDataRegistry extends InMemoryDataRegistry {
  constructor({ logger, failingGets = [], failingGetAllTypes = [] } = {}) {
    super({ logger });
    this.#failingGets = new Map(
      failingGets.map(([key, config]) => {
        if (typeof config === 'string') {
          return [
            key,
            { message: config, throwOnFirstCall: true, throwOnSecondCall: false }
          ];
        }

        return [
          key,
          {
            message: config.message,
            throwOnFirstCall: Boolean(config.throwOnFirstCall),
            throwOnSecondCall: Boolean(config.throwOnSecondCall)
          }
        ];
      })
    );
    this.#failingGetAllTypes = new Set(failingGetAllTypes);
    this.#ruleAnalysisCallCounts = new Map();
  }

  #failingGets;
  #failingGetAllTypes;
  #ruleAnalysisCallCounts;

  get(type, id) {
    const key = `${type}:${id}`;

    if (this.#failingGets.has(key)) {
      const config = this.#failingGets.get(key);
      const currentCount = (this.#ruleAnalysisCallCounts.get(key) ?? 0) + 1;
      this.#ruleAnalysisCallCounts.set(key, currentCount);

      if (config.throwOnFirstCall && currentCount === 1) {
        throw new Error(config.message);
      }

      if (config.throwOnSecondCall && currentCount === 2) {
        throw new Error(config.message);
      }
    }

    return super.get(type, id);
  }

  getAll(type) {
    if (this.#failingGetAllTypes.has(type)) {
      throw new Error(`getAll failure for ${type}`);
    }

    return super.getAll(type);
  }
}

function createSchemaValidator(logger, dataRegistry) {
  return new AjvSchemaValidator({
    logger,
    dataRegistry,
    preloadSchemas: [
      {
        id: planningEffectsSchema.$id,
        schema: planningEffectsSchema
      }
    ]
  });
}

function buildGenerator({ logger = new CapturingLogger(), dataRegistry, schemaValidator } = {}) {
  const registry = dataRegistry ?? new InMemoryDataRegistry({ logger });
  const validator = schemaValidator ?? createSchemaValidator(logger, registry);
  const analyzer = new EffectsAnalyzer({ logger, dataRegistry: registry });
  const generator = new EffectsGenerator({
    logger,
    effectsAnalyzer: analyzer,
    dataRegistry: registry,
    schemaValidator: validator
  });

  return { generator, registry, logger, analyzer, schemaValidator: validator };
}

describe('EffectsGenerator integration with production collaborators', () => {
  it('generates effects with abstract preconditions using production analyzer and schema validator', () => {
    const { generator, registry } = buildGenerator();

    registry.store('actions', 'items:give_item', {
      id: 'items:give_item',
      name: 'Give Item'
    });

    registry.store('rules', 'items:handle_give_item', {
      id: 'items:handle_give_item',
      actions: [
        {
          type: 'VALIDATE_INVENTORY_CAPACITY',
          parameters: {
            result_variable: 'capacityCheck',
            actor_id: '{actorId}',
            item_id: '{itemId}'
          }
        },
        {
          type: 'TRANSFER_ITEM',
          parameters: {
            from_entity: 'actor',
            to_entity: 'target',
            item_id: '{itemId}'
          }
        }
      ]
    });

    const effectsMap = generator.generateForMod('items');
    const effects = effectsMap.get('items:give_item');

    expect(effects).toBeDefined();
    expect(effects.effects).toHaveLength(2);
    expect(effects.effects).toEqual([
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: '{itemId}' }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'target',
        component: 'items:inventory_item',
        data: { itemId: '{itemId}' }
      }
    ]);
    expect(effects.abstractPreconditions).toEqual({
      capacityCheck: {
        description: 'Checks if actor can carry the item',
        parameters: ['actorId', 'itemId'],
        simulationFunction: 'assumeTrue'
      }
    });
    expect(effects.cost).toBeCloseTo(1.2, 1);
  });

  it('throws when an action is missing from the registry', () => {
    const { generator, logger } = buildGenerator();

    expect(() => generator.generateForAction('items:missing'))
      .toThrow('Action not found: items:missing');
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('Failed to generate effects for action items:missing')
      )
    ).toBe(true);
  });

  it('continues mod generation when a rule analysis fails and records the failure', () => {
    const logger = new CapturingLogger();
    const failingRegistry = new ExceptionDataRegistry({
      logger,
      failingGets: [
        [
          'rules:items:handle_broken_action',
          { message: 'Rule retrieval failed during analysis', throwOnFirstCall: false, throwOnSecondCall: true }
        ]
      ]
    });
    const schemaValidator = createSchemaValidator(logger, failingRegistry);
    const analyzer = new EffectsAnalyzer({ logger, dataRegistry: failingRegistry });
    const generator = new EffectsGenerator({
      logger,
      effectsAnalyzer: analyzer,
      dataRegistry: failingRegistry,
      schemaValidator
    });

    failingRegistry.store('actions', 'items:give_item', { id: 'items:give_item' });
    failingRegistry.store('rules', 'items:handle_give_item', {
      id: 'items:handle_give_item',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: { entity: 'actor', component: 'items:inventory_item', data: {} }
        }
      ]
    });

    failingRegistry.store('actions', 'items:broken_action', { id: 'items:broken_action' });
    failingRegistry.store('rules', 'items:handle_broken_action', {
      id: 'items:handle_broken_action',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: { entity: 'actor', component: 'items:inventory_item', data: {} }
        }
      ]
    });

    const map = generator.generateForMod('items');

    expect(map.size).toBe(1);
    expect(map.has('items:give_item')).toBe(true);
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('Failed to analyze rule items:handle_broken_action')
      )
    ).toBe(true);
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('✗ items:broken_action - Failed to generate effects')
      )
    ).toBe(true);
  });

  it('propagates registry failures when loading actions for a mod', () => {
    const logger = new CapturingLogger();
    const registry = new ExceptionDataRegistry({
      logger,
      failingGetAllTypes: ['actions']
    });
    const schemaValidator = createSchemaValidator(logger, registry);
    const analyzer = new EffectsAnalyzer({ logger, dataRegistry: registry });
    const generator = new EffectsGenerator({
      logger,
      effectsAnalyzer: analyzer,
      dataRegistry: registry,
      schemaValidator
    });

    expect(() => generator.generateForMod('items')).toThrow('getAll failure for actions');
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('Failed to generate effects for mod items')
      )
    ).toBe(true);
  });

  it('marks validation result with a warning when no effects are generated', () => {
    const logger = new CapturingLogger();
    const registry = new InMemoryDataRegistry({ logger });
    const schemaValidator = {
      validate: () => ({ isValid: true, errors: [] })
    };
    const analyzer = new EffectsAnalyzer({ logger, dataRegistry: registry });
    const generator = new EffectsGenerator({
      logger,
      effectsAnalyzer: analyzer,
      dataRegistry: registry,
      schemaValidator
    });

    const validation = generator.validateEffects('items:test', {
      effects: [],
      cost: 1
    });

    expect(validation.valid).toBe(true);
    expect(validation.warnings).toContainEqual({
      type: 'empty',
      message: 'No effects generated'
    });
  });

  it('captures invalid component references during validation', () => {
    const { generator } = buildGenerator();

    const validation = generator.validateEffects('items:test', {
      effects: [
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'invalidComponent'
        }
      ],
      cost: 1
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual({
      type: 'invalid_component',
      message: 'Invalid component reference: invalidComponent',
      effect: {
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'invalidComponent'
      }
    });
  });

  it('captures malformed abstract preconditions during validation', () => {
    const { generator } = buildGenerator();

    const validation = generator.validateEffects('items:test', {
      effects: [
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: {}
        }
      ],
      cost: 1,
      abstractPreconditions: {
        broken: {
          description: '',
          parameters: null,
          simulationFunction: null
        }
      }
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual({
      type: 'invalid_precondition',
      message: 'Invalid abstract precondition: broken',
      precondition: {
        description: '',
        parameters: null,
        simulationFunction: null
      }
    });
  });

  it('returns exception details when schema validation throws', () => {
    const logger = new CapturingLogger();
    const registry = new InMemoryDataRegistry({ logger });
    const analyzer = new EffectsAnalyzer({ logger, dataRegistry: registry });
    const throwingValidator = {
      validate() {
        throw new Error('schema validation blew up');
      }
    };
    const generator = new EffectsGenerator({
      logger,
      effectsAnalyzer: analyzer,
      dataRegistry: registry,
      schemaValidator: throwingValidator
    });

    const result = generator.validateEffects('items:test', {
      effects: [
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: {}
        }
      ],
      cost: 1
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        type: 'exception',
        message: 'schema validation blew up'
      }
    ]);
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('Failed to validate effects for items:test')
      )
    ).toBe(true);
  });

  it('warns when injecting effects for an unknown action', () => {
    const { generator, logger } = buildGenerator();

    const updateCount = generator.injectEffects(
      new Map([
        [
          'items:missing_action',
          {
            effects: [],
            cost: 1
          }
        ]
      ])
    );

    expect(updateCount).toBe(0);
    expect(
      logger.entries.warn.some(entry =>
        entry.join(' ').includes('Action not found for injection: items:missing_action')
      )
    ).toBe(true);
  });

  it('logs errors when injection fails due to registry issues', () => {
    const logger = new CapturingLogger();
    const registry = new ExceptionDataRegistry({
      logger,
      failingGets: [['actions:items:broken_action', 'Action retrieval failed']]
    });
    const schemaValidator = createSchemaValidator(logger, registry);
    const analyzer = new EffectsAnalyzer({ logger, dataRegistry: registry });
    const generator = new EffectsGenerator({
      logger,
      effectsAnalyzer: analyzer,
      dataRegistry: registry,
      schemaValidator
    });

    const count = generator.injectEffects(
      new Map([
        [
          'items:broken_action',
          {
            effects: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'items:inventory_item',
                data: {}
              }
            ],
            cost: 1
          }
        ]
      ])
    );

    expect(count).toBe(0);
    expect(
      logger.entries.error.some(entry =>
        entry.join(' ').includes('Failed to inject effects for items:broken_action')
      )
    ).toBe(true);
  });

  it('locates alternate rules referencing an action when naming conventions differ', () => {
    const { generator, registry, logger } = buildGenerator();

    registry.store('actions', 'items:indirect_action', {
      id: 'items:indirect_action'
    });

    registry.store('rules', 'items:alternate_indirect', {
      id: 'items:alternate_indirect',
      event: { type: 'ACTION_DECIDED' },
      conditions: [
        { type: 'event-is-action', actionId: 'items:indirect_action' }
      ],
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity: 'actor',
            component: 'items:inventory_item',
            data: { itemId: '{itemId}' }
          }
        }
      ]
    });

    const effects = generator.generateForAction('items:indirect_action');

    expect(effects.effects).toEqual([
      {
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: '{itemId}' }
      }
    ]);
    expect(effects.cost).toBeCloseTo(1.1, 1);
    expect(
      logger.entries.debug.some(entry =>
        entry.join(' ').includes('Rule not found with standard naming: items:handle_indirect_action')
      )
    ).toBe(true);
  });
});
