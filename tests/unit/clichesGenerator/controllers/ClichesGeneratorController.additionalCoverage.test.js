/**
 * @file Additional coverage tests for ClichesGeneratorController state management helpers.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGeneratorController additional coverage', () => {
  let testBed;
  let baseDirections;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    const { directions } = testBed.setupSuccessfulDirectionLoad();
    baseDirections = directions;
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed?.cleanup();
  });

  it('dispatches a failure event when the selected direction cannot be found', async () => {
    await testBed.controller._testDirectionSelection('missing-direction');

    const failureEvents = testBed.getDispatchedEventsByType(
      'core:direction_selection_failed'
    );
    expect(failureEvents.length).toBeGreaterThan(0);
    expect(failureEvents[failureEvents.length - 1].payload).toMatchObject({
      directionId: 'missing-direction',
    });
    expect(testBed.getStatusMessages().textContent).toContain(
      'Direction not found: missing-direction'
    );
    expect(testBed.controller._testGetCurrentState().selectedDirectionId).toBeNull();
  });

  it('allows cancelling regeneration through the confirmation dialog', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();

    const generationPromise = testBed.triggerGeneration();
    await testBed.flushPromises();

    const dialog = document.querySelector('.cb-dialog-overlay');
    expect(dialog).toBeTruthy();

    const cancelButton = dialog.querySelector('[data-action="cancel"]');
    cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await generationPromise;
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.cb-dialog-overlay')).toBeNull();
  });

  it('closes the confirmation dialog when Escape is pressed', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();

    const generationPromise = testBed.triggerGeneration();
    await testBed.flushPromises();

    const dialog = document.querySelector('.cb-dialog-overlay');
    expect(dialog).toBeTruthy();

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    await generationPromise;
    await testBed.waitForAsyncOperations();

    expect(
      testBed.mockCharacterBuilderService.generateClichesForDirection
    ).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.cb-dialog-overlay')).toBeNull();
  });

  it('warns when deleting an item without active clichés', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    testBed.logger.warn.mockClear();

    testBed.controller._testSetCurrentState({ currentCliches: null });

    const deleteButton = document.querySelector('.delete-item-btn');
    expect(deleteButton).toBeTruthy();
    deleteButton.click();

    await testBed.waitForAsyncOperations();

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Cannot delete item: no direction or clichés loaded'
    );
  });

  it('warns when deleting a trope without active clichés', async () => {
    const generatedCliche = testBed.createMockClichesData();
    testBed.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      generatedCliche
    );

    await testBed.selectDirection('dir-1');
    await testBed.triggerGeneration();
    await testBed.waitForAsyncOperations();

    testBed.logger.warn.mockClear();

    testBed.controller._testSetCurrentState({ currentCliches: null });

    const deleteButton = document.querySelector('.delete-trope-btn');
    expect(deleteButton).toBeTruthy();
    deleteButton.click();

    await testBed.waitForAsyncOperations();

    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Cannot delete trope: no direction or clichés loaded'
    );
  });

  it('reuses cached concepts when service data omits concept details', async () => {
    testBed.mockCharacterBuilderService.getCharacterConcept.mockClear();

    testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      baseDirections.map((direction) => ({ direction, concept: null }))
    );
    testBed.mockCharacterBuilderService.getAllThematicDirections.mockResolvedValue(
      baseDirections
    );

    await testBed.controller._loadInitialData();

    expect(
      testBed.mockCharacterBuilderService.getCharacterConcept
    ).not.toHaveBeenCalled();
    expect(testBed.controller.getCacheStats().conceptsCacheSize).toBeGreaterThan(0);
  });

  it('maintains a maximum of 10 state history entries', async () => {
    for (let i = 0; i < 11; i += 1) {
      await testBed.controller._testDirectionSelection('dir-1');
      await testBed.waitForAsyncOperations();
    }

    const history = testBed.controller.getStateHistory();
    expect(history.length).toBeLessThanOrEqual(10);
    expect(history[0].action).not.toBe('initialized');
  });

  it('validates state transitions for known scenarios', () => {
    testBed.logger.error.mockClear();

    const directionResult = testBed.controller._testValidateStateTransition(
      'direction_selection',
      {}
    );
    expect(directionResult).toBe(false);
    expect(testBed.logger.error).toHaveBeenCalledWith(
      'Direction selection: Missing directionId'
    );

    testBed.logger.error.mockClear();
    const generationResult = testBed.controller._testValidateStateTransition(
      'cliche_generation',
      {}
    );
    expect(generationResult).toBe(false);
    expect(testBed.logger.error).toHaveBeenCalledWith(
      'Cliché generation: No direction selected'
    );

    testBed.logger.warn.mockClear();
    const unknownResult = testBed.controller._testValidateStateTransition(
      'unknown_transition',
      {}
    );
    expect(unknownResult).toBe(true);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Unknown state transition: unknown_transition'
    );
  });

  it('flags cliche generation validation when already generating', () => {
    testBed.logger.warn.mockClear();

    testBed.controller._testSetCurrentState({
      selectedDirectionId: 'dir-1',
      currentConcept: { id: 'concept-1' },
      currentDirection: { id: 'dir-1' },
      isGenerating: true,
    });

    const result = testBed.controller._testValidateStateTransition(
      'cliche_generation',
      {
        selectedDirectionId: 'dir-1',
        currentConcept: { id: 'concept-1' },
        currentDirection: { id: 'dir-1' },
      }
    );

    expect(result).toBe(false);
    expect(testBed.logger.warn).toHaveBeenCalledWith(
      'Cliché generation: Already generating'
    );
  });

  it('invokes legacy handleError helpers for recovery failures', () => {
    const recoveryError = new Error('Recovery step failed');

    expect(() =>
      testBed.controller._testInvokeHandleError(
        new Error('Initialization failure'),
        'Human readable',
        () => {
          throw recoveryError;
        }
      )
    ).not.toThrow();

    const errorCalls = testBed.logger.error.mock.calls.filter(([message]) =>
      message.includes('Recovery action failed:')
    );
    expect(errorCalls.length).toBeGreaterThan(0);
  });

  it('updates state through the dedicated test helper', () => {
    const generatedCliche = testBed.createMockClichesData();

    testBed.controller._testSetCurrentState({
      currentConcept: { id: 'concept-test' },
      currentDirection: { id: 'dir-test' },
      selectedDirectionId: 'dir-test',
      currentCliches: generatedCliche,
      isGenerating: true,
    });

    const state = testBed.controller._testGetCurrentState();
    expect(state.selectedDirectionId).toBe('dir-test');
    expect(state.currentConcept).toEqual({ id: 'concept-test' });
    expect(state.currentDirection).toEqual({ id: 'dir-test' });
    expect(state.currentCliches).toBe(generatedCliche);
    expect(state.isGenerating).toBe(true);
  });
});
