/**
 * @file Accessibility and keyboard interaction tests for ClichesGeneratorController.
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
  ClichesGeneratorControllerTestBed,
} from '../../../common/clichesGeneratorControllerTestBed.js';

async function setupTestBedWithDirections() {
  const testBed = new ClichesGeneratorControllerTestBed();
  testBed.setupSuccessfulDirectionLoad();
  await testBed.setup();
  return testBed;
}

describe('ClichesGeneratorController keyboard and focus management', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await setupTestBedWithDirections();
  });

  afterEach(async () => {
    await testBed?.cleanup();
  });

  it('wires DOM events for direction change and generation clicks', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    const selector = testBed.getDirectionSelector();
    selector.value = 'dir-1';
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    const state = testBed.controller._testGetCurrentState();
    expect(state.selectedDirectionId).toBe('dir-1');
    expect(document.activeElement).toBe(testBed.getGenerateButton());

    const generateBtn = testBed.getGenerateButton();
    generateBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalled();
  });

  it('generates clichés when the Ctrl+Enter shortcut is used', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');

    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(shortcutEvent);
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalled();
  });

  it('clears non-error messages on Escape while preserving errors and removing field errors', async () => {
    const status = testBed.getStatusMessages();
    status.innerHTML = `
      <div class="cb-message cb-message--info">Temporary info</div>
      <div class="cb-message cb-message--error">Persistent error</div>
    `;

    const fieldError = document.createElement('div');
    fieldError.className = 'cb-field-error';
    testBed.getDirectionSelector().insertAdjacentElement('afterend', fieldError);
    testBed.getDirectionSelector().classList.add('cb-form-error');

    testBed.controller._testSetCurrentState({ isGenerating: true });

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    document.dispatchEvent(escapeEvent);
    await testBed.waitForAsyncOperations();

    expect(status.textContent).toContain('Generation in progress');
    expect(status.textContent).not.toContain('Temporary info');
    expect(document.querySelector('.cb-field-error')).toBeNull();
  });

  it('refreshes data and prevents the browser reload when F5 is pressed', async () => {
    const f5Event = new Event('keydown', { bubbles: true });
    const preventDefault = jest.fn();
    Object.defineProperties(f5Event, {
      key: { value: 'F5' },
      shiftKey: { value: false },
      preventDefault: { value: preventDefault },
    });

    document.dispatchEvent(f5Event);
    await testBed.waitForAsyncOperations();

    expect(preventDefault).toHaveBeenCalled();
    expect(testBed.getStatusMessages().textContent).toContain(
      'Data refreshed successfully'
    );
  });

  it('wraps focus when tabbing past the last or first focusable element', async () => {
    const focusable = [
      testBed.getDirectionSelector(),
      testBed.getGenerateButton(),
      document.getElementById('back-btn'),
    ];
    focusable.forEach((element) => {
      Object.defineProperty(element, 'offsetParent', {
        configurable: true,
        get: () => document.body,
      });
    });

    document.getElementById('back-btn').focus();
    const tabEvent = new Event('keydown', { bubbles: true });
    const forwardPreventDefault = jest.fn();
    Object.defineProperties(tabEvent, {
      key: { value: 'Tab' },
      shiftKey: { value: false },
      preventDefault: { value: forwardPreventDefault },
    });
    document.dispatchEvent(tabEvent);
    expect(forwardPreventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(testBed.getDirectionSelector());

    const shiftTabEvent = new Event('keydown', { bubbles: true });
    const backwardPreventDefault = jest.fn();
    Object.defineProperties(shiftTabEvent, {
      key: { value: 'Tab' },
      shiftKey: { value: true },
      preventDefault: { value: backwardPreventDefault },
    });
    testBed.getDirectionSelector().focus();
    document.dispatchEvent(shiftTabEvent);
    expect(backwardPreventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById('back-btn'));

    focusable.forEach((element) => {
      // Clean up mocked offsetParent definitions
      delete element.offsetParent;
    });
  });

  it('focuses the success message when no result cards are present after generation', async () => {
    const successMessage = document.createElement('div');
    successMessage.className = 'cb-message--success';
    document.body.appendChild(successMessage);

    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    expect(successMessage.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(successMessage);
  });

  it('confirms regeneration through the custom dialog', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const secondRun = testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    const dialog = document.querySelector('.cb-dialog-overlay');
    expect(dialog).toBeTruthy();
    dialog
      .querySelector('[data-action="confirm"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await secondRun;
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.cb-dialog-overlay')).toBeNull();
  });
});

describe('ClichesGeneratorController state validation helpers', () => {
  let validationBed;

  beforeEach(async () => {
    validationBed = new ClichesGeneratorControllerTestBed();
    await validationBed.setup();
  });

  afterEach(async () => {
    await validationBed?.cleanup();
  });

  it('logs an error when validating direction selection without loaded directions', () => {
    validationBed.logger.error.mockClear();
    const result = validationBed.controller._testValidateStateTransition(
      'direction_selection',
      { directionId: 'dir-unknown' }
    );

    expect(result).toBe(false);
    expect(validationBed.logger.error).toHaveBeenCalledWith(
      'Direction selection: No directions data loaded'
    );
  });

  it('detects missing concept or direction during generation validation', () => {
    validationBed.logger.error.mockClear();
    const result = validationBed.controller._testValidateStateTransition(
      'cliche_generation',
      {
        selectedDirectionId: 'dir-1',
        currentConcept: null,
        currentDirection: null,
      }
    );

    expect(result).toBe(false);
    expect(validationBed.logger.error).toHaveBeenCalledWith(
      'Cliché generation: Missing concept or direction data'
    );
  });

  it('prevents validation while generation is already running', () => {
    validationBed.controller._testSetCurrentState({ isGenerating: true });
    validationBed.logger.warn.mockClear();

    const result = validationBed.controller._testValidateStateTransition(
      'cliche_generation',
      {
        selectedDirectionId: 'dir-1',
        currentConcept: { id: 'concept-1' },
        currentDirection: { id: 'dir-1', title: 'Direction' },
      }
    );

    expect(result).toBe(false);
    expect(validationBed.logger.warn).toHaveBeenCalledWith(
      'Cliché generation: Already generating'
    );
  });

  it('allows generation validation when prerequisites are satisfied', () => {
    validationBed.controller._testSetCurrentState({ isGenerating: false });
    validationBed.logger.error.mockClear();

    const result = validationBed.controller._testValidateStateTransition(
      'cliche_generation',
      {
        selectedDirectionId: 'dir-1',
        currentConcept: { id: 'concept-1' },
        currentDirection: { id: 'dir-1', title: 'Direction' },
      }
    );

    expect(result).toBe(true);
    expect(validationBed.logger.error).not.toHaveBeenCalled();
  });
});
