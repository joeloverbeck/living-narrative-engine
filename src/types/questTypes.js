// src/types/questTypes.js

/**
 * @typedef {object} RewardSummaryItem
 * @property {string} itemId
 * @property {number} quantity
 */

/**
 * @typedef {object} RewardSummary
 * @property {number | undefined} experience
 * @property {RewardSummaryItem[] | undefined} items
 * @property {Record<string, number> | undefined} currency
 * @property {string[] | undefined} gameStateFlagsSet // Optional: List flags set
 */