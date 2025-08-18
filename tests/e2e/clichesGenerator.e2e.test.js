/**
 * @file End-to-end test for Clichés Generator page loading
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Clichés Generator Page Loading', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'cliches-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Create a new JSDOM instance
    dom = new JSDOM(html, {
      url: 'http://localhost:3000/cliches-generator.html',
      runScripts: 'dangerously',
      resources: 'usable',
    });

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  it('should have all required UI state elements', () => {
    // Check that all required state elements exist
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const resultsState = document.getElementById('results-state');
    const errorState = document.getElementById('error-state');

    expect(emptyState).toBeTruthy();
    expect(loadingState).toBeTruthy();
    expect(resultsState).toBeTruthy();
    expect(errorState).toBeTruthy();

    // Check initial visibility
    expect(emptyState.style.display).not.toBe('none');
    expect(loadingState.style.display).toBe('none');
    expect(resultsState.style.display).toBe('none');
    expect(errorState.style.display).toBe('none');
  });

  it('should have all required form elements', () => {
    const directionSelector = document.getElementById('direction-selector');
    const generateBtn = document.getElementById('generate-btn');
    const form = document.getElementById('cliches-form');

    expect(directionSelector).toBeTruthy();
    expect(generateBtn).toBeTruthy();
    expect(form).toBeTruthy();

    // Check initial state
    expect(generateBtn.disabled).toBe(true);
    expect(directionSelector.value).toBe('');
  });

  it('should have all required display containers', () => {
    const directionDisplay = document.getElementById(
      'selected-direction-display'
    );
    const conceptDisplay = document.getElementById('original-concept-display');
    const clichesContainer = document.getElementById('cliches-container');
    const statusMessages = document.getElementById('status-messages');

    expect(directionDisplay).toBeTruthy();
    expect(conceptDisplay).toBeTruthy();
    expect(clichesContainer).toBeTruthy();
    expect(statusMessages).toBeTruthy();

    // Check initial visibility
    expect(directionDisplay.style.display).toBe('none');
    expect(conceptDisplay.style.display).toBe('none');
  });

  it('should not have loading overlay stuck visible', () => {
    // Check if there's a loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');

    if (loadingOverlay) {
      // If it exists, it should not be visible
      expect(loadingOverlay.style.display).toBe('none');
    }

    // Check that the loading state is not visible
    const loadingState = document.getElementById('loading-state');
    expect(loadingState.style.display).toBe('none');
  });

  it('should show empty state by default', () => {
    const emptyState = document.getElementById('empty-state');

    // Empty state should be visible
    expect(emptyState).toBeTruthy();
    expect(emptyState.style.display).not.toBe('none');

    // Check that the empty state has the expected content
    const emptyStateText = emptyState.textContent;
    expect(emptyStateText).toContain('No Clichés Generated');
  });
});
