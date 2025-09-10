/**
 * @file Enhanced keyboard shortcuts manager for critical log notifier
 * @see criticalLogNotifier.js
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { validateDependency } from '../utils/dependencyUtils.js';

class KeyboardShortcutsManager {
  #shortcuts = new Map();
  #enabled = true;
  #logger;
  #boundHandler;
  #actionCallback = null;
  #document;

  constructor({ logger, documentContext = null }) {
    ensureValidLogger(logger, 'KeyboardShortcutsManager constructor');
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    // Use provided document context or fall back to global document
    this.#document =
      documentContext || (typeof document !== 'undefined' ? document : null);
    this.#boundHandler = this.#handleKeydown.bind(this);
    this.#enabled = false; // Explicitly start disabled
    this.#registerDefaultShortcuts();
  }

  #registerDefaultShortcuts() {
    // Existing shortcuts
    this.register('Escape', {
      description: 'Close panel',
      action: 'close-panel',
    });

    this.register('Ctrl+Shift+L', {
      description: 'Toggle panel',
      action: 'toggle-panel',
      preventDefault: true,
    });

    // New shortcuts
    this.register('Ctrl+Shift+C', {
      description: 'Clear all notifications',
      action: 'clear-all',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+D', {
      description: 'Dismiss notifications',
      action: 'dismiss',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+E', {
      description: 'Export logs',
      action: 'export',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+F', {
      description: 'Focus search',
      action: 'focus-search',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+W', {
      description: 'Filter warnings only',
      action: 'filter-warnings',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+R', {
      description: 'Filter errors only',
      action: 'filter-errors',
      preventDefault: true,
    });

    this.register('Ctrl+Shift+A', {
      description: 'Show all logs',
      action: 'filter-all',
      preventDefault: true,
    });

    // Navigation shortcuts when panel is open
    this.register('ArrowUp', {
      description: 'Previous log entry',
      action: 'prev-log',
      requiresPanel: true,
    });

    this.register('ArrowDown', {
      description: 'Next log entry',
      action: 'next-log',
      requiresPanel: true,
    });

    this.register('Home', {
      description: 'First log entry',
      action: 'first-log',
      requiresPanel: true,
    });

    this.register('End', {
      description: 'Last log entry',
      action: 'last-log',
      requiresPanel: true,
    });
  }

  /**
   * Register a keyboard shortcut
   *
   * @param {string} key - Key combination (e.g., 'Ctrl+Shift+L')
   * @param {object} config - Shortcut configuration
   */
  register(key, config) {
    const normalizedKey = this.#normalizeKey(key);
    this.#shortcuts.set(normalizedKey, config);
  }

  /**
   * Enable keyboard shortcuts
   */
  enable() {
    if (this.#enabled || !this.#document) return;

    this.#document.addEventListener('keydown', this.#boundHandler);
    this.#enabled = true;
    this.#logger.debug('Keyboard shortcuts enabled');
  }

  /**
   * Disable keyboard shortcuts
   */
  disable() {
    if (!this.#enabled || !this.#document) return;

    this.#document.removeEventListener('keydown', this.#boundHandler);
    this.#enabled = false;
    this.#logger.debug('Keyboard shortcuts disabled');
  }

  /**
   * Set callback for shortcut actions
   *
   * @param {Function} callback - Function to call when shortcuts are triggered
   */
  setActionCallback(callback) {
    this.#actionCallback = callback;
  }

  #handleKeydown(e) {
    const key = this.#getKeyFromEvent(e);
    const shortcut = this.#shortcuts.get(key);

    if (!shortcut) return;

    // Check if panel is required
    if (shortcut.requiresPanel) {
      const panel = this.#document
        ? this.#document.querySelector('.lne-critical-log-panel')
        : null;
      if (!panel || panel.hidden) return;
    }

    // Check if we should handle this shortcut
    if (this.#shouldHandleShortcut(e, shortcut)) {
      if (shortcut.preventDefault && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      if (this.#actionCallback) {
        this.#actionCallback(shortcut.action, e);
      }

      this.#logger.debug(`Shortcut triggered: ${key} -> ${shortcut.action}`);
    }
  }

  #shouldHandleShortcut(e, _shortcut) {
    // Ensure target exists
    if (!e.target) {
      return false;
    }

    // Don't trigger shortcuts when typing in input fields
    const tagName = e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return false;
    }

    // Don't trigger if contenteditable
    if (e.target.isContentEditable) {
      return false;
    }

    return true;
  }

  #getKeyFromEvent(e) {
    const parts = [];

    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');

    // Add the actual key
    const key = e.key;
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  #normalizeKey(key) {
    // Normalize key string for consistent comparison
    return key
      .split('+')
      .map((part) => part.trim())
      .sort((a, b) => {
        // Modifiers first, then key
        const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
        const aIsMod = modifiers.includes(a);
        const bIsMod = modifiers.includes(b);

        if (aIsMod && !bIsMod) return -1;
        if (!aIsMod && bIsMod) return 1;
        return a.localeCompare(b);
      })
      .join('+');
  }

  /**
   * Get help text for all shortcuts
   *
   * @returns {string} Formatted help text for all registered shortcuts
   */
  getHelpText() {
    const lines = ['Keyboard Shortcuts:'];

    this.#shortcuts.forEach((config, key) => {
      lines.push(`  ${key.padEnd(20)} - ${config.description}`);
    });

    return lines.join('\n');
  }

  destroy() {
    this.disable();
    this.#shortcuts.clear();
    this.#actionCallback = null;
  }
}

export default KeyboardShortcutsManager;
