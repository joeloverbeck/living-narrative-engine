# ENHLOGVIS-007: Implement Notification Badge and Panel UI

## Ticket Overview
**Type**: UI Implementation  
**Component**: UI/Logging System  
**Priority**: High  
**Phase**: 2 - Visual Notifications  
**Estimated Effort**: 3-4 hours  

## Objective
Implement the complete UI for the critical log notification system, including the floating badge with counts, expandable panel with log details, and all user interaction handlers.

## Current State
- CriticalLogNotifier class structure exists (ENHLOGVIS-005)
- Integration with HybridLogger complete (ENHLOGVIS-006)
- No actual UI rendering or event handling implemented
- No visual feedback for critical logs

## Technical Implementation

### Files to Create/Modify
- `src/logging/criticalLogNotifierEvents.js` - Event handling implementation
- `src/logging/ui/notificationDOMHelpers.js` - DOM utility functions
- Update rendering logic in `criticalLogNotifierRenderer.js`

### Implementation Steps

1. **Event Handler Implementation** (`criticalLogNotifierEvents.js`):
   ```javascript
   /**
    * @file Event handling for critical log notifier UI
    */
   
   import { validateDependency } from '../utils/dependencyUtils.js';
   
   class CriticalLogNotifierEvents {
     #callbacks;
     #container;
     #logger;
     #listeners = new Map();
     #isDragging = false;
     #dragOffset = { x: 0, y: 0 };
     
     constructor({ onExpand, onCollapse, onDismiss, onClear, onPositionChange, logger }) {
       validateDependency(logger, 'ILogger', console, {
         requiredMethods: ['debug', 'error']
       });
       
       this.#logger = logger;
       this.#callbacks = {
         onExpand,
         onCollapse,
         onDismiss,
         onClear,
         onPositionChange
       };
     }
     
     attachToContainer(container) {
       this.#container = container;
       this.#attachEventListeners();
     }
     
     #attachEventListeners() {
       // Badge click to expand/collapse
       const badgeContainer = this.#container.querySelector('.lne-badge-container');
       if (badgeContainer) {
         const handleBadgeClick = (e) => {
           e.stopPropagation();
           const panel = this.#container.querySelector('.lne-log-panel');
           
           if (panel.hidden) {
             this.#callbacks.onExpand();
           } else {
             this.#callbacks.onCollapse();
           }
         };
         
         badgeContainer.addEventListener('click', handleBadgeClick);
         this.#listeners.set('badge-click', { element: badgeContainer, handler: handleBadgeClick });
       }
       
       // Clear button
       const clearBtn = this.#container.querySelector('.lne-clear-btn');
       if (clearBtn) {
         const handleClear = (e) => {
           e.stopPropagation();
           this.#callbacks.onClear();
         };
         
         clearBtn.addEventListener('click', handleClear);
         this.#listeners.set('clear-click', { element: clearBtn, handler: handleClear });
       }
       
       // Close button (collapse panel)
       const closeBtn = this.#container.querySelector('.lne-close-btn');
       if (closeBtn) {
         const handleClose = (e) => {
           e.stopPropagation();
           this.#callbacks.onCollapse();
         };
         
         closeBtn.addEventListener('click', handleClose);
         this.#listeners.set('close-click', { element: closeBtn, handler: handleClose });
       }
       
       // Dismiss notification (right-click on badge)
       if (badgeContainer) {
         const handleDismiss = (e) => {
           e.preventDefault();
           e.stopPropagation();
           this.#callbacks.onDismiss();
         };
         
         badgeContainer.addEventListener('contextmenu', handleDismiss);
         this.#listeners.set('badge-contextmenu', { element: badgeContainer, handler: handleDismiss });
       }
       
       // Keyboard shortcuts
       const handleKeyboard = (e) => {
         // Only handle if notifier is visible
         if (this.#container.hidden) return;
         
         // Escape to collapse panel
         if (e.key === 'Escape') {
           const panel = this.#container.querySelector('.lne-log-panel');
           if (!panel.hidden) {
             this.#callbacks.onCollapse();
           }
         }
         
         // Ctrl+Shift+L to toggle panel
         if (e.ctrlKey && e.shiftKey && e.key === 'L') {
           e.preventDefault();
           const panel = this.#container.querySelector('.lne-log-panel');
           
           if (panel.hidden) {
             this.#callbacks.onExpand();
           } else {
             this.#callbacks.onCollapse();
           }
         }
       };
       
       document.addEventListener('keydown', handleKeyboard);
       this.#listeners.set('keyboard', { element: document, handler: handleKeyboard });
       
       // Click outside to collapse panel
       const handleOutsideClick = (e) => {
         if (!this.#container.contains(e.target)) {
           const panel = this.#container.querySelector('.lne-log-panel');
           if (!panel.hidden) {
             this.#callbacks.onCollapse();
           }
         }
       };
       
       document.addEventListener('click', handleOutsideClick);
       this.#listeners.set('outside-click', { element: document, handler: handleOutsideClick });
     }
     
     detachFromContainer() {
       // Remove all event listeners
       this.#listeners.forEach((info, key) => {
         info.element.removeEventListener(
           key.split('-')[0], // Extract event type from key
           info.handler
         );
       });
       
       this.#listeners.clear();
       this.#container = null;
     }
     
     /**
      * Enable drag functionality (will be fully implemented in ENHLOGVIS-010)
      */
     enableDragging() {
       // Placeholder for drag functionality
       // Full implementation in ENHLOGVIS-010
       this.#logger.debug('Drag functionality will be implemented in ENHLOGVIS-010');
     }
     
     /**
      * Emit custom event (for future extensions)
      */
     emit(eventName, detail = {}) {
       if (this.#container) {
         const event = new CustomEvent(`lne-notifier-${eventName}`, {
           detail,
           bubbles: true
         });
         this.#container.dispatchEvent(event);
       }
     }
   }
   
   export default CriticalLogNotifierEvents;
   ```

2. **DOM Helper Functions** (`src/logging/ui/notificationDOMHelpers.js`):
   ```javascript
   /**
    * @file DOM utility functions for notification UI
    */
   
   /**
    * Create element with attributes and classes
    */
   export function createElement(tag, attributes = {}, classes = []) {
     const element = document.createElement(tag);
     
     // Set attributes
     Object.entries(attributes).forEach(([key, value]) => {
       if (key === 'textContent') {
         element.textContent = value;
       } else if (key === 'innerHTML') {
         element.innerHTML = value;
       } else {
         element.setAttribute(key, value);
       }
     });
     
     // Add classes
     if (classes.length > 0) {
       element.className = classes.join(' ');
     }
     
     return element;
   }
   
   /**
    * Safely set text content (prevent XSS)
    */
   export function setSafeText(element, text) {
     element.textContent = text;
     return element;
   }
   
   /**
    * Format timestamp for display
    */
   export function formatTimestamp(timestamp) {
     const date = new Date(timestamp);
     return date.toLocaleTimeString('en-US', {
       hour12: false,
       hour: '2-digit',
       minute: '2-digit',
       second: '2-digit'
     });
   }
   
   /**
    * Get position coordinates based on position string
    */
   export function getPositionCoordinates(position) {
     const positions = {
       'top-left': { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
       'top-right': { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
       'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
       'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
     };
     
     return positions[position] || positions['top-right'];
   }
   
   /**
    * Truncate long messages
    */
   export function truncateMessage(message, maxLength = 200) {
     if (message.length <= maxLength) return message;
     return message.substring(0, maxLength - 3) + '...';
   }
   
   /**
    * Create log entry element with proper formatting
    */
   export function createLogEntryElement(log) {
     const entry = createElement('div', {}, ['lne-log-entry', `lne-log-${log.level}`]);
     
     // Time
     const time = createElement('span', {
       textContent: formatTimestamp(log.timestamp)
     }, ['lne-log-time']);
     
     // Level badge
     const level = createElement('span', {
       textContent: log.level.toUpperCase()
     }, ['lne-log-level']);
     
     // Category (if present)
     if (log.category && log.category !== 'general') {
       const category = createElement('span', {
         textContent: `[${log.category}]`
       }, ['lne-log-category']);
       entry.appendChild(category);
     }
     
     // Message
     const message = createElement('span', {
       title: log.message // Full message on hover
     }, ['lne-log-message']);
     setSafeText(message, truncateMessage(log.message));
     
     // Add metadata indicator if present
     if (log.metadata && Object.keys(log.metadata).length > 0) {
       const metaIndicator = createElement('span', {
         textContent: '📎',
         title: 'Has metadata'
       }, ['lne-log-meta-indicator']);
       entry.appendChild(metaIndicator);
     }
     
     entry.appendChild(time);
     entry.appendChild(level);
     entry.appendChild(message);
     
     return entry;
   }
   
   /**
    * Apply position styles to container
    */
   export function applyPositionStyles(element, position) {
     const coords = getPositionCoordinates(position);
     
     element.style.position = 'fixed';
     element.style.top = coords.top;
     element.style.right = coords.right;
     element.style.bottom = coords.bottom;
     element.style.left = coords.left;
     element.style.zIndex = '10000';
   }
   
   /**
    * Animate element appearance
    */
   export function animateIn(element) {
     element.style.opacity = '0';
     element.style.transform = 'scale(0.9)';
     element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
     
     // Trigger reflow
     element.offsetHeight;
     
     element.style.opacity = '1';
     element.style.transform = 'scale(1)';
   }
   
   /**
    * Animate element removal
    */
   export function animateOut(element, callback) {
     element.style.opacity = '1';
     element.style.transform = 'scale(1)';
     element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
     
     element.style.opacity = '0';
     element.style.transform = 'scale(0.9)';
     
     setTimeout(() => {
       if (callback) callback();
     }, 200);
   }
   ```

3. **Update CriticalLogNotifierRenderer** (enhance existing methods):
   ```javascript
   // Additional methods to add to CriticalLogNotifierRenderer
   
   import {
     createElement,
     setSafeText,
     createLogEntryElement,
     applyPositionStyles,
     animateIn,
     animateOut
   } from './ui/notificationDOMHelpers.js';
   
   class CriticalLogNotifierRenderer {
     // ... existing code ...
     
     createContainer() {
       // ... existing container creation ...
       
       // Apply position styles
       applyPositionStyles(this.#container, this.#position);
       
       // Add animation
       animateIn(this.#container);
       
       return this.#container;
     }
     
     updateLogPanel(logs) {
       const logList = this.#panel.querySelector('.lne-log-list');
       
       // Clear with fade out
       const existingEntries = logList.querySelectorAll('.lne-log-entry');
       existingEntries.forEach(entry => {
         entry.style.opacity = '0';
       });
       
       setTimeout(() => {
         logList.innerHTML = '';
         
         // Add logs in reverse order (newest first)
         [...logs].reverse().forEach((log, index) => {
           const entry = createLogEntryElement(log);
           
           // Stagger animation
           setTimeout(() => {
             animateIn(entry);
           }, index * 50);
           
           logList.appendChild(entry);
         });
       }, 200);
     }
     
     showPanel(logs) {
       this.updateLogPanel(logs);
       this.#panel.hidden = false;
       animateIn(this.#panel);
       
       // Focus management for accessibility
       const closeBtn = this.#panel.querySelector('.lne-close-btn');
       if (closeBtn) {
         closeBtn.focus();
       }
     }
     
     hidePanel() {
       animateOut(this.#panel, () => {
         this.#panel.hidden = true;
       });
     }
     
     hide() {
       if (this.#container) {
         animateOut(this.#container, () => {
           this.#container.hidden = true;
         });
       }
     }
     
     updatePosition(position) {
       if (this.#container) {
         this.#position = position;
         applyPositionStyles(this.#container, position);
         this.#container.setAttribute('data-position', position);
       }
     }
   }
   ```

## Dependencies
- **Depends On**: ENHLOGVIS-005 (CriticalLogNotifier class structure)
- **Depends On**: ENHLOGVIS-006 (Integration for testing)
- **Required By**: ENHLOGVIS-008 (CSS styling)
- **Required By**: ENHLOGVIS-010 (Drag functionality)

## Acceptance Criteria
- [ ] Badge container displays and is clickable
- [ ] Warning and error counts display correctly
- [ ] Click on badge expands/collapses panel
- [ ] Panel shows recent logs with proper formatting
- [ ] Clear button clears all notifications
- [ ] Close button collapses panel
- [ ] Right-click on badge dismisses notifications
- [ ] Escape key collapses panel
- [ ] Ctrl+Shift+L toggles panel
- [ ] Click outside collapses panel
- [ ] Animations work smoothly
- [ ] Position is applied correctly
- [ ] Messages are sanitized (XSS prevention)
- [ ] Accessibility attributes present

## Testing Requirements

### Unit Tests
- Test event handler attachment/detachment
- Test click handlers trigger callbacks
- Test keyboard shortcuts work
- Test outside click detection
- Test DOM helper functions
- Test XSS prevention in messages
- Test position calculation

### Manual Testing
1. Open browser with app
2. Trigger warning - badge appears with animation
3. Click badge - panel expands
4. Verify logs display correctly
5. Press Escape - panel collapses
6. Press Ctrl+Shift+L - panel toggles
7. Click Clear - notifications clear
8. Right-click badge - notifications dismiss
9. Click outside - panel collapses
10. Test in different positions

## Code Review Checklist
- [ ] Event listeners properly cleaned up
- [ ] No memory leaks from animations
- [ ] XSS prevention implemented
- [ ] Accessibility standards met
- [ ] Browser compatibility verified
- [ ] Performance acceptable

## Notes
- Drag functionality stub included but will be completed in ENHLOGVIS-010
- Consider using requestAnimationFrame for smoother animations
- May need to adjust z-index based on app's existing UI
- Keyboard shortcuts should not conflict with app shortcuts

## Related Tickets
- **Depends On**: ENHLOGVIS-005, ENHLOGVIS-006
- **Next**: ENHLOGVIS-008 (Add CSS styling)
- **Enables**: ENHLOGVIS-010, ENHLOGVIS-011