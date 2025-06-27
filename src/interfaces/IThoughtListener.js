/**
 * @file Defines the interface for listeners that persist AI thoughts.
 */

/**
 * @typedef {object} IThoughtListener
 * @property {(event: { type: string, payload: any }) => void} handleEvent
 * Handles an ACTION_DECIDED_ID event and persists thoughts.
 */

export {};
