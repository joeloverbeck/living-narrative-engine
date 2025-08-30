# ENHLOGVIS-005: Create CriticalLogNotifier Class

## Ticket Overview
**Type**: Feature Implementation  
**Component**: UI/Logging System  
**Priority**: High  
**Phase**: 2 - Visual Notifications  
**Estimated Effort**: 4-5 hours  

## Objective
Create a new CriticalLogNotifier class that manages the visual notification system for warnings and errors, including a floating badge with counts and an expandable panel showing recent critical logs.

## Current State
- No visual indication when warnings/errors occur
- Developers must check console or remote logs manually
- No UI components for logging visualization
- HybridLogger has buffer (from ENHLOGVIS-002) but no UI consumer

## Technical Implementation

### Files to Create
- `src/logging/criticalLogNotifier.js` - Main notifier class
- `src/logging/criticalLogNotifierRenderer.js` - DOM rendering logic
- `src/logging/criticalLogNotifierEvents.js` - Event handling

### Class Structure

1. **Main CriticalLogNotifier Class** (`criticalLogNotifier.js`):
   ```javascript
   /**
    * @file Visual notification system for critical logs
    * @see hybridLogger.js
    */
   
   import CriticalLogNotifierRenderer from './criticalLogNotifierRenderer.js';
   import CriticalLogNotifierEvents from './criticalLogNotifierEvents.js';
   import { validateDependency } from '../utils/dependencyUtils.js';
   
   /** @typedef {import('./types.js').CriticalLogEntry} CriticalLogEntry */
   /** @typedef {import('./types.js').NotifierConfig} NotifierConfig */
   
   class CriticalLogNotifier {
     #config;
     #renderer;
     #eventHandler;
     #logCounts = { warnings: 0, errors: 0 };
     #recentLogs = [];
     #maxRecentLogs = 20;
     #isExpanded = false;
     #isDismissed = false;
     #position;
     #container = null;
     #logger;
     
     /**
      * @param {Object} dependencies
      * @param {NotifierConfig} dependencies.config - Configuration object
      * @param {Object} dependencies.logger - Logger instance
      */
     constructor({ config, logger }) {
       validateDependency(logger, 'ILogger', console, {
         requiredMethods: ['info', 'warn', 'error', 'debug']
       });
       
       this.#logger = logger;
       this.#config = this.#validateConfig(config);
       this.#position = this.#loadPosition();
       
       this.#renderer = new CriticalLogNotifierRenderer({
         config: this.#config,
         position: this.#position,
         logger
       });
       
       this.#eventHandler = new CriticalLogNotifierEvents({
         onExpand: () => this.#handleExpand(),
         onCollapse: () => this.#handleCollapse(),
         onDismiss: () => this.#handleDismiss(),
         onClear: () => this.#handleClear(),
         onPositionChange: (pos) => this.#handlePositionChange(pos),
         logger
       });
       
       this.#initialize();
     }
     
     #validateConfig(config) {
       const defaults = {
         enableVisualNotifications: true,
         notificationPosition: 'top-right',
         autoDismissAfter: null,
         soundEnabled: false
       };
       
       return { ...defaults, ...config };
     }
     
     #initialize() {
       if (!this.#config.enableVisualNotifications) {
         this.#logger.debug('Visual notifications disabled');
         return;
       }
       
       // Create container
       this.#container = this.#renderer.createContainer();
       this.#eventHandler.attachToContainer(this.#container);
       
       // Set up auto-dismiss if configured
       if (this.#config.autoDismissAfter) {
         this.#setupAutoDismiss();
       }
     }
     
     /**
      * Notify about a warning log
      * @param {CriticalLogEntry} logEntry
      */
     notifyWarning(logEntry) {
       if (!this.#config.enableVisualNotifications || this.#isDismissed) {
         return;
       }
       
       this.#logCounts.warnings++;
       this.#addToRecentLogs(logEntry);
       this.#updateDisplay();
       
       if (this.#config.soundEnabled) {
         this.#playNotificationSound('warning');
       }
     }
     
     /**
      * Notify about an error log
      * @param {CriticalLogEntry} logEntry
      */
     notifyError(logEntry) {
       if (!this.#config.enableVisualNotifications || this.#isDismissed) {
         return;
       }
       
       this.#logCounts.errors++;
       this.#addToRecentLogs(logEntry);
       this.#updateDisplay();
       
       if (this.#config.soundEnabled) {
         this.#playNotificationSound('error');
       }
     }
     
     #addToRecentLogs(logEntry) {
       this.#recentLogs.push({
         ...logEntry,
         displayTime: new Date().toLocaleTimeString()
       });
       
       // Maintain max size
       if (this.#recentLogs.length > this.#maxRecentLogs) {
         this.#recentLogs.shift();
       }
     }
     
     #updateDisplay() {
       if (!this.#container) return;
       
       this.#renderer.updateBadges(this.#logCounts);
       
       if (this.#isExpanded) {
         this.#renderer.updateLogPanel(this.#recentLogs);
       }
       
       // Show container if hidden
       if (this.#container.hidden) {
         this.#container.hidden = false;
       }
     }
     
     #handleExpand() {
       this.#isExpanded = true;
       this.#renderer.showPanel(this.#recentLogs);
       this.#logger.debug('Critical log panel expanded');
     }
     
     #handleCollapse() {
       this.#isExpanded = false;
       this.#renderer.hidePanel();
       this.#logger.debug('Critical log panel collapsed');
     }
     
     #handleDismiss() {
       this.#isDismissed = true;
       this.#logCounts = { warnings: 0, errors: 0 };
       this.#recentLogs = [];
       this.#renderer.hide();
       this.#logger.debug('Critical notifications dismissed');
       
       // Reset dismissed state after a delay
       setTimeout(() => {
         this.#isDismissed = false;
       }, 30000); // 30 seconds
     }
     
     #handleClear() {
       this.#logCounts = { warnings: 0, errors: 0 };
       this.#recentLogs = [];
       this.#updateDisplay();
       this.#logger.debug('Critical logs cleared');
     }
     
     #handlePositionChange(newPosition) {
       this.#position = newPosition;
       this.#savePosition(newPosition);
       this.#renderer.updatePosition(newPosition);
     }
     
     #loadPosition() {
       try {
         const saved = localStorage.getItem('lne-critical-notifier-position');
         return saved || this.#config.notificationPosition;
       } catch (e) {
         return this.#config.notificationPosition;
       }
     }
     
     #savePosition(position) {
       try {
         localStorage.setItem('lne-critical-notifier-position', position);
       } catch (e) {
         this.#logger.warn('Failed to save position preference', e);
       }
     }
     
     #setupAutoDismiss() {
       let dismissTimer;
       
       const resetTimer = () => {
         if (dismissTimer) clearTimeout(dismissTimer);
         
         dismissTimer = setTimeout(() => {
           this.#handleDismiss();
         }, this.#config.autoDismissAfter);
       };
       
       // Reset timer on new notifications
       this.#eventHandler.on('notification', resetTimer);
     }
     
     #playNotificationSound(type) {
       // Future enhancement - not implemented in initial version
       // Could use Web Audio API or simple audio element
     }
     
     /**
      * Get current notification counts
      * @returns {{warnings: number, errors: number}}
      */
     getCounts() {
       return { ...this.#logCounts };
     }
     
     /**
      * Check if notifier is currently showing
      * @returns {boolean}
      */
     isVisible() {
       return !this.#isDismissed && (this.#logCounts.warnings > 0 || this.#logCounts.errors > 0);
     }
     
     /**
      * Destroy the notifier and clean up
      */
     destroy() {
       if (this.#container) {
         this.#eventHandler.detachFromContainer(this.#container);
         this.#renderer.destroy();
         this.#container = null;
       }
       
       this.#logger.debug('CriticalLogNotifier destroyed');
     }
   }
   
   export default CriticalLogNotifier;
   ```

2. **Renderer Class** (`criticalLogNotifierRenderer.js`):
   ```javascript
   /**
    * Handles DOM rendering for the critical log notifier
    */
   class CriticalLogNotifierRenderer {
     #config;
     #position;
     #container;
     #badgeContainer;
     #panel;
     #logger;
     
     constructor({ config, position, logger }) {
       this.#config = config;
       this.#position = position;
       this.#logger = logger;
     }
     
     createContainer() {
       // Check if container already exists
       const existing = document.querySelector('.lne-critical-log-notifier');
       if (existing) {
         existing.remove();
       }
       
       this.#container = document.createElement('div');
       this.#container.className = 'lne-critical-log-notifier';
       this.#container.setAttribute('data-position', this.#position);
       this.#container.hidden = true;
       
       // Create badge container
       this.#badgeContainer = this.#createBadgeContainer();
       this.#container.appendChild(this.#badgeContainer);
       
       // Create expandable panel
       this.#panel = this.#createPanel();
       this.#container.appendChild(this.#panel);
       
       // Add to DOM
       document.body.appendChild(this.#container);
       
       return this.#container;
     }
     
     #createBadgeContainer() {
       const container = document.createElement('div');
       container.className = 'lne-badge-container';
       container.setAttribute('role', 'status');
       container.setAttribute('aria-label', 'Critical log notifications');
       
       // Create warning badge
       const warningBadge = document.createElement('span');
       warningBadge.className = 'lne-warning-badge';
       warningBadge.hidden = true;
       warningBadge.setAttribute('aria-label', 'Warning count');
       
       // Create error badge
       const errorBadge = document.createElement('span');
       errorBadge.className = 'lne-error-badge';
       errorBadge.hidden = true;
       errorBadge.setAttribute('aria-label', 'Error count');
       
       container.appendChild(warningBadge);
       container.appendChild(errorBadge);
       
       return container;
     }
     
     #createPanel() {
       const panel = document.createElement('div');
       panel.className = 'lne-log-panel';
       panel.hidden = true;
       panel.setAttribute('role', 'log');
       panel.setAttribute('aria-label', 'Critical logs panel');
       
       // Header
       const header = document.createElement('div');
       header.className = 'lne-log-header';
       
       const title = document.createElement('span');
       title.textContent = 'Recent Critical Logs';
       
       const clearBtn = document.createElement('button');
       clearBtn.className = 'lne-clear-btn';
       clearBtn.textContent = 'Clear';
       clearBtn.setAttribute('aria-label', 'Clear all logs');
       
       const closeBtn = document.createElement('button');
       closeBtn.className = 'lne-close-btn';
       closeBtn.innerHTML = '&times;';
       closeBtn.setAttribute('aria-label', 'Close panel');
       
       header.appendChild(title);
       header.appendChild(clearBtn);
       header.appendChild(closeBtn);
       
       // Log list
       const logList = document.createElement('div');
       logList.className = 'lne-log-list';
       
       panel.appendChild(header);
       panel.appendChild(logList);
       
       return panel;
     }
     
     updateBadges({ warnings, errors }) {
       const warningBadge = this.#badgeContainer.querySelector('.lne-warning-badge');
       const errorBadge = this.#badgeContainer.querySelector('.lne-error-badge');
       
       // Update warning badge
       if (warnings > 0) {
         warningBadge.textContent = warnings > 99 ? '99+' : warnings;
         warningBadge.hidden = false;
       } else {
         warningBadge.hidden = true;
       }
       
       // Update error badge
       if (errors > 0) {
         errorBadge.textContent = errors > 99 ? '99+' : errors;
         errorBadge.hidden = false;
       } else {
         errorBadge.hidden = true;
       }
     }
     
     updateLogPanel(logs) {
       const logList = this.#panel.querySelector('.lne-log-list');
       logList.innerHTML = '';
       
       // Add logs in reverse order (newest first)
       [...logs].reverse().forEach(log => {
         const entry = this.#createLogEntry(log);
         logList.appendChild(entry);
       });
     }
     
     #createLogEntry(log) {
       const entry = document.createElement('div');
       entry.className = `lne-log-entry lne-log-${log.level}`;
       
       const time = document.createElement('span');
       time.className = 'lne-log-time';
       time.textContent = log.displayTime;
       
       const level = document.createElement('span');
       level.className = 'lne-log-level';
       level.textContent = log.level.toUpperCase();
       
       const message = document.createElement('span');
       message.className = 'lne-log-message';
       message.textContent = this.#sanitizeMessage(log.message);
       
       entry.appendChild(time);
       entry.appendChild(level);
       entry.appendChild(message);
       
       return entry;
     }
     
     #sanitizeMessage(message) {
       // Prevent XSS by escaping HTML
       const div = document.createElement('div');
       div.textContent = message;
       return div.innerHTML;
     }
     
     showPanel(logs) {
       this.updateLogPanel(logs);
       this.#panel.hidden = false;
     }
     
     hidePanel() {
       this.#panel.hidden = true;
     }
     
     hide() {
       if (this.#container) {
         this.#container.hidden = true;
       }
     }
     
     updatePosition(position) {
       if (this.#container) {
         this.#container.setAttribute('data-position', position);
       }
     }
     
     destroy() {
       if (this.#container) {
         this.#container.remove();
       }
     }
   }
   
   export default CriticalLogNotifierRenderer;
   ```

## Dependencies
- **Depends On**: ENHLOGVIS-002 (Critical log buffer for log entries)
- **Depends On**: ENHLOGVIS-003 (Configuration schema)
- **Required By**: ENHLOGVIS-006 (Integration with HybridLogger)
- **Required By**: ENHLOGVIS-007 (UI implementation)

## Acceptance Criteria
- [ ] Class creates floating notification badge
- [ ] Badge shows separate counts for warnings and errors
- [ ] Badge is clickable to expand panel
- [ ] Panel shows recent critical logs with timestamps
- [ ] Clear button removes all notifications
- [ ] Dismiss button hides notifications
- [ ] Position preference saved to localStorage
- [ ] Notifications respect configuration settings
- [ ] No XSS vulnerabilities in message display
- [ ] Proper ARIA attributes for accessibility

## Testing Requirements

### Unit Tests
- Test notifier initialization with various configs
- Test warning notification increments count
- Test error notification increments count
- Test recent logs buffer management
- Test auto-dismiss functionality
- Test position persistence
- Test message sanitization
- Test destroy cleanup

### Manual Testing
1. Create instance with default config
2. Call notifyWarning() - verify badge appears
3. Call notifyError() - verify error count shows
4. Click badge - verify panel expands
5. Check log entries display correctly
6. Click Clear - verify counts reset
7. Click Dismiss - verify notification hides
8. Reload page - verify position persists

## Code Review Checklist
- [ ] Follows project class patterns
- [ ] Proper dependency injection
- [ ] Private fields used appropriately
- [ ] Error handling for DOM operations
- [ ] Memory cleanup in destroy()
- [ ] Accessibility attributes included
- [ ] XSS prevention implemented

## Notes
- Sound notification is included in structure but not implemented initially
- Consider using Shadow DOM for style isolation in future
- Position changing via drag will be implemented in ENHLOGVIS-010
- Keyboard shortcuts will be added in ENHLOGVIS-011

## Related Tickets
- **Depends On**: ENHLOGVIS-002, ENHLOGVIS-003
- **Next**: ENHLOGVIS-006 (Integration with HybridLogger)
- **Blocks**: ENHLOGVIS-007, ENHLOGVIS-010, ENHLOGVIS-011