# ACTDESC-022: Handle Edge Cases and Corner Scenarios

## Status
🟡 **Pending**

## Phase
**Phase 7: Production Polish** (Week 4-5)

## Description
Implement comprehensive handling for edge cases, corner scenarios, and unusual states that could occur in production: empty activity collections, repeated/circular metadata, extremely long descriptions, special characters, and unusual entity configurations. Align the work with the existing `ActivityDescriptionService` implementation in `src/anatomy/services/activityDescriptionService.js`.

## Background
Production systems encounter unexpected scenarios. This ticket ensures the activity description system handles all edge cases gracefully without degrading user experience.

**Reference**: Design document lines 2656-2745 (Edge Case Handling)

## Technical Specification

### Edge Case Enhancements

The current service already short-circuits when metadata is missing, but several helper methods need to be hardened. All work happens inside `ActivityDescriptionService` unless explicitly noted.

#### 1. Empty or Missing Data
- Keep the existing early returns inside `generateActivityDescription`, but ensure the post-filter path is consistent:
  ```javascript
  const activities = this.#collectActivityMetadata(entityId, entity);

  if (activities.length === 0) {
    this.#logger.debug(`No activities found for entity: ${entityId}`);
    return '';
  }

  const conditionedActivities = this.#filterByConditions(activities, entity);

  if (conditionedActivities.length === 0) {
    this.#logger.debug(
      `No visible activities available after filtering for entity: ${entityId}`
    );
    return '';
  }
  ```
- After filtering, invoke the new deduplication helper (see below) before sorting and formatting so that empty results from deduplication also return an empty string without throwing.

#### 2. Duplicate and Circular Activity Metadata
- Introduce `#deduplicateActivitiesBySignature(activities)` to collapse metadata that describes the same interaction (e.g. same `template` + `targetEntityId`, or same `sourceComponent` + `targetEntityId`).
- Call the helper right before `#sortByPriority` in `generateActivityDescription`.
- Emit a debug log when duplicates are removed so telemetry can track noisy metadata.
- Expose the helper through `getTestHooks()`.

#### 3. Extremely Long Descriptions
- Extend `DEFAULT_ACTIVITY_FORMATTING_CONFIG` with `maxDescriptionLength: 500`.
- Update `#getActivityIntegrationConfig()` so downstream overrides can customise the length.
- Add `#truncateDescription(description, maxLength)` and use it at the end of `#formatActivityDescription` before returning the final string.
- Prefer truncating on the last period (like the UI example) and fall back to an ellipsis when none exists.

#### 4. Special Characters and Name Sanitisation
- Add a dedicated `#sanitizeEntityName(name)` helper that strips control characters, collapses whitespace, and falls back to `'Unknown entity'` when the result is empty. Expose it through `getTestHooks()` for white-box tests.
- Harden `#resolveEntityName(entityId)` so the returned value always passes through `#sanitizeEntityName` before being cached.
- When the resolved value becomes empty, fall back to `'Unknown entity'` (and cache that value to avoid repeated work).
- Leave the cache key unchanged so the sanitised value is reused.

#### 5. Self-Targeting Activities and Reflexive Pronouns
- Update `#generateActivityPhrase` to accept the actor entity ID (pass it from the call sites in `#formatActivityDescription`).
- When `targetEntityId` matches the actor ID, prefer reflexive pronouns via a new `#getReflexivePronoun` helper. Respect the `usePronounsForTarget` flag when selecting between the reflexive pronoun and the actor's display name.
- Ensure existing calls that omit the actor still work (e.g. related activity fragments should continue to request `omitActor: true`).

#### 6. Missing Target Entities
- When `#resolveEntityName` cannot locate an entity, log at debug level and return the sanitised entity ID instead of the raw ID.
- Ensure `#generateActivityPhrase` gracefully handles `null` or `undefined` targets without throwing (including the self-targeting branch above).

#### 7. Guarding Activity Index Interactions
- `#groupActivities` already tracks visited nodes, but ensure the new deduplicated list prevents infinite loops caused by repeated references.
- When `#getActivityIndex` receives an empty array, short-circuit before caching.

### Configuration Additions
Extend the default configuration object instead of adding a nested `edgeCases` block:

```javascript
const DEFAULT_ACTIVITY_FORMATTING_CONFIG = Object.freeze({
  enabled: true,
  prefix: 'Activity: ',
  suffix: '.',
  separator: '. ',
  maxActivities: 10,
  enableContextAwareness: true,
  maxDescriptionLength: 500,
  deduplicateActivities: true,
  nameResolution: Object.freeze({
    usePronounsWhenAvailable: false,
    preferReflexivePronouns: true,
  }),
});
```

`#getActivityIntegrationConfig` should merge the new properties so overrides remain backwards compatible.

## Acceptance Criteria
- [ ] Empty activity lists handled gracefully
- [ ] Circular references and duplicate metadata prevented
- [ ] Extremely long descriptions truncated intelligently
- [ ] Special characters sanitised through `#resolveEntityName`
- [ ] Self-targeting activities use reflexive pronouns when configured
- [ ] Missing target entities handled with sanitised fallbacks
- [ ] Duplicate activity metadata deduplicated before formatting
- [ ] Configuration exposes toggles and limits for edge case handling
- [ ] Tests verify all edge cases
- [ ] No crashes on unusual inputs

## Dependencies
- **Requires**: All Phase 6 features (ACTDESC-018 to ACTDESC-021)
- **Blocks**: ACTDESC-024 (Documentation needs complete implementation)
- **Enhances**: Production robustness

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Edge Cases', () => {
  it('returns an empty string when no activities exist', async () => {
    const description = await service.generateActivityDescription('jon');
    expect(description).toBe('');
  });

  it('deduplicates duplicate metadata before formatting', () => {
    const hooks = service.getTestHooks();
    const activities = [
      { template: '{actor} waves', targetEntityId: 'alicia', priority: 70 },
      { template: '{actor} waves', targetEntityId: 'alicia', priority: 80 },
    ];

    const deduplicated = hooks.deduplicateActivitiesBySignature(activities);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].priority).toBe(80);
  });

  it('truncates extremely long descriptions', () => {
    const hooks = service.getTestHooks();
    const longDescription = 'Activity: ' + 'Jon is doing something. '.repeat(50);

    const truncated = hooks.truncateDescription(longDescription, 500);

    expect(truncated.length).toBeLessThanOrEqual(500);
    expect(truncated.endsWith('.') || truncated.endsWith('...')).toBe(true);
  });

  it('sanitises entity names with special characters', () => {
    const hooks = service.getTestHooks();
    const sanitized = hooks.sanitizeEntityName('  Jon\x00Ureña  ');

    expect(sanitized).toBe('JonUreña');
  });

  it('uses reflexive pronouns for self-targeting activities', async () => {
    // Arrange entity + activity metadata that targets the actor id
    // Expect the generated description to use "himself" / "herself" / "themselves"
  });

  it('falls back gracefully when a target entity is missing', async () => {
    // Configure metadata that references a missing target and ensure no crash occurs
    // Expect the sanitised target id to appear in the final description
  });
});
```

## Implementation Notes
1. **Fail Gracefully**: Return empty string > crash
2. **Sanitize Inputs**: Clean all user-facing strings
3. **Detect Duplicates**: Based on content, not object identity
4. **Length Limits**: Prevent UI overflow
5. **Reflexive Pronouns**: "himself", "herself", "themselves" for self-targets

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2656-2745)

## Success Metrics
- All edge cases handled gracefully
- No crashes on unusual inputs
- Intelligent fallbacks for missing data
- Tests verify all scenarios
- Production-ready robustness

## Related Tickets
- **Requires**: All Phase 6 features
- **Enhances**: Production readiness and reliability
- **Enables**: Safe deployment to all users
