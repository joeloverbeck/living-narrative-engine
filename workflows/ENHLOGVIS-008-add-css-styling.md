# ENHLOGVIS-008: Add CSS Styling for Notification Components

## Ticket Overview
**Type**: Styling/UI  
**Component**: UI/CSS  
**Priority**: High  
**Phase**: 2 - Visual Notifications  
**Estimated Effort**: 2-3 hours  

## Objective
Create comprehensive CSS styling for the critical log notification system, ensuring the UI is visually appealing, accessible, and doesn't interfere with the main application's gameplay or UI elements.

## Current State
- DOM structure created (ENHLOGVIS-007)
- No styling applied
- No visual distinction between warnings and errors
- No responsive design considerations

## Technical Implementation

### Files to Create
- `css/critical-log-notifier.css` - Main stylesheet
- Update `index.html` and `game.html` to include stylesheet

### CSS Implementation

1. **Create Main Stylesheet** (`css/critical-log-notifier.css`):
   ```css
   /**
    * Critical Log Notifier Styles
    * Provides visual notification system for warnings and errors
    */
   
   /* Container and positioning */
   .lne-critical-log-notifier {
     position: fixed;
     z-index: 10000;
     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
     font-size: 14px;
     line-height: 1.5;
     user-select: none;
     pointer-events: none; /* Allow click-through except on interactive elements */
   }
   
   .lne-critical-log-notifier > * {
     pointer-events: auto; /* Re-enable pointer events for children */
   }
   
   /* Position variants */
   .lne-critical-log-notifier[data-position="top-left"] {
     top: 20px;
     left: 20px;
   }
   
   .lne-critical-log-notifier[data-position="top-right"] {
     top: 20px;
     right: 20px;
   }
   
   .lne-critical-log-notifier[data-position="bottom-left"] {
     bottom: 20px;
     left: 20px;
   }
   
   .lne-critical-log-notifier[data-position="bottom-right"] {
     bottom: 20px;
     right: 20px;
   }
   
   /* Badge container */
   .lne-badge-container {
     display: flex;
     gap: 8px;
     padding: 8px;
     background: rgba(30, 30, 30, 0.95);
     border-radius: 8px;
     box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
     cursor: pointer;
     transition: transform 0.2s ease, box-shadow 0.2s ease;
     backdrop-filter: blur(10px);
     border: 1px solid rgba(255, 255, 255, 0.1);
   }
   
   .lne-badge-container:hover {
     transform: scale(1.05);
     box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
   }
   
   .lne-badge-container:active {
     transform: scale(0.98);
   }
   
   /* Warning badge */
   .lne-warning-badge {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     min-width: 24px;
     height: 24px;
     padding: 0 6px;
     background: linear-gradient(135deg, #f59e0b, #d97706);
     color: white;
     font-weight: 600;
     font-size: 12px;
     border-radius: 12px;
     box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
     animation: pulse-warning 2s infinite;
   }
   
   @keyframes pulse-warning {
     0%, 100% {
       box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
     }
     50% {
       box-shadow: 0 2px 8px rgba(245, 158, 11, 0.6);
     }
   }
   
   /* Error badge */
   .lne-error-badge {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     min-width: 24px;
     height: 24px;
     padding: 0 6px;
     background: linear-gradient(135deg, #ef4444, #dc2626);
     color: white;
     font-weight: 600;
     font-size: 12px;
     border-radius: 12px;
     box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
     animation: pulse-error 2s infinite;
   }
   
   @keyframes pulse-error {
     0%, 100% {
       box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
     }
     50% {
       box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
     }
   }
   
   /* Hide badges when count is 0 */
   .lne-warning-badge[hidden],
   .lne-error-badge[hidden] {
     display: none;
   }
   
   /* Log panel */
   .lne-log-panel {
     position: absolute;
     top: calc(100% + 8px);
     right: 0;
     width: 400px;
     max-width: 90vw;
     max-height: 500px;
     background: rgba(30, 30, 30, 0.98);
     border-radius: 8px;
     box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
     overflow: hidden;
     backdrop-filter: blur(10px);
     border: 1px solid rgba(255, 255, 255, 0.1);
     animation: slideDown 0.3s ease;
   }
   
   @keyframes slideDown {
     from {
       opacity: 0;
       transform: translateY(-10px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }
   
   .lne-log-panel[hidden] {
     display: none;
   }
   
   /* Adjust panel position for bottom positions */
   .lne-critical-log-notifier[data-position^="bottom"] .lne-log-panel {
     top: auto;
     bottom: calc(100% + 8px);
     animation-name: slideUp;
   }
   
   @keyframes slideUp {
     from {
       opacity: 0;
       transform: translateY(10px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }
   
   /* Panel header */
   .lne-log-header {
     display: flex;
     align-items: center;
     justify-content: space-between;
     padding: 12px 16px;
     background: rgba(20, 20, 20, 0.8);
     border-bottom: 1px solid rgba(255, 255, 255, 0.1);
   }
   
   .lne-log-header > span {
     color: #e5e5e5;
     font-weight: 600;
     font-size: 14px;
   }
   
   /* Header buttons */
   .lne-clear-btn,
   .lne-close-btn {
     padding: 4px 8px;
     background: rgba(255, 255, 255, 0.1);
     color: #e5e5e5;
     border: 1px solid rgba(255, 255, 255, 0.2);
     border-radius: 4px;
     font-size: 12px;
     cursor: pointer;
     transition: background 0.2s ease, color 0.2s ease;
     margin-left: 8px;
   }
   
   .lne-clear-btn:hover,
   .lne-close-btn:hover {
     background: rgba(255, 255, 255, 0.2);
     color: white;
   }
   
   .lne-close-btn {
     width: 24px;
     height: 24px;
     padding: 0;
     display: flex;
     align-items: center;
     justify-content: center;
     font-size: 18px;
     line-height: 1;
   }
   
   /* Log list */
   .lne-log-list {
     max-height: 400px;
     overflow-y: auto;
     padding: 8px;
   }
   
   /* Custom scrollbar */
   .lne-log-list::-webkit-scrollbar {
     width: 8px;
   }
   
   .lne-log-list::-webkit-scrollbar-track {
     background: rgba(255, 255, 255, 0.05);
   }
   
   .lne-log-list::-webkit-scrollbar-thumb {
     background: rgba(255, 255, 255, 0.2);
     border-radius: 4px;
   }
   
   .lne-log-list::-webkit-scrollbar-thumb:hover {
     background: rgba(255, 255, 255, 0.3);
   }
   
   /* Log entries */
   .lne-log-entry {
     display: flex;
     align-items: flex-start;
     gap: 8px;
     padding: 8px;
     margin-bottom: 4px;
     background: rgba(255, 255, 255, 0.05);
     border-radius: 4px;
     border-left: 3px solid transparent;
     transition: background 0.2s ease;
     animation: fadeIn 0.3s ease;
   }
   
   @keyframes fadeIn {
     from {
       opacity: 0;
       transform: translateX(-10px);
     }
     to {
       opacity: 1;
       transform: translateX(0);
     }
   }
   
   .lne-log-entry:hover {
     background: rgba(255, 255, 255, 0.08);
   }
   
   /* Warning entry */
   .lne-log-entry.lne-log-warn {
     border-left-color: #f59e0b;
   }
   
   .lne-log-entry.lne-log-warn .lne-log-level {
     background: #f59e0b;
   }
   
   /* Error entry */
   .lne-log-entry.lne-log-error {
     border-left-color: #ef4444;
   }
   
   .lne-log-entry.lne-log-error .lne-log-level {
     background: #ef4444;
   }
   
   /* Log entry components */
   .lne-log-time {
     color: #9ca3af;
     font-size: 12px;
     font-family: 'Monaco', 'Menlo', monospace;
     white-space: nowrap;
   }
   
   .lne-log-level {
     padding: 2px 6px;
     color: white;
     font-size: 10px;
     font-weight: 600;
     border-radius: 3px;
     text-transform: uppercase;
     white-space: nowrap;
   }
   
   .lne-log-category {
     color: #60a5fa;
     font-size: 12px;
     font-style: italic;
   }
   
   .lne-log-message {
     flex: 1;
     color: #e5e5e5;
     font-size: 13px;
     line-height: 1.4;
     word-break: break-word;
   }
   
   .lne-log-meta-indicator {
     color: #9ca3af;
     font-size: 12px;
     cursor: help;
   }
   
   /* Responsive design */
   @media (max-width: 640px) {
     .lne-log-panel {
       width: calc(100vw - 40px);
       max-height: 300px;
     }
     
     .lne-log-entry {
       flex-direction: column;
       gap: 4px;
     }
     
     .lne-log-time {
       font-size: 11px;
     }
   }
   
   /* Dark mode adjustments (already dark by default) */
   @media (prefers-color-scheme: light) {
     .lne-badge-container {
       background: rgba(255, 255, 255, 0.95);
       border-color: rgba(0, 0, 0, 0.1);
     }
     
     .lne-log-panel {
       background: rgba(255, 255, 255, 0.98);
       border-color: rgba(0, 0, 0, 0.1);
     }
     
     .lne-log-header {
       background: rgba(250, 250, 250, 0.9);
       border-bottom-color: rgba(0, 0, 0, 0.1);
     }
     
     .lne-log-header > span,
     .lne-log-message {
       color: #1f2937;
     }
     
     .lne-clear-btn,
     .lne-close-btn {
       background: rgba(0, 0, 0, 0.05);
       color: #1f2937;
       border-color: rgba(0, 0, 0, 0.1);
     }
     
     .lne-log-entry {
       background: rgba(0, 0, 0, 0.02);
     }
     
     .lne-log-entry:hover {
       background: rgba(0, 0, 0, 0.05);
     }
   }
   
   /* Accessibility improvements */
   .lne-badge-container:focus-visible,
   .lne-clear-btn:focus-visible,
   .lne-close-btn:focus-visible {
     outline: 2px solid #60a5fa;
     outline-offset: 2px;
   }
   
   /* Dragging styles (for ENHLOGVIS-010) */
   .lne-critical-log-notifier.dragging {
     cursor: move;
     opacity: 0.8;
   }
   
   /* Print styles */
   @media print {
     .lne-critical-log-notifier {
       display: none;
     }
   }
   ```

2. **Update HTML files to include stylesheet**:

   **In `index.html`**:
   ```html
   <!-- Add in <head> section -->
   <link rel="stylesheet" href="css/critical-log-notifier.css">
   ```

   **In `game.html`**:
   ```html
   <!-- Add in <head> section -->
   <link rel="stylesheet" href="css/critical-log-notifier.css">
   ```

3. **Create CSS variables for theming** (optional enhancement):
   ```css
   :root {
     /* Critical Log Notifier Theme Variables */
     --lne-notifier-bg: rgba(30, 30, 30, 0.95);
     --lne-notifier-border: rgba(255, 255, 255, 0.1);
     --lne-notifier-text: #e5e5e5;
     --lne-notifier-text-muted: #9ca3af;
     --lne-warning-color: #f59e0b;
     --lne-error-color: #ef4444;
     --lne-panel-width: 400px;
     --lne-panel-max-height: 500px;
   }
   ```

## Dependencies
- **Depends On**: ENHLOGVIS-007 (DOM structure must exist)
- **Required By**: ENHLOGVIS-010 (Drag styles)
- **Required By**: ENHLOGVIS-011 (Filter styles)

## Acceptance Criteria
- [ ] Badge container is visually distinct and noticeable
- [ ] Warning badges are yellow/orange colored
- [ ] Error badges are red colored
- [ ] Panel has dark theme by default
- [ ] Light theme support via media query
- [ ] Smooth animations for show/hide
- [ ] Responsive design for mobile devices
- [ ] Custom scrollbar in log list
- [ ] Hover states for interactive elements
- [ ] Focus indicators for accessibility
- [ ] Z-index ensures notifier is above game content
- [ ] Styles don't leak to main application

## Testing Requirements

### Visual Testing
1. Verify badge appearance in all positions
2. Test warning badge color and animation
3. Test error badge color and animation
4. Verify panel slides correctly based on position
5. Test hover states on all buttons
6. Verify focus states for keyboard navigation
7. Test responsive design on mobile
8. Verify light mode if system preference set
9. Test with long messages (truncation)
10. Verify no style conflicts with game

### Browser Testing
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Android)

### Accessibility Testing
- Keyboard navigation visible focus
- Color contrast ratios meet WCAG AA
- Animations respect prefers-reduced-motion
- Screen reader compatibility

## Code Review Checklist
- [ ] CSS follows BEM-like naming convention
- [ ] No use of !important unless necessary
- [ ] Animations are performant (GPU accelerated)
- [ ] Responsive breakpoints appropriate
- [ ] Print styles included
- [ ] CSS is minifiable

## Notes
- Consider CSS-in-JS or CSS Modules in future for better isolation
- Animation timing should not be too distracting during gameplay
- Z-index value may need adjustment based on game UI layers
- Consider adding theme customization options in future

## Related Tickets
- **Depends On**: ENHLOGVIS-007
- **Next**: ENHLOGVIS-009 (Integration tests)
- **Enhances**: ENHLOGVIS-010, ENHLOGVIS-011