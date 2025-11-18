export const PLANNING_STATE_COMPONENT_STATUSES = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  UNKNOWN: 'unknown',
});

export const PLANNING_STATE_COMPONENT_SOURCES = Object.freeze({
  FLAT: 'flat',
  STATE: 'state',
  ACTOR: 'actor',
});

export const PLANNING_STATE_COMPONENT_REASONS = Object.freeze({
  COMPONENT_PRESENT: 'component-present',
  COMPONENT_MISSING: 'component-missing',
  ENTITY_MISSING: 'entity-missing',
  INVALID_LOOKUP: 'invalid-component-lookup',
});

/**
 * @typedef {'present'|'absent'|'unknown'} PlanningStateComponentStatus
 * @typedef {'flat'|'state'|'actor'} PlanningStateComponentSource
 * @typedef {'component-present'|'component-missing'|'entity-missing'|'invalid-component-lookup'} PlanningStateComponentReason
 *
 * @typedef {object} PlanningStateComponentLookupBase
 * @property {PlanningStateComponentStatus} status
 * @property {boolean} value
 * @property {PlanningStateComponentSource|null} source
 * @property {PlanningStateComponentReason|null} reason
 *
 * @typedef {PlanningStateComponentLookupBase & { status: 'present', source: PlanningStateComponentSource, reason: null }} PlanningStateComponentPresentResult
 * @typedef {PlanningStateComponentLookupBase & { status: 'absent', source: PlanningStateComponentSource, reason: 'component-missing', value: false }} PlanningStateComponentAbsentResult
 * @typedef {PlanningStateComponentLookupBase & { status: 'unknown', source: null, reason: 'entity-missing'|'invalid-component-lookup', value: false }} PlanningStateComponentUnknownResult
 *
 * @typedef {PlanningStateComponentPresentResult|PlanningStateComponentAbsentResult|PlanningStateComponentUnknownResult} PlanningStateComponentLookupResult
 */

/**
 * Determine if the lookup represents a known entity/component relationship.
 * @param {PlanningStateComponentLookupResult} result
 * @returns {result is PlanningStateComponentPresentResult|PlanningStateComponentAbsentResult}
 */
export function isKnownComponent(result) {
  return (
    !!result &&
    (result.status === PLANNING_STATE_COMPONENT_STATUSES.PRESENT ||
      result.status === PLANNING_STATE_COMPONENT_STATUSES.ABSENT)
  );
}

/**
 * Determine if the lookup represents an unknown/indeterminate planning-state answer.
 * @param {PlanningStateComponentLookupResult} result
 * @returns {result is PlanningStateComponentUnknownResult}
 */
export function isUnknownComponent(result) {
  return !!result && result.status === PLANNING_STATE_COMPONENT_STATUSES.UNKNOWN;
}
