// src/prompting/helpers/darknessWorldContextBuilder.js

/**
 * @file Helper to build world context prompt content for locations in darkness.
 * Reuses the presence message system from the DOM UI layer for consistency.
 * @module prompting/helpers/darknessWorldContextBuilder
 */

import { getPresenceMessage } from '../../domUI/location/presenceMessageBuilder.js';

/**
 * Builds world context markdown for a dark location.
 * The output structure mirrors the lit location format for consistency,
 * but replaces detailed information with darkness-appropriate sensory content.
 *
 * @param {object} params - Build parameters.
 * @param {string} params.locationName - The location's display name.
 * @param {string|null} params.darknessDescription - Custom sensory description or null for default.
 * @param {number} params.characterCount - Number of other characters present (for presence sensing).
 * @returns {string} Markdown-formatted world context for the LLM prompt.
 */
export function buildDarknessWorldContext({
  locationName,
  darknessDescription,
  characterCount,
}) {
  const segments = [];

  // Main header - matches lit location structure
  segments.push('## Current Situation');
  segments.push('');

  // Location section
  segments.push('### Location');
  segments.push(locationName);
  segments.push('');

  // Conditions section - indicates darkness
  segments.push('### Conditions');
  segments.push('**Pitch darkness.** You cannot see anything.');
  segments.push('');

  // Sensory impressions if custom description provided
  if (darknessDescription) {
    segments.push('### Sensory Impressions');
    segments.push(darknessDescription);
    segments.push('');
  }

  // Navigation section - cannot see exits in darkness
  segments.push('## Exits from Current Location');
  segments.push('You cannot see any exits in the darkness.');
  segments.push('');

  // Other presences section - uses three-tier sensing
  segments.push('## Other Presences');
  segments.push(getPresenceMessage(characterCount));

  return segments.join('\n');
}
