/**
 * @file Integration tests for displayFatalStartupError utility
 * @description Ensures fatal error display wiring works with real DOM manipulation helpers
 */

import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { DomAdapter } from '../../../src/interfaces/DomAdapter.js';
import { displayFatalStartupError } from '../../../src/utils/errorUtils.js';

class RealDomAdapter extends DomAdapter {
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
    referenceNode.parentNode?.insertBefore(newNode, referenceNode.nextSibling);
  }

  /** @override */
  setTextContent(element, text) {
    element.textContent = text;
  }

  /** @override */
  setStyle(element, property, value) {
    element.style[property] = value;
  }

  alert(message) {
    this.alertMessages.push(message);
  }
}

describe('displayFatalStartupError integration', () => {
  let domAdapter;
  let logger;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <h1 id="page-title">Living Narrative Engine</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Type here" />
      </main>
    `;

    domAdapter = new RealDomAdapter();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logger = new ConsoleLogger(LogLevel.ERROR);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('displays the fatal error inside the UI and updates related elements', () => {
    const uiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
      titleElement: document.getElementById('page-title'),
    };

    const details = {
      userMessage: 'Application failed to initialize.',
      consoleMessage: 'Bootstrap failed due to missing dependency.',
      errorObject: new Error('Missing dependency'),
      pageTitle: 'Critical Failure',
      inputPlaceholder: 'Please refresh the page',
      phase: 'Container Setup',
    };

    const result = displayFatalStartupError(
      uiElements,
      details,
      logger,
      domAdapter
    );

    expect(result.displayed).toBe(true);
    expect(uiElements.errorDiv?.textContent).toBe(details.userMessage);
    expect(uiElements.errorDiv?.style.display).toBe('block');
    expect(uiElements.titleElement?.textContent).toBe(details.pageTitle);
    expect(uiElements.inputElement?.disabled).toBe(true);
    expect(uiElements.inputElement?.placeholder).toBe(details.inputPlaceholder);
    expect(domAdapter.alertMessages).toHaveLength(0);
  });

  it('falls back to alert behaviour when no display targets are available', () => {
    document.body.innerHTML = `
      <main>
        <h1 id="page-title">Living Narrative Engine</h1>
        <input id="speech-input" placeholder="Type here" />
      </main>
    `;

    const uiElements = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: document.getElementById('error-output'),
      inputElement: document.getElementById('speech-input'),
      titleElement: document.getElementById('page-title'),
    };

    const details = {
      userMessage: 'Unable to render UI.',
      consoleMessage: 'DOM elements missing',
      phase: 'UI Check',
    };

    const result = displayFatalStartupError(
      uiElements,
      details,
      logger,
      domAdapter
    );

    expect(result.displayed).toBe(false);
    expect(domAdapter.alertMessages).toEqual([details.userMessage]);
  });
});
