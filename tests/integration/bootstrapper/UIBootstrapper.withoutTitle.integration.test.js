/**
 * @file Integration test to verify UIBootstrapper works without titleElement (h1)
 * This test reproduces the scenario from the runtime error where game.html
 * had the title/header removed, causing bootstrap to fail.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { UIBootstrapper } from '../../../src/bootstrapper/UIBootstrapper.js';

describe('UIBootstrapper without titleElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('should successfully bootstrap when h1 title element is missing', () => {
    // Setup: Create DOM without h1 element (simulates game.html with title removed)
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const bootstrapper = new UIBootstrapper();
    const result = bootstrapper.gatherEssentialElements(document);

    // Verify: Essential elements are gathered successfully
    expect(result.outputDiv).toBe(document.getElementById('outputDiv'));
    expect(result.errorDiv).toBe(document.getElementById('error-output'));
    expect(result.inputElement).toBe(document.getElementById('speech-input'));
    expect(result.document).toBe(document);

    // Verify: titleElement is not required and not present in result
    expect(result.titleElement).toBeUndefined();

    // Verify: No warnings or errors logged
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not fail when only required elements are present', () => {
    // Setup: Minimal DOM with only the required elements
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
    `;

    const bootstrapper = new UIBootstrapper();

    // Verify: gatherEssentialElements completes without throwing
    expect(() => {
      bootstrapper.gatherEssentialElements(document);
    }).not.toThrow();
  });

  it('should still fail when truly required elements are missing', () => {
    // Setup: DOM missing a required element (errorDiv)
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <input id="speech-input" />
    `;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const bootstrapper = new UIBootstrapper();

    // Verify: Still fails for missing required elements
    expect(() => {
      bootstrapper.gatherEssentialElements(document);
    }).toThrow(/Fatal Error: Cannot find required HTML elements: errorDiv/);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('errorDiv (ID: error-output)')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[UIBootstrapper]',
      expect.stringContaining('errorDiv (ID: error-output)')
    );
  });

  it('should work correctly in production-like scenario without h1', () => {
    // Setup: Production DOM structure without title element
    document.body.innerHTML = `
      <div id="outputDiv">
        <ul id="message-list"></ul>
      </div>
      <div id="error-output"></div>
      <input id="speech-input" type="text" placeholder="Enter command..." />
      <div id="action-buttons"></div>
    `;

    const bootstrapper = new UIBootstrapper();
    const result = bootstrapper.gatherEssentialElements(document);

    // Verify: All essential elements are found
    expect(result.outputDiv).toBeInstanceOf(HTMLElement);
    expect(result.errorDiv).toBeInstanceOf(HTMLElement);
    expect(result.inputElement).toBeInstanceOf(HTMLInputElement);
    expect(result.document).toBe(document);

    // Verify: No titleElement in result
    expect(result.titleElement).toBeUndefined();
  });
});
