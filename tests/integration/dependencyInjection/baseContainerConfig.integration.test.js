import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import * as actionCategorizationRegistrations from '../../../src/dependencyInjection/registrations/actionCategorizationRegistrations.js';

/**
 *
 */
function setupUiDom() {
  document.body.innerHTML = `
    <h1 id="title-element">Test Game</h1>
    <div id="current-turn-actor-panel">
      <div class="actor-visuals"></div>
      <img id="current-actor-image" alt="" />
      <p class="actor-name-display"></p>
    </div>
    <div id="perception-log-widget">
      <ul id="perception-log-list"></ul>
    </div>
    <div id="outputDiv">
      <ul id="message-list"></ul>
      <div id="processing-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    </div>
    <div id="actions-widget">
      <div id="action-buttons"></div>
      <button id="player-confirm-turn-button" type="button">Confirm</button>
    </div>
    <input id="speech-input" />
    <div id="location-info-container">
      <div id="location-portrait-visuals">
        <img id="location-portrait-image" alt="" />
      </div>
      <h2 id="location-name-display"></h2>
      <p id="location-description-display"></p>
      <div id="location-exits-display"></div>
      <div id="location-characters-display"></div>
    </div>
    <div id="actor-participation-widget">
      <div id="actor-participation-list-container"></div>
      <div id="actor-participation-status"></div>
    </div>
    <div id="perceptible-event-sender-widget">
      <textarea id="perceptible-event-message"></textarea>
      <select id="perceptible-event-location"></select>
      <div id="actor-filter-container">
        <input type="radio" name="filter-mode" value="all" checked />
        <input type="radio" name="filter-mode" value="specific" />
        <select id="perceptible-event-actors" multiple></select>
      </div>
      <button id="send-perceptible-event-button" type="button">Send</button>
      <div id="perceptible-event-status"></div>
    </div>
    <button id="change-llm-button" type="button">Change LLM</button>
    <div id="llm-selection-modal">
      <button id="llm-selection-modal-close-button" type="button">Close</button>
      <ul id="llm-selection-list"></ul>
      <div id="llm-selection-status-message"></div>
    </div>
    <div id="save-game-screen">
      <button id="cancel-save-button" type="button">Cancel Save</button>
      <div id="save-slots-container"></div>
      <input id="save-name-input" />
      <button id="confirm-save-button" type="button">Save</button>
      <div id="save-game-status-message"></div>
    </div>
    <div id="load-game-screen">
      <button id="cancel-load-button" type="button">Cancel Load</button>
      <div id="load-slots-container"></div>
      <button id="confirm-load-button" type="button">Load</button>
      <button id="delete-save-button" type="button">Delete</button>
      <div id="load-game-status-message"></div>
    </div>
    <div id="turn-order-ticker" role="region" aria-label="Turn order" aria-live="polite">
      <span id="ticker-round-number">ROUND 1</span>
      <div id="ticker-actor-queue" class="ticker-actor-queue"></div>
    </div>
  `;
}

describe('configureBaseContainer (integration)', () => {
  let container;
  let logger;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    container.register(tokens.ILogger, logger, { lifecycle: 'singleton' });
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (container) {
      container.reset();
    }
    container = null;
    document.body.innerHTML = '';
  });

  it('configures the container with game systems, UI, anatomy, and executes callbacks', async () => {
    const callback = jest.fn();
    container.registerCallback(callback);

    setupUiDom();

    const uiElements = {
      outputDiv: document.getElementById('outputDiv'),
      inputElement: document.getElementById('speech-input'),
      titleElement: document.getElementById('title-element'),
      uiInputContainer: document.getElementById('actions-widget'),
      document,
    };

    await configureBaseContainer(container, {
      includeGameSystems: true,
      includeUI: true,
      includeAnatomySystems: true,
      uiElements,
      logger,
    });

    const turnManager = container.resolve(tokens.ITurnManager);
    expect(turnManager).toBeDefined();

    const uiManager = container.resolve(tokens.EngineUIManager);
    expect(uiManager).toBeDefined();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(container);

    expect(logger.debug).toHaveBeenCalledWith(
      '[BaseContainerConfig] Executing registered callbacks...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      '[BaseContainerConfig] Base container configuration complete.'
    );
  });

  it('registers minimal AI when only character builder services are requested', async () => {
    await configureBaseContainer(container, {
      includeCharacterBuilder: true,
      includeGameSystems: false,
      logger,
    });

    const characterBuilderService = container.resolve(
      tokens.ICharacterBuilderService
    );
    expect(characterBuilderService).toBeDefined();

    const llmJsonService = container.resolve(tokens.LlmJsonService);
    expect(llmJsonService).toBeDefined();

    expect(logger.debug).toHaveBeenCalledWith(
      '[BaseContainerConfig] Registering character builder services...'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      '[BaseContainerConfig] Registering minimal AI services for character builder...'
    );
  });

  it('logs and rethrows errors from registration failures with contextual information', async () => {
    const registrationError = new Error('intentional failure');
    jest
      .spyOn(actionCategorizationRegistrations, 'registerActionCategorization')
      .mockImplementation(() => {
        throw registrationError;
      });

    await expect(configureBaseContainer(container, { logger })).rejects.toThrow(
      'Failed to register action categorization services: intentional failure'
    );

    expect(logger.error).toHaveBeenCalledWith(
      '[BaseContainerConfig] Failed to register action categorization services: intentional failure',
      registrationError
    );

    expect(logger.error).toHaveBeenCalledWith(
      '[BaseContainerConfig] Configuration failed:',
      expect.any(Error)
    );
  });
});
