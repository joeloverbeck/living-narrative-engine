# Ticket 02: Extract ConceptUtilities

**Service**: ConceptUtilities (Pure utility functions)
**Estimated Time**: 2 hours
**Dependencies**: Ticket 01 (Setup & Types)
**Status**: ⬜ Not Started

---

## Goal

Extract all pure utility functions from the controller into a dedicated `ConceptUtilities` class. These are stateless, side-effect-free functions that can be tested in isolation.

---

## Methods to Extract

Extract the following 13 methods from `characterConceptsManagerController.js`:

1. `_formatRelativeDate(date)` - Format date as "X minutes ago"
2. `_formatFullDate(date)` - Format date as "January 15, 2024 at 3:45 PM"
3. `_truncateText(text, maxLength)` - Truncate text with ellipsis
4. `_escapeHtml(text)` - Escape HTML special characters
5. `_escapeRegex(string)` - Escape regex special characters
6. `_convertToCSV(data)` - Convert statistics to CSV format
7. `_exportStatistics(format)` - Export statistics (JSON/CSV)
8. `_getDisplayText(concept, maxLength)` - Get display text with highlighting
9. `_isConceptVisible(concept)` - Check if concept matches search
10. `_fuzzyMatch(text, pattern)` - Fuzzy string matching (may move to SearchEngine later)

---

## Implementation

### File: `src/domUI/characterConceptsManager/utils/ConceptUtilities.js`

```javascript
/**
 * @file Pure utility functions for Character Concepts Manager
 * No dependencies, no side effects - all static methods
 */

/**
 * Collection of utility functions for concept management
 */
export class ConceptUtilities {
  /**
   * Format a date as relative time (e.g., "5 minutes ago")
   *
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time string
   */
  static formatRelativeDate(date) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return this.formatFullDate(date);
  }

  /**
   * Format a date as full date string
   *
   * @param {string|Date} date - Date to format
   * @returns {string} Full date string
   */
  static formatFullDate(date) {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * Truncate text to maximum length with ellipsis
   *
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  static truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;

    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    // Use word boundary if it's not too far back (80% of maxLength)
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Escape HTML special characters
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape special regex characters
   *
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Convert statistics data to CSV format
   *
   * @param {Object} data - Statistics data
   * @returns {string} CSV string
   */
  static convertToCSV(data) {
    const headers = Object.keys(data);
    const values = Object.values(data);

    const csvHeaders = headers.join(',');
    const csvValues = values.join(',');

    return `${csvHeaders}\n${csvValues}`;
  }

  /**
   * Export statistics in specified format
   *
   * @param {Object} stats - Statistics object
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {string} Exported data
   */
  static exportStatistics(stats, format = 'json') {
    if (format === 'csv') {
      return this.convertToCSV(stats);
    }
    return JSON.stringify(stats, null, 2);
  }

  /**
   * Download data as file
   *
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   */
  static downloadAsFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }
}
```

---

## Update Controller (Facade Pattern)

In `characterConceptsManagerController.js`, replace method implementations with delegations:

```javascript
import { ConceptUtilities } from './characterConceptsManager/utils/ConceptUtilities.js';

// ... in class

/**
 * Format date as relative time
 * @param {string|Date} date
 * @returns {string}
 */
_formatRelativeDate(date) {
  return ConceptUtilities.formatRelativeDate(date);
}

/**
 * Format date as full date
 * @param {string|Date} date
 * @returns {string}
 */
_formatFullDate(date) {
  return ConceptUtilities.formatFullDate(date);
}

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
_truncateText(text, maxLength) {
  return ConceptUtilities.truncateText(text, maxLength);
}

/**
 * Escape HTML characters
 * @param {string} text
 * @returns {string}
 */
_escapeHtml(text) {
  return ConceptUtilities.escapeHtml(text);
}

/**
 * Escape regex characters
 * @param {string} string
 * @returns {string}
 */
_escapeRegex(string) {
  return ConceptUtilities.escapeRegex(string);
}

/**
 * Convert data to CSV
 * @param {Object} data
 * @returns {string}
 */
_convertToCSV(data) {
  return ConceptUtilities.convertToCSV(data);
}

/**
 * Export statistics
 * @param {string} format
 */
_exportStatistics(format = 'json') {
  const stats = this._calculateStatistics();
  const content = ConceptUtilities.exportStatistics(stats, format);
  const filename = `concept-statistics-${Date.now()}.${format}`;
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  ConceptUtilities.downloadAsFile(content, filename, mimeType);
}
```

---

## Create Unit Tests

**File**: `tests/unit/domUI/characterConceptsManager/utils/ConceptUtilities.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { ConceptUtilities } from '../../../../../src/domUI/characterConceptsManager/utils/ConceptUtilities.js';

describe('ConceptUtilities', () => {
  describe('formatRelativeDate', () => {
    it('should return "just now" for recent dates', () => {
      const now = new Date();
      const result = ConceptUtilities.formatRelativeDate(now);
      expect(result).toBe('just now');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = ConceptUtilities.formatRelativeDate(fiveMinutesAgo);
      expect(result).toBe('5 minutes ago');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = ConceptUtilities.formatRelativeDate(twoHoursAgo);
      expect(result).toBe('2 hours ago');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = ConceptUtilities.formatRelativeDate(threeDaysAgo);
      expect(result).toBe('3 days ago');
    });

    it('should use full date for dates older than 7 days', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const result = ConceptUtilities.formatRelativeDate(tenDaysAgo);
      expect(result).toContain(tenDaysAgo.getFullYear().toString());
    });
  });

  describe('truncateText', () => {
    it('should return original text if shorter than max', () => {
      const text = 'Short text';
      const result = ConceptUtilities.truncateText(text, 100);
      expect(result).toBe('Short text');
    });

    it('should truncate text longer than max', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = ConceptUtilities.truncateText(text, 20);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(result).toContain('...');
    });

    it('should truncate at word boundary when possible', () => {
      const text = 'This is a test sentence';
      const result = ConceptUtilities.truncateText(text, 10);
      expect(result).toBe('This is a...');
    });
  });

  describe('escapeHtml', () => {
    it('should escape < and >', () => {
      const text = '<script>alert("xss")</script>';
      const result = ConceptUtilities.escapeHtml(text);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape &', () => {
      const text = 'Tom & Jerry';
      const result = ConceptUtilities.escapeHtml(text);
      expect(result).toContain('&amp;');
    });
  });

  describe('escapeRegex', () => {
    it('should escape special regex characters', () => {
      const text = 'test.*+?^${}()|[]\\';
      const result = ConceptUtilities.escapeRegex(text);
      expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });
  });

  describe('convertToCSV', () => {
    it('should convert object to CSV', () => {
      const data = { total: 10, completed: 5, percentage: 50 };
      const result = ConceptUtilities.convertToCSV(data);
      expect(result).toBe('total,completed,percentage\n10,5,50');
    });
  });

  describe('exportStatistics', () => {
    const stats = { total: 10, completed: 5 };

    it('should export as JSON by default', () => {
      const result = ConceptUtilities.exportStatistics(stats);
      expect(result).toContain('"total": 10');
      expect(JSON.parse(result)).toEqual(stats);
    });

    it('should export as CSV when specified', () => {
      const result = ConceptUtilities.exportStatistics(stats, 'csv');
      expect(result).toBe('total,completed\n10,5');
    });
  });
});
```

---

## Verification Steps

```bash
# 1. Create the utility file
# (Copy implementation above)

# 2. Update controller with delegations
# (Copy facade pattern above)

# 3. Create unit tests
# (Copy tests above)

# 4. Run tests
npm run test:unit -- --testPathPattern="ConceptUtilities"

# 5. Verify controller tests still pass
npm run test:unit -- --testPathPattern="characterConceptsManagerController"

# 6. Check line count
wc -l src/domUI/characterConceptsManager/utils/ConceptUtilities.js
# Should be < 300 lines

# 7. Lint
npx eslint src/domUI/characterConceptsManager/utils/ConceptUtilities.js

# 8. Verify coverage
npm run test:unit -- --coverage --testPathPattern="ConceptUtilities"
# Should be > 90%
```

---

## Success Criteria

- ✅ `ConceptUtilities.js` created (< 300 lines)
- ✅ All 13 utility methods extracted
- ✅ Controller delegates to `ConceptUtilities`
- ✅ Unit tests created with 90%+ coverage
- ✅ All existing controller tests still pass
- ✅ No ESLint errors

---

## Next Ticket

[Ticket 03: Extract ConceptFormValidator](./TICKET-03-form-validator.md)
