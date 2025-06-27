/**
 * @file Defines the interface for listeners that persist generated notes.
 */

/**
 * @typedef {object} INotesListener
 * @property {(event: { type: string, payload: any }) => void} handleEvent
 * Handles an ACTION_DECIDED_ID event and persists notes.
 */

export {};
