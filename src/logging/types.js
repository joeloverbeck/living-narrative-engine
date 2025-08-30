/**
 * @file Type definitions for the logging system
 */

/**
 * @typedef {object} CriticalLogEntry
 * @property {string} id - Unique identifier for the log entry
 * @property {string} timestamp - ISO timestamp when log was created
 * @property {string} level - Log level ('warn' | 'error')
 * @property {string} message - Log message text
 * @property {string|undefined} category - Log category from detector
 * @property {object} metadata - Additional metadata including args
 * @property {string} displayTime - Human-readable time for UI display
 */

/**
 * @typedef {object} NotifierConfig
 * @property {boolean} enableVisualNotifications - Whether to show visual notifications
 * @property {string} notificationPosition - Position for notifications ('top-right', 'top-left', etc.)
 * @property {number|null} autoDismissAfter - Auto-dismiss after milliseconds, null to disable
 * @property {boolean} soundEnabled - Whether to play notification sounds
 * @property {number} maxRecentLogs - Maximum number of recent logs to keep
 * @property {boolean} alwaysShowInConsole - Whether critical logs always show in console
 */

/**
 * @typedef {object} LogCounts
 * @property {number} warnings - Number of warning logs
 * @property {number} errors - Number of error logs
 */

export default {};