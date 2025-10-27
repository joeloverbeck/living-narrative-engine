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
});
