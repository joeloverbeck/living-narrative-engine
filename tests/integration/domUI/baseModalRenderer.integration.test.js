/**
 * @file Integration tests for BaseModalRenderer using real production collaborators.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseModalRenderer } from '../../../src/domUI/baseModalRenderer.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

/**
 * Creates a minimal IDataRegistry implementation that satisfies production constructors.
 * The registry mirrors the method surface expected by GameDataRepository while
 * returning neutral values so tests can focus on UI behaviour.
 */
function createDataRegistry() {
  const noop = jest.fn();
  const arrayFn = jest.fn().mockReturnValue([]);

  return {
    getWorldDefinition: noop,
    getAllWorldDefinitions: arrayFn,
    getStartingPlayerId: noop,
    getStartingLocationId: noop,
    getActionDefinition: noop,
    getAllActionDefinitions: arrayFn,
    getEntityDefinition: noop,
    getAllEntityDefinitions: arrayFn,
    getEventDefinition: noop,
    getAllEventDefinitions: arrayFn,
    getComponentDefinition: noop,
    getAllComponentDefinitions: arrayFn,
    getConditionDefinition: noop,
    getAllConditionDefinitions: arrayFn,
    getGoalDefinition: noop,
    getAllGoalDefinitions: arrayFn,
    getEntityInstanceDefinition: noop,
    getAllEntityInstanceDefinitions: arrayFn,
    get: noop,
    getAll: arrayFn,
    clear: noop,
    store: noop,
  };
}

/**
 * Builds a real ValidatedEventDispatcher backed by production services.
 *
 * @param {import('../../../src/interfaces/coreServices.js').ILogger} logger
 */
function createValidatedEventDispatcher(logger) {
  const schemaValidator = new AjvSchemaValidator({ logger });
  const dataRegistry = createDataRegistry();
  const gameDataRepository = new GameDataRepository(dataRegistry, logger);
  const eventBus = new EventBus({ logger });

  return new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
}

class TestModalRenderer extends BaseModalRenderer {
  constructor(options) {
    super(options);
    this.onShowSpy = jest.fn();
    this.onHideSpy = jest.fn();
    this.initialFocusOverride = null;
    this.returnFocusOverride = null;
    this.throwOnShow = false;
    this.throwOnHide = false;
  }

  _onShow() {
    this.onShowSpy();
    if (this.throwOnShow) {
      throw new Error('onShow failure');
    }
  }

  _onHide() {
    this.onHideSpy();
    if (this.throwOnHide) {
      throw new Error('onHide failure');
    }
  }

  _getInitialFocusElement() {
    if (this.initialFocusOverride) {
      return this.initialFocusOverride;
    }
    return super._getInitialFocusElement();
  }

  _getReturnFocusElement() {
    if (this.returnFocusOverride) {
      return this.returnFocusOverride;
    }
    return super._getReturnFocusElement();
  }
}

describe('BaseModalRenderer integration', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeAll(() => {
    originalRequestAnimationFrame = global.requestAnimationFrame;
    originalCancelAnimationFrame = global.cancelAnimationFrame;
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  afterAll(() => {
    if (originalRequestAnimationFrame) {
      global.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete global.requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete global.cancelAnimationFrame;
    }
  });

  let logger;
  let validatedEventDispatcher;
  let documentContext;

  beforeEach(() => {
    logger = createMockLogger();
    validatedEventDispatcher = createValidatedEventDispatcher(logger);
    documentContext = new DocumentContext(document, logger);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  it('manages modal lifecycle, event bindings, and UI helpers with real collaborators', async () => {
    document.body.innerHTML = `
      <button id="launch" type="button">Launch</button>
      <div id="modal" class="modal-overlay">
        <div class="content">
          <button id="close" type="button">Close</button>
          <button id="confirm" type="button">Confirm</button>
          <button id="cancel" type="button">Cancel</button>
          <div id="status" class="status-message-area"></div>
        </div>
      </div>
    `;

    const modalElement = document.getElementById('modal');
    const closeButton = document.getElementById('close');
    const confirmButton = document.getElementById('confirm');
    const cancelButton = document.getElementById('cancel');
    const statusElement = document.getElementById('status');
    const launchButton = document.getElementById('launch');

    confirmButton.focus = jest.fn();
    cancelButton.focus = jest.fn();
    launchButton.focus = jest.fn();

    const renderer = new TestModalRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        modalElement: '#modal',
        closeButton: '#close',
        confirmButton: '#confirm',
        cancelButton: '#cancel',
        statusMessageElement: '#status',
      },
    });

    expect(modalElement.getAttribute('aria-hidden')).toBe('true');

    renderer.initialFocusOverride = confirmButton;
    renderer.returnFocusOverride = launchButton;

    renderer.show();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(renderer.isVisible).toBe(true);
    expect(modalElement.style.display).toBe('flex');
    expect(modalElement.classList.contains('visible')).toBe(true);
    expect(modalElement.getAttribute('aria-hidden')).toBe('false');
    expect(renderer.onShowSpy).toHaveBeenCalled();
    expect(confirmButton.focus).toHaveBeenCalled();

    renderer._displayStatusMessage('Processing request', 'warning');
    expect(statusElement.textContent).toBe('Processing request');
    expect(statusElement.classList.contains('status-message-warning')).toBe(
      true
    );

    renderer._displayStatusMessage('Completed', 'success');
    expect(statusElement.classList.contains('status-message-success')).toBe(
      true
    );
    expect(statusElement.classList.contains('status-message-warning')).toBe(
      false
    );

    renderer._clearStatusMessage();
    expect(statusElement.textContent).toBe('');
    expect(statusElement.classList.contains('status-message-success')).toBe(
      false
    );

    renderer._operationInProgressAffectedElements = [
      'confirmButton',
      'cancelButton',
      'missingButton',
    ];
    renderer._setOperationInProgress(true);
    expect(confirmButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
    renderer._setOperationInProgress(false);
    expect(confirmButton.disabled).toBe(false);
    expect(cancelButton.disabled).toBe(false);

    closeButton.click();
    expect(renderer.isVisible).toBe(false);
    expect(renderer.onHideSpy).toHaveBeenCalled();

    await new Promise((resolve) =>
      setTimeout(resolve, renderer._hideAnimationDuration + 10)
    );
    expect(modalElement.style.display).toBe('none');
    expect(launchButton.focus).toHaveBeenCalled();

    renderer.show();
    await new Promise((resolve) => setTimeout(resolve, 0));
    modalElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(renderer.isVisible).toBe(false);

    renderer.show();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(renderer.isVisible).toBe(false);

    renderer.throwOnShow = true;
    renderer.show();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in _onShow lifecycle hook.'),
      expect.any(Error)
    );

    renderer.throwOnShow = false;
    renderer.throwOnHide = true;
    renderer.hide();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in _onHide lifecycle hook.'),
      expect.any(Error)
    );

    renderer.throwOnHide = false;
    renderer.show();
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderer.show();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('show() called when modal is already visible.')
    );

    renderer.destroy();
    expect(renderer._managedDomListeners).toHaveLength(0);
    expect(renderer.isVisible).toBe(false);
  });

  it('logs configuration issues and handles focus fallbacks when DOM elements are missing', () => {
    document.body.innerHTML = '<div id="modal" class="modal-overlay"></div>';
    const modalElement = document.getElementById('modal');

    const renderer = new TestModalRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        modalElement: '#modal',
        closeButton: '#missing-close',
        statusMessageElement: '#missing-status',
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "'closeButton' was configured in 'elementsConfig' but not found"
      )
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "'statusMessageElement' was configured in 'elementsConfig' but not found"
      )
    );

    renderer._displayStatusMessage('ignored');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "'_displayStatusMessage' called, but 'statusMessageElement' is not available."
      )
    );

    modalElement.removeAttribute('tabindex');
    renderer.initialFocusOverride = null;
    renderer.show();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No default initial focus element identified.')
    );

    renderer._operationInProgressAffectedElements = [];
    renderer._setOperationInProgress(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "No elements configured for '_setOperationInProgress'."
      )
    );

    renderer.elements.modalElement = null;
    renderer.isVisible = true;
    renderer.hide();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Cannot hide modal, 'modalElement' is not available."
      )
    );

    const rendererWithoutCloseButton = new TestModalRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        modalElement: '#modal',
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "'closeButton' was not specified in 'elementsConfig'."
      )
    );

    rendererWithoutCloseButton.show();
    rendererWithoutCloseButton._previouslyFocusedElement =
      document.createElement('button');
    rendererWithoutCloseButton.hide();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Previously focused element is no longer focusable.'
      )
    );

    rendererWithoutCloseButton.show();
    rendererWithoutCloseButton._previouslyFocusedElement = null;
    rendererWithoutCloseButton.hide();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No specific element to return focus to.')
    );

    const missingModalRenderer = new TestModalRenderer({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        modalElement: '#does-not-exist',
      },
    });

    missingModalRenderer.show();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Cannot show modal, 'modalElement' is not available."
      )
    );
  });
});
