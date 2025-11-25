# ENHACTINFFORLLM-002: Create ModActionMetadataProvider Service

**Status**: ✅ COMPLETED

## Summary
Create a new service that retrieves mod-level action metadata (actionPurpose, actionConsiderWhen) from mod manifests stored in the data registry.

## Prerequisites
- ENHACTINFFORLLM-001 must be completed (schema changes)

## Files to Touch
- `src/prompting/modActionMetadataProvider.js` (NEW FILE)

> **CORRECTED**: The original ticket specified `src/prompting/services/modActionMetadataProvider.js`, but the `src/prompting/` directory does not use a `services/` subdirectory pattern. Other similar files (like `promptStaticContentService.js`, `promptTemplateService.js`) are placed directly in `src/prompting/`.

## Out of Scope
- DO NOT modify `AIPromptContentProvider.js` (that's ENHACTINFFORLLM-004)
- DO NOT modify DI registrations (that's ENHACTINFFORLLM-003)
- DO NOT modify any schema files
- DO NOT create test files (that's ENHACTINFFORLLM-005)

## Implementation Details

### Directory Structure
~~Create new directory if it doesn't exist: `src/prompting/services/`~~

**CORRECTED**: No new directory needed. File goes directly in `src/prompting/`.

### Service Implementation

```javascript
/**
 * @file Provides mod-level action metadata for LLM prompt formatting.
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @typedef {object} ModActionMetadata
 * @property {string} modId - The mod identifier
 * @property {string|undefined} actionPurpose - Description of action purpose
 * @property {string|undefined} actionConsiderWhen - Guidance on when to use
 */

/**
 * Service that retrieves mod-level action metadata from manifests.
 * Used by AIPromptContentProvider to enrich action group headers in prompts.
 */
class ModActionMetadataProvider {
  #dataRegistry;
  #logger;
  #cache;

  /**
   * @param {object} deps
   * @param {import('../interfaces/coreServices.js').IDataRegistry} deps.dataRegistry
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Retrieves action metadata for a specific mod.
   * @param {string} modId - The mod identifier (namespace)
   * @returns {ModActionMetadata|null} Metadata or null if mod not found
   */
  getMetadataForMod(modId) {
    // 1. Validate input
    if (!modId || typeof modId !== 'string') {
      this.#logger.warn(
        'ModActionMetadataProvider: Invalid modId provided',
        { modId }
      );
      return null;
    }

    // 2. Normalize modId (lowercase for registry lookup)
    const normalizedModId = modId.toLowerCase();

    // 3. Check cache
    if (this.#cache.has(normalizedModId)) {
      return this.#cache.get(normalizedModId);
    }

    // 4. Retrieve manifest from registry
    const manifest = this.#dataRegistry.get('mod_manifests', normalizedModId);

    if (!manifest) {
      this.#logger.debug(
        `ModActionMetadataProvider: No manifest found for mod '${normalizedModId}'`
      );
      this.#cache.set(normalizedModId, null);
      return null;
    }

    // 5. Extract metadata
    const metadata = {
      modId: normalizedModId,
      actionPurpose: manifest.actionPurpose,
      actionConsiderWhen: manifest.actionConsiderWhen,
    };

    // 6. Cache and return
    this.#cache.set(normalizedModId, metadata);

    this.#logger.debug(
      `ModActionMetadataProvider: Retrieved metadata for mod '${normalizedModId}'`,
      {
        hasActionPurpose: !!metadata.actionPurpose,
        hasActionConsiderWhen: !!metadata.actionConsiderWhen,
      }
    );

    return metadata;
  }

  /**
   * Clears internal cache (for testing/manifest reload scenarios).
   */
  clearCache() {
    this.#cache.clear();
    this.#logger.debug('ModActionMetadataProvider: Cache cleared');
  }
}

export { ModActionMetadataProvider };
```

> **CORRECTED** import paths:
> - `validateDependency` import changed from `'../../utils/dependencyUtils.js'` to `'../utils/dependencyUtils.js'`
> - JSDoc type paths changed from `'../../data/interfaces/IDataRegistry.js'` to `'../interfaces/coreServices.js'` (the correct location for type definitions)

## Acceptance Criteria

### Tests That Must Pass
- File compiles without errors: `npm run typecheck`
- ESLint passes: `npx eslint src/prompting/services/modActionMetadataProvider.js`
- No circular dependency issues: `npm run depcruise:check` (if available)

### Invariants That Must Remain True
1. Service follows existing DI patterns (constructor injection)
2. Service validates dependencies using `validateDependency`
3. Service uses private fields (`#`) consistently with codebase style
4. Cache is a `Map` for consistent O(1) lookups
5. ModId is normalized to lowercase before registry lookup
6. Returns `null` for missing manifests (graceful degradation)
7. Logs appropriately at debug/warn levels

## Verification Steps
1. Run `npm run typecheck`
2. Run `npx eslint src/prompting/modActionMetadataProvider.js`
3. Verify file structure matches existing services in codebase

---

## Outcome

**Completed**: 2025-11-25

### What Changed vs. Originally Planned

| Aspect | Original Plan | Actual Implementation |
|--------|---------------|----------------------|
| File location | `src/prompting/services/modActionMetadataProvider.js` | `src/prompting/modActionMetadataProvider.js` |
| `validateDependency` import | `'../../utils/dependencyUtils.js'` | `'../utils/dependencyUtils.js'` |
| JSDoc type paths | `'../../data/interfaces/IDataRegistry.js'` | `'../interfaces/coreServices.js'` |

### Corrections Made

1. **Directory structure**: The `src/prompting/` directory does not use a `services/` subdirectory pattern. Other service files (e.g., `promptStaticContentService.js`, `promptTemplateService.js`) are placed directly in `src/prompting/`. File placed at the correct location.

2. **Import paths**: Adjusted to match the actual file's location in the directory hierarchy.

3. **Type definition paths**: The `IDataRegistry` type is exported from `src/interfaces/coreServices.js`, not from a non-existent `src/data/interfaces/IDataRegistry.js`.

### Verification Results

- ✅ `npm run typecheck` - passes (pre-existing errors in unrelated files)
- ✅ `npx eslint src/prompting/modActionMetadataProvider.js` - 0 errors, 5 warnings (JSDoc style)
- ✅ Module loads successfully: `import('./src/prompting/modActionMetadataProvider.js')`
- ✅ All 23 prompting unit test suites pass (399 tests)
- ✅ Basic sanity tests pass (caching, normalization, graceful degradation)

### Notes for Downstream Tickets

- **ENHACTINFFORLLM-003**: DI registration should import from `'../prompting/modActionMetadataProvider.js'` (no `services/` subdirectory)
- **ENHACTINFFORLLM-005**: Test file should be at `tests/unit/prompting/modActionMetadataProvider.test.js` (no `services/` subdirectory)
