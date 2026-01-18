/**
 * @file statusTheme.js - Single source of truth for expression diagnostic status colors
 * @description Centralizes all color definitions (fill, background, text) for status indicators
 * used throughout the expression diagnostics system. CSS and JavaScript should import from
 * this file to ensure consistency.
 * @see css/expression-diagnostics.css
 * @see ExpressionStatusService.js
 * @see DiagnosticResult.js
 */

/**
 * @typedef {object} StatusThemeEntry
 * @property {string} fill - Primary/fill color (hex) for status circles and solid indicators
 * @property {string} background - Light background color (hex) for badges and pills
 * @property {string} text - Text/contrast color (hex) for text on light backgrounds
 * @property {string} emoji - Unicode emoji for visual indicator
 * @property {string} label - Human-readable display label
 * @property {string} colorName - Simple color name for backward compatibility
 */

/**
 * Complete status theme configuration.
 * This is the authoritative source for all status-related colors in the system.
 *
 * @type {Readonly<Record<string, StatusThemeEntry>>}
 */
export const STATUS_THEME = Object.freeze({
  unknown: Object.freeze({
    fill: '#BBBBBB',
    background: '#F7F7F7',
    text: '#545454',
    emoji: '⚪',
    label: 'Unknown',
    colorName: 'gray',
  }),
  // Legacy "impossible" status - kept for backward compatibility
  // New code should use theoretically_impossible or empirically_unreachable
  impossible: Object.freeze({
    fill: '#CC3311',
    background: '#F9E7E2',
    text: '#5C1708',
    emoji: '🔴',
    label: 'Impossible',
    colorName: 'red',
  }),
  // Three-tier classification: static analysis proves no solution exists
  theoretically_impossible: Object.freeze({
    fill: '#990000',
    background: '#F5E0E0',
    text: '#4D0000',
    emoji: '🚫',
    label: 'Theoretically Impossible',
    colorName: 'dark-red',
    description: 'Static analysis proves this cannot occur',
  }),
  // Three-tier classification: observed max < threshold (ceiling effect)
  empirically_unreachable: Object.freeze({
    fill: '#CC3311',
    background: '#F9E7E2',
    text: '#5C1708',
    emoji: '⛔',
    label: 'Empirically Unreachable',
    colorName: 'red',
    description: 'Observed maximum below threshold in sampled conditions',
  }),
  // Three-tier classification: 0 hits but no ceiling evidence
  unobserved: Object.freeze({
    fill: '#DDAA33',
    background: '#FDF5E6',
    text: '#6B5317',
    emoji: '🟡',
    label: 'Unobserved',
    colorName: 'amber',
    description: 'No triggers found, but not proven impossible',
  }),
  extremely_rare: Object.freeze({
    fill: '#EE7733',
    background: '#FDEFE7',
    text: '#6B3617',
    emoji: '🟠',
    label: 'Extremely Rare',
    colorName: 'orange',
  }),
  rare: Object.freeze({
    fill: '#EE3377',
    background: '#FDE7EF',
    text: '#6B1736',
    emoji: '🟣',
    label: 'Rare',
    colorName: 'magenta',
  }),
  uncommon: Object.freeze({
    fill: '#33BBEE',
    background: '#E8F8FD',
    text: '#175E6B',
    emoji: '🩵',
    label: 'Uncommon',
    colorName: 'cyan',
  }),
  normal: Object.freeze({
    fill: '#009988',
    background: '#E0F3F1',
    text: '#00453D',
    emoji: '🟢',
    label: 'Normal',
    colorName: 'teal',
  }),
  frequent: Object.freeze({
    fill: '#332288',
    background: '#E7E4F1',
    text: '#170F3D',
    emoji: '🔵',
    label: 'Frequent',
    colorName: 'indigo',
  }),
});

/**
 * All valid status keys in the theme.
 * @type {readonly string[]}
 */
export const STATUS_KEYS = Object.freeze(Object.keys(STATUS_THEME));

/**
 * Priority ordering for diagnostic statuses (lower = higher priority).
 * Used for sorting problematic expressions by severity.
 * Order: impossible (most severe) → frequent (least severe)
 *
 * @type {Readonly<Record<string, number>>}
 */
export const STATUS_PRIORITY = Object.freeze({
  theoretically_impossible: 0,
  impossible: 1, // Legacy, same priority as theoretically_impossible
  empirically_unreachable: 2,
  unobserved: 3,
  unknown: 4,
  extremely_rare: 5,
  rare: 6,
  uncommon: 7,
  normal: 8,
  frequent: 9,
});

/**
 * Statuses that should NOT be displayed in the problematic expressions panel.
 * These represent healthy or acceptable expression trigger rates.
 *
 * @type {Readonly<Set<string>>}
 */
export const NON_PROBLEMATIC_STATUSES = Object.freeze(
  new Set(['normal', 'frequent', 'uncommon'])
);

/**
 * Rarity category constants derived from STATUS_KEYS.
 * Provides uppercase constant names for programmatic access.
 * Example: RARITY_CATEGORIES.EXTREMELY_RARE === 'extremely_rare'
 *
 * @type {Readonly<Record<string, string>>}
 */
export const RARITY_CATEGORIES = Object.freeze(
  Object.fromEntries(STATUS_KEYS.map((key) => [key.toUpperCase(), key]))
);

/**
 * Gets the fill/primary color for a status.
 * Returns unknown color if status is invalid.
 *
 * @param {string|null|undefined} status - Status key
 * @returns {string} Hex color code
 */
export function getStatusFillColor(status) {
  const entry = STATUS_THEME[status];
  return entry ? entry.fill : STATUS_THEME.unknown.fill;
}

/**
 * Gets the background color for a status.
 * Returns unknown color if status is invalid.
 *
 * @param {string|null|undefined} status - Status key
 * @returns {string} Hex color code
 */
export function getStatusBackgroundColor(status) {
  const entry = STATUS_THEME[status];
  return entry ? entry.background : STATUS_THEME.unknown.background;
}

/**
 * Gets the text color for a status.
 * Returns unknown color if status is invalid.
 *
 * @param {string|null|undefined} status - Status key
 * @returns {string} Hex color code
 */
export function getStatusTextColor(status) {
  const entry = STATUS_THEME[status];
  return entry ? entry.text : STATUS_THEME.unknown.text;
}

/**
 * Gets the complete theme entry for a status.
 * Returns unknown entry if status is invalid.
 *
 * @param {string|null|undefined} status - Status key
 * @returns {StatusThemeEntry} Theme entry with all properties
 */
export function getStatusThemeEntry(status) {
  return STATUS_THEME[status] || STATUS_THEME.unknown;
}

/**
 * Generates CSS custom property declarations for all status colors.
 * Can be injected into :root or used to generate a CSS string.
 *
 * @returns {Record<string, string>} Object mapping CSS variable names to values
 */
export function generateCssVariables() {
  const variables = {};

  for (const [status, theme] of Object.entries(STATUS_THEME)) {
    const normalizedStatus = status.replace(/_/g, '-');
    variables[`--status-${normalizedStatus}-fill`] = theme.fill;
    variables[`--status-${normalizedStatus}-bg`] = theme.background;
    variables[`--status-${normalizedStatus}-text`] = theme.text;
  }

  return variables;
}

/**
 * Generates a CSS string with all status color custom properties.
 * Suitable for injection into a style element.
 *
 * @returns {string} CSS rule string for :root
 */
export function generateCssVariablesString() {
  const variables = generateCssVariables();
  const declarations = Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

  return `:root {\n${declarations}\n}`;
}

/**
 * Converts a diagnostic status to a CSS class for status circle elements.
 * Validates the status against known values and logs warnings for unrecognized statuses.
 *
 * @param {string|null|undefined} status - The diagnostic status
 * @param {Object|null} [logger=null] - Optional logger for validation warnings
 * @returns {string} The CSS class (e.g., 'status-rare', 'status-extremely-rare')
 * @see STATUS_KEYS for valid status values
 */
export function getStatusCircleCssClass(status, logger = null) {
  const normalized = (status || 'unknown').toLowerCase();
  const underscoreNormalized = normalized.replace(/-/g, '_');
  const cssStatus = normalized.replace(/_/g, '-');

  if (!STATUS_KEYS.includes(underscoreNormalized)) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(
        `statusTheme: Unrecognized status "${status}", defaulting to "unknown". ` +
          `Valid statuses: ${STATUS_KEYS.join(', ')}`
      );
    }
    return 'status-unknown';
  }

  return `status-${cssStatus}`;
}

/**
 * Injects status CSS custom properties into the document root.
 * Safe to call multiple times - will update existing values.
 */
export function injectStatusCssVariables() {
  if (typeof document === 'undefined') {
    return; // Skip in non-browser environments
  }

  const root = document.documentElement;
  const variables = generateCssVariables();

  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
}
