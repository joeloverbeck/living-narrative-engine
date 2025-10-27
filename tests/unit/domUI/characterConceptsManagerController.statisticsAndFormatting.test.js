import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

const FIXED_NOW = new Date('2024-01-01T12:00:00Z');

describe('CharacterConceptsManagerController statistics and formatting coverage', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await testBase.cleanup();
  });

  const setConceptsData = (concepts) => {
    controller._testExports.conceptsData = concepts;
  };

  const createConceptEntry = ({
    id = 'concept-1',
    concept = 'Adventurer concept',
    directionCount = 0,
    createdAt = '2023-12-31T00:00:00Z',
    updatedAt = '2023-12-31T12:00:00Z',
  } = {}) => ({
    concept: { id, concept, createdAt, updatedAt },
    directionCount,
  });

  it('filters concepts using fuzzy matching when direct substring fails', () => {
    setConceptsData([createConceptEntry({ concept: 'Adventurer legend' })]);
    controller._testExports.searchFilter = 'advenur';

    const results = controller._filterConcepts(controller._testExports.conceptsData);

    expect(results).toHaveLength(1);
  });

  it('animates statistic values by clearing existing intervals and toggling classes', () => {
    jest.useFakeTimers();
    try {
      const element = document.createElement('span');
      element.textContent = '0';
      element.classList.add('stat-updated');
      element.animationInterval = 7;

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const setIntervalSpy = jest.spyOn(controller, '_setInterval');

      controller._animateStatValue(element, 5);

      expect(clearIntervalSpy).toHaveBeenCalledWith(7);
      expect(setIntervalSpy).toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(element.textContent).toBe('5');
      expect(element.classList.contains('stat-updated')).toBe(true);

      jest.advanceTimersByTime(300);
      expect(element.classList.contains('stat-updated')).toBe(false);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it('updates completion progress styling and recalculates statistics', () => {
    const progressContainer = document.createElement('div');
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    const conceptsComplete = document.createElement('span');
    conceptsComplete.className = 'concepts-complete';
    const conceptsTotal = document.createElement('span');
    conceptsTotal.className = 'concepts-total';
    progressContainer.append(progressFill, conceptsComplete, conceptsTotal);
    document.body.appendChild(progressContainer);

    setConceptsData([
      createConceptEntry({ id: 'a', directionCount: 3 }),
      createConceptEntry({ id: 'b', directionCount: 0 }),
    ]);

    const originalQuerySelector = document.querySelector.bind(document);
    const querySpy = jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '.progress-fill') return progressFill;
      if (selector === '.concepts-complete') return conceptsComplete;
      if (selector === '.concepts-total') return conceptsTotal;
      return originalQuerySelector(selector);
    });

    controller._updateCompletionProgress(80);

    expect(progressFill.style.width).toBe('80%');
    expect(progressFill.classList.contains('good')).toBe(true);
    expect(progressFill.classList.contains('moderate')).toBe(false);
    expect(conceptsComplete.textContent).toBe('1');
    expect(conceptsTotal.textContent).toBe('2');

    controller._updateCompletionProgress(40);
    expect(progressFill.classList.contains('low')).toBe(true);

    querySpy.mockRestore();
  });

  it('celebrates creation milestones for first, multiples of ten, and full completion', () => {
    const milestoneSpy = jest.spyOn(controller, '_showMilestone');

    setConceptsData([createConceptEntry({ id: 'first', directionCount: 0 })]);
    controller._celebrateCreation();
    expect(milestoneSpy).toHaveBeenCalledWith('🎉 First Concept Created!');

    milestoneSpy.mockClear();
    setConceptsData(
      Array.from({ length: 10 }, (_, index) =>
        createConceptEntry({ id: `concept-${index}`, directionCount: index % 2 })
      )
    );
    controller._celebrateCreation();
    expect(milestoneSpy).toHaveBeenCalledWith('🎊 10 Concepts Created!');

    milestoneSpy.mockClear();
    setConceptsData([
      createConceptEntry({ id: 'alpha', directionCount: 2 }),
      createConceptEntry({ id: 'beta', directionCount: 1 }),
    ]);
    controller._celebrateCreation();
    expect(milestoneSpy).toHaveBeenCalledWith('⭐ All Concepts Have Directions!');
  });

  it('shows milestone notification lifecycle with animations and removal', () => {
    jest.useFakeTimers();
    try {
      const appendSpy = jest.spyOn(document.body, 'appendChild');
      controller._showMilestone('Milestone reached');

      expect(appendSpy).toHaveBeenCalledTimes(1);
      const milestone = appendSpy.mock.calls[0][0];
      expect(milestone.classList.contains('milestone-notification')).toBe(true);
      expect(milestone.textContent).toBe('Milestone reached');

      jest.advanceTimersByTime(100);
      expect(milestone.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(3000);
      expect(milestone.classList.contains('show')).toBe(false);

      jest.advanceTimersByTime(500);
      expect(document.body.contains(milestone)).toBe(false);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it('exports statistics as JSON and triggers download workflow', () => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);

    const originalBlob = global.Blob;
    const blobMock = jest.fn().mockReturnValue({});
    global.Blob = blobMock;

    const createObjectURLSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-json');
    const revokeObjectURLSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        element.click = anchorClick;
      }
      return element;
    });

    const loggerSpy = jest.spyOn(controller.logger, 'info');

    setConceptsData([
      createConceptEntry({
        id: 'json',
        concept: 'Hero idea',
        directionCount: 2,
        createdAt: '2023-12-30T00:00:00Z',
        updatedAt: '2023-12-31T00:00:00Z',
      }),
    ]);

    controller._exportStatistics('json');

    expect(blobMock).toHaveBeenCalledWith(
      [expect.stringContaining('"statistics"')],
      { type: 'application/json' }
    );
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith('Statistics exported', {
      format: 'json',
      filename: expect.stringMatching(/character-concepts-stats-.*\.json/),
    });

    document.createElement.mockRestore();
    URL.createObjectURL.mockRestore();
    URL.revokeObjectURL.mockRestore();
    global.Blob = originalBlob;
    jest.useRealTimers();
  });

  it('exports statistics as CSV using converter and sets correct metadata', () => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);

    const originalBlob = global.Blob;
    const blobMock = jest.fn().mockReturnValue({});
    global.Blob = blobMock;

    const createObjectURLSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-csv');
    const revokeObjectURLSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        element.click = anchorClick;
      }
      return element;
    });

    setConceptsData([
      createConceptEntry({ id: 'csv', concept: 'Mystic ranger', directionCount: 1 }),
    ]);

    controller._exportStatistics('csv');

    expect(blobMock).toHaveBeenCalledWith([
      expect.stringContaining('Metric,Value'),
    ], { type: 'text/csv' });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    document.createElement.mockRestore();
    URL.createObjectURL.mockRestore();
    URL.revokeObjectURL.mockRestore();
    global.Blob = originalBlob;
    jest.useRealTimers();
  });

  it('converts statistics to CSV with quoted values', () => {
    const csv = controller._convertToCSV({
      exportDate: '2024-01-01T00:00:00Z',
      statistics: {
        totalConcepts: 1,
        conceptsWithDirections: 1,
        totalDirections: 2,
        averageDirectionsPerConcept: '2.0',
        completionRate: 100,
        maxDirections: 2,
      },
    });

    expect(csv.split('\n')).toHaveLength(8);
    expect(csv).toContain('"Export Date","2024-01-01T00:00:00Z"');
  });

  it('escapes HTML characters safely', () => {
    const escaped = controller._escapeHtml('<script>alert(1)</script>');
    expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('truncates text intelligently at word boundaries', () => {
    const shortText = 'Short concept';
    expect(controller._truncateText(shortText, 50)).toBe(shortText);

    const longText = 'An incredible hero origin story that spans galaxies';
    const truncated = controller._truncateText(longText, 30);
    expect(truncated.endsWith('...')).toBe(true);

    const forcedCut = controller._truncateText('abcdefghi', 5);
    expect(forcedCut).toBe('abcde...');
  });

  it('formats relative and absolute dates across thresholds', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-02T00:00:00Z'));

    expect(controller._formatRelativeDate('2024-01-02T00:00:30Z')).toBe('just now');
    expect(controller._formatRelativeDate('2024-01-01T23:10:00Z')).toBe(
      '50 minutes ago'
    );
    expect(controller._formatRelativeDate('2024-01-01T05:00:00Z')).toBe(
      '19 hours ago'
    );
    expect(controller._formatRelativeDate('2023-12-30T00:00:00Z')).toBe(
      '3 days ago'
    );
    expect(controller._formatRelativeDate('2023-12-20T00:00:00Z')).toMatch(/2023/);

    expect(controller._formatFullDate('2024-01-01T12:34:56Z')).toContain('2024');

    jest.useRealTimers();
  });

  it('refreshes concepts display while preserving or resetting scroll position', async () => {
    const resultsElement = controller._getElement('conceptsResults');
    resultsElement.scrollTop = 120;

    const loadSpy = jest
      .spyOn(controller, '_loadConceptsData')
      .mockResolvedValue(undefined);

    await controller._refreshConceptsDisplay(true);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(resultsElement.scrollTop).toBe(120);

    resultsElement.scrollTop = 75;
    await controller._refreshConceptsDisplay(false);
    expect(resultsElement.scrollTop).toBe(75);
  });

  it('shows search empty state with clear action handler', () => {
    const uiStateManager = testBase.getUIStateManager();
    uiStateManager.getCurrentState.mockReturnValue('results');
    const displaySpy = jest.spyOn(controller, '_displayConcepts').mockImplementation(() => {});

    controller._testExports.searchFilter = 'mystic';
    setConceptsData([
      createConceptEntry({ id: 'search', concept: 'Mystic Guardian' }),
    ]);

    controller._showEmptyState();

    const emptyState = controller._getElement('emptyState');
    expect(emptyState.innerHTML).toContain('No concepts match your search');

    const clearButton = document.getElementById('clear-search-btn');
    document.getElementById('concept-search').value = 'mystic';
    clearButton.dispatchEvent(new Event('click'));

    expect(controller._testExports.searchFilter).toBe('');
    expect(displaySpy).toHaveBeenCalledWith(controller._testExports.conceptsData);
  });

  it('queues empty UI state when UIStateManager not ready', () => {
    const uiStateManager = testBase.getUIStateManager();
    uiStateManager.getCurrentState.mockReturnValue(null);
    controller._testExports.searchFilter = '';

    controller._showEmptyState();

    expect(controller._testExports.pendingUIState).toBe('empty');
  });

  it('invokes form change tracking when edit modal input changes', async () => {
    jest.useFakeTimers();
    try {
      setConceptsData([
        createConceptEntry({ id: 'edit-id', concept: 'Existing concept' }),
      ]);

      const trackSpy = jest.spyOn(controller, '_trackFormChanges');
      jest.spyOn(controller, '_animateModalEntrance').mockImplementation(() => {});

      jest.spyOn(controller, '_setupConceptFormValidation').mockImplementation(() => {});

      const conceptText = controller._getElement('conceptText');
      const addEventSpy = jest.spyOn(conceptText, 'addEventListener');

      await controller._showEditModal('edit-id');

      const inputCall = addEventSpy.mock.calls.find(
        ([eventName]) => eventName === 'input'
      );
      expect(inputCall).toBeDefined();
      const handler = inputCall[1];
      handler(new Event('input'));

      expect(trackSpy).toHaveBeenCalled();
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
});
