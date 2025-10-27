import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController session management and utilities', () => {
  let testBase;
  let controller;
  let originalBroadcastChannel;

  beforeEach(async () => {
    testBase = new CharacterConceptsManagerTestBase();
    await testBase.setup();
    controller = testBase.createController();
    testBase.controller = controller;
    controller._cacheElements();
    sessionStorage.clear();
  });

  afterEach(async () => {
    if (originalBroadcastChannel) {
      if (originalBroadcastChannel === 'unset') {
        delete global.BroadcastChannel;
      } else {
        global.BroadcastChannel = originalBroadcastChannel;
      }
      originalBroadcastChannel = undefined;
    }

    jest.useRealTimers();
    await testBase.cleanup();
    jest.restoreAllMocks();
    sessionStorage.clear();
  });

  it('periodically saves enhanced search state when activity is detected', () => {
    jest.useFakeTimers();
    const saveSpy = jest.spyOn(controller, '_saveEnhancedSearchState');
    const filterSpy = jest
      .spyOn(controller, '_filterConcepts')
      .mockReturnValue(['matching']);
    const debugSpy = jest.spyOn(testBase.mocks.logger, 'debug');
    const cleanupSpy = jest.spyOn(controller, '_registerCleanupTask');
    const clearIntervalSpy = jest.spyOn(controller, '_clearInterval');

    controller._testExports.searchFilter = 'hero';

    controller._setupPeriodicStateSave();

    jest.advanceTimersByTime(30000);

    expect(filterSpy).toHaveBeenCalledWith(controller._testExports.conceptsData);
    expect(saveSpy).toHaveBeenCalledWith('hero', 1);
    expect(debugSpy).toHaveBeenCalledWith('Periodic state save completed');
    expect(cleanupSpy).toHaveBeenCalledWith(
      expect.any(Function),
      'Periodic state save cleanup'
    );

    const cleanupFn = cleanupSpy.mock.calls[0][0];
    cleanupFn();
    expect(clearIntervalSpy).toHaveBeenCalled();

    jest.runOnlyPendingTimers();
  });

  it('warns about unsaved changes during page unload while saving state and notifying other tabs', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    let unloadHandler;
    addEventListenerSpy.mockImplementation((event, handler) => {
      if (event === 'beforeunload') {
        unloadHandler = handler;
      }
    });

    const broadcastInstance = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
      postMessage: jest.fn(),
    };

    originalBroadcastChannel =
      'BroadcastChannel' in global ? global.BroadcastChannel : 'unset';
    global.BroadcastChannel = jest
      .fn()
      .mockReturnValue(broadcastInstance);

    const broadcastSpy = jest
      .spyOn(controller, '_broadcastMessage')
      .mockImplementation(() => {});
    jest
      .spyOn(controller, '_performLeaderElection')
      .mockImplementation(() => {});

    controller._initializeCrossTabSync();

    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-1', concept: 'Original concept' },
        directionCount: 0,
      },
    ];

    await controller._showEditModal('concept-1');
    controller._getElement('conceptText').value = 'Updated concept';
    controller._trackFormChanges();

    controller._testExports.searchFilter = 'mage';
    jest
      .spyOn(controller, '_getFilteredConcepts')
      .mockReturnValue([{ id: 'concept-1' }]);

    const saveSpy = jest.spyOn(controller, '_saveEnhancedSearchState');

    controller._registerPageUnloadHandler();

    expect(unloadHandler).toBeInstanceOf(Function);

    const event = { preventDefault: jest.fn(), returnValue: undefined };
    const result = unloadHandler(event);

    expect(saveSpy).toHaveBeenCalledWith('mage', 1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
    expect(result).toBe(
      'You have unsaved changes. Are you sure you want to leave?'
    );
    expect(
      broadcastSpy.mock.calls.some(([payload]) =>
        payload?.type === 'tab-closed' && payload?.wasLeader === false
      )
    ).toBe(true);
  });

  it('logs errors thrown during beforeunload handling', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    let unloadHandler;
    addEventListenerSpy.mockImplementation((event, handler) => {
      if (event === 'beforeunload') {
        unloadHandler = handler;
      }
    });

    jest
      .spyOn(controller, '_saveEnhancedSearchState')
      .mockImplementation(() => {
        throw new Error('storage failure');
      });

    controller._registerPageUnloadHandler();

    const event = { preventDefault: jest.fn(), returnValue: undefined };
    unloadHandler(event);

    expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
      'Error in unload handler',
      expect.any(Error)
    );
  });

  it('returns filtered concepts using the cached dataset', () => {
    controller._testExports.conceptsData = ['concept-a'];
    const filterSpy = jest
      .spyOn(controller, '_filterConcepts')
      .mockReturnValue(['filtered']);

    expect(controller._getFilteredConcepts()).toEqual(['filtered']);
    expect(filterSpy).toHaveBeenCalledWith(['concept-a']);
  });

  it('skips undo when no recent edits exist', async () => {
    await controller._undoLastEdit();
    expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
      'No recent edit to undo'
    );
  });

  it('reverts the last edit when invoked within the undo window', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);

    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-1', concept: 'Original' },
        directionCount: 0,
      },
    ];

    const originalUpdate = controller._updateConcept.bind(controller);
    await originalUpdate('concept-1', 'Updated');

    controller._updateConcept = jest.fn().mockResolvedValue(undefined);
    const showStateSpy = jest.spyOn(controller, '_showState');

    await controller._undoLastEdit();

    expect(controller._updateConcept).toHaveBeenCalledWith(
      'concept-1',
      'Original'
    );
    expect(showStateSpy).toHaveBeenCalledWith('results');

    dateSpy.mockRestore();
  });

  it('does not undo edits older than the allowed window', async () => {
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValue(40001);

    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-1', concept: 'Original' },
        directionCount: 0,
      },
    ];

    const originalUpdate = controller._updateConcept.bind(controller);
    await originalUpdate('concept-1', 'Updated');

    await controller._undoLastEdit();

    expect(testBase.mocks.logger.info).toHaveBeenCalledWith(
      'No recent edit to undo'
    );

    dateSpy.mockRestore();
  });

  it('applies and reverts optimistic delete animations', () => {
    jest.useFakeTimers();

    const conceptsResults = controller._getElement('conceptsResults');
    conceptsResults.querySelector = HTMLElement.prototype.querySelector.bind(
      conceptsResults
    );
    conceptsResults.appendChild = HTMLElement.prototype.appendChild.bind(
      conceptsResults
    );
    conceptsResults.innerHTML =
      '<div data-concept-id="concept-1" class="concept-card"><div class="concept-text"></div></div>';
    const card = conceptsResults.querySelector('[data-concept-id="concept-1"]');

    controller._applyOptimisticDelete('concept-1');
    expect(card.classList.contains('concept-deleting')).toBe(true);

    jest.advanceTimersByTime(300);
    expect(card.isConnected).toBe(false);

    controller._revertOptimisticDelete();
    expect(card.classList.contains('concept-delete-failed')).toBe(true);
    expect(card.parentElement).toBe(conceptsResults);

    jest.advanceTimersByTime(2000);
    expect(card.classList.contains('concept-delete-failed')).toBe(false);
    expect(controller._testExports.deletedCard).toBeNull();
  });

  it('updates visible concept cards after concept updates', () => {
    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-1', concept: 'Existing concept' },
        directionCount: 5,
      },
    ];

    jest
      .spyOn(controller, '_isConceptVisible')
      .mockReturnValue(true);
    const updateCardSpy = jest.spyOn(controller, '_updateConceptCard');

    controller._handleConceptUpdated({
      payload: { concept: { id: 'concept-1', concept: 'Updated concept' } },
    });

    expect(updateCardSpy).toHaveBeenCalledWith(
      { id: 'concept-1', concept: 'Updated concept' },
      5
    );
  });

  it('performs fuzzy matching with and without typo tolerance', () => {
    expect(controller._fuzzyMatch('hero', 'abc')).toBe(false);
    expect(controller._fuzzyMatch('adventurer', 'avent')).toBe(true);
  });

  it('returns escaped text when no search term is provided', () => {
    expect(controller._highlightSearchTerms('Hero & Villain', '')).toBe(
      'Hero &amp; Villain'
    );
  });

  it('saves enhanced search state and removes legacy key when filter empty', () => {
    controller._testExports.searchAnalytics = {
      searches: ['hero', 'mage'],
      noResultSearches: [],
    };

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
    Object.defineProperty(window, 'scrollY', { value: 25, configurable: true });

    controller._saveEnhancedSearchState('hero', 2);
    expect(setItemSpy).toHaveBeenCalledWith(
      'conceptsSearchState',
      expect.any(String)
    );
    expect(setItemSpy).toHaveBeenCalledWith('conceptsManagerSearch', 'hero');

    controller._saveEnhancedSearchState('', 0);
    expect(removeItemSpy).toHaveBeenCalledWith('conceptsManagerSearch');
  });

  it('saves and clears the legacy search state flag', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');

    controller._testExports.searchFilter = 'villain';
    controller._saveSearchState();
    expect(setItemSpy).toHaveBeenCalledWith('conceptsManagerSearch', 'villain');

    controller._testExports.searchFilter = '';
    controller._saveSearchState();
    expect(removeItemSpy).toHaveBeenCalledWith('conceptsManagerSearch');
  });
});
