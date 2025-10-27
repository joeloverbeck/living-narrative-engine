/**
 * @file Additional coverage tests for ThematicDirectionsManagerController
 * @description Exercises edge cases and error handling paths that were previously uncovered
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  ThematicDirectionsManagerController,
} from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import {
  BaseCharacterBuilderControllerTestBase,
} from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import {
  __getInstances as getEditorInstances,
  __resetInstances as resetEditorInstances,
} from '../../../../src/shared/characterBuilder/inPlaceEditor.js';
import {
  __getInstances as getDropdownInstances,
  __resetInstances as resetDropdownInstances,
} from '../../../../src/shared/characterBuilder/previousItemsDropdown.js';

// Mock InPlaceEditor to expose created instances for validation
jest.mock(
  '../../../../src/shared/characterBuilder/inPlaceEditor.js',
  () => {
    const instances = [];
    return {
      InPlaceEditor: jest.fn().mockImplementation((options) => {
        const instance = {
          options,
          destroy: jest.fn(),
          triggerSave: (value) => options.onSave(value),
          runValidator: (value) => options.validator(value),
        };
        instances.push(instance);
        return instance;
      }),
      __getInstances: () => instances,
      __resetInstances: () => {
        instances.length = 0;
      },
    };
  }
);

// Mock PreviousItemsDropdown to control dropdown behaviour
jest.mock(
  '../../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => {
    const instances = [];
    return {
      PreviousItemsDropdown: jest.fn().mockImplementation((options) => {
        const instance = {
          options,
          clear: jest.fn(),
          enable: jest.fn(),
          loadItems: jest.fn().mockResolvedValue(undefined),
          simulateSelection: (value) =>
            options.onSelectionChange?.(value),
        };
        instances.push(instance);
        return instance;
      }),
      __getInstances: () => instances,
      __resetInstances: () => {
        instances.length = 0;
      },
    };
  }
);

describe('ThematicDirectionsManagerController uncovered paths', () => {
  let testBase;
  let controller;

  const buildDirection = (overrides = {}) => ({
    id: 'direction-1',
    title: 'Brave Hero Saga',
    description:
      'An epic quest that easily surpasses the minimum description length.',
    coreTension:
      'Balancing duty with personal desires in a sprawling kingdom.',
    uniqueTwist:
      'The hero can rewind time but loses precious memories each attempt.',
    narrativePotential:
      'Opens multiple branching arcs exploring sacrifice and consequence.',
    ...overrides,
  });

  const buildConcept = (overrides = {}) => ({
    id: 'concept-1',
    concept: 'A legendary champion destined to reshape the realm.',
    status: 'active',
    createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
    thematicDirections: [
      { id: 'direction-1' },
      { id: 'direction-2' },
    ],
    ...overrides,
  });

  const addCoreDom = () => {
    testBase.addDOMElement(`
      <div id="tdm-test-root">
        <select id="concept-selector">
          <option value="">All Concepts</option>
          <option value="concept-1">Concept 1</option>
        </select>
        <input id="direction-filter" />
        <div id="directions-results"></div>
        <div id="total-directions"></div>
        <div id="orphaned-count"></div>
        <button id="cleanup-orphans-btn"></button>
        <button id="refresh-btn"></button>
        <button id="retry-btn"></button>
        <button id="back-to-menu-btn"></button>
        <div id="concept-display-container" style="display: none;">
          <div id="concept-display-content"></div>
        </div>
        <div id="confirmation-modal" style="display: none;">
          <h2 id="modal-title"></h2>
          <div id="modal-message"></div>
          <button id="modal-confirm-btn"></button>
          <button id="modal-cancel-btn"></button>
          <button id="close-modal-btn"></button>
        </div>
      </div>
    `);
  };

  beforeEach(async () => {
    global.alert = jest.fn();
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    addCoreDom();

    controller = new ThematicDirectionsManagerController(testBase.mocks);
    controller._cacheElements();

    resetEditorInstances();
    resetDropdownInstances();
  });

  afterEach(async () => {
    if (controller && !controller.isDestroyed) {
      await controller.destroy();
    }

    await testBase.cleanup();
    jest.restoreAllMocks();
    resetEditorInstances();
    resetDropdownInstances();
  });

  it('validates fields and saves edits through the InPlaceEditor options', async () => {
    const dataset = [
      { direction: buildDirection(), concept: buildConcept() },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.refreshDropdown();

    const instances = getEditorInstances();
    expect(instances.length).toBeGreaterThan(0);
    const titleEditor = instances.find((instance) =>
      instance.options.element.getAttribute('data-field') === 'title'
    );
    expect(titleEditor).toBeDefined();

    expect(titleEditor.runValidator('')).toEqual({
      isValid: false,
      error: 'Field cannot be empty',
    });
    expect(titleEditor.runValidator('tiny')).toEqual({
      isValid: false,
      error: 'title must be at least 5 characters',
    });
    expect(titleEditor.runValidator('x'.repeat(301))).toEqual({
      isValid: false,
      error: 'title must be no more than 300 characters',
    });
    expect(titleEditor.runValidator('A heroic journey')).toEqual({
      isValid: true,
    });

    await titleEditor.triggerSave('   Updated Title   ');

    expect(
      testBase.mocks.characterBuilderService.updateThematicDirection
    ).toHaveBeenCalledWith('direction-1', { title: 'Updated Title' });
    expect(controller.logger.info).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Updated direction field',
      { directionId: 'direction-1', fieldName: 'title' }
    );
  });

  it('throws a user friendly error when saving a field fails', async () => {
    const dataset = [
      { direction: buildDirection(), concept: buildConcept() },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );
    testBase.mocks.characterBuilderService.updateThematicDirection.mockRejectedValueOnce(
      new Error('network failure')
    );

    await controller.refreshDropdown();
    const titleEditor = getEditorInstances().find((instance) =>
      instance.options.element.getAttribute('data-field') === 'title'
    );

    await expect(
      titleEditor.triggerSave('Another heroic tale')
    ).rejects.toThrow('Failed to save changes. Please try again.');
    expect(controller.logger.error).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Failed to update direction',
      expect.any(Error)
    );
  });

  it('deletes a direction through the confirmation flow', async () => {
    const direction = buildDirection();
    const dataset = [{ direction, concept: buildConcept() }];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.refreshDropdown();

    let confirmPromise;
    const confirmationSpy = jest
      .spyOn(controller, '_showConfirmationModal')
      .mockImplementation((options) => {
        confirmPromise = options.onConfirm();
        return confirmPromise;
      });
    const successSpy = jest
      .spyOn(controller, '_showSuccess')
      .mockImplementation(() => {});

    controller.deleteDirection(direction);
    await confirmPromise;

    expect(confirmationSpy).toHaveBeenCalled();
    expect(
      testBase.mocks.characterBuilderService.deleteThematicDirection
    ).toHaveBeenCalledWith(direction.id);
    expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
      'core:direction_deleted',
      { directionId: direction.id }
    );
    expect(successSpy).toHaveBeenCalledWith(
      'Thematic direction deleted successfully'
    );
  });

  it('alerts the user when deleting a direction fails', async () => {
    const direction = buildDirection();
    const dataset = [{ direction, concept: buildConcept() }];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );
    testBase.mocks.characterBuilderService.deleteThematicDirection.mockRejectedValueOnce(
      new Error('boom')
    );

    await controller.refreshDropdown();

    let confirmPromise;
    jest
      .spyOn(controller, '_showConfirmationModal')
      .mockImplementation((options) => {
        confirmPromise = options.onConfirm();
        return confirmPromise;
      });

    controller.deleteDirection(direction);
    await confirmPromise;

    expect(global.alert).toHaveBeenCalledWith(
      'Failed to delete direction. Please try again.'
    );
    expect(controller.logger.error).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Failed to delete direction',
      expect.any(Error)
    );
  });

  it('cleans up orphaned directions and dispatches analytics', async () => {
    const dataset = [
      { direction: buildDirection({ id: 'direction-1' }), concept: buildConcept() },
      { direction: buildDirection({ id: 'direction-2' }), concept: null },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.refreshDropdown();
    controller._cacheElements();
    controller._setupEventListeners();

    let confirmPromise;
    const confirmMock = jest
      .spyOn(controller, '_showConfirmationModal')
      .mockImplementation((options) => {
        confirmPromise = options.onConfirm();
        return confirmPromise;
      });
    const successSpy = jest
      .spyOn(controller, '_showSuccess')
      .mockImplementation(() => {});

    document.getElementById('cleanup-orphans-btn').click();
    await confirmPromise;

    expect(confirmMock).toHaveBeenCalled();
    expect(
      testBase.mocks.characterBuilderService.deleteThematicDirection
    ).toHaveBeenCalledWith('direction-2');
    expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
      'core:orphans_cleaned',
      { deletedCount: 1 }
    );
    expect(successSpy).toHaveBeenCalledWith(
      'Successfully deleted 1 orphaned direction(s).'
    );
  });

  it('shows an alert when orphan cleanup encounters an error', async () => {
    const dataset = [
      { direction: buildDirection({ id: 'direction-2' }), concept: null },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );
    testBase.mocks.characterBuilderService.deleteThematicDirection.mockRejectedValueOnce(
      new Error('cleanup failed')
    );

    await controller.refreshDropdown();
    controller._cacheElements();
    controller._setupEventListeners();

    let confirmPromise;
    jest
      .spyOn(controller, '_showConfirmationModal')
      .mockImplementation((options) => {
        confirmPromise = options.onConfirm();
        return confirmPromise;
      });

    document.getElementById('cleanup-orphans-btn').click();
    await confirmPromise;

    expect(global.alert).toHaveBeenCalledWith(
      'Failed to cleanup orphaned directions. Please try again.'
    );
    expect(controller.logger.error).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Failed to cleanup orphans',
      expect.any(Error)
    );
  });

  it('logs and recovers when dropdown refresh fails before initialization', async () => {
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValueOnce(
      new Error('load failure')
    );
    const errorSpy = jest
      .spyOn(controller, '_showError')
      .mockImplementation(() => {});

    await controller.refreshDropdown();

    const selectElement = document.getElementById('concept-selector');
    expect(selectElement.classList.contains('native-fallback')).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to refresh concepts. Please try again.'
    );
  });

  it('resets the dropdown via fallback when component reset fails', async () => {
    const dropdownData = [
      { direction: buildDirection(), concept: buildConcept() },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dropdownData
    );

    await controller._initializeAdditionalServices();
    const [dropdownInstance] = getDropdownInstances();
    dropdownInstance.clear.mockImplementation(() => {
      throw new Error('clear failed');
    });

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValueOnce(
      new Error('post-init failure')
    );
    const errorSpy = jest
      .spyOn(controller, '_showError')
      .mockImplementation(() => {});

    await controller.refreshDropdown();

    expect(dropdownInstance.clear).toHaveBeenCalled();
    expect(controller.logger.error).toHaveBeenCalledWith(
      'Failed to reset dropdown:',
      expect.any(Error)
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to refresh concepts. Please try again.'
    );
  });

  it('warns when extracting concepts from invalid dropdown data', async () => {
    const warnSpy = controller.logger.warn;
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      null
    );

    await controller.refreshDropdown();
    expect(warnSpy).toHaveBeenCalledWith(
      'directionsWithConcepts is null/undefined, returning empty array'
    );

    warnSpy.mockClear();
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      { unexpected: true }
    );

    await controller.refreshDropdown();
    expect(warnSpy).toHaveBeenCalledWith(
      'directionsWithConcepts is not an array, returning empty array',
      expect.objectContaining({ type: 'object' })
    );
  });

  it('handles modal cancel callbacks that throw errors', () => {
    const modalElements = {
      modalConfirmBtn: document.getElementById('modal-confirm-btn'),
      modalCancelBtn: document.getElementById('modal-cancel-btn'),
      confirmationModal: document.getElementById('confirmation-modal'),
    };
    Object.values(modalElements).forEach((el) => {
      el.style.display = 'block';
    });

    controller._showConfirmationModal({
      title: 'Cancel Test',
      message: 'Testing cancel error handling',
      onConfirm: jest.fn(),
      onCancel: () => {
        throw new Error('cancel failure');
      },
    });

    controller._closeModal(true);

    expect(controller.logger.error).toHaveBeenCalledWith(
      'Error in modal cancel callback:',
      expect.any(Error)
    );
  });

  it('logs cleanup issues when editors cannot be destroyed or removed', async () => {
    jest.useFakeTimers();

    const dataset = [
      { direction: buildDirection(), concept: buildConcept() },
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      dataset
    );

    await controller.refreshDropdown();
    const [editorInstance] = getEditorInstances();
    editorInstance.destroy.mockImplementation(() => {
      throw new Error('destroy failure');
    });

    const orphanedEditor = document.createElement('div');
    orphanedEditor.className = 'in-place-editor';
    orphanedEditor.remove = jest.fn(() => {
      throw new Error('remove failure');
    });
    document.body.appendChild(orphanedEditor);

    await controller.refreshDropdown();
    jest.runAllTimers();
    jest.useRealTimers();

    expect(controller.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to destroy InPlaceEditor instance for key'),
      expect.any(Error)
    );
    expect(controller.logger.debug).toHaveBeenCalledWith(
      'Failed to remove orphaned editor element:',
      expect.any(Error)
    );
  });
});

