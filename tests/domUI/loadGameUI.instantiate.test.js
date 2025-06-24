import { JSDOM } from 'jsdom';
import LoadGameUI from '../../src/domUI/loadGameUI.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { describe, it, expect, jest } from '@jest/globals';

describe('LoadGameUI instantiation', () => {
  it('can be created with mocked services and a custom DocumentContext', () => {
    const html = `<!DOCTYPE html><body>
      <div id="load-game-screen">
        <div id="load-slots-container"></div>
        <div id="load-game-status-message"></div>
        <button id="confirm-load-button"></button>
        <button id="delete-save-button"></button>
        <button id="cancel-load-button"></button>
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
    const saveLoadService = {
      listManualSaveSlots: jest.fn(),
      deleteManualSave: jest.fn(),
    };
    const dispatcher = {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      dispatch: jest.fn(),
    };
    const userPrompt = { confirm: jest.fn(() => true) };

    const ui = new LoadGameUI({
      logger: mockLogger,
      documentContext: docContext,
      domElementFactory: factory,
      saveLoadService,
      validatedEventDispatcher: dispatcher,
      userPrompt,
    });

    expect(ui).toBeInstanceOf(LoadGameUI);
    expect(userPrompt.confirm).not.toHaveBeenCalled();
    expect(typeof ui.show).toBe('function');
    ui.show();
    ui.hide();
  });
});
