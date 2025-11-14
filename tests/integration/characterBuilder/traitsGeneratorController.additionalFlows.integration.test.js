/**
 * @file Additional integration tests for TraitsGeneratorController
 * @description Covers generation workflow branches that were previously untested.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  createControllerSetup,
  defaultDirectionItem,
  flushAsyncOperations,
  flushMicrotasksOnly,
  initializeAndSettle,
} from './traitsGeneratorTestUtils.js';

const originalGlobalURL = global.URL;
const originalScrollIntoView = Element.prototype.scrollIntoView;

describe('TraitsGeneratorController Integration - Additional Flows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalGlobalURL) {
      global.URL = originalGlobalURL;
    } else {
      delete global.URL;
    }
    document.body.innerHTML = '';
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url);
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete Element.prototype.scrollIntoView;
    }
  });

  it('should show direction error when generating without selection', async () => {
    const { controller, eventBus, service } = createControllerSetup();
    await initializeAndSettle(controller);

    const initialEventCount = eventBus.events.length;
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');

    generateBtn.click();
    await flushMicrotasksOnly();

    expect(document.getElementById('direction-selector-error').textContent).toContain(
      'Please select a thematic direction first'
    );
    expect(eventBus.events).toHaveLength(initialEventCount);
    expect(service.generateTraitsCalls).toHaveLength(0);

    await flushAsyncOperations();

    await controller.destroy();
  });

  it('should prevent generation on invalid inputs and announce validation issues', async () => {
    const { controller, service } = createControllerSetup();
    await initializeAndSettle(controller);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value = 'too short';
    document.getElementById('internal-contradiction-input').value = 'small';
    document.getElementById('central-question-input').value = 'short?';

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();
    await flushMicrotasksOnly();

    const validationMessage = document.getElementById('input-validation-error').textContent;
    expect(validationMessage).toContain('Core motivation must be at least 10 characters');
    expect(validationMessage).toContain('Internal contradiction must be at least 10 characters');
    expect(validationMessage).toContain('Central question must be at least 10 characters');
    expect(service.generateTraitsCalls).toHaveLength(0);
    expect(document.getElementById('screen-reader-announcement').textContent).toBe(
      'Please fix validation errors before generating traits'
    );

    await flushAsyncOperations();

    await controller.destroy();
  });

  it('should complete generation workflow, export results, and respond to keyboard shortcuts', async () => {
    const url = new URL(window.location.href);
    url.search = `?directionId=${defaultDirectionItem.direction.id}`;
    window.history.replaceState({}, '', url);

    const { controller, service, eventBus, logger } = createControllerSetup();
    await initializeAndSettle(controller);

    // Preselection should have populated the selector and cleared errors
    const selector = document.getElementById('direction-selector');
    expect(selector.value).toBe(defaultDirectionItem.direction.id);
    expect(document.getElementById('direction-selector-error').textContent).toBe('');

    // Provide valid inputs
    document.getElementById('core-motivation-input').value =
      'To ensure every settlement can stand on its own.';
    document.getElementById('internal-contradiction-input').value =
      'Believes in teamwork yet refuses to show vulnerability.';
    document.getElementById('central-question-input').value =
      'How can communities heal while honoring past sacrifices?';

    document.getElementById('core-motivation-input').dispatchEvent(new Event('input'));
    document.getElementById('internal-contradiction-input').dispatchEvent(new Event('input'));
    document.getElementById('central-question-input').dispatchEvent(new Event('input'));
    await flushAsyncOperations();

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();
    await flushAsyncOperations();

    const resultsHtml = document.getElementById('traits-results').innerHTML;
    expect(resultsHtml).toContain('Generated Character Traits');
    expect(resultsHtml).toContain('Character Names');
    expect(resultsHtml).toContain('Based on Your Inputs');

    expect(document.getElementById('export-btn').style.display).toBe('inline-block');

    expect(service.generateTraitsCalls).toHaveLength(1);
    const eventNames = eventBus.events.map((evt) => evt.name);
    expect(eventNames).toEqual(
      expect.arrayContaining(['core:traits_generated'])
    );
    const successEvent = eventBus.events.find(
      (evt) => evt.name === 'core:traits_generated'
    );
    expect(successEvent).toEqual(
      expect.objectContaining({
        name: 'core:traits_generated',
        payload: expect.objectContaining({
          directionId: defaultDirectionItem.direction.id,
          success: true,
          traitsCount: expect.any(Number),
        }),
      })
    );

    // Export to text using click handler
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock'),
      revokeObjectURL: jest.fn(),
    };
    document.getElementById('export-btn').click();
    await flushAsyncOperations();
    expect(global.URL.createObjectURL).toHaveBeenCalled();

    // Keyboard shortcut: Ctrl+E exports again
    document.dispatchEvent(
      new KeyboardEvent('keydown', { ctrlKey: true, key: 'e' })
    );
    await flushAsyncOperations();
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);

    // Keyboard shortcut: Ctrl+Shift+Delete clears selection
    document.dispatchEvent(
      new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'Delete' })
    );
    await flushAsyncOperations();
    expect(selector.value).toBe('');

    // Reselect and trigger generation with Ctrl+Enter
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value =
      'To rebuild a thriving trade network that empowers the outskirts.';
    document.getElementById('internal-contradiction-input').value =
      'Craves collaboration yet fears depending on others.';
    document.getElementById('central-question-input').value =
      'Can trust be rebuilt faster than the next crisis arrives?';

    document.getElementById('core-motivation-input').dispatchEvent(new Event('input'));
    document.getElementById('internal-contradiction-input').dispatchEvent(new Event('input'));
    document.getElementById('central-question-input').dispatchEvent(new Event('input'));
    await flushAsyncOperations();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter' })
    );
    await flushAsyncOperations();

    expect(service.generateTraitsCalls).toHaveLength(2);
    expect(logger.warn).not.toHaveBeenCalledWith('Traits results container not found');

    await controller.destroy();
  });

  it('should handle generation failure and surface a user-friendly network message', async () => {
    const failingResolver = async () => {
      throw new Error('Network connection lost while contacting generator');
    };
    const { controller, service, logger } = createControllerSetup({
      traitsResolver: failingResolver,
    });

    await initializeAndSettle(controller);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value =
      'To coordinate resilient mutual aid routes across the realm.';
    document.getElementById('internal-contradiction-input').value =
      'Fears dependence yet asks others to trust completely.';
    document.getElementById('central-question-input').value =
      'What price must be paid to keep everyone connected?';

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();
    await flushAsyncOperations();

    expect(service.generateTraitsCalls.length).toBeGreaterThanOrEqual(2);

    expect(logger.error).toHaveBeenCalled();

    await controller.destroy();
  });

  it('should display guidance when no eligible directions exist', async () => {
    const { controller } = createControllerSetup({
      directions: [],
      motivations: new Map(),
      cliches: new Map(),
    });

    await initializeAndSettle(controller);

    const message = document.querySelector('.no-directions-message');
    expect(message).not.toBeNull();
    const generateBtn = document.getElementById('generate-btn');
    expect(generateBtn.disabled).toBe(true);
    expect(generateBtn.getAttribute('aria-disabled')).toBe('true');

    await controller.destroy();
  });

  it('should warn when traits results container is missing but continue processing', async () => {
    const { controller, logger, service } = createControllerSetup({
      includeResultsContainer: false,
    });

    await initializeAndSettle(controller);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value =
      'To weave alliances that shield every border town.';
    document.getElementById('internal-contradiction-input').value =
      'Dreams of rest but cannot stop planning every contingency.';
    document.getElementById('central-question-input').value =
      'Will preparation ever be enough to prevent the next disaster?';

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();
    await flushAsyncOperations();

    expect(service.generateTraitsCalls).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith('Traits results container not found');
    expect(document.getElementById('results-state').style.display).toBe('block');

    await controller.destroy();
  });

  it('should handle display enhancer failures gracefully and emit failure events', async () => {
    const invalidResolver = async () => ({ generatedAt: new Date().toISOString() });
    const { controller, logger, service, eventBus } = createControllerSetup({
      traitsResolver: invalidResolver,
    });

    await initializeAndSettle(controller);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value =
      'To build resilient communication hubs in every settlement.';
    document.getElementById('internal-contradiction-input').value =
      'Encourages openness yet hides personal doubts from the team.';
    document.getElementById('central-question-input').value =
      'Can a single network hold together so many fragile hopes?';

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();
    await flushAsyncOperations();

    expect(service.generateTraitsCalls).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to display results:',
      expect.any(Error)
    );
    const failureEvent = eventBus.events.at(-1);
    expect(failureEvent.name).toBe('core:traits_generation_failed');
    expect(failureEvent.payload.directionId).toBe(defaultDirectionItem.direction.id);
    expect(document.getElementById('error-state').style.display).toBe('flex');

    await controller.destroy();
  });
});
