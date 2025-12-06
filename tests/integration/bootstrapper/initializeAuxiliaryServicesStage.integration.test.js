/**
 * @file Integration tests for initializeAuxiliaryServicesStage orchestrating
 *       real auxiliary service initializers against the DI container.
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { initializeAuxiliaryServicesStage } from '../../../src/bootstrapper/stages/initializeAuxiliaryServicesStage.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import StageError from '../../../src/bootstrapper/StageError.js';
import { createEnhancedMockLogger } from '../../common/mockFactories.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

/**
 * Loads the primary game UI DOM required by the auxiliary services.
 * Removes script tags to avoid executing bundled scripts during tests.
 */
function loadGameDom() {
  const htmlPath = path.resolve(currentDirname, '../../../game.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : '';
  const sanitized = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = sanitized;
}

/**
 * Creates a logger that satisfies the expectations of the bootstrap stages.
 * We extend the enhanced mock logger with child logger helpers used in the app.
 */
function createLogger() {
  const logger = createEnhancedMockLogger();
  logger.createChildLogger = jest.fn(() => logger);
  logger.scope = jest.fn(() => logger);
  logger.log = jest.fn();
  return logger;
}

/**
 * Builds a DI container configured with UI services resolved against the DOM.
 */
async function createContainerAndLogger() {
  loadGameDom();
  const container = new AppContainer();
  const logger = createLogger();
  container.register(tokens.ILogger, logger);
  const llmAdapterStub = {
    getAvailableLlmOptions: jest.fn().mockResolvedValue([]),
    getCurrentActiveLlmId: jest.fn().mockResolvedValue(null),
    setActiveLlm: jest.fn().mockResolvedValue(true),
  };
  container.register(tokens.LLMAdapter, llmAdapterStub);

  const uiElements = {
    outputDiv: document.getElementById('outputDiv'),
    inputElement: document.getElementById('speech-input'),
    document,
  };

  if (!uiElements.outputDiv || !uiElements.inputElement) {
    throw new Error('Required UI elements missing from DOM setup.');
  }

  await configureBaseContainer(container, {
    includeGameSystems: false,
    includeUI: true,
    includeCharacterBuilder: false,
    uiElements,
    logger,
  });

  return { container, logger };
}

describe('initializeAuxiliaryServicesStage integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('initializes UI-oriented auxiliary services successfully', async () => {
    const { container, logger } = await createContainerAndLogger();

    const engineUiManager = container.resolve(tokens.EngineUIManager);
    const saveGameUI = container.resolve(tokens.SaveGameUI);
    const loadGameUI = container.resolve(tokens.LoadGameUI);

    const engineInitializeSpy = jest.spyOn(engineUiManager, 'initialize');
    const saveInitSpy = jest.spyOn(saveGameUI, 'init');
    const loadInitSpy = jest.spyOn(loadGameUI, 'init');

    container.setOverride(tokens.EngineUIManager, engineUiManager);
    container.setOverride(tokens.SaveGameUI, saveGameUI);
    container.setOverride(tokens.LoadGameUI, loadGameUI);

    const gameEngine = {
      triggerManualSave: jest.fn().mockResolvedValue(undefined),
      loadGame: jest.fn().mockResolvedValue(undefined),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      gameEngine,
      logger,
      tokens
    );

    expect(result.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Bootstrap Stage: Starting Auxiliary Services Initialization'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Bootstrap Stage: Auxiliary Services Initialization completed.'
      )
    );

    expect(engineInitializeSpy).toHaveBeenCalledTimes(1);
    expect(saveInitSpy).toHaveBeenCalledTimes(1);
    expect(loadInitSpy).toHaveBeenCalledTimes(1);

    const [saveAdapter] = saveInitSpy.mock.calls[0];
    const [loadAdapter] = loadInitSpy.mock.calls[0];
    expect(saveAdapter).toBeInstanceOf(GameEngineSaveAdapter);
    expect(loadAdapter).toBeInstanceOf(GameEngineLoadAdapter);
    expect(gameEngine.triggerManualSave).not.toHaveBeenCalled();
    expect(gameEngine.loadGame).not.toHaveBeenCalled();
  });

  it('aggregates failures when auxiliary services cannot initialize', async () => {
    const { container, logger } = await createContainerAndLogger();

    container.setOverride(tokens.EngineUIManager, {
      initialize: () => {
        throw new Error('Engine manager boom');
      },
    });
    container.setOverride(tokens.LlmSelectionModal, null);

    const gameEngine = {
      triggerManualSave: jest.fn(),
      loadGame: jest.fn(),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      gameEngine,
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe('Auxiliary Services Initialization');
    expect(result.error.message).toContain('EngineUIManager');
    expect(result.error.message).toContain('LlmSelectionModal');

    const failureNames = result.error.failures.map((f) => f.service);
    expect(failureNames).toEqual(
      expect.arrayContaining(['EngineUIManager', 'LlmSelectionModal'])
    );
  });
});
