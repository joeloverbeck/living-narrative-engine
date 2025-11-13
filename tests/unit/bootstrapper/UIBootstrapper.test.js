import { afterEach, describe, it, expect, jest } from '@jest/globals';
import { UIBootstrapper } from '../../../src/bootstrapper/UIBootstrapper.js';

// Use a global variable so the jest.mock factory can access it
global.__queryMock = undefined;

jest.mock('../../../src/domUI/documentContext.js', () => {
  return {
    __esModule: true,
    default: class {
      constructor(doc) {
        this.doc = doc;
      }
      query(selector) {
        if (typeof global.__queryMock === 'function') {
          return global.__queryMock(selector, this.doc);
        }
        return this.doc.querySelector(selector);
      }
    },
  };
});

/**
 * Helper to set the DOM for tests.
 *
 * @param {string} html - HTML string to inject into document.body.
 */
function setDom(html) {
  document.body.innerHTML = html;
}

describe('UIBootstrapper.gatherEssentialElements', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
    global.__queryMock = undefined;
  });

  it('returns all elements when present', () => {
    setDom(`
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `);
    const bootstrapper = new UIBootstrapper();
    const result = bootstrapper.gatherEssentialElements(document);

    expect(result.outputDiv).toBe(document.querySelector('#outputDiv'));
    expect(result.errorDiv).toBe(document.querySelector('#error-output'));
    expect(result.inputElement).toBe(document.querySelector('#speech-input'));
    expect(result.document).toBe(document);
  });

  it('throws with details when elements are missing', () => {
    setDom('<div id="outputDiv"></div>');
    const bootstrapper = new UIBootstrapper();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => bootstrapper.gatherEssentialElements(document)).toThrow(
      'Fatal Error: Cannot find required HTML elements: errorDiv (ID: error-output), inputElement (ID: speech-input). Application cannot start.'
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('throws when document is not provided', () => {
    const bootstrapper = new UIBootstrapper();
    expect(() => bootstrapper.gatherEssentialElements(undefined)).toThrow(
      'Fatal Error: Document object was not provided to UIBootstrapper.'
    );
  });

  it('handles query errors from DocumentContext', () => {
    setDom(`
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `);
    global.__queryMock = jest
      .fn()
      .mockImplementationOnce((sel) => document.querySelector(sel))
      .mockImplementationOnce(() => {
        throw new Error('fail');
      })
      .mockImplementation(() => null);

    const bootstrapper = new UIBootstrapper();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => bootstrapper.gatherEssentialElements(document)).toThrow(
      'Fatal Error: Cannot find required HTML elements: errorDiv (ID: error-output) (query failed), inputElement (ID: speech-input). Application cannot start.'
    );
    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
