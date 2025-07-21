# Rich Text Notes Tooltip Display Specification

## Overview

This specification outlines the implementation of a rich text display for notes tooltips in the Living Narrative Engine's speech bubble system. Currently, notes appear as plain text without proper formatting or line breaks, making it difficult to read structured content with multiple notes.

## Problem Statement

### Current Issues

1. **Line breaks not respected**: Multiple notes appear as a continuous string
2. **Plain text display**: No visual distinction between different note properties
3. **Poor readability**: Difficult to distinguish between multiple notes
4. **Lost structure**: The rich structure of note objects (subject, subjectType, context, tags) is flattened into plain text

### Current Implementation

- Notes are formatted in `noteFormatter.js` using simple string concatenation
- The tooltip displays the formatted string as plain text in `buildSpeechMeta.js`
- CSS styling is minimal, focusing only on positioning and basic appearance

## Desired Functionality

### Rich Text Display Requirements

1. **Structured display** of each note showing:
   - Subject (with visual emphasis)
   - Subject type (as a styled badge/label)
   - Note text (main content)
   - Context (if present, in subdued text)
   - Tags (as styled chips/badges)
   - Timestamp (optional, in small text)

2. **Clear separation** between multiple notes:
   - Visual dividers or spacing
   - Alternating background colors or borders
   - Numbered or bulleted presentation

3. **Enhanced readability**:
   - Proper line breaks and spacing
   - Typography hierarchy
   - Color coding for different elements
   - Icons for subject types

## Technical Implementation

### 1. HTML Structure Changes

#### Current Structure (buildSpeechMeta.js)

```javascript
const tooltip = domFactory.create('div', { cls: 'meta-tooltip' });
tooltip.textContent = notes; // Plain text
```

#### Proposed Structure

```javascript
const tooltip = domFactory.create('div', {
  cls: 'meta-tooltip meta-tooltip--notes',
});
tooltip.innerHTML = formatNotesAsRichHTML(notes); // Rich HTML content
```

### 2. New Formatting Function

Create a new function `formatNotesAsRichHTML` in a new module `src/domUI/helpers/noteTooltipFormatter.js`:

```javascript
/**
 * Formats notes data into rich HTML for tooltip display
 * @param {string|Array} notesData - Raw notes data (could be formatted string or array)
 * @returns {string} HTML string for tooltip content
 */
export function formatNotesAsRichHTML(notesData) {
  // Parse the notes data if it's a string
  // Convert to structured format if needed
  // Generate HTML with proper structure
}
```

### 3. HTML Template Structure

For a single note:

```html
<div class="note-item">
  <div class="note-header">
    <span class="note-subject-type" data-type="character">
      <i class="icon icon--character"></i>
      Character
    </span>
    <span class="note-subject">Alice</span>
  </div>
  <div class="note-content">Seems nervous about the upcoming meeting</div>
  <div class="note-meta">
    <span class="note-context">During conversation in the garden</span>
    <div class="note-tags">
      <span class="note-tag">emotion</span>
      <span class="note-tag">observation</span>
    </div>
  </div>
</div>
```

For multiple notes:

```html
<div class="notes-container">
  <div class="notes-header">
    <span class="notes-count">3 Notes</span>
  </div>
  <div class="notes-list">
    <div class="note-item">...</div>
    <div class="note-divider"></div>
    <div class="note-item">...</div>
    <div class="note-divider"></div>
    <div class="note-item">...</div>
  </div>
</div>
```

### 4. CSS Styling

Add new styles to `css/components/_speech-bubbles.css`:

```css
/* Enhanced tooltip for notes */
.meta-tooltip--notes {
  max-width: 600px;
  min-width: 400px;
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
}

/* Notes container */
.notes-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notes-header {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 6px;
  margin-bottom: 8px;
}

/* Individual note */
.note-item {
  background: var(--bg-subtle);
  border-radius: 6px;
  padding: 10px;
  transition: background-color 0.2s;
}

.note-item:hover {
  background: var(--bg-hover);
}

/* Note header */
.note-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.note-subject-type {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--badge-bg);
  color: var(--badge-text);
}

.note-subject-type[data-type='character'] {
  background: var(--type-character-bg);
  color: var(--type-character-text);
}
.note-subject-type[data-type='location'] {
  background: var(--type-location-bg);
  color: var(--type-location-text);
}
.note-subject-type[data-type='event'] {
  background: var(--type-event-bg);
  color: var(--type-event-text);
}
/* ... other types ... */

.note-subject {
  font-weight: 600;
  color: var(--text-primary);
}

/* Note content */
.note-content {
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 6px;
}

/* Note metadata */
.note-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.note-context {
  font-size: 0.813rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.note-tag {
  display: inline-block;
  padding: 2px 6px;
  background: var(--tag-bg);
  color: var(--tag-text);
  border-radius: 10px;
  font-size: 0.75rem;
}

/* Note divider */
.note-divider {
  height: 1px;
  background: var(--border-light);
  margin: 8px 0;
}

/* Scrollbar styling for long notes */
.meta-tooltip--notes::-webkit-scrollbar {
  width: 6px;
}

.meta-tooltip--notes::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.meta-tooltip--notes::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
```

### 5. Implementation Steps

1. **Create new formatter module** (`noteTooltipFormatter.js`)
   - Parse notes data (handle both string and structured formats)
   - Generate rich HTML based on note structure
   - Handle edge cases (missing fields, malformed data)

2. **Update buildSpeechMeta.js**
   - Import the new formatter
   - Replace `textContent` with `innerHTML` for notes tooltip
   - Add security considerations for HTML injection

3. **Add CSS variables to theme**
   - Define color variables for different subject types
   - Add variables for badges, tags, and metadata styling

4. **Add icons for subject types** (optional enhancement)
   - Character: person icon
   - Location: map pin icon
   - Event: calendar icon
   - Item: box icon
   - etc.

### 6. Data Flow

1. **Notes data arrives** in `speechBubbleRenderer.js` as part of the payload
2. **buildSpeechMeta** receives the notes (already formatted as a string by `noteFormatter.js`)
3. **Parse the formatted string** back into structured data (or modify flow to pass structured data)
4. **Generate rich HTML** using the new formatter
5. **Display in tooltip** with enhanced styling

### 7. Backward Compatibility

- The implementation should handle both old-style string notes and new structured notes
- Fallback to plain text display if parsing fails
- Maintain the existing tooltip behavior for non-notes metadata (thoughts)

### 8. Security Considerations

- Sanitize HTML content to prevent XSS attacks
- Escape user-generated content properly
- Use a whitelist approach for allowed HTML tags and attributes

### 9. Testing Requirements

1. **Unit tests** for the new formatter function
2. **Integration tests** for the tooltip display
3. **Visual regression tests** for styling
4. **Edge cases**:
   - Empty notes array
   - Single note vs. multiple notes
   - Missing optional fields
   - Very long content
   - Special characters in text

### 10. Performance Considerations

- Limit the number of notes displayed (e.g., show first 10 with "and X more...")
- Lazy render tooltip content on hover
- Use CSS containment for tooltip performance

## Visual Mockup

```
┌─────────────────────────────────────────┐
│ 3 Notes                                 │
│─────────────────────────────────────────│
│ ┌─────────────────────────────────────┐ │
│ │ [Character] Alice                   │ │
│ │ Seems nervous about the meeting    │ │
│ │ During garden conversation          │ │
│ │ [emotion] [observation]             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Location] Old Library              │ │
│ │ Dusty and abandoned, perfect for   │ │
│ │ secret meetings                     │ │
│ │ While exploring the mansion         │ │
│ │ [atmosphere] [discovery]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Event] Strange Noise               │ │
│ │ Heard scratching sounds from the   │ │
│ │ walls at midnight                   │ │
│ │ [mystery] [investigation]           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Alternative Approach: Modify Data Flow

Instead of parsing formatted strings, modify the data flow to pass structured note data directly to the tooltip:

1. **Modify buildSpeechPayload.js** to pass raw notes data instead of formatted string
2. **Update buildSpeechMeta.js** to handle structured data
3. **Format directly in the tooltip generation**

This approach would be cleaner but requires more changes to the existing flow.

## Conclusion

This specification provides a comprehensive plan for enhancing the notes tooltip display with rich text formatting. The implementation will significantly improve readability and user experience when viewing character notes in the game.
