# Location Portrait Tooltip Implementation Analysis

## Executive Summary

This report analyzes the current location rendering system in the Living Narrative Engine and proposes a solution to prevent display clutter when both a location portrait and description are present. The proposed solution involves implementing a tooltip mechanism for location portraits similar to the existing character portrait tooltips.

## 1. Current Implementation Analysis

### 1.1 Location Display Structure

The location renderer (`locationRenderer.js`) currently displays location information in the following hierarchy:

```
Location Panel
├── Name (h2#location-name-display)
├── Portrait (div#location-portrait-visuals)
│   └── Image (img#location-portrait-image)
├── Description (p#location-description-display)
├── Exits (details.location-card)
└── Characters (details.location-card)
```

### 1.2 Current Behavior

When a location has both a portrait and a description:
- The portrait is displayed as a full-width image
- The description text appears directly below the portrait
- This creates visual clutter and redundancy

The relevant rendering logic is in `locationRenderer.js:540-542`:
```javascript
this.renderName(locationDto);
this.renderPortrait(locationDto);
this.renderDescription(locationDto);
```

Both elements are rendered sequentially without conditional logic to hide the description when a portrait is present.

## 2. Character Portrait Tooltip Mechanism Analysis

### 2.1 Implementation Details

Character portraits with tooltips are implemented in `renderCharacterListItem.js` with the following key features:

1. **HTML Structure**: 
   - Portrait image and name are wrapped in a list item
   - A hidden tooltip span is appended containing the description
   - The tooltip has class `character-tooltip`

2. **Interaction Mechanism**:
   - Click event toggles the `tooltip-open` class on the list item
   - CSS handles visibility based on hover, focus, or the `tooltip-open` class

3. **CSS Implementation** (from `_location-info.css`):
   ```css
   .character-tooltip {
     visibility: hidden;
     opacity: 0;
     position: absolute;
     /* ... positioning and styling ... */
   }
   
   #location-characters-display li:hover > .character-tooltip,
   #location-characters-display li:focus-within > .character-tooltip,
   #location-characters-display li.tooltip-open > .character-tooltip {
     visibility: visible;
     opacity: 1;
   }
   ```

### 2.2 Key Features

- **Accessibility**: Supports keyboard navigation via `:focus-within`
- **Mobile Support**: Click-to-toggle behavior via the `tooltip-open` class
- **Positioning**: Absolute positioning with transform for centering
- **Styling**: Consistent with the application's design system

## 3. Proposed Solution Architecture

### 3.1 Design Goals

1. **Consistency**: Match the behavior of character portrait tooltips
2. **Progressive Enhancement**: Description remains accessible without JavaScript
3. **Minimal Changes**: Leverage existing CSS and patterns
4. **Backward Compatibility**: Support locations without portraits

### 3.2 Implementation Strategy

#### 3.2.1 Conditional Description Rendering

Modify the `renderDescription` method to conditionally render based on portrait presence:

```javascript
renderDescription(locationDto) {
  DomUtils.clearElement(this.elements.descriptionDisplay);
  
  // Only show inline description if no portrait
  if (!locationDto.portraitPath && locationDto.description) {
    const pDesc = this.domElementFactory.p(
      undefined,
      locationDto.description || DEFAULT_LOCATION_DESCRIPTION
    );
    if (pDesc) {
      this.elements.descriptionDisplay.appendChild(pDesc);
    }
  }
}
```

#### 3.2.2 Portrait Tooltip Integration

Enhance `renderPortraitElements.js` to include tooltip functionality:

```javascript
export function renderPortraitElements(
  imageElement,
  visualsElement,
  locationDto,
  logger,
  domFactory,
  documentContext,
  addListener
) {
  if (!imageElement || !visualsElement) {
    logger.warn('[renderPortraitElements] portrait elements missing.');
    return;
  }

  if (locationDto.portraitPath) {
    // Set up the portrait image
    imageElement.src = locationDto.portraitPath;
    imageElement.alt = locationDto.portraitAltText || `Image of ${locationDto.name || 'location'}`;
    imageElement.style.display = 'block';
    visualsElement.style.display = 'flex';
    
    // Add tooltip if description exists
    if (locationDto.description && locationDto.description.trim()) {
      // Remove any existing tooltip
      const existingTooltip = visualsElement.querySelector('.location-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }
      
      // Create new tooltip
      const tooltip = documentContext.document.createElement('span');
      tooltip.classList.add('location-tooltip');
      tooltip.innerHTML = DomUtils.textToHtml(locationDto.description);
      visualsElement.appendChild(tooltip);
      
      // Add interaction handler
      const handler = () => visualsElement.classList.toggle('tooltip-open');
      if (addListener) {
        addListener(visualsElement, 'click', handler);
      } else {
        visualsElement.addEventListener('click', handler);
      }
    }
  } else {
    // Hide portrait elements
    visualsElement.style.display = 'none';
    imageElement.style.display = 'none';
    imageElement.src = '';
    imageElement.alt = '';
  }
}
```

#### 3.2.3 CSS Updates

The existing CSS already includes a `.location-tooltip` class that extends `.character-tooltip`. We need to add hover/focus rules:

```css
#location-portrait-visuals:hover > .location-tooltip,
#location-portrait-visuals:focus-within > .location-tooltip,
#location-portrait-visuals.tooltip-open > .location-tooltip {
  visibility: visible;
  opacity: 1;
}

/* Ensure the portrait container can receive focus for keyboard accessibility */
#location-portrait-visuals {
  cursor: pointer;
  outline-offset: 2px;
}

#location-portrait-visuals:focus {
  outline: 2px solid var(--focus-color);
}
```

## 4. Implementation Recommendations

### 4.1 Required Changes

1. **locationRenderer.js**:
   - Update `renderDescription` to conditionally render based on portrait presence
   - Pass additional dependencies to `renderPortraitElements`

2. **renderPortraitElements.js**:
   - Add parameters for DOM factory, document context, and event listener binding
   - Implement tooltip creation and interaction logic
   - Handle cleanup of existing tooltips

3. **_location-info.css**:
   - Add hover/focus rules for location portrait tooltips
   - Ensure proper focus styling for accessibility

### 4.2 Testing Considerations

1. **Unit Tests**:
   - Test conditional description rendering logic
   - Test tooltip creation when both portrait and description exist
   - Test cleanup of existing tooltips
   - Test event handler binding

2. **Integration Tests**:
   - Verify tooltip appears on hover/click
   - Verify description shows inline when no portrait exists
   - Test keyboard navigation
   - Test mobile touch interactions

3. **Visual Regression Tests**:
   - Ensure tooltip positioning is correct
   - Verify no visual artifacts when switching locations
   - Test responsive behavior

## 5. Technical Considerations

### 5.1 Performance

- Minimal performance impact as we're reusing existing patterns
- Event delegation could be considered for multiple location portraits in the future
- Tooltip content is only created when needed (portrait + description exist)

### 5.2 Accessibility

- Maintain keyboard navigation support via `:focus-within`
- Consider adding ARIA attributes for screen readers:
  - `aria-describedby` on the portrait linking to the tooltip
  - `role="tooltip"` on the tooltip element
  - `tabindex="0"` on the portrait container for keyboard focus

### 5.3 Mobile Considerations

- Click-to-toggle behavior ensures mobile users can access descriptions
- Touch target size should be adequate (portrait images are full-width)
- Consider adding a visual indicator (e.g., info icon) to show tooltip availability

### 5.4 Future Enhancements

1. **Animation**: Add transition effects for tooltip appearance
2. **Smart Positioning**: Adjust tooltip position based on viewport constraints
3. **Rich Content**: Support for formatted text or additional media in tooltips
4. **Persistence**: Option to keep tooltip open while hovering over it

## 6. Conclusion

The proposed solution elegantly solves the visual clutter issue by:
- Reusing existing tooltip patterns from character portraits
- Maintaining accessibility and mobile support
- Requiring minimal code changes
- Preserving backward compatibility

This approach ensures a consistent user experience across the application while improving the visual hierarchy of location displays. The implementation leverages existing infrastructure, reducing development time and potential bugs.

The solution follows the project's established patterns and maintains the modular, testable architecture of the Living Narrative Engine.