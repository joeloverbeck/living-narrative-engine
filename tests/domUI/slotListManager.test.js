import { JSDOM } from 'jsdom';
import { describe, it, expect, jest } from '@jest/globals';
import SaveGameUI from '../../src/domUI/saveGameUI.js';
import SaveGameService from '../../src/domUI/saveGameService.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { createMockLogger } from '../common/mockFactories';

/**
 *
 * @param saveLoadService
 */
function setupUI(saveLoadService) {
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
  const logger = createMockLogger();
  const docContext = new DocumentContext(document, logger);
  const factory = new DomElementFactory(docContext);
  const dispatcher = {
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    dispatch: jest.fn(),
  };
  const saveGameService = new SaveGameService({
    logger,
    userPrompt: { confirm: jest.fn() },
  });

  const ui = new SaveGameUI({
    logger,
    documentContext: docContext,
    domElementFactory: factory,
    saveLoadService,
    validatedEventDispatcher: dispatcher,
    saveGameService,
  });

  return { ui, logger };
}

describe('slot list manager', () => {
  it('fetches and formats save slots', async () => {
    const saveLoadService = {
      listManualSaveSlots: jest.fn().mockResolvedValue([
        {
          identifier: 'id1',
          saveName: 'First',
          timestamp: '2023-01-01T00:00:00Z',
          playtimeSeconds: 5,
          isCorrupted: false,
        },
        {
          identifier: 'id2',
          saveName: 'Second',
          timestamp: '2023-01-02T00:00:00Z',
          playtimeSeconds: 10,
          isCorrupted: false,
        },
      ]),
    };

    const { ui } = setupUI(saveLoadService);
    const data = await ui._getSaveSlotsData();

    expect(saveLoadService.listManualSaveSlots).toHaveBeenCalled();
    expect(data).toHaveLength(10);
    expect(data[0]).toMatchObject({
      slotId: 0,
      identifier: 'id1',
      isEmpty: false,
    });
    expect(data[2].isEmpty).toBe(true);
  });

  it('handles fetch errors gracefully', async () => {
    const saveLoadService = {
      listManualSaveSlots: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const { ui, logger } = setupUI(saveLoadService);
    const statusSpy = jest.spyOn(ui, '_displayStatusMessage');
    const data = await ui._getSaveSlotsData();

    expect(data).toEqual([]);
    expect(statusSpy).toHaveBeenCalledWith(
      'Error loading save slots information.',
      'error'
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
