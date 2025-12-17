/**
 * @file Integration tests for UIBootstrapper cooperating with bootstrap stages.
 * @description Exercises the real DOM-driven flow between the bootstrapper and
 *              the stage helpers to ensure essential elements are gathered and
 *              menu button listeners are wired without mocks.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { UIBootstrapper } from '../../../src/bootstrapper/UIBootstrapper.js';
import {
  ensureCriticalDOMElementsStage,
  setupMenuButtonListenersStage,
} from '../../../src/bootstrapper/stages/index.js';
import StageError from '../../../src/bootstrapper/StageError.js';

/** @typedef {import('../../../src/bootstrapper/UIBootstrapper.js').EssentialUIElements} EssentialUIElements */

describe('UIBootstrapper integration with bootstrap stages', () => {
  /** @type {{ debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock }} */
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const renderCompleteUi = () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <button id="llm-prompt-debug-button"></button>
    `;
  };

  it('collects real DOM references and wires menu listeners with actual implementations', async () => {
    renderCompleteUi();

    const stageResult = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => new UIBootstrapper(),
    });

    expect(stageResult.success).toBe(true);
    const elements = /** @type {EssentialUIElements} */ (stageResult.payload);

    expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(elements.errorDiv).toBe(document.getElementById('error-output'));
    expect(elements.inputElement).toBe(document.getElementById('speech-input'));
    expect(elements.document).toBe(document);

    const gameEngine = {
      previewLlmPromptForCurrentActor: jest.fn().mockResolvedValue(undefined),
    };

    const menuStage = await setupMenuButtonListenersStage(
      gameEngine,
      logger,
      document
    );

    expect(menuStage.success).toBe(true);

    const promptDebugButton = document.getElementById('llm-prompt-debug-button');
    expect(promptDebugButton).not.toBeNull();

    promptDebugButton?.click();

    expect(gameEngine.previewLlmPromptForCurrentActor).toHaveBeenCalledTimes(1);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Menu Button Listeners Setup')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('"LLM Prompt Debug" button clicked')
    );
  });

  it('returns a StageError when essential elements are missing', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <input id="speech-input" />
      <h1>Living Narrative Engine</h1>
      <button id="llm-prompt-debug-button"></button>
    `;

    const failureResult = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => new UIBootstrapper(),
    });

    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toBeInstanceOf(StageError);

    const stageError = /** @type {StageError} */ (failureResult.error);
    expect(stageError.phase).toBe('UI Element Validation');
    expect(stageError.message).toContain('errorDiv');
    expect(stageError.cause).toBeInstanceOf(Error);
    expect(stageError.cause?.message).toContain('errorDiv');
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
