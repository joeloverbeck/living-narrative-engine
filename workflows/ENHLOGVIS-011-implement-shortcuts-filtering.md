# ENHLOGVIS-011: Implement Keyboard Shortcuts and Log Filtering

## Ticket Overview

**Type**: Feature Enhancement  
**Component**: UI/UX  
**Priority**: Medium  
**Phase**: 3 - Enhanced Features  
**Estimated Effort**: 3 hours

## Objective

Add keyboard shortcuts for quick notification management and implement log filtering capabilities in the panel to help developers quickly find specific warnings or errors.

## Current State

- Basic keyboard shortcuts exist (Escape, Ctrl+Shift+L)
- No filtering capability in log panel
- No search functionality
- No quick actions via keyboard

## Technical Implementation

### Files to Create/Modify

- `src/logging/ui/logFilter.js` - New filtering logic
- `src/logging/ui/keyboardShortcuts.js` - Enhanced keyboard handling
- Update `criticalLogNotifierRenderer.js` - Add filter UI
- Update `criticalLogNotifierEvents.js` - Connect filter and shortcuts

### Implementation Steps

1. **Create Log Filter Component** (`src/logging/ui/logFilter.js`):

   ```javascript
   /**
    * @file Log filtering functionality for critical notifications
    */

   import { validateDependency } from '../../utils/dependencyUtils.js';

   class LogFilter {
     #logs = [];
     #filteredLogs = [];
     #filterCriteria = {
       level: 'all', // 'all', 'warn', 'error'
       searchText: '',
       category: 'all',
       timeRange: 'all', // 'all', 'last5min', 'last15min', 'last30min', 'lasthour'
     };
     #callbacks;
     #logger;
     #categories = new Set(['all']);

     constructor({ callbacks, logger }) {
       validateDependency(logger, 'ILogger', console, {
         requiredMethods: ['debug'],
       });

       this.#callbacks = callbacks || {};
       this.#logger = logger;
     }

     /**
      * Set the logs to filter
      * @param {Array} logs - Array of log entries
      */
     setLogs(logs) {
       this.#logs = logs;
       this.#updateCategories();
       this.#applyFilters();
     }

     /**
      * Add a new log entry
      * @param {Object} log - Log entry to add
      */
     addLog(log) {
       this.#logs.push(log);
       if (log.category) {
         this.#categories.add(log.category);
       }
       this.#applyFilters();
     }

     /**
      * Clear all logs
      */
     clearLogs() {
       this.#logs = [];
       this.#filteredLogs = [];
       this.#categories = new Set(['all']);
       this.#notifyChange();
     }

     /**
      * Set filter criteria
      * @param {Object} criteria - Filter criteria object
      */
     setFilter(criteria) {
       const changed = Object.keys(criteria).some(
         (key) => this.#filterCriteria[key] !== criteria[key]
       );

       if (changed) {
         Object.assign(this.#filterCriteria, criteria);
         this.#applyFilters();
         this.#logger.debug('Filter criteria updated', criteria);
       }
     }

     /**
      * Get current filter criteria
      * @returns {Object}
      */
     getFilter() {
       return { ...this.#filterCriteria };
     }

     /**
      * Get filtered logs
      * @returns {Array}
      */
     getFilteredLogs() {
       return [...this.#filteredLogs];
     }

     /**
      * Get available categories
      * @returns {Array}
      */
     getCategories() {
       return Array.from(this.#categories).sort();
     }

     /**
      * Get filter statistics
      * @returns {Object}
      */
     getStats() {
       const stats = {
         total: this.#logs.length,
         filtered: this.#filteredLogs.length,
         warnings: 0,
         errors: 0,
         byCategory: {},
       };

       this.#filteredLogs.forEach((log) => {
         if (log.level === 'warn') stats.warnings++;
         if (log.level === 'error') stats.errors++;

         const category = log.category || 'general';
         stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
       });

       return stats;
     }

     #applyFilters() {
       let filtered = [...this.#logs];

       // Filter by level
       if (this.#filterCriteria.level !== 'all') {
         filtered = filtered.filter(
           (log) => log.level === this.#filterCriteria.level
         );
       }

       // Filter by search text
       if (this.#filterCriteria.searchText) {
         const searchLower = this.#filterCriteria.searchText.toLowerCase();
         filtered = filtered.filter((log) => {
           const message = (log.message || '').toLowerCase();
           const category = (log.category || '').toLowerCase();
           return (
             message.includes(searchLower) || category.includes(searchLower)
           );
         });
       }

       // Filter by category
       if (this.#filterCriteria.category !== 'all') {
         filtered = filtered.filter(
           (log) => log.category === this.#filterCriteria.category
         );
       }

       // Filter by time range
       if (this.#filterCriteria.timeRange !== 'all') {
         const now = Date.now();
         const ranges = {
           last5min: 5 * 60 * 1000,
           last15min: 15 * 60 * 1000,
           last30min: 30 * 60 * 1000,
           lasthour: 60 * 60 * 1000,
         };

         const maxAge = ranges[this.#filterCriteria.timeRange];
         if (maxAge) {
           filtered = filtered.filter((log) => {
             const logTime = new Date(log.timestamp).getTime();
             return now - logTime <= maxAge;
           });
         }
       }

       this.#filteredLogs = filtered;
       this.#notifyChange();
     }

     #updateCategories() {
       this.#categories = new Set(['all']);
       this.#logs.forEach((log) => {
         if (log.category) {
           this.#categories.add(log.category);
         }
       });
     }

     #notifyChange() {
       if (this.#callbacks.onFilterChange) {
         this.#callbacks.onFilterChange(this.#filteredLogs, this.getStats());
       }
     }

     /**
      * Export filtered logs as JSON
      * @returns {string}
      */
     exportAsJSON() {
       return JSON.stringify(this.#filteredLogs, null, 2);
     }

     /**
      * Export filtered logs as CSV
      * @returns {string}
      */
     exportAsCSV() {
       const headers = ['Timestamp', 'Level', 'Category', 'Message'];
       const rows = this.#filteredLogs.map((log) => [
         log.timestamp,
         log.level,
         log.category || '',
         `"${(log.message || '').replace(/"/g, '""')}"`,
       ]);

       return [headers.join(','), ...rows.map((row) => row.join(','))].join(
         '\n'
       );
     }
   }

   export default LogFilter;
   ```

2. **Create Enhanced Keyboard Shortcuts** (`src/logging/ui/keyboardShortcuts.js`):

   ```javascript
   /**
    * @file Enhanced keyboard shortcuts for critical log notifier
    */

   class KeyboardShortcuts {
     #shortcuts = new Map();
     #enabled = true;
     #logger;
     #boundHandler;

     constructor({ logger }) {
       this.#logger = logger;
       this.#boundHandler = this.#handleKeydown.bind(this);
       this.#registerDefaultShortcuts();
     }

     #registerDefaultShortcuts() {
       // Existing shortcuts
       this.register('Escape', {
         description: 'Close panel',
         action: 'close-panel',
       });

       this.register('Ctrl+Shift+L', {
         description: 'Toggle panel',
         action: 'toggle-panel',
         preventDefault: true,
       });

       // New shortcuts
       this.register('Ctrl+Shift+C', {
         description: 'Clear all notifications',
         action: 'clear-all',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+D', {
         description: 'Dismiss notifications',
         action: 'dismiss',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+E', {
         description: 'Export logs',
         action: 'export',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+F', {
         description: 'Focus search',
         action: 'focus-search',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+W', {
         description: 'Filter warnings only',
         action: 'filter-warnings',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+R', {
         description: 'Filter errors only',
         action: 'filter-errors',
         preventDefault: true,
       });

       this.register('Ctrl+Shift+A', {
         description: 'Show all logs',
         action: 'filter-all',
         preventDefault: true,
       });

       // Navigation shortcuts when panel is open
       this.register('ArrowUp', {
         description: 'Previous log entry',
         action: 'prev-log',
         requiresPanel: true,
       });

       this.register('ArrowDown', {
         description: 'Next log entry',
         action: 'next-log',
         requiresPanel: true,
       });

       this.register('Home', {
         description: 'First log entry',
         action: 'first-log',
         requiresPanel: true,
       });

       this.register('End', {
         description: 'Last log entry',
         action: 'last-log',
         requiresPanel: true,
       });
     }

     /**
      * Register a keyboard shortcut
      * @param {string} key - Key combination (e.g., 'Ctrl+Shift+L')
      * @param {Object} config - Shortcut configuration
      */
     register(key, config) {
       const normalizedKey = this.#normalizeKey(key);
       this.#shortcuts.set(normalizedKey, config);
     }

     /**
      * Enable keyboard shortcuts
      */
     enable() {
       if (this.#enabled) return;

       document.addEventListener('keydown', this.#boundHandler);
       this.#enabled = true;
       this.#logger.debug('Keyboard shortcuts enabled');
     }

     /**
      * Disable keyboard shortcuts
      */
     disable() {
       if (!this.#enabled) return;

       document.removeEventListener('keydown', this.#boundHandler);
       this.#enabled = false;
       this.#logger.debug('Keyboard shortcuts disabled');
     }

     /**
      * Set callback for shortcut actions
      * @param {Function} callback
      */
     setActionCallback(callback) {
       this.#actionCallback = callback;
     }

     #handleKeydown(e) {
       const key = this.#getKeyFromEvent(e);
       const shortcut = this.#shortcuts.get(key);

       if (!shortcut) return;

       // Check if panel is required
       if (shortcut.requiresPanel) {
         const panel = document.querySelector('.lne-log-panel');
         if (!panel || panel.hidden) return;
       }

       // Check if we should handle this shortcut
       if (this.#shouldHandleShortcut(e, shortcut)) {
         if (shortcut.preventDefault) {
           e.preventDefault();
         }

         if (this.#actionCallback) {
           this.#actionCallback(shortcut.action, e);
         }

         this.#logger.debug(`Shortcut triggered: ${key} -> ${shortcut.action}`);
       }
     }

     #shouldHandleShortcut(e, shortcut) {
       // Don't trigger shortcuts when typing in input fields
       const tagName = e.target.tagName.toLowerCase();
       if (
         tagName === 'input' ||
         tagName === 'textarea' ||
         tagName === 'select'
       ) {
         return false;
       }

       // Don't trigger if contenteditable
       if (e.target.isContentEditable) {
         return false;
       }

       return true;
     }

     #getKeyFromEvent(e) {
       const parts = [];

       if (e.ctrlKey) parts.push('Ctrl');
       if (e.altKey) parts.push('Alt');
       if (e.shiftKey) parts.push('Shift');
       if (e.metaKey) parts.push('Meta');

       // Add the actual key
       const key = e.key;
       if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
         parts.push(key);
       }

       return parts.join('+');
     }

     #normalizeKey(key) {
       // Normalize key string for consistent comparison
       return key
         .split('+')
         .map((part) => part.trim())
         .sort((a, b) => {
           // Modifiers first, then key
           const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
           const aIsMod = modifiers.includes(a);
           const bIsMod = modifiers.includes(b);

           if (aIsMod && !bIsMod) return -1;
           if (!aIsMod && bIsMod) return 1;
           return a.localeCompare(b);
         })
         .join('+');
     }

     /**
      * Get help text for all shortcuts
      * @returns {string}
      */
     getHelpText() {
       const lines = ['Keyboard Shortcuts:'];

       this.#shortcuts.forEach((config, key) => {
         lines.push(`  ${key.padEnd(20)} - ${config.description}`);
       });

       return lines.join('\n');
     }

     destroy() {
       this.disable();
       this.#shortcuts.clear();
     }
   }

   export default KeyboardShortcuts;
   ```

3. **Update Renderer to Add Filter UI**:

   ```javascript
   // Add to CriticalLogNotifierRenderer

   #createPanel() {
     const panel = document.createElement('div');
     // ... existing panel creation ...

     // Add filter bar
     const filterBar = this.#createFilterBar();
     panel.insertBefore(filterBar, panel.querySelector('.lne-log-list'));

     return panel;
   }

   #createFilterBar() {
     const filterBar = document.createElement('div');
     filterBar.className = 'lne-filter-bar';

     // Search input
     const searchInput = document.createElement('input');
     searchInput.type = 'text';
     searchInput.className = 'lne-search-input';
     searchInput.placeholder = 'Search logs... (Ctrl+Shift+F)';
     searchInput.setAttribute('aria-label', 'Search logs');

     // Level filter
     const levelSelect = document.createElement('select');
     levelSelect.className = 'lne-level-filter';
     levelSelect.setAttribute('aria-label', 'Filter by level');
     levelSelect.innerHTML = `
       <option value="all">All Levels</option>
       <option value="warn">Warnings</option>
       <option value="error">Errors</option>
     `;

     // Category filter
     const categorySelect = document.createElement('select');
     categorySelect.className = 'lne-category-filter';
     categorySelect.setAttribute('aria-label', 'Filter by category');
     categorySelect.innerHTML = `<option value="all">All Categories</option>`;

     // Time range filter
     const timeSelect = document.createElement('select');
     timeSelect.className = 'lne-time-filter';
     timeSelect.setAttribute('aria-label', 'Filter by time');
     timeSelect.innerHTML = `
       <option value="all">All Time</option>
       <option value="last5min">Last 5 min</option>
       <option value="last15min">Last 15 min</option>
       <option value="last30min">Last 30 min</option>
       <option value="lasthour">Last hour</option>
     `;

     // Stats display
     const stats = document.createElement('div');
     stats.className = 'lne-filter-stats';
     stats.textContent = 'Showing 0 of 0 logs';

     filterBar.appendChild(searchInput);
     filterBar.appendChild(levelSelect);
     filterBar.appendChild(categorySelect);
     filterBar.appendChild(timeSelect);
     filterBar.appendChild(stats);

     return filterBar;
   }

   updateFilterStats(stats) {
     const statsElement = this.#panel.querySelector('.lne-filter-stats');
     if (statsElement) {
       statsElement.textContent = `Showing ${stats.filtered} of ${stats.total} logs`;
       if (stats.warnings > 0 || stats.errors > 0) {
         statsElement.textContent += ` (${stats.warnings}⚠ ${stats.errors}❌)`;
       }
     }
   }

   updateCategoryOptions(categories) {
     const categorySelect = this.#panel.querySelector('.lne-category-filter');
     if (categorySelect) {
       categorySelect.innerHTML = '<option value="all">All Categories</option>';
       categories.forEach(cat => {
         if (cat !== 'all') {
           const option = document.createElement('option');
           option.value = cat;
           option.textContent = cat;
           categorySelect.appendChild(option);
         }
       });
     }
   }
   ```

## Dependencies

- **Depends On**: ENHLOGVIS-005 (CriticalLogNotifier structure)
- **Depends On**: ENHLOGVIS-007 (Event handling)
- **Depends On**: ENHLOGVIS-008 (CSS for filter UI)

## Acceptance Criteria

- [ ] Search input filters logs by message text
- [ ] Level filter shows only warnings or errors
- [ ] Category filter shows logs by category
- [ ] Time range filter limits to recent logs
- [ ] Keyboard shortcuts work as specified
- [ ] Filter stats show correct counts
- [ ] Shortcuts don't interfere with input fields
- [ ] Export shortcuts prepare data (for ENHLOGVIS-012)
- [ ] Navigation shortcuts work in panel
- [ ] Help text available for shortcuts

## Testing Requirements

### Unit Tests

- Test filter logic for each criteria
- Test combined filter scenarios
- Test keyboard shortcut registration
- Test shortcut key normalization
- Test export format generation
- Test stats calculation

### Manual Testing

1. Type in search - filters logs
2. Select warning filter - shows only warnings
3. Select category - filters by category
4. Select time range - shows recent logs
5. Press Ctrl+Shift+F - focuses search
6. Press Ctrl+Shift+W - filters warnings
7. Press Ctrl+Shift+C - clears notifications
8. Use arrow keys - navigates logs
9. Type in input field - shortcuts disabled
10. Press ? - shows help (optional)

## Code Review Checklist

- [ ] Filter logic efficient for large logs
- [ ] Keyboard shortcuts don't conflict
- [ ] Search is case-insensitive
- [ ] Time filtering accurate
- [ ] Export formats valid
- [ ] Accessibility maintained

## Notes

- Consider debouncing search input
- Category list should update dynamically
- Shortcuts should be customizable in future
- Consider adding regex search option

## Related Tickets

- **Depends On**: ENHLOGVIS-005, ENHLOGVIS-007, ENHLOGVIS-008
- **Next**: ENHLOGVIS-012 (Export functionality)
- **Enhances**: Overall developer experience
