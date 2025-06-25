import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { registerUI } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { MockContainer } from '../../../common/mockFactories/index.js';
import LoadGameUI from '../../../../src/domUI/loadGameUI.js';

const uiElements = {
  outputDiv: document.createElement('div'),
  inputElement: document.createElement('input'),
  titleElement: document.createElement('h1'),
  document,
};

describe('registerUI LoadGameUI resolution', () => {
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
    container.register(tokens.IEntityManager, {});
    container.register(tokens.EntityDisplayDataProvider, {});
    container.register(tokens.IDataRegistry, {});
    container.register(tokens.ISaveLoadService, {
      listManualSaveSlots: jest.fn(),
      deleteManualSave: jest.fn(),
    });
    container.register(tokens.LLMAdapter, {});
  });

  it('resolves LoadGameUI with IUserPrompt dependency', () => {
    registerUI(container, uiElements);
    const loadGameUI = container.resolve(tokens.LoadGameUI);
    expect(loadGameUI).toBeInstanceOf(LoadGameUI);
    const resolvedTokens = container.resolve.mock.calls.map((c) => c[0]);
    expect(resolvedTokens).toContain(tokens.IUserPrompt);
  });
});
