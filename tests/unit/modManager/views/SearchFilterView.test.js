/**
 * @file Unit tests for SearchFilterView
 * @see src/modManager/views/SearchFilterView.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SearchFilterView } from '../../../../src/modManager/views/SearchFilterView.js';

describe('SearchFilterView', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {{debug: jest.Mock}} */
  let mockLogger;
  /** @type {jest.Mock} */
  let onSearchChange;
  /** @type {jest.Mock} */
  let onFilterChange;
  /** @type {SearchFilterView} */
  let view;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');

    mockLogger = { debug: jest.fn() };
    onSearchChange = jest.fn();
    onFilterChange = jest.fn();

    view = new SearchFilterView({
      container,
      logger: mockLogger,
      onSearchChange,
      onFilterChange,
      debounceMs: 300,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('constructor creates search input and filter buttons', () => {
    // Search input
    const searchInput = container.querySelector('#mod-search');
    expect(searchInput).not.toBeNull();
    expect(searchInput.type).toBe('search');
    expect(searchInput.placeholder).toBe('Search mods...');
    expect(searchInput.getAttribute('aria-label')).toBe(
      'Search mods by name or description'
    );

    // Clear button
    const clearButton = container.querySelector('.search-filter__clear');
    expect(clearButton).not.toBeNull();
    expect(clearButton.hidden).toBe(true);

    // Filter buttons
    const filterButtons = container.querySelectorAll(
      '.search-filter__filter-btn'
    );
    expect(filterButtons.length).toBe(3);

    // Check filter button data attributes
    const allBtn = container.querySelector('[data-filter="all"]');
    const activeBtn = container.querySelector('[data-filter="active"]');
    const inactiveBtn = container.querySelector('[data-filter="inactive"]');
    expect(allBtn).not.toBeNull();
    expect(activeBtn).not.toBeNull();
    expect(inactiveBtn).not.toBeNull();

    // Results section
    const resultsSection = container.querySelector('#search-results-count');
    expect(resultsSection).not.toBeNull();
    expect(resultsSection.getAttribute('role')).toBe('status');
    expect(resultsSection.getAttribute('aria-live')).toBe('polite');
  });

  it('search input triggers onSearchChange with debounce', () => {
    const searchInput = container.querySelector('#mod-search');

    // Type into search input
    searchInput.value = 'test';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Callback should NOT be called immediately
    expect(onSearchChange).not.toHaveBeenCalled();

    // Advance timers by less than debounce time
    jest.advanceTimersByTime(200);
    expect(onSearchChange).not.toHaveBeenCalled();

    // Advance timers to complete debounce
    jest.advanceTimersByTime(100);
    expect(onSearchChange).toHaveBeenCalledWith('test');
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it('Enter key triggers immediate search (no debounce)', () => {
    const searchInput = container.querySelector('#mod-search');

    // Type into search input
    searchInput.value = 'immediate';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Press Enter before debounce completes
    searchInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    // Callback should be called immediately
    expect(onSearchChange).toHaveBeenCalledWith('immediate');
    expect(onSearchChange).toHaveBeenCalledTimes(1);

    // Advance timers - should NOT trigger additional call (debounce was cancelled)
    jest.advanceTimersByTime(300);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it('Escape key clears search', () => {
    const searchInput = container.querySelector('#mod-search');
    const clearButton = container.querySelector('.search-filter__clear');

    // Set initial value
    searchInput.value = 'to be cleared';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(clearButton.hidden).toBe(false);

    // Press Escape
    searchInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );

    // Input should be cleared
    expect(searchInput.value).toBe('');
    expect(clearButton.hidden).toBe(true);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('clear button clears search and triggers callback', () => {
    const searchInput = container.querySelector('#mod-search');
    const clearButton = container.querySelector('.search-filter__clear');

    // Set initial value
    searchInput.value = 'to be cleared';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(clearButton.hidden).toBe(false);

    // Wait for debounce and clear callback count
    jest.advanceTimersByTime(300);
    onSearchChange.mockClear();

    // Click clear button
    clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Input should be cleared
    expect(searchInput.value).toBe('');
    expect(clearButton.hidden).toBe(true);
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it('filter button click triggers onFilterChange', () => {
    const activeBtn = container.querySelector('[data-filter="active"]');

    activeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith('active');
    expect(onFilterChange).toHaveBeenCalledTimes(1);
  });

  it('filter button click updates aria-pressed', () => {
    const allBtn = container.querySelector('[data-filter="all"]');
    const activeBtn = container.querySelector('[data-filter="active"]');
    const inactiveBtn = container.querySelector('[data-filter="inactive"]');

    // Initial state: "all" is pressed
    expect(allBtn.getAttribute('aria-pressed')).toBe('true');
    expect(activeBtn.getAttribute('aria-pressed')).toBe('false');
    expect(inactiveBtn.getAttribute('aria-pressed')).toBe('false');

    // Click "active"
    activeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // "active" should now be pressed, others should not
    expect(allBtn.getAttribute('aria-pressed')).toBe('false');
    expect(activeBtn.getAttribute('aria-pressed')).toBe('true');
    expect(inactiveBtn.getAttribute('aria-pressed')).toBe('false');

    // Click "inactive"
    inactiveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(allBtn.getAttribute('aria-pressed')).toBe('false');
    expect(activeBtn.getAttribute('aria-pressed')).toBe('false');
    expect(inactiveBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('setActiveFilter updates button classes', () => {
    const allBtn = container.querySelector('[data-filter="all"]');
    const activeBtn = container.querySelector('[data-filter="active"]');
    const inactiveBtn = container.querySelector('[data-filter="inactive"]');

    // Initial state: "all" is active
    expect(
      allBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(true);
    expect(
      activeBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(false);

    // Use setFilter (which internally calls setActiveFilter)
    view.setFilter('active');

    expect(
      allBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(false);
    expect(
      activeBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(true);
    expect(
      inactiveBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(false);
  });

  it('updateResultsCount shows correct text', () => {
    const resultsSection = container.querySelector('#search-results-count');

    // When all mods shown
    view.updateResultsCount(10, 10);
    expect(resultsSection.textContent).toBe('10 mods');

    // When filtered
    view.updateResultsCount(3, 10);
    expect(resultsSection.textContent).toBe('Showing 3 of 10 mods');

    // Edge case: 0 shown
    view.updateResultsCount(0, 10);
    expect(resultsSection.textContent).toBe('Showing 0 of 10 mods');

    // Edge case: 1 shown of 1
    view.updateResultsCount(1, 1);
    expect(resultsSection.textContent).toBe('1 mods');
  });

  it('setSearchQuery updates input value', () => {
    const searchInput = container.querySelector('#mod-search');
    const clearButton = container.querySelector('.search-filter__clear');

    // Initially empty
    expect(searchInput.value).toBe('');
    expect(clearButton.hidden).toBe(true);

    // Set query
    view.setSearchQuery('new query');

    expect(searchInput.value).toBe('new query');
    expect(clearButton.hidden).toBe(false);

    // Clear query
    view.setSearchQuery('');

    expect(searchInput.value).toBe('');
    expect(clearButton.hidden).toBe(true);
  });

  it('setFilter updates active button', () => {
    const allBtn = container.querySelector('[data-filter="all"]');
    const inactiveBtn = container.querySelector('[data-filter="inactive"]');

    // Set to inactive
    view.setFilter('inactive');

    expect(
      allBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(false);
    expect(
      inactiveBtn.classList.contains('search-filter__filter-btn--active')
    ).toBe(true);
    expect(inactiveBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('getSearchQuery returns current value', () => {
    const searchInput = container.querySelector('#mod-search');

    expect(view.getSearchQuery()).toBe('');

    searchInput.value = 'query value';
    expect(view.getSearchQuery()).toBe('query value');
  });

  it('getActiveFilter returns active filter id', () => {
    expect(view.getActiveFilter()).toBe('all');

    view.setFilter('active');
    expect(view.getActiveFilter()).toBe('active');

    view.setFilter('inactive');
    expect(view.getActiveFilter()).toBe('inactive');

    view.setFilter('all');
    expect(view.getActiveFilter()).toBe('all');
  });

  it('destroy clears debounce timer', () => {
    const searchInput = container.querySelector('#mod-search');

    // Start a debounce
    searchInput.value = 'test';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Destroy before debounce completes
    view.destroy();

    // Advance timers
    jest.advanceTimersByTime(300);

    // Callback should NOT have been called because timer was cleared
    expect(onSearchChange).not.toHaveBeenCalled();

    // Container should be empty
    expect(container.innerHTML).toBe('');
  });

  it('focus method focuses search input', () => {
    const searchInput = container.querySelector('#mod-search');
    searchInput.focus = jest.fn();

    view.focus();

    expect(searchInput.focus).toHaveBeenCalled();
  });

  it('clear button focuses search input after clearing', () => {
    const searchInput = container.querySelector('#mod-search');
    const clearButton = container.querySelector('.search-filter__clear');
    searchInput.focus = jest.fn();

    // Set initial value to make clear button visible
    searchInput.value = 'test';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Click clear button
    clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(searchInput.focus).toHaveBeenCalled();
  });

  it('multiple rapid inputs only trigger one debounced callback', () => {
    const searchInput = container.querySelector('#mod-search');

    // Rapid typing
    searchInput.value = 'a';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    jest.advanceTimersByTime(100);

    searchInput.value = 'ab';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    jest.advanceTimersByTime(100);

    searchInput.value = 'abc';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // No callbacks yet
    expect(onSearchChange).not.toHaveBeenCalled();

    // Wait for debounce to complete
    jest.advanceTimersByTime(300);

    // Only one callback with final value
    expect(onSearchChange).toHaveBeenCalledWith('abc');
    expect(onSearchChange).toHaveBeenCalledTimes(1);
  });

  it('visually-hidden label exists for accessibility', () => {
    const label = container.querySelector('.visually-hidden');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Search mods');
    expect(label.getAttribute('for')).toBe('mod-search');
  });

  it('filter section has proper ARIA group attributes', () => {
    const filterSection = container.querySelector('.search-filter__filters');
    expect(filterSection.getAttribute('role')).toBe('group');
    expect(filterSection.getAttribute('aria-label')).toBe(
      'Filter mods by status'
    );
  });
});
