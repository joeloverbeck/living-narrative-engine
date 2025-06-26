import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { registerUI } from '../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import InputHandler from '../../src/input/inputHandler.js';
import { ChatAlertRenderer } from '../../src/domUI/chatAlertRenderer.js';

describe('registerUI', () => {
  /** @type {AppContainer} */
  let container;
  let elements;

  beforeEach(() => {
    container = new AppContainer();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    container.register(tokens.ISafeEventDispatcher, {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    });

    const doc = document;
    elements = {
      outputDiv: doc.createElement('div'),
      inputElement: doc.createElement('input'),
      titleElement: doc.createElement('h1'),
      document: doc,
    };
  });

  it('registers and resolves UI services', () => {
    registerUI(container, elements);

    const input1 = container.resolve(tokens.IInputHandler);
    const input2 = container.resolve(tokens.IInputHandler);
    expect(input1).toBeInstanceOf(InputHandler);
    expect(input1).toBe(input2); // singleton

    const chat1 = container.resolve(tokens.ChatAlertRenderer);
    const chat2 = container.resolve(tokens.ChatAlertRenderer);
    expect(chat1).toBeInstanceOf(ChatAlertRenderer);
    expect(chat1).toBe(chat2); // singleton
  });
});
