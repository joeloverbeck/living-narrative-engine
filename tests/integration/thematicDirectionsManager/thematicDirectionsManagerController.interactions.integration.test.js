import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { BaseCharacterBuilderControllerTestBase } from '../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

const buildIntegrationDom = () => {
  document.body.innerHTML = `
    <div class="page-container">
      <div class="header-section">
        <button id="refresh-btn">Refresh</button>
        <button id="cleanup-orphans-btn">Clean Up</button>
        <button id="back-to-menu-btn">Back</button>
        <button id="retry-btn">Retry</button>
      </div>

      <div class="filter-section">
        <select id="concept-selector">
          <option value="">All Concepts</option>
          <option value="orphaned">Orphaned</option>
        </select>
        <input id="direction-filter" type="text" />
      </div>

      <div class="stats-section">
        <span id="total-directions">0</span>
        <span id="orphaned-count">0</span>
      </div>

      <div id="concept-display-container" style="display: none;">
        <div id="concept-display-content"></div>
      </div>

      <div id="empty-state" class="hidden"></div>
      <div id="loading-state" class="hidden"></div>
      <div id="error-state" class="hidden"></div>
      <div id="results-state" class="hidden"></div>
      <div id="error-message-text"></div>

      <div id="directions-results"></div>
      <div id="directions-container"></div>
    </div>

    <div id="confirmation-modal" style="display: none;">
      <div class="modal-content">
        <h2 id="modal-title"></h2>
        <p id="modal-message"></p>
        <button id="modal-confirm-btn">Confirm</button>
        <button id="modal-cancel-btn">Cancel</button>
        <button id="close-modal-btn">Close</button>
      </div>
    </div>
  `;
};

describe('ThematicDirectionsManagerController integration: event wiring and cleanup', () => {
  let controller;
  let testBase;
  let characterBuilderService;
  let storageService;
  const concept = {
    id: 'concept-1',
    concept: 'A courageous explorer seeking lost worlds',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const direction = {
    id: 'direction-1',
    conceptId: concept.id,
    title: 'Charting the Unknown',
    description: 'The explorer faces the void with only wit and grit.',
    coreTension: 'Discovery versus safety',
    uniqueTwist: 'Maps that rewrite themselves at night',
    narrativePotential: 'Branches into survival, wonder, and betrayal arcs.',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    buildIntegrationDom();

    storageService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      storeCharacterConcept: jest.fn().mockResolvedValue(concept),
      listCharacterConcepts: jest.fn().mockResolvedValue([concept]),
      getCharacterConcept: jest.fn().mockResolvedValue(concept),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      storeThematicDirections: jest.fn().mockResolvedValue([direction]),
      getThematicDirections: jest.fn().mockResolvedValue([direction]),
      getThematicDirection: jest.fn().mockResolvedValue(direction),
      updateThematicDirection: jest.fn().mockResolvedValue(direction),
      deleteThematicDirection: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn().mockResolvedValue([direction]),
      findOrphanedDirections: jest.fn().mockResolvedValue([]),
    };

    characterBuilderService = new CharacterBuilderService({
      logger: testBase.mocks.logger,
      storageService,
      directionGenerator: { generateDirections: jest.fn() },
      eventBus: testBase.mocks.eventBus,
    });
    characterBuilderService.initialize = jest.fn().mockResolvedValue(undefined);
    characterBuilderService.getAllThematicDirectionsWithConcepts = jest
      .fn()
      .mockResolvedValue([{ direction, concept }]);
    characterBuilderService.getAllCharacterConcepts = jest
      .fn()
      .mockResolvedValue([concept]);
    characterBuilderService.getCharacterConcept = jest
      .fn()
      .mockResolvedValue(concept);
    characterBuilderService.updateThematicDirection = jest
      .fn()
      .mockResolvedValue(direction);

    controller = new ThematicDirectionsManagerController({
      ...testBase.mockDependencies,
      logger: testBase.mocks.logger,
      eventBus: testBase.mocks.eventBus,
      schemaValidator: testBase.mocks.schemaValidator,
      characterBuilderService,
    });

    await controller.initialize();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
    if (testBase) {
      await testBase.cleanup();
      testBase = null;
    }
  });

  it('registers UI handlers that call controller actions and analytics', async () => {
    const refreshSpy = jest
      .spyOn(controller, 'refreshDropdown')
      .mockResolvedValue();
    const cancelSpy = jest.spyOn(controller, '_handleModalCancel');
    const confirmSpy = jest.spyOn(controller, '_handleModalConfirm');

    controller._showConfirmationModal({
      title: 'Confirm cleanup',
      message: 'Should we proceed?',
      onConfirm: () => {},
    });

    const filterInput = document.getElementById('direction-filter');
    filterInput.value = 'explorer';
    filterInput.dispatchEvent(new Event('input', { bubbles: true }));

    document.getElementById('refresh-btn').click();
    document.getElementById('modal-confirm-btn').click();
    document
      .getElementById('confirmation-modal')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(refreshSpy).toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({
        event: 'thematic_dropdown_interaction',
        properties: expect.objectContaining({ action: 'filter' }),
      })
    );
    expect(
      localStorage.getItem('thematic-directions-dropdown-state')
    ).not.toBeNull();
  });

  it('cleans up resources and reports lingering editors during destruction', () => {
    controller._showSuccess('Saved direction', 5000);
    const strayEditor = document.createElement('div');
    strayEditor.className = 'in-place-editor';
    document.body.appendChild(strayEditor);

    controller._postDestroy();
    jest.runOnlyPendingTimers();

    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Potential memory leaks detected',
      expect.objectContaining({
        leaks: expect.arrayContaining([
          expect.stringContaining('InPlaceEditor instances'),
          expect.stringContaining('Orphaned editor DOM elements'),
        ]),
      })
    );
  });
});
