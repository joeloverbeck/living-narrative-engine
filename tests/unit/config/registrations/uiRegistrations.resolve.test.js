import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { registerUI } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { MockContainer } from '../../../common/mockFactories/index.js';

/** Simple DOM elements for registration */
const uiElements = {
  outputDiv: document.createElement('div'),
  inputElement: document.createElement('input'),
  titleElement: document.createElement('h1'),
  document,
};

describe('registerUI token resolution', () => {
  /** @type {MockContainer} */
  let container;

  beforeEach(() => {
    container = new MockContainer();
    container.register(tokens.ILogger, {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });
    container.register(tokens.ISafeEventDispatcher, {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    });
    container.register(tokens.IValidatedEventDispatcher, {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    });
    container.register(tokens.IEntityManager, {
      getEntityInstance: jest.fn(),
    });
    container.register(tokens.EntityDisplayDataProvider, {});
    container.register(tokens.IDataRegistry, {});
    container.register(tokens.LLMAdapter, {});
    container.register(tokens.InjuryAggregationService, {
      aggregateInjuries: jest.fn(),
    });
    container.register(tokens.InjuryNarrativeFormatterService, {
      formatFirstPerson: jest.fn(),
      formatDamageEvent: jest.fn(),
    });
    container.register(tokens.OxygenAggregationService, {
      aggregateOxygen: jest.fn(),
    });
    container.register(tokens.IEmotionCalculatorService, {
      calculateSexualArousal: jest.fn(),
      calculateEmotions: jest.fn(),
      getTopEmotions: jest.fn().mockReturnValue([]),
      formatEmotionsForPrompt: jest.fn(),
      calculateSexualStates: jest.fn(),
      getTopSexualStates: jest.fn().mockReturnValue([]),
      formatSexualStatesForPrompt: jest.fn(),
    });
  });

  it('registers DomUiFacade and EngineUIManager', () => {
    registerUI(container, uiElements);
    expect(container._registrations.has(String(tokens.DomUiFacade))).toBe(true);
    expect(container._registrations.has(String(tokens.EngineUIManager))).toBe(
      true
    );
  });
});
