import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

const TEST_SEARCH_TERM = 'mystic quest';

describe('CharacterConceptsManagerController enhanced features', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
    sessionStorage.clear();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await testBase.cleanup();
  });

  describe('search state restoration', () => {
    it('falls back to simple restoration when enhanced state fails to parse', () => {
      sessionStorage.setItem('conceptsSearchState', '{invalid-json');
      sessionStorage.setItem('conceptsManagerSearch', 'fallback term');

      const fallbackSpy = jest
        .spyOn(controller, '_restoreSearchState')
        .mockImplementation(() => {
          controller._testExports.searchFilter = 'fallback term';
          const element = controller._getElement('conceptSearch');
          element.value = 'fallback term';
          controller._testExports.searchStateRestored = true;
        });

      controller._restoreEnhancedSearchState();

      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(controller._testExports.searchFilter).toBe('fallback term');
      expect(controller._testExports.searchStateRestored).toBe(true);
      expect(controller._getElement('conceptSearch').value).toBe('fallback term');
    });

    it('restores the simple search state when present', () => {
      sessionStorage.setItem('conceptsManagerSearch', 'arcane focus');

      controller._restoreSearchState();

      expect(controller._testExports.searchFilter).toBe('arcane focus');
      expect(controller._testExports.searchStateRestored).toBe(true);
      expect(controller._getElement('conceptSearch').value).toBe('arcane focus');
    });
  });

  describe('search analytics tracking', () => {
    it('records enhanced analytics and logs periodic summary', () => {
      controller._testExports.searchAnalytics = {
        searches: Array.from({ length: 9 }, (_, index) => ({
          term: `existing-${index}`,
          resultCount: index + 1,
        })),
        noResultSearches: [],
      };

      controller._trackEnhancedSearchAnalytics(TEST_SEARCH_TERM, []);

      const analytics = controller._testExports.searchAnalytics;
      expect(analytics.searches).toHaveLength(10);
      expect(analytics.noResultSearches).toHaveLength(1);
      const latest = analytics.searches[analytics.searches.length - 1];
      expect(latest.term).toBe(TEST_SEARCH_TERM);
      expect(latest.searchType).toBe('multi-word');
      expect(latest.hasSpecialChars).toBe(false);
      expect(controller.logger.info).toHaveBeenCalledWith(
        'Search analytics summary',
        expect.objectContaining({
          totalSearches: 10,
          noResultSearches: 1,
        })
      );
    });

    it('bounds the analytics history to the most recent 100 entries', () => {
      controller._testExports.searchAnalytics = {
        searches: Array.from({ length: 100 }, () => ({ resultCount: 2 })),
        noResultSearches: [],
      };

      controller._trackEnhancedSearchAnalytics('focused', [1, 2]);

      expect(controller._testExports.searchAnalytics.searches).toHaveLength(100);
    });

    it('routes the legacy analytics wrapper through the enhanced tracker', () => {
      const enhancedSpy = jest
        .spyOn(controller, '_trackEnhancedSearchAnalytics')
        .mockImplementation(() => {});

      controller._trackSearchAnalytics('shadow', 3);

      expect(enhancedSpy).toHaveBeenCalledWith('shadow', new Array(3));
    });
  });

  describe('notification helpers', () => {
    it('logs notifications when document.body is unavailable', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'body'
      );

      Object.defineProperty(document, 'body', {
        configurable: true,
        value: null,
      });

      try {
        controller._showNotification('Test message', 'info');
        expect(controller.logger.info).toHaveBeenCalledWith(
          'Notification:',
          'Test message'
        );
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(document, 'body', originalDescriptor);
        } else {
          delete document.body;
        }
      }
    });
  });

  describe('milestone detection', () => {
    it('announces the first created concept milestone', () => {
      jest
        .spyOn(controller, '_calculateStatistics')
        .mockReturnValue({
          totalConcepts: 1,
          completionRate: 0,
          conceptsWithDirections: 0,
        });
      const milestoneSpy = jest
        .spyOn(controller, '_showMilestone')
        .mockImplementation(() => {});

      controller._checkMilestones('created');

      expect(milestoneSpy).toHaveBeenCalledWith('🎉 First Concept Created!');
    });

    it('celebrates complete direction coverage', () => {
      jest
        .spyOn(controller, '_calculateStatistics')
        .mockReturnValue({
          totalConcepts: 5,
          completionRate: 100,
          conceptsWithDirections: 5,
        });
      const milestoneSpy = jest
        .spyOn(controller, '_showMilestone')
        .mockImplementation(() => {});

      controller._checkMilestones('directions-added');

      expect(milestoneSpy).toHaveBeenCalledWith('⭐ All Concepts Have Directions!');
    });

    it('recognizes the first completed concept', () => {
      jest
        .spyOn(controller, '_calculateStatistics')
        .mockReturnValue({
          totalConcepts: 3,
          completionRate: 40,
          conceptsWithDirections: 1,
        });
      const milestoneSpy = jest
        .spyOn(controller, '_showMilestone')
        .mockImplementation(() => {});

      controller._checkMilestones('directions-added');

      expect(milestoneSpy).toHaveBeenCalledWith('🌟 First Concept Completed!');
    });
  });

  describe('animation cleanup', () => {
    it('falls back to clearInterval when controller interval helper is missing', () => {
      const element = document.createElement('div');
      element.setAttribute('data-animation', 'pulse');
      element.animationInterval = 12345;
      document.body.appendChild(element);

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const originalClearInterval = controller._clearInterval;
      controller._clearInterval = undefined;

      controller._cleanupAnimations();

      expect(clearIntervalSpy).toHaveBeenCalledWith(12345);

      controller._clearInterval = originalClearInterval;
      clearIntervalSpy.mockRestore();
      element.remove();
    });
  });

  describe('event listener wiring', () => {
    beforeEach(() => {
      controller._setupEventListeners();
    });

    it('opens the create modal from primary actions', () => {
      const showModalSpy = jest
        .spyOn(controller, '_showCreateModal')
        .mockImplementation(() => {});

      const createButton = document.getElementById('create-concept-btn');
      const createFirstButton = document.getElementById('create-first-btn');

      createButton.dispatchEvent(new window.Event('click', { bubbles: true }));
      createFirstButton.dispatchEvent(new window.Event('click', { bubbles: true }));

      expect(showModalSpy).toHaveBeenCalledTimes(2);
    });

    it('retries loading when retry is clicked', () => {
      const loadSpy = jest
        .spyOn(controller, '_loadConceptsData')
        .mockImplementation(() => {});

      const retryButton = document.getElementById('retry-btn');
      retryButton.dispatchEvent(new window.Event('click', { bubbles: true }));

      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('navigates back to the menu when requested', () => {
      const navigateSpy = jest
        .spyOn(controller, '_navigateToMenu')
        .mockImplementation(() => {});

      const backButton = document.getElementById('back-to-menu-btn');
      backButton.dispatchEvent(new window.Event('click', { bubbles: true }));

      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('search results display helpers', () => {
    it('delegates to displayConcepts when filtered results exist', () => {
      const filteredConcepts = [
        {
          concept: { id: 'concept-1', concept: 'Mystic Hunter' },
          directionCount: 3,
        },
      ];

      const displaySpy = jest.spyOn(controller, '_displayConcepts');

      controller._testExports.displayFilteredConcepts(filteredConcepts);

      expect(displaySpy).toHaveBeenCalledWith(filteredConcepts);
    });

    it('shows the dedicated empty state when search results are empty', () => {
      controller._testExports.searchFilter = 'mystic';

      const noResultsSpy = jest.spyOn(controller, '_showNoSearchResults');

      controller._testExports.displayFilteredConcepts([]);

      expect(noResultsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('no search results state', () => {
    it('renders the enhanced empty state and wires the clear action', () => {
      controller._testExports.searchFilter = 'phantom';
      const appendChildMock = jest.fn();
      controller._getElement('conceptsResults').appendChild = appendChildMock;

      const clearSpy = jest
        .spyOn(controller, '_clearSearch')
        .mockImplementation(() => {});
      const showStateSpy = jest.spyOn(controller, '_showState');

      controller._showNoSearchResults();

      expect(showStateSpy).toHaveBeenCalledWith('results');
      expect(appendChildMock).toHaveBeenCalledTimes(1);

      const [noResultsDiv] = appendChildMock.mock.calls[0];
      expect(noResultsDiv.classList.contains('no-search-results')).toBe(true);

      const clearButton = noResultsDiv.querySelector('#clear-search-btn');
      clearButton.click();
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to the generic empty state when no search filter is present', () => {
      controller._testExports.searchFilter = '';
      const emptySpy = jest.spyOn(controller, '_showEmptyState');

      controller._showNoSearchResults();

      expect(emptySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('search state updates', () => {
    it('toggles container styling and updates status helpers', () => {
      const container = controller._getElement('conceptsContainer');
      const updateStatusSpy = jest
        .spyOn(controller, '_updateSearchStatus')
        .mockImplementation(() => {});
      const updateClearSpy = jest
        .spyOn(controller, '_updateClearButton')
        .mockImplementation(() => {});

      controller._updateSearchState('arcane', 2);

      expect(container.classList.contains('search-active')).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledWith('arcane', 2);
      expect(updateClearSpy).toHaveBeenCalledWith(true);

      controller._updateSearchState('', 0);

      expect(container.classList.contains('search-active')).toBe(false);
      expect(updateClearSpy).toHaveBeenLastCalledWith(false);
    });
  });

  describe('search status indicator', () => {
    it('removes the status element when search is cleared', () => {
      const status = document.createElement('div');
      status.className = 'search-status';
      document.body.appendChild(status);
      const originalQuery = document.querySelector;
      const removeSpy = jest.spyOn(status, 'remove');
      document.querySelector = jest.fn((selector) => {
        if (selector === '.search-status') {
          return status;
        }
        return originalQuery.call(document, selector);
      });

      controller._updateSearchStatus('', 0);

      expect(removeSpy).toHaveBeenCalled();

      document.querySelector = originalQuery;
    });

    it('creates and updates the status element with a clear handler', () => {
      const resultsContainer = controller._getElement('conceptsResults');
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      const panelTitle = document.createElement('div');
      panelTitle.className = 'cb-panel-title';
      wrapper.appendChild(panelTitle);
      wrapper.appendChild(resultsContainer);
      controller._testExports.conceptsData = [
        { concept: { id: 'a' }, directionCount: 1 },
        { concept: { id: 'b' }, directionCount: 0 },
      ];

      const clearSpy = jest
        .spyOn(controller, '_clearSearch')
        .mockImplementation(() => {});

      controller._updateSearchStatus('arc', 1);

      const statusElement = wrapper.querySelector('.search-status');
      expect(statusElement).not.toBeNull();
      expect(statusElement.innerHTML).toContain('Showing <strong>1</strong>');

      statusElement.querySelector('.clear-search-inline').click();
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear search button helper', () => {
    it('creates and removes the inline clear button', () => {
      const clearSpy = jest
        .spyOn(controller, '_clearSearch')
        .mockImplementation(() => {});
      const searchWrapper = document.createElement('div');
      document.body.appendChild(searchWrapper);
      const searchInput = controller._getElement('conceptSearch');
      searchWrapper.appendChild(searchInput);

      controller._updateClearButton(true);

      const button = searchWrapper.querySelector('.search-clear-btn');
      expect(button).not.toBeNull();

      button.click();
      expect(clearSpy).toHaveBeenCalledTimes(1);

      controller._updateClearButton(false);
      expect(searchWrapper.querySelector('.search-clear-btn')).toBeNull();
    });
  });

  describe('search highlighting utilities', () => {
    it('wraps matching terms in mark tags', () => {
      const highlighted = controller._highlightSearchTerms(
        'Arcane Archer',
        'Arc'
      );

      expect(highlighted).toContain('<mark>Arc</mark>');
    });

    it('escapes regular expression characters safely', () => {
      const escaped = controller._escapeRegex('mage+(test)');

      expect(escaped).toBe('mage\\+\\(test\\)');
    });
  });

  describe('enhanced search state persistence', () => {
    it('saves structured search state and compatibility backup', () => {
      controller._testExports.searchAnalytics = {
        searches: [{ term: 'old', resultCount: 2 }],
        noResultSearches: [],
      };
      sessionStorage.clear();

      controller._saveEnhancedSearchState('mystic', 4);

      const enhancedState = JSON.parse(
        sessionStorage.getItem('conceptsSearchState')
      );
      expect(enhancedState.filter).toBe('mystic');
      expect(enhancedState.resultCount).toBe(4);
      expect(sessionStorage.getItem('conceptsManagerSearch')).toBe('mystic');

      controller._testExports.searchFilter = '';
      controller._saveSearchState();
      expect(sessionStorage.getItem('conceptsManagerSearch')).toBeNull();
    });

    it('falls back to legacy persistence when saving fails', () => {
      const setItemMock = jest
        .spyOn(window.Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('primary failure');
        });

      const legacySpy = jest
        .spyOn(controller, '_saveSearchState')
        .mockImplementation(() => {
          throw new Error('legacy failure');
        });

      controller._saveEnhancedSearchState('arcane', 1);

      const warnCall = controller.logger.warn.mock.calls.find(
        ([message]) => message === 'Failed to save enhanced search state'
      );
      expect(warnCall).toBeDefined();
      expect(warnCall[1]).toBeInstanceOf(Error);

      const errorCall = controller.logger.error.mock.calls.find(
        ([message]) => message === 'Failed to save search state'
      );
      expect(errorCall).toBeDefined();
      expect(errorCall[1]).toBeInstanceOf(Error);

      legacySpy.mockRestore();
      setItemMock.mockRestore();
    });
  });

  describe('enhanced search state restoration', () => {
    it('restores enhanced state, scroll position, and analytics when valid', () => {
      controller._testExports.searchAnalytics = { searches: [], noResultSearches: [] };
      const state = {
        filter: 'psionic',
        resultCount: 2,
        timestamp: Date.now(),
        scrollPosition: 120,
        analytics: {
          recentSearches: [{ term: 'prior', resultCount: 3 }],
        },
      };
      sessionStorage.setItem('conceptsSearchState', JSON.stringify(state));

      if (!window.scrollTo) {
        window.scrollTo = () => {};
      }
      const scrollToMock = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const rafMock = jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb) => {
          cb();
          return 1;
        });

      controller._restoreEnhancedSearchState();

      expect(controller._testExports.searchFilter).toBe('psionic');
      expect(controller._testExports.searchStateRestored).toBe(true);
      expect(scrollToMock).toHaveBeenCalledWith(0, 120);
      expect(controller._testExports.searchAnalytics.searches).toEqual(
        expect.arrayContaining([expect.objectContaining({ term: 'prior' })])
      );

      rafMock.mockRestore();
      scrollToMock.mockRestore();
    });
  });

  describe('analytics error handling', () => {
    it('logs a warning when analytics tracking fails', () => {
      controller._testExports.searchAnalytics = {
        searches: null,
        noResultSearches: [],
      };

      controller._trackEnhancedSearchAnalytics('broken', []);

      expect(controller.logger.warn).toHaveBeenCalledWith(
        'Failed to track search analytics',
        expect.any(Error)
      );
    });
  });
});
