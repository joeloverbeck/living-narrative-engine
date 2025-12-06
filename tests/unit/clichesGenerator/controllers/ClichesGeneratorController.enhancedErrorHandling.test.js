/**
 * @file Additional coverage tests for ClichesGeneratorController focusing on
 * enhanced error recovery flows and deletion helpers.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';
import {
  ClicheLLMError,
  ClicheStorageError,
  ClichePrerequisiteError,
  ClicheDataIntegrityError,
} from '../../../../src/errors/clicheErrors.js';

let ClichesGeneratorControllerTestBed;
let handleErrorSpy;

beforeAll(async () => {
  ({ ClichesGeneratorControllerTestBed } = await import(
    '../../../common/clichesGeneratorControllerTestBed.js'
  ));

  const errorHandlerModule = await import(
    '../../../../src/characterBuilder/services/clicheErrorHandler.js'
  );
  handleErrorSpy = jest.spyOn(
    errorHandlerModule.ClicheErrorHandler.prototype,
    'handleError'
  );
});

let testBed;

/**
 * Prepare controller with a fresh DOM and default mocks.
 */
async function initializeController() {
  testBed = new ClichesGeneratorControllerTestBed();
  testBed.setupSuccessfulDirectionLoad();
  await testBed.setup();

  // Default concept/cliché generation responses so selection works out of the box.
  const concept = testBed.createMockConcept();
  testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
    concept
  );
  testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
    false
  );
}

beforeEach(async () => {
  handleErrorSpy.mockClear();

  await initializeController();
});

afterEach(async () => {
  await testBed?.cleanup();
});

afterAll(() => {
  handleErrorSpy?.mockRestore();
});

describe('ClichesGeneratorController deletion flows', () => {
  it('deletes a category item via the display enhancer callback and updates caches', async () => {
    const generatedCliche = testBed.createMockClichesData();
    const deletedName = generatedCliche.categories.names[0];
    const generatedRaw = generatedCliche.toJSON();
    const updatedCliche = Cliche.fromRawData({
      ...generatedRaw,
      categories: {
        ...generatedRaw.categories,
        names: generatedRaw.categories.names.slice(1),
      },
    });

    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );
    testBed.mockCharacterBuilderService.removeClicheItem = jest
      .fn()
      .mockResolvedValue(updatedCliche);

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const deleteButton = document.querySelector('.delete-item-btn');
    expect(deleteButton).toBeTruthy();
    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.removeClicheItem
    ).toHaveBeenCalledWith('dir-1', 'names', deletedName);

    const state = testBed.controller._testGetCurrentState();
    expect(state.currentCliches).toBe(updatedCliche);
    expect(testBed.getStatusMessages().textContent).toContain(
      'Item deleted successfully'
    );
    expect(testBed.controller.getCacheStats().clichesCacheSize).toBeGreaterThan(
      0
    );
  });

  it('handles errors when deleting a category item', async () => {
    const generatedCliche = testBed.createMockClichesData();
    const deletionError = new Error('Database failure');

    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );
    testBed.mockCharacterBuilderService.removeClicheItem = jest
      .fn()
      .mockRejectedValue(deletionError);

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const deleteButton = document.querySelector('.delete-item-btn');
    expect(deleteButton).toBeTruthy();
    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    expect(testBed.logger.error).toHaveBeenCalledWith(
      'Failed to delete cliché item:',
      deletionError
    );
    expect(testBed.getStatusMessages().textContent).toContain(
      'Failed to delete item'
    );
  });

  it('deletes a trope via the display enhancer callback', async () => {
    const generatedCliche = testBed.createMockClichesData();
    const tropeToDelete = generatedCliche.tropesAndStereotypes[0];
    const generatedRaw = generatedCliche.toJSON();
    const updatedCliche = Cliche.fromRawData({
      ...generatedRaw,
      tropesAndStereotypes: generatedRaw.tropesAndStereotypes.slice(1),
    });

    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );
    testBed.mockCharacterBuilderService.removeClicheTrope = jest
      .fn()
      .mockResolvedValue(updatedCliche);

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const deleteTropeButton = document.querySelector('.delete-trope-btn');
    expect(deleteTropeButton).toBeTruthy();
    deleteTropeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.removeClicheTrope
    ).toHaveBeenCalledWith('dir-1', tropeToDelete);
    const state = testBed.controller._testGetCurrentState();
    expect(state.currentCliches).toBe(updatedCliche);
    expect(testBed.getStatusMessages().textContent).toContain(
      'Trope deleted successfully'
    );
  });

  it('handles errors when deleting a trope', async () => {
    const generatedCliche = testBed.createMockClichesData();
    const deletionError = new Error('Removal failed');

    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );
    testBed.mockCharacterBuilderService.removeClicheTrope = jest
      .fn()
      .mockRejectedValue(deletionError);

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const deleteTropeButton = document.querySelector('.delete-trope-btn');
    expect(deleteTropeButton).toBeTruthy();
    deleteTropeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    expect(testBed.logger.error).toHaveBeenCalledWith(
      'Failed to delete cliché trope:',
      deletionError
    );
    expect(testBed.getStatusMessages().textContent).toContain(
      'Failed to delete trope'
    );
  });
});

describe('ClichesGeneratorController enhanced error recovery', () => {
  it('adds a retry button for generation errors and retries on click', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce(generatedCliche);

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const retryButton = testBed
      .getStatusMessages()
      .querySelector('[data-action="retry"]');
    expect(retryButton).toBeTruthy();

    retryButton.click();
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalledTimes(2);
    const state = testBed.controller._testGetCurrentState();
    expect(state.currentCliches).toBe(generatedCliche);
  });

  it('invokes the enhanced error handler when direction selection fails and shows recovery guidance', async () => {
    const prerequisiteError = new ClichePrerequisiteError(
      'Missing prerequisites',
      ['direction selection']
    );
    const showLoadingSpy = jest
      .spyOn(testBed.controller, '_showLoading')
      .mockImplementation(() => {
        throw prerequisiteError;
      });

    await testBed.controller._testDirectionSelection('dir-1');
    await testBed.waitForAsyncOperations();

    const statusMessages = testBed.getStatusMessages();
    expect(statusMessages.textContent).toContain(
      'Please ensure all required information is provided before proceeding.'
    );
    const actionableSteps = Array.from(
      statusMessages.querySelectorAll('.cb-actionable-steps li')
    ).map((step) => step.textContent);
    expect(actionableSteps).toContain(
      'Select a thematic direction from the dropdown'
    );

    showLoadingSpy.mockRestore();
  });

  it('shows a refresh option when data integrity issues are detected during direction selection', async () => {
    const dataIntegrityError = new ClicheDataIntegrityError(
      'Cached clichés are invalid',
      'cliches'
    );
    const showLoadingSpy = jest
      .spyOn(testBed.controller, '_showLoading')
      .mockImplementation(() => {
        throw dataIntegrityError;
      });

    await testBed.controller._testDirectionSelection('dir-1');
    await testBed.waitForAsyncOperations();

    const statusMessages = testBed.getStatusMessages();
    const refreshButton = statusMessages.querySelector(
      '.cb-error-action button'
    );
    expect(refreshButton).toBeTruthy();
    expect(refreshButton.textContent).toContain('Refresh Page');

    showLoadingSpy.mockRestore();
  });

  it('displays fallback options from the error handler and executes manual entry guidance', async () => {
    const llmError = new ClicheLLMError('LLM quota exceeded', 400, {
      isRetryable: false,
    });
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      llmError
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const statusMessages = testBed.getStatusMessages();
    const fallbackButtons = statusMessages.querySelectorAll(
      '.cb-option-buttons button'
    );
    expect(fallbackButtons.length).toBeGreaterThanOrEqual(3);

    fallbackButtons[0].click();
    await testBed.waitForAsyncOperations();
    expect(statusMessages.textContent).toContain(
      'Manual cliché entry is not yet available. Please try again later or contact support.'
    );
  });

  it('shows the try later fallback guidance when selected', async () => {
    const llmError = new ClicheLLMError('Service temporarily busy', 429, {
      isRetryable: false,
    });
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      llmError
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const tryLaterButton = testBed
      .getStatusMessages()
      .querySelector('[data-action="TRY_LATER"]');
    expect(tryLaterButton).toBeTruthy();
    tryLaterButton.click();
    await testBed.waitForAsyncOperations();

    expect(testBed.getStatusMessages().textContent).toContain(
      'Please try again in a few minutes. The service may be temporarily busy.'
    );
  });

  it('shows support contact details when the support fallback is selected', async () => {
    const llmError = new ClicheLLMError('Persistent failure', 500, {
      isRetryable: false,
    });
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      llmError
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const supportButton = testBed
      .getStatusMessages()
      .querySelector('[data-action="CONTACT_SUPPORT"]');
    expect(supportButton).toBeTruthy();
    supportButton.click();
    await testBed.waitForAsyncOperations();

    expect(testBed.getStatusMessages().textContent).toContain(
      'If this problem persists, please report it through the application feedback system.'
    );
  });

  it('logs unknown fallback actions without throwing', async () => {
    const llmError = new ClicheLLMError('Fallback scenario', 400, {
      isRetryable: false,
    });
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      llmError
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const fallbackButton = testBed
      .getStatusMessages()
      .querySelector('[data-action="MANUAL_ENTRY"]');
    expect(fallbackButton).toBeTruthy();
    fallbackButton.setAttribute('data-action', 'SOMETHING_ELSE');
    fallbackButton.click();
    await testBed.waitForAsyncOperations();

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Unknown fallback action:',
      'SOMETHING_ELSE'
    );
  });

  it('displays storage fallback messaging when persistent storage is unavailable', async () => {
    const storageError = new ClicheStorageError(
      'Failed to persist clichés',
      'save'
    );
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      storageError
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    expect(testBed.getStatusMessages().textContent).toContain(
      'Clichés generated successfully but could not be saved permanently. They will be available for this session only.'
    );
  });

  it('schedules a retry when the error handler recommends another attempt', async () => {
    const generatedCliche = testBed.createMockClichesData();
    const retryableError = new ClicheLLMError('Temporary outage', 503, {
      isRetryable: true,
    });
    testBed.mockCharacterBuilderService.generateClichesForDirection
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(generatedCliche);

    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0;
      });

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    await testBed.waitForAsyncOperations();
    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalledTimes(2);

    setTimeoutSpy.mockRestore();
  });
});
