import { JSDOM } from 'jsdom';
import SaveGameUI from '../../src/domUI/saveGameUI.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { describe, it, expect, jest } from '@jest/globals';

describe('SaveGameUI instantiation', () => {
  it('can be created with mocked services and a custom DocumentContext', () => {
    const html = `<!DOCTYPE html><body>
      <div id="save-game-screen">
        <button id="cancel-save-button"></button>
        <div id="save-slots-container"></div>
        <input id="save-name-input" />
        <button id="confirm-save-button"></button>
        <div id="save-game-status-message"></div>
      </div>
    </body>`;
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    const docContext = new DocumentContext(document, mockLogger);
    const factory = new DomElementFactory(docContext);
    const saveLoadService = { listManualSaveSlots: jest.fn() };
    const dispatcher = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };
    const userPrompt = { confirm: jest.fn(() => true) };

    const ui = new SaveGameUI({
      logger: mockLogger,
      documentContext: docContext,
      domElementFactory: factory,
      saveLoadService,
      validatedEventDispatcher: dispatcher,
      userPrompt,
    });

    expect(ui).toBeInstanceOf(SaveGameUI);
    expect(userPrompt.confirm).not.toHaveBeenCalled();
    expect(typeof ui.show).toBe('function');
    ui.show();
    ui.hide();
  });
});
