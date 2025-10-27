import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController interactive behaviors', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await testBase.cleanup();
  });

  const setupConceptCard = (id = 'concept-1') => {
    const results = controller._getElement('conceptsResults');
    results.appendChild = HTMLElement.prototype.appendChild.bind(results);

    const card = document.createElement('div');
    card.dataset.conceptId = id;
    card.className = 'concept-card';

    const conceptText = document.createElement('p');
    conceptText.className = 'concept-text';
    card.appendChild(conceptText);

    const date = document.createElement('span');
    date.className = 'concept-date';
    card.appendChild(date);

    results.appendChild(card);

    results.querySelector = jest
      .fn()
      .mockImplementation((selector) =>
        selector === `[data-concept-id="${id}"]` ? card : null
      );

    card.querySelector = jest.fn((selector) => {
      if (selector === '.concept-text') {
        return conceptText;
      }
      if (selector === '.concept-date') {
        return date;
      }
      return null;
    });

    return { card, conceptText, date };
  };

  it('updates concept cards with formatted details and animations', () => {
    jest.useFakeTimers();
    const { card, conceptText, date } = setupConceptCard();

    jest
      .spyOn(controller, '_getDisplayText')
      .mockReturnValue('formatted-text');
    jest
      .spyOn(controller, '_formatRelativeDate')
      .mockReturnValue('moments ago');
    jest
      .spyOn(controller, '_formatFullDate')
      .mockReturnValue('2024-01-02');

    controller._updateConceptCard(
      { id: 'concept-1', concept: 'Example', updatedAt: '2024-01-02' },
      2
    );

    expect(conceptText.innerHTML).toBe('formatted-text');
    expect(date.textContent).toBe('Updated moments ago');
    expect(date.title).toBe('2024-01-02');
    expect(card.classList.contains('concept-updated')).toBe(true);

    jest.runOnlyPendingTimers();
    expect(card.classList.contains('concept-updated')).toBe(false);
  });

  it('applies and reverts optimistic updates on concept cards', () => {
    jest.useFakeTimers();
    const { card, conceptText } = setupConceptCard();

    jest.spyOn(controller, '_truncateText').mockReturnValue('truncated');
    controller._applyOptimisticUpdate('concept-1', 'Updated text');

    expect(conceptText.textContent).toBe('truncated');
    expect(card.classList.contains('concept-updating')).toBe(true);

    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-1', concept: 'Original', updatedAt: '2024-01-02' },
        directionCount: 3,
      },
    ];

    const updateSpy = jest
      .spyOn(controller, '_updateConceptCard')
      .mockImplementation(() => {});

    controller._revertOptimisticUpdate('concept-1');

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'concept-1' }),
      3
    );
    expect(card.classList.contains('concept-update-failed')).toBe(true);

    jest.runOnlyPendingTimers();
    expect(card.classList.contains('concept-update-failed')).toBe(false);
  });

  it('tracks form changes and toggles save button styles', () => {
    const conceptText = controller._getElement('conceptText');
    const saveButton = controller._getElement('saveConceptBtn');

    conceptText.value = 'New concept';
    controller._trackFormChanges();
    expect(saveButton.classList.contains('has-changes')).toBe(true);

    conceptText.value = '';
    controller._trackFormChanges();
    expect(saveButton.classList.contains('has-changes')).toBe(false);
  });

  it('registers enhanced keyboard shortcuts with cleanup', () => {
    let cleanupTask;
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const registerCleanupSpy = jest
      .spyOn(controller, '_registerCleanupTask')
      .mockImplementation((task) => {
        cleanupTask = task;
      });

    controller._setupKeyboardShortcuts();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
    expect(registerCleanupSpy).toHaveBeenCalledWith(
      expect.any(Function),
      'Keyboard shortcuts cleanup'
    );

    expect(() => cleanupTask()).not.toThrow();

    addEventListenerSpy.mockRestore();
    registerCleanupSpy.mockRestore();
  });

  it('handles enhanced keyboard shortcuts for multiple workflows', async () => {
    const focusSpy = jest
      .spyOn(controller, '_focusSearchInput')
      .mockImplementation(() => {});
    const showCreateSpy = jest
      .spyOn(controller, '_showCreateModal')
      .mockImplementation(() => {});
    const helpSpy = jest
      .spyOn(controller, '_showKeyboardHelp')
      .mockImplementation(() => {});
    const undoSpy = jest
      .spyOn(controller, '_undoLastEdit')
      .mockResolvedValue();
    const clearSpy = jest
      .spyOn(controller, '_clearSearch')
      .mockImplementation(() => {});
    const closeConceptModalSpy = jest
      .spyOn(controller, '_closeConceptModal')
      .mockImplementation(() => {});
    const closeDeleteModalSpy = jest
      .spyOn(controller, '_closeDeleteModal')
      .mockImplementation(() => {});
    const showEditSpy = jest
      .spyOn(controller, '_showEditModal')
      .mockImplementation(() => {});
    const showDeleteSpy = jest
      .spyOn(controller, '_showDeleteConfirmation')
      .mockImplementation(() => {});

    const searchInput = controller._getElement('conceptSearch');
    const conceptModal = controller._getElement('conceptModal');
    const deleteModal = controller._getElement('deleteModal');

    document.activeElement = document.body;
    controller._handleEnhancedKeyboardShortcut({
      key: 'f',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(focusSpy).toHaveBeenCalled();

    document.activeElement = controller._getElement('conceptText');
    controller._handleEnhancedKeyboardShortcut({
      key: 'a',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(showCreateSpy).not.toHaveBeenCalled();

    document.activeElement = document.body;
    conceptModal.style.display = 'flex';
    const escapeEvent = {
      key: 'Escape',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    };
    controller._handleEnhancedKeyboardShortcut(escapeEvent);
    expect(closeConceptModalSpy).toHaveBeenCalled();
    expect(escapeEvent.preventDefault).toHaveBeenCalled();
    conceptModal.style.display = '';

    deleteModal.style.display = 'flex';
    const escapeDeleteEvent = {
      key: 'Escape',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    };
    controller._handleEnhancedKeyboardShortcut(escapeDeleteEvent);
    expect(closeDeleteModalSpy).toHaveBeenCalled();
    expect(escapeDeleteEvent.preventDefault).toHaveBeenCalled();
    deleteModal.style.display = '';

    searchInput.value = 'mage';
    const clearEvent = {
      key: 'Escape',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    };
    controller._handleEnhancedKeyboardShortcut(clearEvent);
    expect(clearSpy).toHaveBeenCalled();

    controller._handleEnhancedKeyboardShortcut({
      key: 'n',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(showCreateSpy).toHaveBeenCalled();

    controller._handleEnhancedKeyboardShortcut({
      key: 'F1',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(helpSpy).toHaveBeenCalled();

    controller._handleEnhancedKeyboardShortcut({
      key: '?',
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: true,
      preventDefault: jest.fn(),
    });
    expect(helpSpy).toHaveBeenCalledTimes(2);

    controller._handleEnhancedKeyboardShortcut({
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(undoSpy).toHaveBeenCalled();

    const { card } = setupConceptCard('concept-2');
    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-2', concept: 'Existing concept' },
        directionCount: 2,
      },
    ];
    document.activeElement = card;

    controller._handleEnhancedKeyboardShortcut({
      key: 'e',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(showEditSpy).toHaveBeenCalledWith('concept-2');

    controller._handleEnhancedKeyboardShortcut({
      key: 'd',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(showDeleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'concept-2' }),
      2
    );

    const errorSpy = jest.spyOn(controller.logger, 'error');
    document.activeElement = {
      closest: () => {
        throw new Error('boom');
      },
    };

    controller._handleEnhancedKeyboardShortcut({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Error handling keyboard shortcut',
      expect.any(Error),
      expect.objectContaining({ key: 'Enter' })
    );
  });

  it('focuses the search input and scrolls into view', () => {
    const searchInput = controller._getElement('conceptSearch');
    searchInput.select = jest.fn();
    const scrollSpy = jest
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    const debugSpy = jest.spyOn(controller.logger, 'debug');

    controller._focusSearchInput();

    expect(searchInput.focus).toHaveBeenCalled();
    expect(searchInput.select).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(debugSpy).toHaveBeenCalledWith(
      'Search input focused via keyboard shortcut'
    );

    scrollSpy.mockRestore();
  });

  it('shows keyboard help overlay and schedules cleanup', () => {
    jest.useFakeTimers();
    const infoSpy = jest.spyOn(controller.logger, 'info');
    const setTimeoutSpy = jest
      .spyOn(controller, '_setTimeout')
      .mockImplementation((fn, delay) => {
        expect(delay).toBe(10000);
        return setTimeout(fn, 0);
      });

    const appendSpy = jest.spyOn(document.body, 'appendChild');

    controller._showKeyboardHelp();

    const appendedNodes = appendSpy.mock.calls.map(([node]) => node);
    const helpModal = appendedNodes.find((node) =>
      node.classList?.contains('help-modal')
    );
    expect(helpModal).toBeTruthy();
    expect(infoSpy).toHaveBeenCalledWith('Keyboard help displayed');

    const backdrop = appendedNodes.find((node) => node !== helpModal);
    expect(backdrop).toBeTruthy();
    backdrop.dispatchEvent(new Event('click'));
    jest.runOnlyPendingTimers();

    expect(document.body.contains(helpModal)).toBe(false);
    expect(setTimeoutSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('initializes enhanced session management utilities', () => {
    const periodicSpy = jest
      .spyOn(controller, '_setupPeriodicStateSave')
      .mockImplementation(() => {});
    const unloadSpy = jest
      .spyOn(controller, '_registerPageUnloadHandler')
      .mockImplementation(() => {});
    const debugSpy = jest.spyOn(controller.logger, 'debug');

    controller._initializeSessionManagement();

    expect(periodicSpy).toHaveBeenCalled();
    expect(unloadSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith('Session management initialized');
  });

  it('schedules periodic state saves and registers cleanup', () => {
    const saveStateSpy = jest
      .spyOn(controller, '_saveEnhancedSearchState')
      .mockImplementation(() => {});
    const filterSpy = jest
      .spyOn(controller, '_filterConcepts')
      .mockReturnValue(['a', 'b']);
    let intervalCallback;
    const intervalSpy = jest
      .spyOn(controller, '_setInterval')
      .mockImplementation((callback, delay) => {
        expect(delay).toBe(30000);
        intervalCallback = callback;
        return 123;
      });
    const clearIntervalSpy = jest
      .spyOn(controller, '_clearInterval')
      .mockImplementation(() => {});
    let cleanup;
    jest.spyOn(controller, '_registerCleanupTask').mockImplementation((fn) => {
      cleanup = fn;
    });

    controller._testExports.searchFilter = 'mage';
    controller._testExports.searchAnalytics = {
      searches: [{ resultCount: 2 }],
      noResultSearches: [],
    };
    controller._testExports.conceptsData = ['concept'];

    controller._setupPeriodicStateSave();

    intervalCallback();
    expect(filterSpy).toHaveBeenCalledWith(['concept']);
    expect(saveStateSpy).toHaveBeenCalledWith('mage', 2);

    cleanup();
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
  });

  it('registers unload handler that saves state and warns about unsaved changes', () => {
    const saveStateSpy = jest
      .spyOn(controller, '_saveEnhancedSearchState')
      .mockImplementation(() => {});
    const filteredSpy = jest
      .spyOn(controller, '_getFilteredConcepts')
      .mockReturnValue([1, 2]);
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    const registerCleanupSpy = jest.spyOn(
      controller,
      '_registerCleanupTask'
    );
    const addEventSpy = jest.spyOn(window, 'addEventListener');

    controller._testExports.searchFilter = 'hero';
    controller._testExports.hasUnsavedChanges = true;
    controller._testExports.editingConceptId = 'concept-1';

    controller._registerPageUnloadHandler();

    const handler = addEventSpy.mock.calls.find(
      ([event]) => event === 'beforeunload'
    )[1];

    const event = { preventDefault: jest.fn(), returnValue: undefined };
    const result = handler(event);

    expect(saveStateSpy).toHaveBeenCalledWith('hero', 2);
    expect(filteredSpy).toHaveBeenCalled();
    expect(broadcastSpy).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
    expect(result).toBe(
      'You have unsaved changes. Are you sure you want to leave?'
    );
    expect(registerCleanupSpy).toHaveBeenCalledWith(
      expect.any(Function),
      'Unload handler cleanup'
    );

    addEventSpy.mockRestore();
  });

  it('returns filtered concepts using stored data', () => {
    const concepts = [{ concept: { id: '1' } }];
    controller._testExports.conceptsData = concepts;
    const filterSpy = jest
      .spyOn(controller, '_filterConcepts')
      .mockReturnValue(['filtered']);

    expect(controller._getFilteredConcepts()).toEqual(['filtered']);
    expect(filterSpy).toHaveBeenCalledWith(concepts);
  });

  it('reports errors when undoing last edit fails', async () => {
    const failure = new Error('update failed');
    jest
      .spyOn(controller, '_updateConcept')
      .mockRejectedValue(failure);
    const showErrorSpy = jest
      .spyOn(controller, '_showError')
      .mockImplementation(() => {});

    controller._testExports.lastEdit = {
      conceptId: 'concept-3',
      previousText: 'before',
      timestamp: Date.now(),
    };

    await controller._undoLastEdit();

    expect(controller.logger.error).toHaveBeenCalledWith(
      'Failed to undo edit',
      failure
    );
    expect(showErrorSpy).toHaveBeenCalledWith('Failed to undo edit');
  });

  it('manages optimistic delete lifecycle for concept cards', () => {
    jest.useFakeTimers();
    const results = controller._getElement('conceptsResults');
    results.appendChild = HTMLElement.prototype.appendChild.bind(results);
    const card = document.createElement('div');
    card.dataset.conceptId = 'concept-4';
    card.className = 'concept-card';
    const otherCard = document.createElement('div');
    otherCard.dataset.conceptId = 'concept-5';
    results.appendChild(card);
    results.appendChild(otherCard);

    results.querySelector = jest.fn((selector) => {
      if (selector === '[data-concept-id="concept-4"]') {
        return card;
      }
      return null;
    });

    controller._applyOptimisticDelete('concept-4');
    expect(card.classList.contains('concept-deleting')).toBe(true);
    jest.advanceTimersByTime(300);
    expect(card.parentElement).toBeNull();

    controller._revertOptimisticDelete();
    expect(card.classList.contains('concept-delete-failed')).toBe(true);
    expect(results.firstChild).toBe(card);

    jest.advanceTimersByTime(2000);
    expect(card.classList.contains('concept-delete-failed')).toBe(false);
    expect(controller._testExports.deletedCard).toBeNull();
  });

  it('removes concepts from local cache and logs the action', () => {
    controller._testExports.conceptsData = [
      { concept: { id: 'concept-6' }, directionCount: 1 },
      { concept: { id: 'concept-7' }, directionCount: 2 },
    ];

    controller._removeFromLocalCache('concept-6');

    expect(controller._testExports.conceptsData).toHaveLength(1);
    expect(controller.logger.info).toHaveBeenCalledWith(
      'Removed concept from local cache',
      expect.objectContaining({ conceptId: 'concept-6' })
    );
  });

  it('handles unload handler broadcasts when a channel is available', () => {
    const saveStateSpy = jest
      .spyOn(controller, '_saveEnhancedSearchState')
      .mockImplementation(() => {});
    const filteredSpy = jest
      .spyOn(controller, '_getFilteredConcepts')
      .mockReturnValue([]);
    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    const addEventSpy = jest.spyOn(window, 'addEventListener');

    controller._testExports.searchFilter = '';
    controller._testExports.broadcastChannel = {};
    controller._testExports.isLeaderTab = true;
    controller._testExports.hasUnsavedChanges = false;
    controller._testExports.editingConceptId = null;

    controller._registerPageUnloadHandler();

    const handler = addEventSpy.mock.calls.find(
      ([event]) => event === 'beforeunload'
    )[1];

    handler({ preventDefault: jest.fn() });

    expect(saveStateSpy).toHaveBeenCalled();
    expect(filteredSpy).toHaveBeenCalled();
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tab-closed', wasLeader: true })
    );

    addEventSpy.mockRestore();
  });
});
