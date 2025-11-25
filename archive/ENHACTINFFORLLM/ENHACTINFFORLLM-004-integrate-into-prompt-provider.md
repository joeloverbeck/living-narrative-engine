# ENHACTINFFORLLM-004: Integrate ModActionMetadataProvider into AIPromptContentProvider

## Status: ✅ COMPLETED

## Summary
Update AIPromptContentProvider to use the ModActionMetadataProvider service to include Purpose and Consider When metadata in the formatted action output.

## Prerequisites
- ENHACTINFFORLLM-002 must be completed (service implementation)
- ENHACTINFFORLLM-003 must be completed (DI registration)

## Files to Touch
- `src/prompting/AIPromptContentProvider.js`
- `src/dependencyInjection/registrations/aiRegistrations.js` (update factory only)

## Out of Scope
- DO NOT modify the `ModActionMetadataProvider` service itself
- DO NOT modify schema files
- DO NOT create test files (that's ENHACTINFFORLLM-006)
- DO NOT modify mod manifest JSON files

## Implementation Details

### 1. Update AIPromptContentProvider Class

Location: `src/prompting/AIPromptContentProvider.js`

#### 1a. Add Private Field (line 53, after `#actionCategorizationService`)

```javascript
/** @type {import('./services/modActionMetadataProvider.js').ModActionMetadataProvider} */
#modActionMetadataProvider;
```

#### 1b. Add JSDoc Typedef (near top of file, with other typedefs)

```javascript
/** @typedef {import('./services/modActionMetadataProvider.js').ModActionMetadata} ModActionMetadata */
```

#### 1c. Update Constructor (starting at line 63)

Add to constructor parameters:
```javascript
modActionMetadataProvider,
```

**NOTE**: Constructor uses `validateDependencies()` (array-based batch validation), NOT individual `validateDependency()` calls.

Add to the dependencies array in `validateDependencies`:
```javascript
{
  dependency: modActionMetadataProvider,
  name: 'AIPromptContentProvider: modActionMetadataProvider',
  methods: ['getMetadataForMod'],
},
```

Add assignment (after `this.#actionCategorizationService = actionCategorizationService;`):
```javascript
this.#modActionMetadataProvider = modActionMetadataProvider;
```

#### 1d. Update `_formatCategorizedActions` Method (lines 662-722)

Replace the for loop body (currently lines 685-697) with:

```javascript
for (const [namespace, namespaceActions] of grouped) {
  const displayName =
    this.#actionCategorizationService.formatNamespaceDisplayName(namespace);

  // Look up mod manifest for metadata
  const metadata = this.#modActionMetadataProvider.getMetadataForMod(namespace);

  // Format header with action count
  segments.push(`### ${displayName} Actions (${namespaceActions.length} actions)`);

  // Add purpose if available
  if (metadata?.actionPurpose) {
    segments.push(`**Purpose:** ${metadata.actionPurpose}`);
  }

  // Add consider when if available
  if (metadata?.actionConsiderWhen) {
    segments.push(`**Consider when:** ${metadata.actionConsiderWhen}`);
  }

  // Add spacing after header metadata
  if (metadata?.actionPurpose || metadata?.actionConsiderWhen) {
    segments.push('');
  }

  for (const action of namespaceActions) {
    segments.push(this._formatSingleAction(action));
  }

  segments.push(''); // Empty line between sections
}
```

### 2. Update DI Factory Registration

Location: `src/dependencyInjection/registrations/aiRegistrations.js`

Update the `IAIPromptContentProvider` factory (around line 348) to include the new dependency:

```javascript
registrar.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
  return new AIPromptContentProvider({
    logger: c.resolve(tokens.ILogger),
    promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
    perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
    gameStateValidationService: c.resolve(
      tokens.IGameStateValidationServiceForPrompting
    ),
    actionCategorizationService: c.resolve(
      tokens.IActionCategorizationService
    ),
    characterDataXmlBuilder: c.resolve(tokens.CharacterDataXmlBuilder),
    modActionMetadataProvider: c.resolve(tokens.IModActionMetadataProvider),  // NEW
  });
});
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run typecheck` passes
- `npm run test:unit -- --testPathPattern="AIPromptContentProvider"` passes
- `npm run test:integration -- --testPathPattern="prompting"` passes
- All existing tests continue to pass (backward compatibility)

### Invariants That Must Remain True
1. Output format unchanged when metadata is NOT present (graceful degradation)
2. Private field naming follows `#` convention
3. Dependency validation follows existing pattern using `validateDependency`
4. Optional chaining (`?.`) used for metadata property access
5. Action count is added to header: `Actions (N actions)`
6. Empty line added between sections only when metadata is present
7. Existing logging behavior preserved

## Verification Steps
1. Run `npm run typecheck`
2. Run `npx eslint src/prompting/AIPromptContentProvider.js`
3. Run `npm run test:unit -- --testPathPattern="AIPromptContentProvider"`
4. Manually verify output format with a test that has metadata and without

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made First:**
- The ticket originally assumed individual `validateDependency()` calls, but the actual code uses `validateDependencies()` with an array-based batch validation pattern. Corrected in ticket before implementation.

**Implementation Matched Plan:**
All planned code changes were implemented as specified:

1. **AIPromptContentProvider.js** - All 4 changes applied:
   - Added typedef for `ModActionMetadata`
   - Added private field `#modActionMetadataProvider`
   - Added to constructor parameters, validation array, and assignment
   - Updated `_formatCategorizedActions` to lookup and display metadata

2. **aiRegistrations.js** - Factory updated with new dependency

**Additional Changes Required (Not in Original Plan):**
- Updated 4 test files to provide mock `modActionMetadataProvider`:
  - `tests/unit/prompting/AIPromptContentProvider.test.js`
  - `tests/integration/prompting/notesFormattingIntegration.test.js`
  - `tests/integration/prompting/AIPromptPipeline.integration.test.js`
  - `tests/integration/prompting/PromptAssembly.test.js`

**Verification Results:**
- ✅ All 32 unit tests pass
- ✅ All 32 integration tests pass
- ✅ Typecheck passes
- ✅ Backward compatibility maintained (default mock returns `null`)
