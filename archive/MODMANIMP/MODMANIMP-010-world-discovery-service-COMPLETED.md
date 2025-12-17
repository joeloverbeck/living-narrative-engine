# MODMANIMP-010: WorldDiscoveryService

**Status:** Completed ✅
**Priority:** Phase 3 (Services Layer)
**Estimated Effort:** S (3-4 hours)
**Dependencies:** MODMANIMP-008 (ModDiscoveryService)

---

## Outcome (2025-12-17)

### Planned vs Actual Changes

| Aspect | Originally Planned | Actually Implemented |
|--------|-------------------|---------------------|
| API usage | Fetch from `/api/mods/{modId}/worlds` | No API calls - endpoint doesn't exist |
| Data source | Backend world details API | `ModDiscoveryService.getModsWithWorlds()` |
| World names | From API response | Generated as `${mod.name} World` |
| World descriptions | From API response | Use mod description or fallback |
| World ID format | `modId:worldId` from API | Convention `modId:modId` |

### Assumption Corrections Made

The original ticket assumed a backend API endpoint `/api/mods/{modId}/worlds` existed. Investigation revealed:
1. No such endpoint exists in the backend
2. Backend only provides `GET /api/mods` with `hasWorlds: boolean`
3. Creating new backend endpoints is out of scope per ticket constraints

**Resolution:** Implemented client-side world discovery using mod metadata convention.

### Files Created

1. `src/modManager/services/WorldDiscoveryService.js` - Service implementation
2. `tests/unit/modManager/services/WorldDiscoveryService.test.js` - 28 unit tests

### Test Results

All 28 tests passing:
- Constructor validation: 4 tests
- `discoverWorlds`: 8 tests
- `isWorldAvailable`: 4 tests
- `parseWorldId`: 12 tests

### Bug Fix During Implementation

Fixed `parseWorldId` edge case: input `'mod:'` was returning `{modId: "mod", worldId: ""}` instead of `null`. Changed check from `rest.length === 0` to `!parsedWorldId` to properly handle empty string.

---

## Objective

Create a service that discovers available worlds from active mods. This service filters mods that have `hasWorlds: true` and constructs world identifiers in the format expected by game.json (`modId:worldId`).

---

## Files to Touch

### New Files

- `src/modManager/services/WorldDiscoveryService.js`
- `tests/unit/modManager/services/WorldDiscoveryService.test.js`

---

## Out of Scope

**DO NOT modify:**

- Backend API (worlds are discovered client-side from mod metadata)
- Existing WorldLoader class
- Game configuration loading
- Mod manifests or world files

---

## Assumptions Corrected (2025-12-17)

**Original Assumption (Incorrect):** The ticket originally assumed an API endpoint `/api/mods/{modId}/worlds` exists that returns world details (name, description).

**Corrected Understanding:**
1. **No such API exists** - The backend only provides `GET /api/mods` returning mod metadata with `hasWorlds: boolean`.
2. **Backend API is out of scope** - Per this ticket's constraints, we cannot create new backend endpoints.
3. **World details not available client-side** - Since the browser cannot scan the filesystem, detailed world metadata (names, descriptions from world files) is unavailable without backend support.

**Revised Implementation Approach:**
- Use `ModDiscoveryService.getModsWithWorlds()` which already filters mods with `hasWorlds: true`
- Create basic world entries using convention `modId:modId` for the primary world
- Generate display names from mod metadata (mod name + " World")
- Remove all API fetch logic for world details (non-existent endpoint)
- This provides a working MVP; future ticket can add backend world details API if needed

---

## Implementation Details

### Service Class

```javascript
// src/modManager/services/WorldDiscoveryService.js
/**
 * @file Service for discovering available worlds from active mods
 * @see src/loaders/worldLoader.js
 */

/**
 * @typedef {Object} WorldInfo
 * @property {string} id - Full world ID (modId:worldId)
 * @property {string} modId - Source mod ID
 * @property {string} worldId - World identifier within mod
 * @property {string} name - Display name
 * @property {string} description - World description
 */

/**
 * Service for discovering worlds from mod metadata.
 *
 * Note: Since no backend API exists for world details, this service
 * derives world information from mod metadata only, using the convention
 * that each mod with worlds has a primary world with ID `modId:modId`.
 */
export class WorldDiscoveryService {
  #logger;
  #modDiscoveryService;

  /**
   * @param {Object} options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.modDiscoveryService - ModDiscoveryService instance
   */
  constructor({ logger, modDiscoveryService }) {
    if (!logger) {
      throw new Error('WorldDiscoveryService: logger is required');
    }
    if (!modDiscoveryService) {
      throw new Error('WorldDiscoveryService: modDiscoveryService is required');
    }
    this.#logger = logger;
    this.#modDiscoveryService = modDiscoveryService;
  }

  /**
   * Get available worlds from a set of active mods
   * @param {string[]} activeModIds - Currently active mod IDs
   * @returns {Promise<WorldInfo[]>}
   */
  async discoverWorlds(activeModIds) {
    this.#logger.info('WorldDiscoveryService: Discovering worlds from active mods...');

    const modsWithWorlds = await this.#modDiscoveryService.getModsWithWorlds();
    const activeModSet = new Set(activeModIds);

    // Filter to only active mods that have worlds
    const activeModsWithWorlds = modsWithWorlds.filter(
      (mod) => activeModSet.has(mod.id)
    );

    if (activeModsWithWorlds.length === 0) {
      this.#logger.info('WorldDiscoveryService: No active mods contain worlds');
      return [];
    }

    // Create world entries from mod metadata
    const worlds = activeModsWithWorlds.map((mod) => this.#createWorldFromMod(mod));

    this.#logger.info(
      `WorldDiscoveryService: Discovered ${worlds.length} worlds from ${activeModsWithWorlds.length} mods`
    );
    return worlds;
  }

  /**
   * Create world entry from mod metadata
   * Uses convention modId:modId for primary world
   * @param {Object} mod - Mod metadata
   * @returns {WorldInfo}
   */
  #createWorldFromMod(mod) {
    return {
      id: `${mod.id}:${mod.id}`,
      modId: mod.id,
      worldId: mod.id,
      name: `${mod.name} World`,
      description: mod.description || `Main world from ${mod.name}`,
    };
  }

  /**
   * Validate that a world ID is available from active mods
   * @param {string} worldId - Full world ID (modId:worldId)
   * @param {string[]} activeModIds - Currently active mod IDs
   * @returns {Promise<boolean>}
   */
  async isWorldAvailable(worldId, activeModIds) {
    const worlds = await this.discoverWorlds(activeModIds);
    return worlds.some((w) => w.id === worldId);
  }

  /**
   * Parse a world ID into its components
   * @param {string} worldId - Full world ID (modId:worldId)
   * @returns {{modId: string, worldId: string}|null}
   */
  parseWorldId(worldId) {
    if (!worldId || typeof worldId !== 'string' || !worldId.includes(':')) {
      return null;
    }
    const [modId, ...rest] = worldId.split(':');
    if (!modId || rest.length === 0) {
      return null;
    }
    return {
      modId,
      worldId: rest.join(':'),
    };
  }
}

export default WorldDiscoveryService;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`WorldDiscoveryService.test.js`):
   - `constructor throws when logger is missing`
   - `constructor throws when modDiscoveryService is missing`
   - `discoverWorlds returns worlds from active mods only`
   - `discoverWorlds filters out mods without hasWorlds`
   - `discoverWorlds returns empty array when no mods have worlds`
   - `discoverWorlds returns empty array when no active mods have worlds`
   - `isWorldAvailable returns true for valid world`
   - `isWorldAvailable returns false for invalid world`
   - `parseWorldId correctly splits modId:worldId`
   - `parseWorldId handles multiple colons in worldId`
   - `parseWorldId returns null for invalid format`
   - `parseWorldId returns null for null/undefined input`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/services/WorldDiscoveryService.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **Integration with ModDiscoveryService:**
   ```bash
   grep -q "modDiscoveryService" src/modManager/services/WorldDiscoveryService.js && echo "OK"
   ```

### Invariants That Must Remain True

1. World IDs use format `modId:worldId`
2. Only discovers worlds from active mods
3. Depends on ModDiscoveryService for mod metadata
4. Uses `getModsWithWorlds()` method (no redundant filtering)
5. Does NOT attempt API calls to non-existent endpoints

---

## Reference Files

- World format: `data/game.json` (startWorld field)
- World loading: `src/loaders/worldLoader.js`
- Mod metadata: `llm-proxy-server/src/services/modScannerService.js`
- Mod discovery: `src/modManager/services/ModDiscoveryService.js`
