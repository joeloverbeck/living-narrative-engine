# MODMANIMP-011: ConfigPersistenceService

**Status:** Completed
**Priority:** Phase 3 (Services Layer)
**Estimated Effort:** S (3-4 hours)
**Dependencies:** MODMANIMP-002 (POST /api/game-config/save endpoint)

---

## Objective

Create a client-side service that persists game configuration by calling the backend API (POST /api/game-config/save) and can load the current configuration (GET /api/game-config/current). This service handles the communication with the backend and provides optimistic UI support.

---

## Files to Touch

### New Files

- `src/modManager/services/ConfigPersistenceService.js`
- `tests/unit/modManager/services/ConfigPersistenceService.test.js`

---

## Out of Scope

**DO NOT modify:**

- Backend API code (llm-proxy-server)
- Existing GameConfigLoader class
- game.json file directly
- Any backup or versioning logic

---

## Implementation Details

### Service Class

```javascript
// src/modManager/services/ConfigPersistenceService.js
/**
 * @file Client service for persisting game configuration via backend API
 * @see llm-proxy-server/src/handlers/gameConfigController.js
 */

/**
 * @typedef {Object} GameConfig
 * @property {string[]} mods - Array of mod IDs
 * @property {string} startWorld - World ID in format modId:worldId
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} success
 * @property {string} message
 * @property {GameConfig} [config]
 * @property {string} [error]
 */

/**
 * Service for loading and saving game configuration
 */
export class ConfigPersistenceService {
  #logger;
  #apiBaseUrl;
  #pendingSave;

  /**
   * @param {Object} options
   * @param {Object} options.logger - Logger instance
   * @param {string} [options.apiBaseUrl] - Base URL for API
   */
  constructor({ logger, apiBaseUrl }) {
    this.#logger = logger;
    this.#apiBaseUrl = apiBaseUrl || this.#getDefaultApiUrl();
    this.#pendingSave = null;
  }

  /**
   * Get default API URL from environment
   * @returns {string}
   */
  #getDefaultApiUrl() {
    const host = typeof __PROXY_HOST__ !== 'undefined' ? __PROXY_HOST__ : 'localhost';
    const port = typeof __PROXY_PORT__ !== 'undefined' ? __PROXY_PORT__ : '3001';
    const useHttps = typeof __PROXY_USE_HTTPS__ !== 'undefined' ? __PROXY_USE_HTTPS__ === 'true' : false;
    return `${useHttps ? 'https' : 'http'}://${host}:${port}`;
  }

  /**
   * Load current game configuration from backend
   * @returns {Promise<GameConfig>}
   */
  async loadConfig() {
    this.#logger.info('Loading current game configuration...');

    try {
      const response = await fetch(`${this.#apiBaseUrl}/api/game-config/current`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load configuration');
      }

      this.#logger.info(`Loaded config: ${data.config.mods.length} mods, world: ${data.config.startWorld}`);
      return data.config;
    } catch (error) {
      this.#logger.error('Failed to load configuration', error);
      throw new ConfigPersistenceError(`Failed to load config: ${error.message}`, error);
    }
  }

  /**
   * Save game configuration to backend
   * @param {GameConfig} config - Configuration to save
   * @returns {Promise<SaveResult>}
   */
  async saveConfig(config) {
    // Validate before sending
    const validation = this.#validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
        error: validation.error,
      };
    }

    this.#logger.info('Saving game configuration...', {
      modCount: config.mods.length,
      startWorld: config.startWorld,
    });

    // Cancel any pending save
    if (this.#pendingSave) {
      this.#pendingSave.abort();
    }

    const controller = new AbortController();
    this.#pendingSave = controller;

    try {
      const response = await fetch(`${this.#apiBaseUrl}/api/game-config/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.message || `API error: ${response.status}`;
        this.#logger.error('Save failed', { error: errorMsg });
        return {
          success: false,
          message: errorMsg,
          error: errorMsg,
        };
      }

      this.#logger.info('Configuration saved successfully');
      return {
        success: true,
        message: data.message || 'Configuration saved successfully',
        config: data.config,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Save cancelled',
          error: 'Save cancelled',
        };
      }

      this.#logger.error('Failed to save configuration', error);
      return {
        success: false,
        message: `Failed to save: ${error.message}`,
        error: error.message,
      };
    } finally {
      this.#pendingSave = null;
    }
  }

  /**
   * Validate configuration before saving
   * @param {GameConfig} config
   * @returns {{valid: boolean, error?: string}}
   */
  #validateConfig(config) {
    if (!config) {
      return { valid: false, error: 'Configuration is required' };
    }

    if (!config.mods || !Array.isArray(config.mods)) {
      return { valid: false, error: 'Mods must be an array' };
    }

    if (config.mods.length === 0) {
      return { valid: false, error: 'At least one mod must be selected' };
    }

    if (!config.mods.every((m) => typeof m === 'string' && m.length > 0)) {
      return { valid: false, error: 'All mod IDs must be non-empty strings' };
    }

    if (!config.startWorld || typeof config.startWorld !== 'string') {
      return { valid: false, error: 'Start world must be selected' };
    }

    if (!config.startWorld.includes(':')) {
      return { valid: false, error: 'Start world must be in format modId:worldId' };
    }

    return { valid: true };
  }

  /**
   * Check if a save is currently in progress
   * @returns {boolean}
   */
  isSaving() {
    return this.#pendingSave !== null;
  }

  /**
   * Cancel any pending save operation
   */
  cancelPendingSave() {
    if (this.#pendingSave) {
      this.#pendingSave.abort();
      this.#pendingSave = null;
      this.#logger.debug('Pending save cancelled');
    }
  }

  /**
   * Check if configuration has changed from saved state
   * @param {GameConfig} current - Current UI state
   * @param {GameConfig} saved - Last saved state
   * @returns {boolean}
   */
  hasChanges(current, saved) {
    if (!saved) return true;
    if (current.startWorld !== saved.startWorld) return true;
    if (current.mods.length !== saved.mods.length) return true;

    const sortedCurrent = [...current.mods].sort();
    const sortedSaved = [...saved.mods].sort();
    return !sortedCurrent.every((m, i) => m === sortedSaved[i]);
  }
}

/**
 * Custom error for config persistence failures
 */
export class ConfigPersistenceError extends Error {
  /**
   * @param {string} message
   * @param {Error} [cause]
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ConfigPersistenceError';
    this.cause = cause;
  }
}

export default ConfigPersistenceService;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ConfigPersistenceService.test.js`):
   - `loadConfig returns configuration on success`
   - `loadConfig throws ConfigPersistenceError on failure`
   - `saveConfig returns success result on valid config`
   - `saveConfig returns error result on invalid config`
   - `saveConfig validates mods array is not empty`
   - `saveConfig validates startWorld format`
   - `saveConfig cancels previous pending save`
   - `isSaving returns true during save operation`
   - `cancelPendingSave aborts pending save`
   - `hasChanges detects mod list changes`
   - `hasChanges detects world selection changes`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/services/ConfigPersistenceService.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **Uses AbortController for cancellation:**
   ```bash
   grep -q "AbortController" src/modManager/services/ConfigPersistenceService.js && echo "OK"
   ```

### Invariants That Must Remain True

1. Client-side validation before API call
2. AbortController used for cancellation support
3. Only one save operation at a time
4. Custom error class for persistence failures
5. hasChanges comparison is order-independent
6. World ID must be in `modId:worldId` format

---

## Reference Files

- API endpoint: `llm-proxy-server/src/handlers/gameConfigController.js`
- Config schema: `data/schemas/game.schema.json`
- Config file: `data/game.json`

---

## Outcome

**Completed:** 2025-12-17

### What Was Actually Changed

1. **Created `src/modManager/services/ConfigPersistenceService.js`**
   - Implements all methods as specified in the ticket
   - Follows the project's service pattern (matching ModDiscoveryService style)
   - Uses AbortController for cancellation support
   - Client-side validation before API calls
   - Custom ConfigPersistenceError class

2. **Created `tests/unit/modManager/services/ConfigPersistenceService.test.js`**
   - 33 unit tests covering all acceptance criteria
   - Tests for loadConfig, saveConfig, isSaving, cancelPendingSave, hasChanges
   - Tests for validation edge cases (null config, invalid mods, invalid startWorld format)
   - Tests for error handling (network failures, API errors, abort scenarios)

### Discrepancies Corrected in Ticket

1. **Dependency reference corrected:** Changed `POST /api/game-save endpoint` to `POST /api/game-config/save endpoint` to match the actual API endpoint path.

### Notes

- TypeScript type errors for `__PROXY_*` build-time globals are pre-existing in this codebase pattern (same as ModDiscoveryService)
- ESLint warnings are JSDoc style warnings, acceptable for this project
- All 33 unit tests pass successfully
