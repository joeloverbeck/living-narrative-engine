# ACTDESC-020: Implement Error Recovery and Resilience

## Status
🟡 **Pending**

## Phase
**Phase 6: Advanced Features** (Week 4)

## Description
Implement comprehensive error recovery mechanisms to handle malformed metadata, missing entities, evaluation errors, and edge cases gracefully without breaking description generation.

## Background
Production systems must handle errors gracefully. This ticket ensures the activity description system never crashes the game, always produces some output, and logs issues for debugging.

**Reference**: Design document lines 2484-2574 (Error Handling and Recovery)

## Technical Specification

### Entry Point: `generateActivityDescription`

`ActivityDescriptionService.generateActivityDescription` already asserts that `entityId` is a non-blank string and wraps the rest of the method in a `try`/`catch`. Error-recovery work for this ticket should build on that reality:

- Short-circuit when `getEntityInstance` returns a falsey value or throws. Log a warning and return `''` before trying to collect metadata.
- Keep `this.#closenessCache.clear()` and the existing debug logs, but ensure any additional logging fits the service's current message patterns (``Failed to …`` or ``No …``).
- Continue returning an empty string on failure. Any new telemetry that should happen on fatal errors must be triggered inside the `catch` block that already exists.
- If emitting error events is still desired, note that the class currently does **not** accept an `eventBus` dependency. You must extend the constructor signature, update dependency validation, and add a private field before dispatching anything.

### Metadata Collection (`#collectActivityMetadata`, `#collectInlineMetadata`, `#collectDedicatedMetadata`)

The service already consolidates metadata through `#collectActivityMetadata`, which calls `#collectInlineMetadata` and `#collectDedicatedMetadata` after optionally hitting an external index. For resilience:

- Harden `#collectActivityMetadata` so a failure in any source logs the issue and continues gathering remaining data. It currently wraps each source in a `try`/`catch`; extend those paths to handle missing entities (when `getEntityInstance` returns `null`/`undefined`).
- `#collectInlineMetadata` iterates `entity.componentTypeIds` and directly pushes whatever `#parseInlineMetadata` returns. Add validation so malformed activities are skipped with a warning instead of propagating `null`/incomplete objects further downstream.
- `#collectDedicatedMetadata` assumes a single `activity:description_metadata` component. Guard all entity interactions—`hasComponent`, `getComponentData`, `entity.getComponentData(sourceComponent)`—because they can throw when the entity proxy is corrupted. Log context-rich errors (component ID, entity ID) before continuing.
- If additional helpers (for example `#isValidActivity`) are useful, add them with private `#` prefixes to match existing style. No “Safe” suffix methods currently exist, so either retrofit the existing ones with additional guards or introduce helpers that they call internally.

### Filtering and Formatting (`#filterByConditions`, `#formatActivityDescription`, grouping helpers)

Formatting already happens through `#formatActivityDescription`, which reads configuration, resolves names/pronouns, groups activities, and generates phrases.

- Wrap accesses to `this.#anatomyFormattingService.getActivityIntegrationConfig?.()` so configuration failures fall back to sane defaults without throwing. There is no `#getConfigSafe` helper today, so either inline the `try`/`catch` or introduce a new helper that the formatter calls.
- `#formatActivityDescription` loops through grouped activities without guarding `#groupActivities`, `#generateActivityPhrase`, or `#buildRelatedActivityFragment`. Add targeted `try`/`catch` blocks around these calls so one malformed activity does not block the rest.
- Keep the current return contract (`''` when nothing useful can be produced). Ensure separators/prefixes/suffixes are read from either the real config or your default object so the existing pronoun logic continues to work.
- `#filterByConditions` and the helpers it uses (`#evaluateActivityVisibility`, JSON-logic evaluation, etc.) already fail open in some branches. Audit these paths for thrown errors (e.g., when the JSON logic service throws, when a target entity lookup fails) and ensure they log and return booleans that allow processing to continue.

### Name and Pronoun Resolution (`#resolveEntityName`, `#detectEntityGender`)

Name resolution currently happens through `#resolveEntityName`, which caches values and catches lookup errors. The method warns (not errors) and returns the original `entityId` on failure. Keep that contract, but verify it handles `null` IDs gracefully and does not attempt to access properties on undefined entities. Pronoun detection (`#detectEntityGender`) should similarly degrade to `'unknown'` without throwing. If new tests need to call these helpers directly, extend `getTestHooks()` to expose bound wrappers (e.g., `resolveEntityName: (...args) => this.#resolveEntityName(...args)`).

### Optional Error Event Dispatching

If telemetry events are required, add an optional `eventBus` dependency:

- Update the constructor to accept `{ eventBus = null }`, validate it (e.g., by checking for a `dispatch` function), and store it in a new private field.
- Implement a private `#dispatchError(errorType, context)` helper that wraps calls to `eventBus.dispatch` in `try`/`catch`. Use it inside the main `catch` block of `generateActivityDescription` and anywhere else it makes sense.
- Because this is a new capability, update `getTestHooks()` only if you need to expose the dispatcher to tests; otherwise rely on injecting a mock bus.

## Acceptance Criteria
- [ ] `generateActivityDescription` logs and returns `''` when the entity lookup fails or any fatal error occurs.
- [ ] `#collectActivityMetadata`, `#collectInlineMetadata`, and `#collectDedicatedMetadata` continue processing when individual components throw.
- [ ] Malformed activity records are filtered out before reaching `#formatActivityDescription`.
- [ ] Configuration lookup failures fall back to a documented default object.
- [ ] Grouping/formatting errors are isolated so other groups still render.
- [ ] Name and pronoun resolution gracefully handle missing data and continue using caches.
- [ ] Optional: error events are dispatched when an `eventBus` dependency is provided (constructor updated accordingly).
- [ ] Unit tests cover missing-entity, malformed metadata, configuration failure, and optional event dispatch scenarios.

## Dependencies
- **Requires**: All Phase 5 features
- **Blocks**: Phase 7 (Production needs resilience)
- **Enhances**: System reliability

## Testing Requirements

```javascript
describe('ActivityDescriptionService – Error Recovery', () => {
  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockEntityManager = { getEntityInstance: jest.fn() };
    mockFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        prefix: 'Activity: ',
        suffix: '.',
        separator: '. ',
      }),
    };
    mockJsonLogic = { evaluate: jest.fn().mockReturnValue(true) };
    mockActivityIndex = { findActivitiesForEntity: jest.fn().mockReturnValue([]) };
    mockEventBus = { dispatch: jest.fn() };

    service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      jsonLogicEvaluationService: mockJsonLogic,
      activityIndex: mockActivityIndex,
      eventBus: mockEventBus, // optional – inject only in tests that need it
    });
  });

  it('returns empty string and logs when entity lookup fails', async () => {
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    const description = await service.generateActivityDescription('missing');

    expect(description).toBe('');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing')
    );
  });

  it('continues processing when inline metadata parsing throws', async () => {
    const entity = {
      id: 'jon',
      componentTypeIds: ['comp1', 'comp2'],
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'comp1') {
          return {
            activityMetadata: { shouldDescribeInActivity: true, template: null },
          };
        }
        if (componentId === 'comp2') {
          return {
            activityMetadata: {
              shouldDescribeInActivity: true,
              template: '{actor} is valid',
              priority: 75,
            },
          };
        }
        return null;
      }),
      hasComponent: jest.fn().mockReturnValue(false),
    };

    mockEntityManager.getEntityInstance.mockReturnValue(entity);
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('valid');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('comp1'),
      expect.any(Error)
    );
  });

  it('uses default formatting config when service throws', async () => {
    mockFormattingService.getActivityIntegrationConfig.mockImplementation(() => {
      throw new Error('Config error');
    });
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      {
        actorId: 'jon',
        description: 'performs a valid action',
        priority: 50,
      },
    ]);
    mockEntityManager.getEntityInstance.mockImplementation((id) => ({
      id,
      getComponentData: jest.fn(() => ({ text: id })),
    }));

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/^Activity:/);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get activity integration config'),
      expect.any(Error)
    );
  });

  it('falls back to entityId when name resolution fails', () => {
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Entity manager error');
    });

    const hooks = service.getTestHooks();
    expect(hooks.resolveEntityName).toBeDefined();

    const name = hooks.resolveEntityName('entity_id');

    expect(name).toBe('entity_id');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('entity_id'),
      expect.any(Error)
    );
  });

  it('dispatches error events when eventBus is provided', async () => {
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Critical error');
    });

    await service.generateActivityDescription('jon');

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVITY_DESCRIPTION_ERROR',
        payload: expect.objectContaining({ entityId: 'jon' }),
      })
    );
  });

  it('returns empty string on cascading failures without throwing', async () => {
    mockEntityManager.getEntityInstance.mockImplementation(() => {
      throw new Error('Entity error');
    });
    mockFormattingService.getActivityIntegrationConfig.mockImplementation(() => {
      throw new Error('Config error');
    });

    const description = await service.generateActivityDescription('jon');

    expect(description).toBe('');
  });
});
```

## Implementation Notes
1. **Fail Gracefully**: Always return something (empty string > crash)
2. **Partial Results**: Process what we can, skip failures
3. **Logging**: Log all errors for debugging
4. **Event Dispatching**: Notify system of errors for monitoring
5. **Validation**: Validate structures before processing

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2484-2574)

## Success Metrics
- No crashes on malformed data
- Partial results on partial failures
- All errors logged
- Error events dispatched
- Graceful degradation verified

## Related Tickets
- **Requires**: All Phase 5 features
- **Enhances**: System reliability and production readiness
- **Enables**: Safe production deployment
