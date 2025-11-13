import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { UIBootstrapper } from '../../../src/bootstrapper/UIBootstrapper.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

/** @typedef {import('../../../src/bootstrapper/UIBootstrapper.js').EssentialUIElements} EssentialUIElements */

describe('UIBootstrapper gatherEssentialElements integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('collects essential DOM references when all nodes are present', () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const bootstrapper = new UIBootstrapper();
    const result = /** @type {EssentialUIElements} */ (
      bootstrapper.gatherEssentialElements(document)
    );

    expect(result.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(result.errorDiv).toBe(document.getElementById('error-output'));
    expect(result.inputElement).toBe(document.getElementById('speech-input'));
    expect(result.document).toBe(document);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('throws an aggregated error message when required elements are missing', () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <input id="speech-input" />
    `;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const bootstrapper = new UIBootstrapper();

    expect(() => bootstrapper.gatherEssentialElements(document)).toThrow(
      /Fatal Error: Cannot find required HTML elements: errorDiv \(ID: error-output\)/
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('errorDiv (ID: error-output)')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[UIBootstrapper]',
      expect.stringContaining('errorDiv (ID: error-output)')
    );
  });

  it('rejects attempts to gather elements without a document reference', () => {
    const bootstrapper = new UIBootstrapper();
    expect(() => bootstrapper.gatherEssentialElements(null)).toThrow(
      'Fatal Error: Document object was not provided to UIBootstrapper.'
    );
  });

  it('surfaces selector failures as query errors for easier debugging', () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Living Narrative Engine</h1>
    `;

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest
      .spyOn(DocumentContext.prototype, 'query')
      .mockImplementation(function queryWithFailure(selector) {
        if (selector === '#error-output') {
          throw new Error('query failure');
        }
        return this.document?.querySelector(selector) ?? null;
      });

    const bootstrapper = new UIBootstrapper();

    expect(() => bootstrapper.gatherEssentialElements(document)).toThrow(
      /errorDiv \(ID: error-output\) \(query failed\)/
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error querying for errorDiv (ID: error-output)'),
      expect.any(Error)
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[UIBootstrapper]',
      expect.stringContaining('errorDiv (ID: error-output) (query failed)')
    );
  });
});
