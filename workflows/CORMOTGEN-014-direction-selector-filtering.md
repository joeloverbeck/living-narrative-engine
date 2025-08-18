# CORMOTGEN-014: Build Direction Selector with Filtering

## Ticket ID

CORMOTGEN-014

## Title

Implement direction selector UI component with cliché-based filtering

## Status

TODO

## Priority

HIGH

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-002 (HTML/CSS structure)
- CORMOTGEN-004 (Controller)

## Description

Create the direction selector component that filters to show only directions with associated clichés, with proper UI feedback.

## Technical Requirements

### Key Features

1. **Direction Filtering Logic**
   - Query all directions for concept
   - Check each for associated clichés
   - Display only eligible directions
   - Show helpful message when none eligible

2. **UI Component Structure**

   ```javascript
   class DirectionSelector {
     constructor({ container, onSelect, characterBuilderService }) {
       // Initialize component
     }

     async loadDirections(conceptId) {
       // Load and filter directions
     }

     #renderDirections(directions) {
       // Render direction list
     }

     #createDirectionElement(direction) {
       // Create individual direction UI
     }
   }
   ```

3. **Visual States**
   - Default: Unselected direction
   - Hover: Highlight effect
   - Selected: Border highlight
   - Disabled: Grayed out (no clichés)
   - Loading: Skeleton loader

## Implementation Steps

1. Create DirectionSelector class
2. Implement filtering logic
3. Add rendering methods
4. Handle selection events
5. Add loading states
6. Implement empty state
7. Add accessibility

## Validation Criteria

- [ ] Only shows directions with clichés
- [ ] Selection highlights properly
- [ ] Empty state message shows
- [ ] Loading state works
- [ ] Keyboard navigation works
- [ ] ARIA labels present

## Checklist

- [ ] Create selector class
- [ ] Add filtering logic
- [ ] Implement rendering
- [ ] Add event handlers
- [ ] Style states
- [ ] Add accessibility
- [ ] Test filtering
