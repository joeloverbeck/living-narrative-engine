/**
 * @file statusEffectUtils.js
 * @description Shared utilities for status effect rendering across damage simulator components
 */

/* eslint-disable mod-architecture/no-hardcoded-mod-references */
export const EFFECT_COMPONENTS = Object.freeze({
  bleeding: 'anatomy:bleeding',
  burning: 'anatomy:burning',
  poisoned: 'anatomy:poisoned',
  fractured: 'anatomy:fractured',
});
/* eslint-enable mod-architecture/no-hardcoded-mod-references */

export const EFFECT_EMOJIS = Object.freeze({
  bleeding: '🩸',
  burning: '🔥',
  poisoned: '☠️',
  fractured: '🦴',
});

export const EFFECT_CSS_CLASSES = Object.freeze({
  container: 'ds-part-effects',
  base: 'ds-effect',
  bleeding: 'ds-effect-bleeding',
  burning: 'ds-effect-burning',
  poisoned: 'ds-effect-poisoned',
  fractured: 'ds-effect-fractured',
});

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str - String to capitalize.
 * @returns {string} Capitalized string.
 */
export function capitalize(str) {
  if (!str) {
    return '';
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract active status effects from a component map.
 *
 * @param {{[key: string]: object}} components - Component map to inspect.
 * @returns {Array<{type: string, data: object}>} Active effects list.
 */
export function getActiveEffects(components) {
  if (!components || typeof components !== 'object') {
    return [];
  }

  const effects = [];
  for (const [effectType, componentId] of Object.entries(EFFECT_COMPONENTS)) {
    if (components[componentId]) {
      effects.push({
        type: effectType,
        data: components[componentId],
      });
    }
  }

  return effects;
}

/**
 * Format a tooltip string for a status effect.
 *
 * @param {string} effectType - Effect identifier.
 * @param {object} effectData - Effect component data.
 * @returns {string} Tooltip text.
 */
export function formatEffectTooltip(effectType, effectData) {
  const displayName = capitalize(effectType);

  switch (effectType) {
    case 'bleeding': {
      const severity = effectData.severity || 'unknown';
      const turns = effectData.remainingTurns;
      return turns !== undefined
        ? `${displayName} (${severity}, ${turns} turns)`
        : `${displayName} (${severity})`;
    }
    case 'burning': {
      const turns = effectData.remainingTurns;
      const stacks = effectData.stackedCount;
      const parts = [displayName];
      if (turns !== undefined) parts.push(`${turns} turns`);
      if (stacks !== undefined && stacks > 1) parts.push(`x${stacks}`);
      return parts.length > 1
        ? `${parts[0]} (${parts.slice(1).join(', ')})`
        : displayName;
    }
    case 'poisoned': {
      const turns = effectData.remainingTurns;
      return turns !== undefined ? `${displayName} (${turns} turns)` : displayName;
    }
    case 'fractured':
      return displayName;
    default:
      return displayName;
  }
}

/**
 * Generate HTML for status effect icons.
 *
 * @param {Array<{type: string, data: object}>} effects - Effects to render.
 * @param {(value: string) => string} escapeHtml - Escaper for tooltip text.
 * @returns {string} HTML string of effect icons.
 */
export function generateEffectIconsHTML(effects, escapeHtml) {
  if (!Array.isArray(effects) || effects.length === 0) {
    return '';
  }

  const escape = typeof escapeHtml === 'function' ? escapeHtml : (value) => value;

  const iconsHTML = effects
    .map((effect) => {
      const effectClass = EFFECT_CSS_CLASSES[effect.type];
      const classes = [EFFECT_CSS_CLASSES.base, effectClass]
        .filter(Boolean)
        .join(' ');
      const tooltip = escape(formatEffectTooltip(effect.type, effect.data));
      const emoji = EFFECT_EMOJIS[effect.type] || '';
      return `<span class="${classes}" title="${tooltip}">${emoji}</span>`;
    })
    .join('');

  return `<div class="${EFFECT_CSS_CLASSES.container}">${iconsHTML}</div>`;
}
