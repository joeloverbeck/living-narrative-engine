/**
 * @file Additional coverage tests for ThematicDirectionController
 * @description Focuses on branches that previously lacked unit test coverage
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

/**
 * Render the DOM structure required for the thematic direction controller
 *
 * @param {object} [options]
 * @param {boolean} [options.includeBackButton]
 * @returns {void}
 */
function renderControllerLayout({ includeBackButton = true } = {}) {
  document.body.innerHTML = `
    <div id="app">
      <form id="concept-form">
        <div class="cb-form-group">
          <select id="concept-selector">
            <option value="">Select a concept</option>
            <option value="stale-option">Old option</option>
            <option value="another-stale">Another old option</option>
          </select>
        </div>
        <textarea id="concept-input"></textarea>
        <div class="char-count">0/1000</div>
        <div id="concept-error"></div>
        <button id="generate-btn" type="submit" disabled>Generate</button>
      </form>
      <div id="concept-selector-error"></div>
      <div id="selected-concept-display" style="display: none;">
        <div id="concept-content"></div>
        <div id="concept-directions-count"></div>
        <div id="concept-created-date"></div>
      </div>
      <div id="empty-state" class="state-container">Empty</div>
      <div id="loading-state" class="state-container" style="display: none;">Loading</div>
      <div id="results-state" class="state-container" style="display: none;">
        <div id="directions-results"></div>
      </div>
      <div id="error-state" class="state-container" style="display: none;">
        <div id="error-message-text"></div>
      </div>
      <div id="directions-container" style="max-height: 100px; overflow: auto;"></div>
      <button id="retry-btn" type="button">Retry</button>
      ${includeBackButton ? '<button id="back-to-menu-btn" type="button">Back</button>' : ''}
    </div>
  `;
}

describe('ThematicDirectionController - Additional Branch Coverage', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();
  const originalURLSearchParams = URLSearchParams;

  beforeEach(async () => {
    await testBase.setup();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(async () => {
    jest.useRealTimers();
    global.URLSearchParams = originalURLSearchParams;
    await testBase.cleanup();
  });

  it('prevents default form submission and navigates back to the menu when requested', async () => {
    renderControllerLayout({ includeBackButton: true });

    const form = document.getElementById('concept-form');
    const addEventListenerSpy = jest.spyOn(form, 'addEventListener');

    testBase.controller = new ThematicDirectionController(testBase.mockDependencies);

    const generateSpy = jest
      .spyOn(testBase.controller, '_handleGenerateDirections')
      .mockResolvedValue();

    await testBase.controller.initialize();

    const submitListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'submit'
    )[1];
    const preventSpy = jest.fn();
    await submitListener({ preventDefault: preventSpy });

    expect(preventSpy).toHaveBeenCalled();
    expect(generateSpy).toHaveBeenCalledTimes(1);

    const backButton = document.getElementById('back-to-menu-btn');
    expect(() =>
      backButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ).not.toThrow();

    generateSpy.mockRestore();
  });

  it('enables generation for preselected concepts and logs retries when generation ultimately fails', async () => {
    renderControllerLayout({ includeBackButton: false });

    const mockConcept = testBase.buildCharacterConcept({
      id: 'concept-1',
      concept: 'Test concept',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      mockConcept,
    ]);

    global.URLSearchParams = jest.fn(() => ({
      get: (key) => (key === 'conceptId' ? 'concept-1' : null),
    }));

    testBase.controller = new ThematicDirectionController(testBase.mockDependencies);

    const executionError = new Error('generation failed');
    const executionSpy = jest
      .spyOn(testBase.controller, '_executeWithErrorHandling')
      .mockRejectedValue(executionError);

    await testBase.controller.initialize();

    const conceptSelector = document.getElementById('concept-selector');
    const generateButton = document.getElementById('generate-btn');

    expect(conceptSelector.value).toBe('concept-1');
    expect(generateButton.disabled).toBe(false);

    await testBase.controller._handleGenerateDirections();

    expect(
      testBase.mockDependencies.logger.error
    ).toHaveBeenCalledWith('Generation failed after retries', executionError);

    testBase.controller._resetToEmpty();
    expect(generateButton.disabled).toBe(false);

    executionSpy.mockRestore();
  });

  it('clears stale selector options and shows the empty state message when no concepts exist', async () => {
    renderControllerLayout({ includeBackButton: false });

    testBase.controller = new ThematicDirectionController(testBase.mockDependencies);

    await testBase.controller.initialize();

    const conceptSelector = document.getElementById('concept-selector');
    const staleOptionOne = new Option('Legacy concept 1', 'legacy-1');
    const staleOptionTwo = new Option('Legacy concept 2', 'legacy-2');
    conceptSelector.appendChild(staleOptionOne);
    conceptSelector.appendChild(staleOptionTwo);

    const newestConcept = testBase.buildCharacterConcept({
      id: 'concept-new',
      concept: 'Newest concept',
      createdAt: '2024-05-10T00:00:00.000Z',
    });
    const olderConcept = testBase.buildCharacterConcept({
      id: 'concept-old',
      concept: 'Older concept',
      createdAt: '2023-12-25T00:00:00.000Z',
    });

    testBase.controller._populateConceptSelector([newestConcept, olderConcept]);

    expect(conceptSelector.options.length).toBe(1 + 2);

    testBase.controller._populateConceptSelector([]);

    const message = document.querySelector('.no-concepts-message');
    expect(message).not.toBeNull();
    expect(message?.previousElementSibling?.classList.contains('cb-form-group')).toBe(true);
    expect(document.getElementById('generate-btn').disabled).toBe(true);
  });

  it('truncates long text and safely handles missing legacy form helpers', async () => {
    renderControllerLayout({ includeBackButton: false });

    testBase.controller = new ThematicDirectionController(testBase.mockDependencies);
    await testBase.controller.initialize();

    const truncated = testBase.controller._truncateText('a'.repeat(20), 10);
    expect(truncated).toBe('aaaaaaaaaa...');

    document.getElementById('generate-btn').remove();
    expect(() => testBase.controller._validateInput()).not.toThrow();

    document.querySelector('.char-count').remove();
    expect(() => testBase.controller._updateCharCount()).not.toThrow();
  });

  it('scrolls the results container to the top after rendering new thematic directions', async () => {
    renderControllerLayout({ includeBackButton: false });

    const mockConcept = testBase.buildCharacterConcept({
      id: 'concept-scroll',
      concept: 'Scroll concept',
      thematicDirections: [{ id: 'existing-direction' }],
    });

    testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      mockConcept,
    ]);

    testBase.controller = new ThematicDirectionController(testBase.mockDependencies);
    await testBase.controller.initialize();

    jest.useFakeTimers();

    const directionsContainer = document.getElementById('directions-container');
    directionsContainer.scrollTop = 75;

    const newDirections = [
      {
        title: 'New Horizon',
        description: 'Fresh narrative direction',
        themes: ['hope'],
        tone: 'uplifting',
        coreTension: 'duty vs desire',
        uniqueTwist: 'unexpected ally',
        narrativePotential: 'franchise ready',
      },
    ];

    testBase.controller._displayResults(mockConcept, newDirections);

    jest.runAllTimers();

    expect(directionsContainer.scrollTop).toBe(0);
  });
});
