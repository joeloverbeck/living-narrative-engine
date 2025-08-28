# TRAREW-007: Implement TraitsRewriterDisplayEnhancer Service

## Priority: 🔥 HIGH

**Phase**: 2 - Core Business Logic  
**Story Points**: 2  
**Estimated Time**: 2-3 hours

## Problem Statement

The TraitsRewriterDisplayEnhancer handles formatting rewritten traits for display and export. It creates HTML-safe display sections, generates export files in multiple formats, manages file naming conventions, and ensures content is properly structured for the user interface.

## Requirements

1. Format rewritten traits for HTML display with proper structure
2. Generate export files in text and JSON formats
3. Create descriptive and timestamp-based filenames
4. Organize traits into labeled display sections
5. Ensure content safety and HTML escaping
6. Support multiple export options and formats

## Acceptance Criteria

- [ ] **Display Formatting**: Creates HTML-safe sections with proper trait organization
- [ ] **Export Functionality**: Supports text and JSON export formats
- [ ] **File Naming**: Generates descriptive filenames with timestamps
- [ ] **Section Creation**: Organizes traits into labeled sections (Likes, Fears, etc.)
- [ ] **Content Safety**: HTML escaping and XSS prevention
- [ ] **Label Formatting**: Converts trait keys to human-readable labels
- [ ] **Architecture Compliance**: Follows codebase patterns (private fields, validation)

## Implementation Details

### File to Create

**Path**: `/src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js`

### Core Interface

```javascript
/**
 * @file TraitsRewriterDisplayEnhancer - Display formatting and export functionality
 * @description Formats rewritten traits for display and handles export operations
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { TraitsRewriterError, TRAITS_REWRITER_ERROR_CODES } from '../errors/TraitsRewriterError.js';

export class TraitsRewriterDisplayEnhancer {
  // Private fields following codebase patterns
  /** @private @type {ILogger} */
  #logger;

  constructor(dependencies) {
    // Validate dependencies using codebase pattern
    this.#validateDependencies(dependencies);

    this.#logger = dependencies.logger;

    this.#logger.info('TraitsRewriterDisplayEnhancer: Initialized successfully');
  }

  /**
   * Enhance traits for display in the UI
   * @param {object} rewrittenTraits - Processed traits from ResponseProcessor
   * @param {string} characterName - Name of the character
   * @param {object} options - Display options
   * @returns {object} Enhanced display data
   */
  enhanceForDisplay(rewrittenTraits, characterName, options = {}) {
    // Implementation details...
  }

  /**
   * Format traits for export operations
   * @param {object} rewrittenTraits - Processed traits
   * @param {string} exportFormat - 'text' or 'json'
   * @param {object} options - Export options
   * @returns {string} Formatted export content
   */
  formatForExport(rewrittenTraits, exportFormat = 'text', options = {}) {
    // Implementation details...
  }

  /**
   * Generate export filename with timestamp
   * @param {string} characterName - Character name for filename
   * @returns {string} Generated filename
   */
  generateExportFilename(characterName) {
    // Implementation details...
  }

  /**
   * Create display sections from enhanced traits
   * @param {object} enhancedTraits - Enhanced trait data
   * @returns {Array<object>} Display sections
   */
  createDisplaySections(enhancedTraits) {
    // Implementation details...
  }

  // Private helper methods
  #escapeHtmlContent(text)
  #createTraitSection(traitKey, traitValue, index)
  #sanitizeForDisplay(content)
  #formatTraitLabel(traitKey)
  #validateDependencies(dependencies)
}
```

### Key Methods Implementation

#### 1. enhanceForDisplay()

Main display enhancement:

- Sanitize trait content for safe HTML display
- Create organized section structure
- Add proper labels and formatting
- Include metadata for display purposes
- Handle empty or missing traits gracefully

#### 2. formatForExport()

Export formatting:

- **Text Format**: Human-readable with section headers
- **JSON Format**: Structured data with metadata
- Include character name and generation timestamp
- Handle export options (include metadata, custom formatting)

#### 3. generateExportFilename()

Filename generation:

- Format: `{character-name}-traits-rewriter-{timestamp}.{ext}`
- Sanitize character names for filesystem safety
- Use ISO timestamp format
- Handle special characters and spaces

#### 4. createDisplaySections()

UI section creation:

- Convert trait keys to human-readable labels
- Create HTML structure expected by the UI
- Add proper CSS classes for styling
- Handle section ordering and presentation

## Dependencies

**Blocking**:

- TRAREW-004 (Application Startup Verified)
- TraitsRewriterError class (created in TRAREW-009)

**External Dependencies**:

- No external service dependencies (minimal service)

**Required Services** (via DI):

- `ILogger` - Logging service (minimal dependencies)

## Testing Requirements

### Unit Tests

Create `/tests/unit/characterBuilder/services/TraitsRewriterDisplayEnhancer.test.js`:

```javascript
describe('TraitsRewriterDisplayEnhancer', () => {
  describe('Constructor Validation', () => {
    it('should validate required dependencies');
    it('should initialize with minimal dependencies');
  });

  describe('Display Enhancement', () => {
    it('should format traits for HTML display');
    it('should escape HTML content safely');
    it('should create proper section structure');
    it('should handle missing traits gracefully');
  });

  describe('Export Formatting', () => {
    it('should format traits for text export');
    it('should format traits for JSON export');
    it('should include character name and metadata');
    it('should handle export options correctly');
  });

  describe('Filename Generation', () => {
    it('should generate descriptive filenames');
    it('should include timestamps in filenames');
    it('should sanitize character names for filesystem');
    it('should handle special characters correctly');
  });

  describe('Section Creation', () => {
    it('should create organized display sections');
    it('should convert trait keys to readable labels');
    it('should add proper CSS classes');
    it('should maintain section ordering');
  });

  describe('Content Safety', () => {
    it('should escape HTML content');
    it('should prevent XSS attacks');
    it('should sanitize display content');
  });
});
```

### Test Data

```javascript
const sampleTraits = {
  'core:personality': 'I am analytical and methodical in my approach.',
  'core:likes': 'I enjoy reading books and solving puzzles.',
  'core:fears': 'I fear being abandoned or seen as incompetent.',
};

const expectedDisplaySections = [
  {
    key: 'core:personality',
    label: 'Personality',
    content: 'I am analytical and methodical in my approach.',
    cssClass: 'trait-section',
    index: 0,
  },
];
```

## Validation Steps

### Step 1: Service Creation

```javascript
const enhancer = container.resolve(tokens.TraitsRewriterDisplayEnhancer);
expect(enhancer).toBeDefined();
```

### Step 2: Display Enhancement Test

```javascript
const displayData = enhancer.enhanceForDisplay(sampleTraits, 'Test Character');
expect(displayData).toHaveProperty('sections');
expect(displayData).toHaveProperty('characterName');
```

### Step 3: Export Formatting Test

```javascript
const textExport = enhancer.formatForExport(sampleTraits, 'text');
expect(textExport).toContain('Personality:');
expect(textExport).toContain('I am analytical');

const jsonExport = enhancer.formatForExport(sampleTraits, 'json');
const parsed = JSON.parse(jsonExport);
expect(parsed).toHaveProperty('rewrittenTraits');
```

## Files Modified

### New Files

- `/src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js` - Main service

### Dependencies Referenced

- `/src/characterBuilder/errors/TraitsRewriterError.js` (created in TRAREW-009)

## Display Structure Expected by UI

The UI expects sections in this format:

```html
<div class="trait-section">
  <h3 class="trait-section-title">Personality</h3>
  <div class="trait-content">I am analytical and methodical...</div>
</div>
```

### Section Data Structure

```javascript
{
  sections: [
    {
      key: 'core:personality',
      label: 'Personality',
      content: 'First-person trait content...',
      cssClass: 'trait-section',
      titleClass: 'trait-section-title',
      contentClass: 'trait-content',
      index: 0
    }
  ],
  characterName: 'Character Name',
  totalSections: 3,
  generatedAt: '2024-01-15T10:30:00Z'
}
```

## Export Format Specifications

### Text Export Format

```
Character: {Character Name}
Generated: {ISO Timestamp}
Rewritten Traits
================

Personality:
I am analytical and methodical in my approach to problems.

Likes:
I enjoy reading books and solving complex puzzles.

Fears:
I fear being abandoned or seen as incompetent.
```

### JSON Export Format

```json
{
  "characterName": "Character Name",
  "rewrittenTraits": {
    "core:personality": "I am analytical...",
    "core:likes": "I enjoy reading...",
    "core:fears": "I fear being..."
  },
  "exportedAt": "2024-01-15T10:30:00Z",
  "exportFormat": "json",
  "traitCount": 3
}
```

## Content Safety Implementation

### HTML Escaping

```javascript
#escapeHtmlContent(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
```

### Content Sanitization

```javascript
#sanitizeForDisplay(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // HTML escape
  let sanitized = this.#escapeHtmlContent(content);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Validate length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + '...';
    this.#logger.warn('Content truncated due to length limit');
  }

  return sanitized;
}
```

## Trait Label Formatting

### Label Conversion Map

```javascript
const TRAIT_LABELS = {
  'core:personality': 'Personality',
  'core:likes': 'Likes',
  'core:dislikes': 'Dislikes',
  'core:fears': 'Fears',
  'core:goals': 'Goals',
  'core:notes': 'Notes',
  'core:profile': 'Profile',
  'core:secrets': 'Secrets',
  'core:strengths': 'Strengths',
  'core:weaknesses': 'Weaknesses'
};

#formatTraitLabel(traitKey) {
  return TRAIT_LABELS[traitKey] ||
         traitKey.replace('core:', '').replace(/([A-Z])/g, ' $1').trim();
}
```

## Filename Sanitization

### Safe Filename Generation

```javascript
generateExportFilename(characterName) {
  // Sanitize character name for filesystem
  const safeName = characterName
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 50); // Limit length

  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-') // Replace colons and dots
    .split('.')[0]; // Remove milliseconds

  return `${safeName}-traits-rewriter-${timestamp}`;
}
```

## Error Handling

### Error Categories

- **EXPORT_FAILED**: Export formatting or generation errors
- **INVALID_FORMAT**: Unsupported export format requested
- **CONTENT_SANITIZATION_FAILED**: Content cleaning errors

### Error Context

- Character name being processed
- Export format requested
- Content length and structure
- Specific formatting failures

## Performance Considerations

### Content Processing

- Efficient string operations
- Memory management for large trait sets
- Batch processing where possible

### Export Generation

- Stream-based export for large content
- Template-based formatting
- Caching for repeated exports

## Success Metrics

- **Display Quality**: Properly formatted and safe HTML content
- **Export Functionality**: Clean, readable export files in multiple formats
- **File Naming**: Descriptive, filesystem-safe filenames
- **Content Safety**: All output is XSS-safe and properly escaped
- **UI Integration**: Compatible with existing UI structure and styling
- **Performance**: Efficient processing without memory leaks

## Next Steps

After completion:

- **TRAREW-008**: Complete TraitsRewriterController integration
- **TRAREW-005**: Integration with TraitsRewriterGenerator
- **TRAREW-013**: Comprehensive unit testing

## Implementation Checklist

- [ ] Create service file with proper imports
- [ ] Implement constructor with dependency validation
- [ ] Implement enhanceForDisplay() method
- [ ] Implement formatForExport() for text format
- [ ] Implement formatForExport() for JSON format
- [ ] Implement generateExportFilename() with sanitization
- [ ] Implement createDisplaySections() method
- [ ] Implement HTML escaping and content sanitization
- [ ] Implement trait label formatting
- [ ] Add comprehensive error handling
- [ ] Create unit tests for all methods
- [ ] Test with various trait combinations
- [ ] Validate export file generation
- [ ] Test content safety measures
