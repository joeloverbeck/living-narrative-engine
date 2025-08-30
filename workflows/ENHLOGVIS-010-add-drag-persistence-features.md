# ENHLOGVIS-010: Add Drag-to-Reposition and localStorage Persistence

## Ticket Overview

**Type**: Feature Enhancement  
**Component**: UI/UX  
**Priority**: Medium  
**Phase**: 3 - Enhanced Features  
**Estimated Effort**: 3-4 hours

## Objective

Implement drag-to-reposition functionality for the notification badge, allowing users to move it to their preferred location on screen, with position persistence using localStorage.

## Current State

- Notification badge has fixed positions (top-left, top-right, bottom-left, bottom-right)
- Position can be changed via configuration but not interactively
- Position preference not persisted across sessions beyond config
- Drag functionality stub exists but not implemented (ENHLOGVIS-007)

## Technical Implementation

### Files to Modify

- `src/logging/criticalLogNotifierEvents.js` - Add drag handling
- `src/logging/criticalLogNotifierRenderer.js` - Update position handling
- `src/logging/ui/dragHandler.js` - New drag handling utility

### Implementation Steps

1. **Create Drag Handler Utility** (`src/logging/ui/dragHandler.js`):

   ```javascript
   /**
    * @file Drag handling utility for notification badge
    */

   import { validateDependency } from '../../utils/dependencyUtils.js';

   class DragHandler {
     #element;
     #container;
     #isDragging = false;
     #startX = 0;
     #startY = 0;
     #currentX = 0;
     #currentY = 0;
     #initialLeft = 0;
     #initialTop = 0;
     #callbacks;
     #logger;
     #boundHandlers = {};
     #snapThreshold = 50; // Pixels from edge to snap
     #longPressTimer = null;
     #longPressDelay = 500; // ms to trigger drag mode

     constructor({ element, container, callbacks, logger }) {
       validateDependency(logger, 'ILogger', console, {
         requiredMethods: ['debug', 'warn'],
       });

       this.#element = element;
       this.#container = container;
       this.#callbacks = callbacks || {};
       this.#logger = logger;

       this.#initializeDragHandlers();
     }

     #initializeDragHandlers() {
       // Mouse events
       this.#boundHandlers.mousedown = this.#handleMouseDown.bind(this);
       this.#boundHandlers.mousemove = this.#handleMouseMove.bind(this);
       this.#boundHandlers.mouseup = this.#handleMouseUp.bind(this);

       // Touch events for mobile
       this.#boundHandlers.touchstart = this.#handleTouchStart.bind(this);
       this.#boundHandlers.touchmove = this.#handleTouchMove.bind(this);
       this.#boundHandlers.touchend = this.#handleTouchEnd.bind(this);

       // Prevent context menu during drag
       this.#boundHandlers.contextmenu = this.#handleContextMenu.bind(this);
     }

     enable() {
       // Mouse events
       this.#element.addEventListener(
         'mousedown',
         this.#boundHandlers.mousedown
       );

       // Touch events
       this.#element.addEventListener(
         'touchstart',
         this.#boundHandlers.touchstart,
         { passive: false }
       );

       // Add visual indicator
       this.#element.style.cursor = 'move';
       this.#element.setAttribute('title', 'Hold to drag');

       this.#logger.debug('Drag functionality enabled');
     }

     disable() {
       // Remove all event listeners
       this.#element.removeEventListener(
         'mousedown',
         this.#boundHandlers.mousedown
       );
       this.#element.removeEventListener(
         'touchstart',
         this.#boundHandlers.touchstart
       );
       document.removeEventListener('mousemove', this.#boundHandlers.mousemove);
       document.removeEventListener('mouseup', this.#boundHandlers.mouseup);
       document.removeEventListener('touchmove', this.#boundHandlers.touchmove);
       document.removeEventListener('touchend', this.#boundHandlers.touchend);

       // Reset cursor
       this.#element.style.cursor = 'pointer';

       // Clear any active drag
       this.#cancelDrag();

       this.#logger.debug('Drag functionality disabled');
     }

     #handleMouseDown(e) {
       // Start long press timer
       this.#longPressTimer = setTimeout(() => {
         this.#startDrag(e.clientX, e.clientY);

         // Add document-level listeners
         document.addEventListener('mousemove', this.#boundHandlers.mousemove);
         document.addEventListener('mouseup', this.#boundHandlers.mouseup);
       }, this.#longPressDelay);

       // Prevent text selection
       e.preventDefault();
     }

     #handleMouseMove(e) {
       if (!this.#isDragging) return;

       e.preventDefault();
       this.#updateDragPosition(e.clientX, e.clientY);
     }

     #handleMouseUp(e) {
       this.#clearLongPressTimer();

       if (this.#isDragging) {
         this.#endDrag(e.clientX, e.clientY);
       }

       // Remove document-level listeners
       document.removeEventListener('mousemove', this.#boundHandlers.mousemove);
       document.removeEventListener('mouseup', this.#boundHandlers.mouseup);
     }

     #handleTouchStart(e) {
       if (e.touches.length !== 1) return;

       const touch = e.touches[0];

       // Start long press timer
       this.#longPressTimer = setTimeout(() => {
         this.#startDrag(touch.clientX, touch.clientY);

         // Add document-level listeners
         document.addEventListener('touchmove', this.#boundHandlers.touchmove, {
           passive: false,
         });
         document.addEventListener('touchend', this.#boundHandlers.touchend);

         // Haptic feedback if available
         if (navigator.vibrate) {
           navigator.vibrate(50);
         }
       }, this.#longPressDelay);

       e.preventDefault();
     }

     #handleTouchMove(e) {
       if (!this.#isDragging) return;
       if (e.touches.length !== 1) return;

       e.preventDefault();
       const touch = e.touches[0];
       this.#updateDragPosition(touch.clientX, touch.clientY);
     }

     #handleTouchEnd(e) {
       this.#clearLongPressTimer();

       if (this.#isDragging) {
         // Use last known position
         this.#endDrag(this.#currentX, this.#currentY);
       }

       // Remove document-level listeners
       document.removeEventListener('touchmove', this.#boundHandlers.touchmove);
       document.removeEventListener('touchend', this.#boundHandlers.touchend);
     }

     #handleContextMenu(e) {
       if (this.#isDragging) {
         e.preventDefault();
         return false;
       }
     }

     #startDrag(x, y) {
       this.#isDragging = true;
       this.#startX = x;
       this.#startY = y;
       this.#currentX = x;
       this.#currentY = y;

       // Get initial position
       const rect = this.#container.getBoundingClientRect();
       this.#initialLeft = rect.left;
       this.#initialTop = rect.top;

       // Set container to absolute positioning for dragging
       this.#container.style.position = 'fixed';
       this.#container.style.left = `${this.#initialLeft}px`;
       this.#container.style.top = `${this.#initialTop}px`;
       this.#container.style.right = 'auto';
       this.#container.style.bottom = 'auto';

       // Add dragging class for visual feedback
       this.#container.classList.add('dragging');

       // Disable pointer events on panel during drag
       const panel = this.#container.querySelector('.lne-log-panel');
       if (panel) {
         panel.style.pointerEvents = 'none';
       }

       if (this.#callbacks.onDragStart) {
         this.#callbacks.onDragStart();
       }

       this.#logger.debug('Drag started');
     }

     #updateDragPosition(x, y) {
       this.#currentX = x;
       this.#currentY = y;

       const deltaX = x - this.#startX;
       const deltaY = y - this.#startY;

       let newLeft = this.#initialLeft + deltaX;
       let newTop = this.#initialTop + deltaY;

       // Constrain to viewport
       const containerRect = this.#container.getBoundingClientRect();
       const maxX = window.innerWidth - containerRect.width;
       const maxY = window.innerHeight - containerRect.height;

       newLeft = Math.max(0, Math.min(newLeft, maxX));
       newTop = Math.max(0, Math.min(newTop, maxY));

       // Apply position
       this.#container.style.left = `${newLeft}px`;
       this.#container.style.top = `${newTop}px`;

       // Show snap guides if near edges
       this.#showSnapGuides(
         newLeft,
         newTop,
         containerRect.width,
         containerRect.height
       );
     }

     #endDrag(x, y) {
       this.#isDragging = false;

       // Remove dragging class
       this.#container.classList.remove('dragging');

       // Re-enable pointer events on panel
       const panel = this.#container.querySelector('.lne-log-panel');
       if (panel) {
         panel.style.pointerEvents = 'auto';
       }

       // Determine final position (with snapping)
       const finalPosition = this.#calculateFinalPosition();

       // Apply final position
       this.#applyPosition(finalPosition);

       if (this.#callbacks.onDragEnd) {
         this.#callbacks.onDragEnd(finalPosition);
       }

       this.#logger.debug(`Drag ended, position: ${finalPosition}`);
     }

     #cancelDrag() {
       this.#clearLongPressTimer();

       if (this.#isDragging) {
         this.#isDragging = false;
         this.#container.classList.remove('dragging');

         // Reset to original position
         this.#applyPosition(this.#getOriginalPosition());
       }
     }

     #clearLongPressTimer() {
       if (this.#longPressTimer) {
         clearTimeout(this.#longPressTimer);
         this.#longPressTimer = null;
       }
     }

     #calculateFinalPosition() {
       const rect = this.#container.getBoundingClientRect();
       const centerX = rect.left + rect.width / 2;
       const centerY = rect.top + rect.height / 2;

       const viewportWidth = window.innerWidth;
       const viewportHeight = window.innerHeight;

       // Determine quadrant and snap to corner
       let position;

       if (rect.left < this.#snapThreshold) {
         // Snap to left
         position = centerY < viewportHeight / 2 ? 'top-left' : 'bottom-left';
       } else if (rect.right > viewportWidth - this.#snapThreshold) {
         // Snap to right
         position = centerY < viewportHeight / 2 ? 'top-right' : 'bottom-right';
       } else if (rect.top < this.#snapThreshold) {
         // Snap to top
         position = centerX < viewportWidth / 2 ? 'top-left' : 'top-right';
       } else if (rect.bottom > viewportHeight - this.#snapThreshold) {
         // Snap to bottom
         position =
           centerX < viewportWidth / 2 ? 'bottom-left' : 'bottom-right';
       } else {
         // Free position - determine nearest corner
         const distances = {
           'top-left': Math.hypot(rect.left, rect.top),
           'top-right': Math.hypot(viewportWidth - rect.right, rect.top),
           'bottom-left': Math.hypot(rect.left, viewportHeight - rect.bottom),
           'bottom-right': Math.hypot(
             viewportWidth - rect.right,
             viewportHeight - rect.bottom
           ),
         };

         position = Object.entries(distances).sort(
           ([, a], [, b]) => a - b
         )[0][0];
       }

       return position;
     }

     #applyPosition(position) {
       this.#container.setAttribute('data-position', position);

       // Reset to CSS-defined position
       this.#container.style.position = 'fixed';

       const positions = {
         'top-left': {
           top: '20px',
           left: '20px',
           right: 'auto',
           bottom: 'auto',
         },
         'top-right': {
           top: '20px',
           right: '20px',
           left: 'auto',
           bottom: 'auto',
         },
         'bottom-left': {
           bottom: '20px',
           left: '20px',
           top: 'auto',
           right: 'auto',
         },
         'bottom-right': {
           bottom: '20px',
           right: '20px',
           top: 'auto',
           left: 'auto',
         },
       };

       const pos = positions[position];
       Object.assign(this.#container.style, pos);
     }

     #getOriginalPosition() {
       return this.#container.getAttribute('data-position') || 'top-right';
     }

     #showSnapGuides(left, top, width, height) {
       // Visual feedback for snap zones (future enhancement)
       // Could show translucent guides when near edges
     }

     destroy() {
       this.disable();
       this.#element = null;
       this.#container = null;
       this.#callbacks = null;
     }
   }

   export default DragHandler;
   ```

2. **Update CriticalLogNotifierEvents** to use DragHandler:

   ```javascript
   import DragHandler from './ui/dragHandler.js';

   class CriticalLogNotifierEvents {
     #dragHandler = null;

     // ... existing code ...

     enableDragging() {
       if (this.#dragHandler) return;

       const badgeContainer = this.#container.querySelector(
         '.lne-badge-container'
       );
       if (!badgeContainer) return;

       this.#dragHandler = new DragHandler({
         element: badgeContainer,
         container: this.#container,
         callbacks: {
           onDragStart: () => {
             this.#logger.debug('User started dragging notification');
           },
           onDragEnd: (position) => {
             this.#callbacks.onPositionChange(position);
             this.#savePositionPreference(position);
           },
         },
         logger: this.#logger,
       });

       this.#dragHandler.enable();
     }

     #savePositionPreference(position) {
       try {
         localStorage.setItem('lne-notifier-position', position);
         localStorage.setItem('lne-notifier-position-custom', 'true');
         this.#logger.debug(`Position saved: ${position}`);
       } catch (e) {
         this.#logger.warn('Failed to save position preference', e);
       }
     }

     detachFromContainer() {
       if (this.#dragHandler) {
         this.#dragHandler.destroy();
         this.#dragHandler = null;
       }

       // ... existing cleanup ...
     }
   }
   ```

3. **Update CriticalLogNotifier** to enable drag feature:
   ```javascript
   class CriticalLogNotifier {
     // ... existing code ...

     #initialize() {
       if (!this.#config.enableVisualNotifications) {
         this.#logger.debug('Visual notifications disabled');
         return;
       }

       // Create container
       this.#container = this.#renderer.createContainer();
       this.#eventHandler.attachToContainer(this.#container);

       // Enable drag functionality
       this.#eventHandler.enableDragging();

       // ... rest of initialization ...
     }

     #loadPosition() {
       try {
         const customPosition = localStorage.getItem(
           'lne-notifier-position-custom'
         );
         if (customPosition === 'true') {
           const saved = localStorage.getItem('lne-notifier-position');
           if (saved && this.#isValidPosition(saved)) {
             return saved;
           }
         }
       } catch (e) {
         // Fallback to config
       }

       return this.#config.notificationPosition;
     }

     #isValidPosition(position) {
       const validPositions = [
         'top-left',
         'top-right',
         'bottom-left',
         'bottom-right',
       ];
       return validPositions.includes(position);
     }

     resetPosition() {
       try {
         localStorage.removeItem('lne-notifier-position');
         localStorage.removeItem('lne-notifier-position-custom');
       } catch (e) {
         // Ignore
       }

       this.#position = this.#config.notificationPosition;
       this.#renderer.updatePosition(this.#position);
     }
   }
   ```

## Dependencies

- **Depends On**: ENHLOGVIS-005 (CriticalLogNotifier structure)
- **Depends On**: ENHLOGVIS-007 (Event handling structure)
- **Depends On**: ENHLOGVIS-008 (CSS for dragging state)

## Acceptance Criteria

- [ ] Long press (500ms) on badge initiates drag mode
- [ ] Badge can be dragged to any position on screen
- [ ] Badge snaps to nearest corner when released
- [ ] Position persists across page reloads
- [ ] Custom position overrides config position
- [ ] Touch support works on mobile devices
- [ ] Visual feedback during drag (opacity/cursor change)
- [ ] Panel doesn't interfere during drag
- [ ] Escape key cancels active drag
- [ ] Position can be reset to default

## Testing Requirements

### Unit Tests

- Test drag handler initialization
- Test position calculation logic
- Test snap threshold behavior
- Test localStorage persistence
- Test touch event handling
- Test constraint boundaries

### Manual Testing

1. Long press badge - enters drag mode
2. Drag to each corner - snaps correctly
3. Drag to center and release - snaps to nearest
4. Reload page - position persisted
5. Test on mobile - touch drag works
6. Test with panel open - doesn't interfere
7. Press Escape during drag - cancels
8. Clear localStorage - reverts to config

## Code Review Checklist

- [ ] Touch events properly handled
- [ ] Memory cleanup on destroy
- [ ] localStorage errors handled
- [ ] Position validation robust
- [ ] Performance acceptable during drag
- [ ] Accessibility maintained

## Notes

- Consider adding visual snap guides in future
- Haptic feedback enhances mobile experience
- Long press delay prevents accidental drags
- Position reset method useful for support

## Related Tickets

- **Depends On**: ENHLOGVIS-005, ENHLOGVIS-007, ENHLOGVIS-008
- **Next**: ENHLOGVIS-011 (Keyboard shortcuts)
- **Enhancement**: Could add free-position mode in future
