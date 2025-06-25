import { describe, it, expect, jest } from '@jest/globals';
import {
  createBaseRuleEnvironment,
  createRuleTestEnvironment,
} from '../../../common/engine/systemLogicTestEnv.js';
import { createCapturingEventBus } from '../../../common/mockFactories/eventBus.js';

describe('createBaseRuleEnvironment injection', () => {
  it('uses provided instances', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const eventBus = createCapturingEventBus();
    const registry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getConditionDefinition: jest.fn(),
    };

    const env = createBaseRuleEnvironment({
      createHandlers: () => ({}),
      logger,
      eventBus,
      dataRegistry: registry,
    });

    expect(env.logger).toBe(logger);
    expect(env.eventBus).toBe(eventBus);
    expect(env.dataRegistry).toBe(registry);
    env.cleanup();
  });

  it('uses factories when provided', () => {
    const loggerFactory = jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const busFactory = jest.fn(() => createCapturingEventBus());
    const registryFactory = jest.fn(() => ({
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getConditionDefinition: jest.fn(),
    }));

    const env = createBaseRuleEnvironment({
      createHandlers: () => ({}),
      createLogger: loggerFactory,
      createEventBus: busFactory,
      createDataRegistry: registryFactory,
    });

    expect(loggerFactory).toHaveBeenCalled();
    expect(busFactory).toHaveBeenCalled();
    expect(registryFactory).toHaveBeenCalled();
    env.cleanup();
  });
});

describe('createRuleTestEnvironment forwarding', () => {
  it('forwards factories to createBaseRuleEnvironment', () => {
    const loggerFactory = jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const env = createRuleTestEnvironment({
      createHandlers: () => ({}),
      createLogger: loggerFactory,
    });

    expect(loggerFactory).toHaveBeenCalled();
    expect(env.logger).toBeDefined();
    env.cleanup();
  });
});
