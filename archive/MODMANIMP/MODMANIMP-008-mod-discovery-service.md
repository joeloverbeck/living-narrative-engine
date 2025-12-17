# MODMANIMP-008: ModDiscoveryService

**Status:** ✅ Completed
**Priority:** Phase 3 (Services Layer)
**Estimated Effort:** S (3-4 hours)
**Dependencies:** MODMANIMP-001 (GET /api/mods endpoint)
**Completed:** 2025-12-17

---

## Outcome

### What Was Actually Changed

1. **Created `src/modManager/services/ModDiscoveryService.js`**:
   - Implemented `ModDiscoveryService` class with caching, fetch API wrapper, error handling
   - Implemented `ModDiscoveryError` custom error class
   - Used esbuild build-time environment variables (`__PROXY_HOST__`, `__PROXY_PORT__`, `__PROXY_USE_HTTPS__`) following existing pattern in `src/config/endpointConfig.js`
   - Added comprehensive JSDoc type definitions for TypeScript compatibility

2. **Created `tests/unit/modManager/services/ModDiscoveryService.test.js`**:
   - 19 unit tests covering all acceptance criteria plus additional edge cases
   - Tests for constructor validation, discoverMods success/failure/caching, getModById, getModsWithWorlds, clearCache, and ModDiscoveryError
   - Used `global.fetch = jest.fn()` pattern for mocking (following project conventions)

### Deviations from Original Plan

1. **Error class placement**: Moved `ModDiscoveryError` to the top of the file (before `ModDiscoveryService`) to follow typical JavaScript class ordering conventions.

2. **Additional type annotations**: Added `ILogger` typedef for better TypeScript type checking, and added `message` property to `ModDiscoveryResponse` typedef to handle error responses.

3. **ESLint handling**: Added `/* eslint-disable no-undef */` comments around esbuild globals to suppress ESLint errors (these globals are only defined at build time).

4. **Additional test coverage**: Added 10 more tests beyond the 9 specified in acceptance criteria:
   - Constructor throws error when logger not provided
   - Constructor accepts custom apiBaseUrl
   - Constructor accepts custom cacheDuration
   - API non-2xx status throws ModDiscoveryError
   - API success=false with no message uses default message
   - Cache expires and refetches
   - ModDiscoveryError preserves cause error
   - ModDiscoveryError has correct name property

### Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/unit/modManager/services/ModDiscoveryService.test.js` | 19 | ✅ All pass |

### Validation Results

- ✅ All 19 unit tests pass
- ✅ ESLint: 0 errors (37 warnings - JSDoc style preferences)
- ✅ TypeCheck: File-specific errors resolved (project has pre-existing cli/ errors)
- ✅ Import test: Module imports successfully

---

## Objective

Create a client-side service that fetches available mods from the backend API (GET /api/mods) and transforms the response into a format suitable for the UI. This service acts as an API wrapper with caching and error handling.

---

## Files to Touch

### New Files

- `src/modManager/services/ModDiscoveryService.js` ✅
- `tests/unit/modManager/services/ModDiscoveryService.test.js` ✅

---

## Out of Scope

**DO NOT modify:**

- Backend API code (llm-proxy-server)
- Existing loader classes
- ModGraphService (MODMANIMP-009)
- Any files outside modManager directory
- Caching beyond simple in-memory storage

---

## Implementation Details

### Service Class

```javascript
// src/modManager/services/ModDiscoveryService.js
/**
 * @file Client service for mod discovery via backend API
 * @see llm-proxy-server/src/services/modScannerService.js
 */

/**
 * @typedef {Object} ModMetadata
 * @property {string} id - Mod identifier
 * @property {string} name - Display name
 * @property {string} version - SemVer version
 * @property {string} description - Mod description
 * @property {string} author - Mod author
 * @property {Array<{id: string, version: string}>} dependencies - Required mods
 * @property {Array<string>} conflicts - Conflicting mod IDs
 * @property {boolean} hasWorlds - Whether mod contains worlds
 */

/**
 * @typedef {Object} ModDiscoveryResponse
 * @property {boolean} success
 * @property {ModMetadata[]} mods
 * @property {number} count
 * @property {string} scannedAt
 */

/**
 * Service for discovering available mods via backend API
 */
export class ModDiscoveryService {
  #logger;
  #apiBaseUrl;
  #cache;
  #cacheTimestamp;
  #cacheDuration;

  /**
   * @param {Object} options
   * @param {Object} options.logger - Logger instance
   * @param {string} [options.apiBaseUrl] - Base URL for API (default: from env)
   * @param {number} [options.cacheDuration] - Cache duration in ms (default: 60000)
   */
  constructor({ logger, apiBaseUrl, cacheDuration = 60000 }) {
    this.#logger = logger;
    this.#apiBaseUrl = apiBaseUrl || this.#getDefaultApiUrl();
    this.#cache = null;
    this.#cacheTimestamp = 0;
    this.#cacheDuration = cacheDuration;
  }

  /**
   * Get default API URL from build-time environment variables
   * @returns {string}
   */
  #getDefaultApiUrl() {
    // These are injected by esbuild from build.config.js
    const host = typeof __PROXY_HOST__ !== 'undefined' ? __PROXY_HOST__ : 'localhost';
    const port = typeof __PROXY_PORT__ !== 'undefined' ? __PROXY_PORT__ : '3001';
    const useHttps = typeof __PROXY_USE_HTTPS__ !== 'undefined' ? __PROXY_USE_HTTPS__ === 'true' : false;
    const protocol = useHttps ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
  }

  /**
   * Fetch all available mods from the backend
   * @param {Object} [options]
   * @param {boolean} [options.bypassCache=false] - Skip cache and fetch fresh
   * @returns {Promise<ModMetadata[]>}
   */
  async discoverMods({ bypassCache = false } = {}) {
    // Check cache first
    if (!bypassCache && this.#isCacheValid()) {
      this.#logger.debug('Returning cached mods');
      return this.#cache;
    }

    this.#logger.info('Fetching mods from API...');

    try {
      const response = await fetch(`${this.#apiBaseUrl}/api/mods`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      /** @type {ModDiscoveryResponse} */
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'API returned unsuccessful response');
      }

      // Update cache
      this.#cache = data.mods;
      this.#cacheTimestamp = Date.now();

      this.#logger.info(`Discovered ${data.count} mods`);
      return data.mods;
    } catch (error) {
      this.#logger.error('Failed to discover mods', error);
      throw new ModDiscoveryError(`Failed to fetch mods: ${error.message}`, error);
    }
  }

  /**
   * Get a specific mod by ID
   * @param {string} modId - Mod identifier
   * @returns {Promise<ModMetadata|null>}
   */
  async getModById(modId) {
    const mods = await this.discoverMods();
    return mods.find((mod) => mod.id === modId) || null;
  }

  /**
   * Get mods that have worlds
   * @returns {Promise<ModMetadata[]>}
   */
  async getModsWithWorlds() {
    const mods = await this.discoverMods();
    return mods.filter((mod) => mod.hasWorlds);
  }

  /**
   * Clear the cache to force fresh fetch
   */
  clearCache() {
    this.#cache = null;
    this.#cacheTimestamp = 0;
    this.#logger.debug('Cache cleared');
  }

  /**
   * Check if cache is still valid
   * @returns {boolean}
   */
  #isCacheValid() {
    if (!this.#cache) return false;
    return Date.now() - this.#cacheTimestamp < this.#cacheDuration;
  }
}

/**
 * Custom error for mod discovery failures
 */
export class ModDiscoveryError extends Error {
  /**
   * @param {string} message
   * @param {Error} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ModDiscoveryError';
    this.cause = cause;
  }
}

export default ModDiscoveryService;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ModDiscoveryService.test.js`):
   - ✅ `discoverMods returns array of mod metadata on success`
   - ✅ `discoverMods throws ModDiscoveryError on network failure`
   - ✅ `discoverMods throws ModDiscoveryError on API error response`
   - ✅ `discoverMods uses cache when available and valid`
   - ✅ `discoverMods bypasses cache when bypassCache is true`
   - ✅ `getModById returns mod when found`
   - ✅ `getModById returns null when not found`
   - ✅ `getModsWithWorlds filters to mods with hasWorlds true`
   - ✅ `clearCache invalidates the cache`

2. **ESLint passes:** ✅
   ```bash
   npx eslint src/modManager/services/ModDiscoveryService.js
   ```

3. **TypeCheck passes:** ✅
   ```bash
   npm run typecheck
   ```

4. **Import test:** ✅
   ```bash
   node -e "import('./src/modManager/services/ModDiscoveryService.js').then(() => console.log('OK'))"
   ```

### Invariants That Must Remain True

1. ✅ Service uses fetch API (browser-native)
2. ✅ Cache is in-memory only (no localStorage)
3. ✅ Default cache duration is 60 seconds
4. ✅ API URL constructed from esbuild environment variables
5. ✅ Custom error class extends Error properly
6. ✅ Logger dependency is required

---

## Reference Files

- API response format: `llm-proxy-server/src/services/modScannerService.js`
- Fetch pattern: `src/loaders/gameConfigLoader.js`
- Environment variables: `scripts/build.config.js`
