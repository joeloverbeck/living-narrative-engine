# CORMOTGEN-015: Create Motivations Display Components

## Ticket ID

CORMOTGEN-015

## Title

Build motivation block display components with card-based layout

## Status

TODO

## Priority

HIGH

## Estimated Effort

4-5 hours

## Dependencies

- CORMOTGEN-002 (HTML/CSS)
- CORMOTGEN-006 (CoreMotivation model)

## Description

Create the display components for showing motivation blocks in a card-based layout with proper visual hierarchy.

## Technical Requirements

### File: `src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js`

Key Features:

1. **Motivation Card Creation**

   ```javascript
   createMotivationBlock(motivation) {
     const card = document.createElement('div');
     card.className = 'motivation-block';
     card.dataset.motivationId = motivation.id;

     // Add header with timestamp and actions
     // Add content sections
     // Add interactive elements

     return card;
   }
   ```

2. **Content Sections**
   - Core Motivation (primary highlight)
   - Contradiction/Conflict (secondary)
   - Central Question (emphasized)
   - Metadata (timestamp, model info)

3. **Interactive Elements**
   - Copy button per block
   - Delete button with confirmation
   - Expand/collapse for long content
   - Hover effects

4. **Animation**
   - Slide-in on creation
   - Fade-out on deletion
   - Smooth transitions

## Implementation Steps

1. Create display enhancer class
2. Implement card creation
3. Add content formatting
4. Create action buttons
5. Add animations
6. Implement delete handling
7. Add copy functionality

## Validation Criteria

- [ ] Cards display all content
- [ ] Visual hierarchy is clear
- [ ] Actions work correctly
- [ ] Animations are smooth
- [ ] Responsive on mobile
- [ ] Accessibility compliant

## Checklist

- [ ] Create enhancer class
- [ ] Build card structure
- [ ] Format content sections
- [ ] Add action buttons
- [ ] Implement animations
- [ ] Handle interactions
- [ ] Test responsiveness
