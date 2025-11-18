/**
 * @file Integration tests for StartupErrorHandler collaborating with DOM adapter and dispatcher.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { StartupErrorHandler } from '../../../src/utils/startupErrorHandler.js';
import { DomAdapter } from '../../../src/interfaces/DomAdapter.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class JsdomDomAdapter extends DomAdapter {
  constructor() {
    super();
    /** @type {string[]} */
    this.alertMessages = [];
    this.alert = this.alert.bind(this);
  }

  /** @override */
  createElement(tagName) {
    return document.createElement(tagName);
  }

  /** @override */
  insertAfter(referenceNode, newNode) {
    const parent = referenceNode.parentNode;
    if (!parent) {
      throw new Error('Missing parent for insertAfter');
    }
    parent.insertBefore(newNode, referenceNode.nextSibling);
  }

  /** @override */
  setTextContent(element, text) {
    element.textContent = text;
  }

  /** @override */
  setStyle(element, property, value) {
    if (property.includes('-')) {
      element.style.setProperty(property, value);
    } else {
      element.style[property] = value;
    }
  }

  alert(message) {
    this.alertMessages.push(message);
  }
}

describe('StartupErrorHandler integration', () => {
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let dispatcher;
  /** @type {JsdomDomAdapter} */
  let domAdapter;

  /**
   *
   */
  function createLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }

  /**
   *
   */
  function setupUi() {
    document.body.innerHTML = `
      <main>
        <h1 id="page-title">Living Narrative Engine</h1>
        <div id="output"></div>
        <div id="fatal-error" style="display:none"></div>
        <input id="speech-input" placeholder="Type here" />
      </main>
    `;

    return {
      outputDiv: document.getElementById('output'),
      errorDiv: document.getElementById('fatal-error'),
      titleElement: document.getElementById('page-title'),
      inputElement: /** @type {HTMLInputElement|null} */ (
        document.getElementById('speech-input')
      ),
    };
  }

  beforeEach(() => {
    domAdapter = new JsdomDomAdapter();
    logger = createLogger();
    dispatcher = { dispatch: jest.fn() };
  });

  it('renders fatal error details with working DOM dependencies', () => {
    const uiElements = setupUi();
    const handler = new StartupErrorHandler(logger, domAdapter, dispatcher, 'bootstrap');

    const errorDetails = {
      userMessage: 'Application failed to initialize.',
      consoleMessage: 'Bootstrap failed due to missing dependency.',
      errorObject: new Error('Missing dependency'),
      pageTitle: 'Critical Failure',
      inputPlaceholder: 'Please refresh the page',
      phase: 'Container Setup',
    };

    const result = handler.displayFatalStartupError(uiElements, errorDetails);

    expect(result.displayed).toBe(true);
    expect(uiElements.errorDiv?.textContent).toBe(errorDetails.userMessage);
    expect(uiElements.errorDiv?.style.display).toBe('block');
    expect(uiElements.titleElement?.textContent).toBe(errorDetails.pageTitle);
    expect(uiElements.inputElement?.disabled).toBe(true);
    expect(uiElements.inputElement?.placeholder).toBe(errorDetails.inputPlaceholder);
    expect(domAdapter.alertMessages).toHaveLength(0);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [eventId, payload] = dispatcher.dispatch.mock.calls[0];
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload.message).toBe(
      `[Bootstrapper Error - Phase: ${errorDetails.phase}] ${errorDetails.consoleMessage}`
    );
    expect(payload.details).toEqual({ error: errorDetails.errorObject.message });
  });

  it('falls back to a temporary error element when the primary target fails', () => {
    const uiElements = setupUi();
    const failingDomAdapter = new (class extends JsdomDomAdapter {
      setTextContent(element, text) {
        if (element.id === 'fatal-error') {
          throw new Error('Cannot update fatal error div');
        }
        super.setTextContent(element, text);
      }
    })();
    const handler = new StartupErrorHandler(
      logger,
      failingDomAdapter,
      dispatcher,
      'bootstrap'
    );

    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Unable to render UI.',
      consoleMessage: 'DOM elements missing',
      errorObject: new Error('Rendering failure'),
      phase: 'UI Check',
    });

    expect(result.displayed).toBe(true);
    const tempElement = uiElements.outputDiv?.nextSibling;
    expect(tempElement).toBeInstanceOf(HTMLElement);
    expect(tempElement?.id).toBe('temp-startup-error');
    expect(tempElement?.textContent).toBe('Unable to render UI.');
    expect(failingDomAdapter.alertMessages).toHaveLength(0);

    // Dispatcher should capture the bootstrap error and the fallback reporting
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'displayFatalStartupError: Failed to set textContent on errorDiv.',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[bootstrap] displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
    );
  });

  it('reports DOM manipulation failures and falls back to alert when nothing can render', () => {
    const uiElements = setupUi();
    uiElements.titleElement?.setAttribute('id', 'fatal-title');

    const inputElement = uiElements.inputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'disabled', {
        set() {
          throw new Error('Cannot disable input');
        },
      });
    }

    const collapsingAdapter = new (class extends JsdomDomAdapter {
      setTextContent(element, text) {
        if (element.id === 'fatal-error' || element.id === 'fatal-title') {
          throw new Error(`Cannot set text for ${element.id}`);
        }
        super.setTextContent(element, text);
      }

      insertAfter() {
        throw new Error('Cannot append temporary element');
      }
    })();

    const handler = new StartupErrorHandler(
      logger,
      collapsingAdapter,
      dispatcher,
      'bootstrap'
    );

    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Catastrophic startup failure.',
      consoleMessage: 'Initialization pipeline halted',
      errorObject: new Error('Bootstrap chain collapsed'),
      phase: 'Bootstrap Pipeline',
    });

    expect(result.displayed).toBe(false);
    expect(collapsingAdapter.alertMessages).toEqual([
      'Catastrophic startup failure.',
    ]);

    const dispatchedMessages = dispatcher.dispatch.mock.calls.map(([, payload]) => payload.message);
    expect(dispatchedMessages).toEqual([
      '[Bootstrapper Error - Phase: Bootstrap Pipeline] Initialization pipeline halted',
      'displayFatalStartupError: Failed to set textContent on errorDiv.',
      'displayFatalStartupError: Failed to create or append temporary error element.',
      'displayFatalStartupError: Failed to set textContent on titleElement.',
      'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
    ]);

    expect(logger.info).toHaveBeenCalledWith(
      '[bootstrap] displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
  });

  it('logs failures with default module logger when dispatcher is unavailable', () => {
    document.body.innerHTML = `
      <main>
        <h1 id="page-title">Living Narrative Engine</h1>
        <div id="fatal-error"></div>
      </main>
    `;

    const failingDomAdapter = new (class extends JsdomDomAdapter {
      setTextContent(element, text) {
        if (element.id === 'fatal-error') {
          throw 'text failure';
        }
        super.setTextContent(element, text);
      }
    })();

    const handler = new StartupErrorHandler(
      logger,
      failingDomAdapter,
      null
    );

    const result = handler.displayFatalStartupError(
      {
        outputDiv: null,
        errorDiv: document.getElementById('fatal-error'),
        titleElement: document.getElementById('page-title'),
        inputElement: null,
      },
      {
        userMessage: 'Non recoverable.',
        consoleMessage: 'Bootstrap aborted.',
      }
    );

    expect(result.displayed).toBe(false);
    expect(failingDomAdapter.alertMessages).toEqual(['Non recoverable.']);

    expect(logger.error).toHaveBeenCalledWith(
      '[errorUtils] [Bootstrapper Error - Phase: Unknown Phase] Bootstrap aborted.',
      ''
    );
    expect(logger.error).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Failed to set textContent on errorDiv.',
      'text failure'
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
    expect(document.getElementById('page-title')?.textContent).toBe('Fatal Error!');
  });

  it('sanitizes non-error values before dispatching failure telemetry', () => {
    const uiElements = setupUi();
    uiElements.titleElement?.setAttribute('id', 'fatal-title');

    const inputElement = uiElements.inputElement;
    if (inputElement) {
      Object.defineProperty(inputElement, 'disabled', {
        set() {
          throw 'disable denied';
        },
      });
    }

    const primitiveThrowingAdapter = new (class extends JsdomDomAdapter {
      setTextContent(element, text) {
        if (element.id === 'fatal-error') {
          throw 'render failure';
        }
        if (element.id === 'fatal-title') {
          throw 'title failure';
        }
        super.setTextContent(element, text);
      }

      insertAfter() {
        throw 'insert failure';
      }
    })();

    const handler = new StartupErrorHandler(
      logger,
      primitiveThrowingAdapter,
      dispatcher,
      'bootstrap'
    );

    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Primitive failures everywhere.',
      consoleMessage: 'Multiple DOM operations rejected.',
      phase: 'Telemetry',
    });

    expect(result.displayed).toBe(false);
    expect(primitiveThrowingAdapter.alertMessages).toEqual([
      'Primitive failures everywhere.',
    ]);

    const dispatched = dispatcher.dispatch.mock.calls.map(([, payload]) => payload);
    expect(dispatched[0].message).toBe(
      '[Bootstrapper Error - Phase: Telemetry] Multiple DOM operations rejected.'
    );
    expect(dispatched[1]).toEqual(
      expect.objectContaining({
        message:
          'displayFatalStartupError: Failed to set textContent on errorDiv.',
        details: expect.objectContaining({ error: 'render failure' }),
      })
    );
    expect(dispatched[2]).toEqual(
      expect.objectContaining({
        message:
          'displayFatalStartupError: Failed to create or append temporary error element.',
        details: expect.objectContaining({ error: 'insert failure' }),
      })
    );
    expect(dispatched[3]).toEqual(
      expect.objectContaining({
        message:
          'displayFatalStartupError: Failed to set textContent on titleElement.',
        details: expect.objectContaining({ raw: 'title failure' }),
      })
    );
    expect(dispatched[4]).toEqual(
      expect.objectContaining({
        message:
          'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
        details: expect.objectContaining({ raw: 'disable denied' }),
      })
    );
  });
});
