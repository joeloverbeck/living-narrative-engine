import { describe, it, expect } from '@jest/globals';
import EffectsValidator from '../../../src/goap/validation/effectsValidator.js';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

class CapturingLogger {
  constructor(level = LogLevel.NONE) {
    this.logger = new ConsoleLogger(level);
    this.entries = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  info(...args) {
    this.entries.info.push(args);
    this.logger.info(...args);
  }

  warn(...args) {
    this.entries.warn.push(args);
    this.logger.warn(...args);
  }

  error(...args) {
    this.entries.error.push(args);
    this.logger.error(...args);
  }

  debug(...args) {
    this.entries.debug.push(args);
    this.logger.debug(...args);
  }
}

class ThrowingRuleRegistry extends InMemoryDataRegistry {
  constructor({ logger, failingRuleIds }) {
    super({ logger });
    this.failingRuleIds = new Set(failingRuleIds);
  }

  get(type, id) {
    if (type === 'rules' && this.failingRuleIds.has(id)) {
      throw new Error(`Failed to load rule ${id}`);
    }

    return super.get(type, id);
  }
}

function buildValidator({ registry, logger } = {}) {
  const effectiveLogger = logger ?? new CapturingLogger(LogLevel.NONE);
  const dataRegistry =
    registry ?? new InMemoryDataRegistry({ logger: effectiveLogger });
  const effectsAnalyzer = new EffectsAnalyzer({
    logger: effectiveLogger,
    dataRegistry,
  });

  return {
    validator: new EffectsValidator({
      logger: effectiveLogger,
      effectsAnalyzer,
      dataRegistry,
    }),
    dataRegistry,
    logger: effectiveLogger,
  };
}

describe('EffectsValidator with production collaborators', () => {
  it('warns when no rules are found for an action', async () => {
    const { validator, dataRegistry } = buildValidator({
      logger: new CapturingLogger(LogLevel.NONE),
    });

    dataRegistry.store('actions', 'items:inspect', {
      id: 'items:inspect',
      modId: 'items',
      planningEffects: {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'items:inspecting',
          },
        ],
      },
    });

    const result = await validator.validateAction('items:inspect');

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([{ message: 'No rules found for action' }]);
    expect(result.errors).toHaveLength(0);
  });

  it('produces errors when required effects are missing from planning data', async () => {
    const { validator, dataRegistry } = buildValidator();

    dataRegistry.store('actions', 'items:give', {
      id: 'items:give',
      modId: 'items',
      planningEffects: {
        effects: [],
      },
    });

    dataRegistry.store('rules', 'items:handle_give', {
      id: 'items:handle_give',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity: 'actor',
            component: 'items:inventory_item',
            data: { itemId: '{itemId}' },
          },
        },
      ],
    });

    const result = await validator.validateAction('items:give');

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Missing effect');
    expect(result.errors[0].message).toContain('items:inventory_item');
    expect(result.warnings).toHaveLength(0);
  });

  it('reports unexpected planning effects when they do not match analyzed rules', async () => {
    const { validator, dataRegistry } = buildValidator();

    dataRegistry.store('actions', 'items:transfer', {
      id: 'items:transfer',
      modId: 'items',
      planningEffects: {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'items:incorrect_effect',
          },
        ],
      },
    });

    dataRegistry.store('rules', 'items:handle_transfer', {
      id: 'items:handle_transfer',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity: 'actor',
            component: 'items:inventory_item',
            data: { itemId: '{itemId}' },
          },
        },
      ],
    });

    const result = await validator.validateAction('items:transfer');

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Missing effect');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('Unexpected effect');
    expect(result.warnings[0].message).toContain('incorrect_effect');
  });

  it('gracefully handles registry failures when fetching rules', async () => {
    const logger = new CapturingLogger(LogLevel.NONE);
    const registry = new ThrowingRuleRegistry({
      logger,
      failingRuleIds: ['items:handle_faulty'],
    });

    const { validator, dataRegistry } = buildValidator({ logger, registry });

    dataRegistry.store('actions', 'items:faulty', {
      id: 'items:faulty',
      modId: 'items',
      planningEffects: {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'items:faulty_marker',
          },
        ],
      },
    });

    const result = await validator.validateAction('items:faulty');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toEqual([{ message: 'No rules found for action' }]);
  });

  it('records validation failures when planning effects are malformed', async () => {
    const logger = new CapturingLogger(LogLevel.NONE);
    const { validator, dataRegistry } = buildValidator({ logger });

    dataRegistry.store('actions', 'items:malformed', {
      id: 'items:malformed',
      modId: 'items',
      planningEffects: {
        effects: null,
      },
    });

    dataRegistry.store('rules', 'items:handle_malformed', {
      id: 'items:handle_malformed',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity: 'actor',
            component: 'items:inventory_item',
          },
        },
      ],
    });

    const result = await validator.validateAction('items:malformed');

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Cannot');
    expect(
      logger.entries.error.some((entry) =>
        entry.join(' ').includes('Failed to validate action items:malformed')
      )
    ).toBe(true);
  });
});
