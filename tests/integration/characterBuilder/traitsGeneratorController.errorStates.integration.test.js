import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';
import {
  comprehensiveTraits,
  createControllerSetup,
  defaultDirectionItem,
  flushAsyncOperations,
  flushMicrotasksOnly,
  initializeAndSettle,
} from './traitsGeneratorTestUtils.js';

const originalGlobalURL = global.URL;
const originalScrollIntoView = Element.prototype.scrollIntoView;

class FaultyTraitsDisplayEnhancer extends TraitsDisplayEnhancer {
  formatForExport() {
    throw new Error('formatter crashed');
  }
}

/**
 *
 */
async function selectDirectionAndProvideInputs() {
  const selector = document.getElementById('direction-selector');
  selector.value = defaultDirectionItem.direction.id;
  selector.dispatchEvent(new Event('change'));
  await flushAsyncOperations();

  document.getElementById('core-motivation-input').value =
    'To ensure every settlement can stand on its own and thrive.';
  document.getElementById('internal-contradiction-input').value =
    'Believes in teamwork but hesitates to be vulnerable with allies.';
  document.getElementById('central-question-input').value =
    'How can communities heal without repeating painful histories?';

  document.getElementById('core-motivation-input').dispatchEvent(new Event('input'));
  document.getElementById('internal-contradiction-input').dispatchEvent(new Event('input'));
  document.getElementById('central-question-input').dispatchEvent(new Event('input'));
}

/**
 *
 * @param logger
 */
async function waitForLoggerError(logger) {
  let attempts = 0;
  while (logger.error.mock.calls.length === 0 && attempts < 5) {
    await flushMicrotasksOnly();
    attempts++;
  }
}

describe('TraitsGeneratorController Integration - Error States and Edge Cases', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url);
    if (originalGlobalURL) {
      global.URL = originalGlobalURL;
    } else {
      delete global.URL;
    }
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete Element.prototype.scrollIntoView;
    }
    jest.clearAllMocks();
  });

  it('shows a fallback message when motivations disappear after eligibility filtering', async () => {
    const { controller, service } = createControllerSetup();
    await initializeAndSettle(controller);

    service.getCoreMotivationsByDirectionId = jest.fn().mockResolvedValue([]);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));

    await flushAsyncOperations();

    expect(document.getElementById('core-motivations-list').innerHTML).toContain(
      'No core motivations available'
    );

    await controller.destroy();
  });

  it('renders an explicit error when motivations fail to load for a selection', async () => {
    const { controller, service, logger } = createControllerSetup();
    await initializeAndSettle(controller);

    service.getCoreMotivationsByDirectionId = jest
      .fn()
      .mockRejectedValue(new Error('network failure while loading motivations'));

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));

    await flushAsyncOperations();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load core motivations:',
      expect.any(Error)
    );
    expect(document.getElementById('core-motivations-list').textContent).toContain(
      'Failed to load core motivations'
    );

    await controller.destroy();
  });

  it('validates inputs on blur events to surface inline guidance', async () => {
    const { controller } = createControllerSetup();
    await initializeAndSettle(controller);

    const selector = document.getElementById('direction-selector');
    selector.value = defaultDirectionItem.direction.id;
    selector.dispatchEvent(new Event('change'));
    await flushAsyncOperations();

    document.getElementById('core-motivation-input').value = 'short';
    document.getElementById('internal-contradiction-input').value =
      'Believes in teamwork but struggles to trust quickly.';
    document.getElementById('central-question-input').value =
      'How can communities heal without repeating painful histories?';

    document.getElementById('core-motivation-input').dispatchEvent(new Event('blur'));
    await flushMicrotasksOnly();

    expect(document.getElementById('input-validation-error').textContent).toContain(
      'Core motivation must be at least 10 characters'
    );

    await controller.destroy();
  });

  it('omits the user input summary when entries are cleared mid-generation', async () => {
    const { controller } = createControllerSetup({
      traitsResolver: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(comprehensiveTraits), 50);
        }),
    });
    await initializeAndSettle(controller);

    await selectDirectionAndProvideInputs();

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();

    document.getElementById('core-motivation-input').value = '';
    document.getElementById('internal-contradiction-input').value = '';
    document.getElementById('central-question-input').value = '';

    await flushAsyncOperations();

    expect(document.getElementById('traits-results').innerHTML).not.toContain(
      'Based on Your Inputs'
    );

    await controller.destroy();
  });

  it('warns and announces when exporting without generated results', async () => {
    const { controller, logger } = createControllerSetup();
    await initializeAndSettle(controller);

    document.getElementById('export-btn').click();

    expect(logger.warn).toHaveBeenCalledWith('No traits available for export');
    expect(document.getElementById('screen-reader-announcement').textContent).toBe(
      'No traits available to export'
    );

    jest.runOnlyPendingTimers();
    await flushMicrotasksOnly();

    await controller.destroy();
  });

  it('announces export failures when formatting throws an error', async () => {
    const { controller, logger } = createControllerSetup({
      traitsDisplayEnhancerFactory: ({ logger }) =>
        new FaultyTraitsDisplayEnhancer({ logger }),
    });
    await initializeAndSettle(controller);

    await selectDirectionAndProvideInputs();

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();

    await flushAsyncOperations();

    document.getElementById('export-btn').click();

    expect(logger.error).toHaveBeenCalledWith('Export failed:', expect.any(Error));
    expect(document.getElementById('screen-reader-announcement').textContent).toBe(
      'Export failed. Please try again.'
    );

    jest.runOnlyPendingTimers();
    await flushMicrotasksOnly();

    await controller.destroy();
  });

  it('surfaces network-specific guidance when generation repeatedly fails', async () => {
    const { controller, eventBus, logger } = createControllerSetup({
      traitsResolver: async () => {
        throw new Error('network offline');
      },
    });
    await initializeAndSettle(controller);

    await selectDirectionAndProvideInputs();

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();

    await flushMicrotasksOnly();
    jest.advanceTimersByTime(1000);
    await flushMicrotasksOnly();
    jest.advanceTimersByTime(2000);
    await flushMicrotasksOnly();

    // Additional time for final error to propagate through promise chain
    jest.advanceTimersByTime(100);
    await flushMicrotasksOnly();
    await flushMicrotasksOnly();

    await waitForLoggerError(logger);

    const screenReaderAnnouncement = document.getElementById(
      'screen-reader-announcement'
    );
    const announcementBeforeCleanup = screenReaderAnnouncement.textContent;

    const generationErrorCall = logger.error.mock.calls.find(
      ([message]) => message === 'Traits generation failed:'
    );
    const generationError = generationErrorCall?.[1];
    expect(generationError?.message).toBe('network offline');
    expect(document.getElementById('error-message-text').textContent).toBe(
      'Network error occurred. Please check your connection and try again.'
    );
    const failureEvent = eventBus.events.find(
      (event) => event.name === 'core:traits_generation_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.directionId).toBe(defaultDirectionItem.direction.id);
    expect(failureEvent.payload.error).toContain('network offline');
    expect(announcementBeforeCleanup).toBe(
      'Generation failed: Network error occurred. Please check your connection and try again.'
    );

    jest.runOnlyPendingTimers();
    await flushMicrotasksOnly();

    await controller.destroy();
  });

  it('maps validation errors to actionable feedback during generation failures', async () => {
    const { controller, eventBus, logger } = createControllerSetup({
      traitsResolver: async () => {
        throw new Error('validation error: missing data');
      },
    });
    await initializeAndSettle(controller);

    await selectDirectionAndProvideInputs();

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.setAttribute('aria-disabled', 'false');
    generateBtn.click();

    await flushAsyncOperations();
    await waitForLoggerError(logger);

    expect(document.getElementById('error-message-text').textContent).toBe(
      'Invalid input provided. Please check your entries and try again.'
    );
    const failureEvent = eventBus.events.find(
      (event) => event.name === 'core:traits_generation_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.directionId).toBe(defaultDirectionItem.direction.id);
    expect(failureEvent.payload.error).toContain('validation error');

    await controller.destroy();
  });
});
