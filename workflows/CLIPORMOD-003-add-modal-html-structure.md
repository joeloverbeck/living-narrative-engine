# CLIPORMOD-003: Add Portrait Modal HTML Structure

## Status
🔴 NOT STARTED

## Priority
HIGH - Required for modal to function

## Dependencies
- None (can be done in parallel with CLIPORMOD-001 and CLIPORMOD-002)

## Description
Add the portrait modal HTML structure to the main HTML file. This provides the DOM elements that the PortraitModalRenderer will interact with. The structure must include all necessary ARIA attributes for accessibility and match the class names used in the CSS.

## File to Modify
Main HTML file (likely `index.html` or similar - needs to be identified)

## HTML Structure to Add

### Complete Modal Structure
```html
<!-- Portrait Modal - Add this before closing </body> tag -->
<div class="portrait-modal-overlay modal-overlay" 
     role="dialog" 
     aria-modal="true" 
     aria-labelledby="portrait-modal-title"
     aria-describedby="portrait-modal-description"
     style="display: none;">
  
  <div class="portrait-modal-content modal-content">
    <!-- Modal Header -->
    <div class="portrait-modal-header">
      <h2 id="portrait-modal-title" class="portrait-modal-title">
        Character Portrait
      </h2>
      <button class="portrait-modal-close" 
              aria-label="Close portrait modal"
              type="button">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    
    <!-- Modal Body -->
    <div class="portrait-modal-body">
      <div class="portrait-image-container">
        <!-- Loading Spinner -->
        <div class="portrait-loading-spinner" 
             role="status" 
             aria-live="polite">
          <span class="sr-only">Loading portrait...</span>
          <span aria-hidden="true">Loading...</span>
        </div>
        
        <!-- Main Portrait Image -->
        <img class="portrait-modal-image" 
             src="" 
             alt=""
             role="img"
             aria-describedby="portrait-modal-description" />
        
        <!-- Error Message -->
        <div class="portrait-error-message" 
             role="alert" 
             aria-live="assertive"
             style="display: none;">
          <span class="error-icon" aria-hidden="true">⚠️</span>
          <span class="error-text">Failed to load portrait</span>
        </div>
      </div>
    </div>
    
    <!-- Hidden description for screen readers -->
    <div id="portrait-modal-description" class="sr-only">
      High resolution portrait image viewer for character artwork
    </div>
  </div>
</div>
```

### Screen Reader Only Styles
If not already present in the CSS, add these utility classes:
```html
<style>
  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  /* Ensure sr-only content is visible when focused */
  .sr-only:focus {
    position: absolute;
    width: auto;
    height: auto;
    padding: var(--spacing-sm);
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
    z-index: 1000;
    background: var(--panel-bg-color);
    border: 1px solid var(--border-color-subtle);
  }
</style>
```

## Implementation Steps

### 1. Locate Main HTML File
- Find the main HTML file (index.html or game.html)
- Identify where other modals are placed in the DOM
- Check for existing modal containers or sections

### 2. Add Modal Structure
- Insert the complete modal HTML before the closing `</body>` tag
- Ensure it's at the same DOM level as other modals (not nested)
- Verify no ID or class conflicts with existing elements

### 3. Verify CSS Import
- Ensure the new `_portrait-modal.css` file is imported
- Add to CSS bundle or link tag as appropriate:
```html
<link rel="stylesheet" href="css/components/_portrait-modal.css">
```
Or in main CSS file:
```css
@import 'components/_portrait-modal.css';
```

### 4. Add Keyboard Trap Prevention
If not already present, add this to prevent keyboard trap:
```html
<!-- Skip link for keyboard users -->
<a href="#main-content" class="skip-link">Skip to main content</a>
```

## Accessibility Requirements

### ARIA Attributes
- `role="dialog"` - Identifies the modal as a dialog
- `aria-modal="true"` - Indicates modal behavior
- `aria-labelledby` - Points to the title element
- `aria-describedby` - Points to description element
- `aria-label` - Provides accessible names for buttons
- `aria-live` - Announces dynamic content changes
- `role="alert"` - For error messages
- `role="status"` - For loading states

### Semantic HTML
- Use `<h2>` for modal title (appropriate heading level)
- Use `<button>` for close button (not `<div>` or `<span>`)
- Use `<img>` for portrait (not background image)

### Focus Management Support
The HTML structure supports:
- Initial focus on close button
- Tab cycling within modal
- Focus return to trigger element on close

## Testing Checklist

### Manual Testing
- [ ] Modal HTML is present in the DOM
- [ ] No console errors when page loads
- [ ] Elements are accessible via DevTools
- [ ] ARIA attributes are properly set
- [ ] No duplicate IDs in the document

### Accessibility Testing
- [ ] Screen reader announces modal properly
- [ ] All interactive elements are keyboard accessible
- [ ] ARIA live regions work for dynamic content
- [ ] No accessibility warnings in browser tools

### Integration Testing
- [ ] Modal structure matches CSS selectors
- [ ] JavaScript can query all required elements
- [ ] No conflicts with existing modal systems
- [ ] Loading/error states can be toggled

## Validation

### HTML Validation
Run through W3C HTML validator to ensure:
- Valid HTML5 structure
- Proper ARIA usage
- No nesting violations
- Correct attribute usage

### WCAG Compliance
Verify with accessibility tools:
- axe DevTools
- WAVE
- Lighthouse
- NVDA/JAWS testing

## Success Criteria
- [ ] Modal HTML structure is added to main HTML file
- [ ] All class names match CSS file (CLIPORMOD-002)
- [ ] All IDs are unique in the document
- [ ] ARIA attributes are properly implemented
- [ ] Screen reader utility classes are available
- [ ] CSS file is properly imported
- [ ] No HTML validation errors
- [ ] Structure supports all required functionality
- [ ] Accessibility requirements are met

## Notes
- The modal should be a direct child of `<body>` for proper z-index stacking
- Ensure the modal is outside any containers with `overflow: hidden`
- The initial `style="display: none;"` prevents flash of unstyled content
- Consider adding a comment to mark this as the portrait modal for future maintenance