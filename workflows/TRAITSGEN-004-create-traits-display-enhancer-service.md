# TRAITSGEN-004: Create Traits Display Enhancer Service

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Foundation/Display Service
- **Priority**: Medium
- **Estimated Effort**: 0.5 days
- **Dependencies**: TRAITSGEN-001 (Trait Model)

## Description
Create a display enhancement service for formatting and presenting trait data in the user interface. This service handles trait organization, display formatting, and export preparation.

## Requirements

### File Creation
- **File**: `src/traitsGenerator/services/TraitsDisplayEnhancer.js`
- **Template**: Follow existing display service patterns from character-builder series
- **Purpose**: Format trait data for optimal UI presentation and user experience

### Core Functionality
Implement trait display enhancement with these capabilities:

```javascript
class TraitsDisplayEnhancer {
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
  }

  /**
   * Enhance traits data for display presentation
   * @param {Object} traitsData - Raw traits data from LLM
   * @param {Object} options - Display options and preferences
   * @returns {Object} Enhanced traits formatted for UI display
   */
  enhanceForDisplay(traitsData, options = {}) {
    // Implementation details below
  }

  /**
   * Format traits for text export
   * @param {Object} traitsData - Enhanced traits data
   * @param {Object} metadata - Generation metadata
   * @returns {string} Formatted text for export
   */
  formatForExport(traitsData, metadata = {}) {
    // Implementation details below
  }

  /**
   * Generate export filename based on traits content
   * @param {Object} traitsData - Enhanced traits data
   * @returns {string} Suggested filename for export
   */
  generateExportFilename(traitsData) {
    // Implementation details below
  }
}
```

### Display Enhancement Features

#### 1. Trait Organization
- **Category Grouping**: Organize traits into logical display sections
- **Priority Ordering**: Order trait categories for optimal user flow
- **Content Structuring**: Structure complex trait data for readability

#### 2. Content Formatting
- **Text Formatting**: Apply proper formatting for different trait types
- **List Presentation**: Format arrays and lists for clean display
- **Rich Content**: Handle structured objects (names with justifications, etc.)

#### 3. UI Enhancement
- **Display Metadata**: Add helpful UI metadata for rendering
- **Visual Indicators**: Add visual cues for different trait categories
- **Interactive Elements**: Prepare data for interactive UI components

### Text Export Implementation

#### Export Format Structure
Create comprehensive text export format:

```text
CHARACTER TRAITS
================

Generated: [timestamp]
Concept: [concept name]
Thematic Direction: [direction name]

NAMES
-----
• [Name 1]: [Justification]
• [Name 2]: [Justification]
[...]

PHYSICAL DESCRIPTION
-------------------
[Physical description content]

PERSONALITY
-----------
• [Trait 1]: [Explanation]
• [Trait 2]: [Explanation]
[...]

STRENGTHS
---------
• [Strength 1]
• [Strength 2]
[...]

[Continue for all trait categories...]

USER INPUTS
-----------
Core Motivation: [User input]
Internal Contradiction: [User input]
Central Question: [User input]

GENERATION METADATA
------------------
Generated At: [ISO timestamp]
LLM Configuration: [Config details]
Prompt Version: [Version info]
```

#### Export Features
- **Clean Formatting**: Human-readable text structure
- **Complete Content**: Include all trait categories and metadata
- **User Context**: Include user inputs and generation details
- **Professional Layout**: Organized sections with clear headers

### Filename Generation

#### Naming Convention
Generate filenames following this pattern:
```
traits_[direction-slug]_[timestamp].txt
```

Example: `traits_haunted-detective_2024-03-15_143022.txt`

#### Filename Components
- **Prefix**: "traits_" for identification
- **Direction Slug**: Sanitized thematic direction name
- **Timestamp**: YYYY-MM-DD_HHMMSS format
- **Extension**: ".txt" for text export

## Technical Implementation

### Dependencies
```javascript
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { assertPresent, assertNonBlankString } from '../../utils/validationUtils.js';
```

### Error Handling
- **Input Validation**: Validate traits data structure
- **Content Validation**: Ensure all required categories present
- **Export Validation**: Validate export content before returning
- **Error Recovery**: Graceful handling of malformed data

### Code Quality Requirements
- Follow camelCase file naming: `TraitsDisplayEnhancer.js`
- Use PascalCase for class: `TraitsDisplayEnhancer`
- Implement comprehensive JSDoc documentation
- Apply proper error handling with descriptive messages
- Use # prefix for private methods and fields

## Acceptance Criteria

### Functional Requirements
- [ ] `enhanceForDisplay()` properly formats traits for UI presentation
- [ ] All trait categories handled with appropriate formatting
- [ ] `formatForExport()` creates clean, readable text export
- [ ] Export includes all trait categories and user context
- [ ] `generateExportFilename()` creates descriptive, unique filenames
- [ ] Handles structured data (names, personality) with proper formatting

### Display Enhancement Requirements
- [ ] Trait categories organized logically for user experience
- [ ] Complex data structures presented clearly
- [ ] Metadata included for UI rendering support
- [ ] Consistent formatting across all trait types

### Export Requirements
- [ ] Text export includes all trait content
- [ ] Professional formatting with clear sections
- [ ] User inputs and generation metadata included
- [ ] Export content is copy-paste friendly
- [ ] Filename generation follows established patterns

### Code Quality Requirements
- [ ] Follows established service patterns
- [ ] Comprehensive error handling for malformed data
- [ ] Clean, readable code with proper documentation
- [ ] Proper validation of input data

### Testing Requirements
- [ ] Create `tests/unit/traitsGenerator/services/TraitsDisplayEnhancer.test.js`
- [ ] Test display enhancement with various trait configurations
- [ ] Test export formatting with complete and partial trait data
- [ ] Test filename generation with different directions
- [ ] Test error handling for invalid input data
- [ ] Achieve 85%+ test coverage

## Files Modified
- **NEW**: `src/traitsGenerator/services/TraitsDisplayEnhancer.js`
- **NEW**: `tests/unit/traitsGenerator/services/TraitsDisplayEnhancer.test.js`

## Dependencies For Next Tickets
This display service is required for:
- TRAITSGEN-005 (Controller Implementation)
- TRAITSGEN-006 (HTML Page Implementation)

## Notes
- Focus on clean, user-friendly formatting for export
- Consider future UI enhancements when designing display structure
- Ensure export format is readable and professional
- Handle edge cases like missing or incomplete trait data gracefully