# MODMANIMP-002: Backend API - POST /api/game-save Endpoint

**Status:** Completed
**Priority:** Phase 1 (Foundation)
**Estimated Effort:** S (4-6 hours)
**Dependencies:** None

---

## Outcome

### Implementation Summary

Successfully implemented the game configuration save/load API endpoints in the llm-proxy-server following the ticket specification. All acceptance criteria have been met.

### Files Created

- `llm-proxy-server/src/services/gameConfigService.js` - Service with atomic write pattern
- `llm-proxy-server/src/handlers/gameConfigController.js` - Controller with input validation
- `llm-proxy-server/src/routes/gameConfigRoutes.js` - Route definitions for POST /save and GET /current
- `llm-proxy-server/tests/unit/handlers/gameConfigController.test.js` - 16 unit tests
- `llm-proxy-server/tests/unit/services/gameConfigService.test.js` - 13 unit tests
- `llm-proxy-server/tests/integration/gameConfigRoutes.integration.test.js` - 9 integration tests

### Files Modified

- `llm-proxy-server/src/core/server.js` - Added imports and route registration

### Test Results

- **Controller Unit Tests**: 16 passed
- **Service Unit Tests**: 13 passed
- **Integration Tests**: 9 passed
- **ESLint**: No errors

### Tests Added (with rationale)

| Test File | Test Count | Rationale |
|-----------|------------|-----------|
| `gameConfigController.test.js` | 16 | Covers constructor validation, all handleSave validation cases (missing mods, non-array mods, empty mods, non-string mods, empty strings in mods, missing startWorld, empty startWorld, whitespace-only startWorld, non-string startWorld), 500 error handling, and handleGetCurrent success/error paths |
| `gameConfigService.test.js` | 13 | Covers constructor validation, saveConfig atomic write pattern (temp file + rename), directory creation, cleanup on failure, verification of JSON validity, loadConfig with existing file, default config when file missing, error propagation for access issues, invalid JSON handling |
| `gameConfigRoutes.integration.test.js` | 9 | End-to-end testing of HTTP routes with actual Express app, verifying request/response formats, status codes, content types, and service integration |

### Deviations from Ticket

1. **Test file locations**: Ticket specified `tests/unit/llm-proxy-server/...` but the llm-proxy-server has its own test structure at `llm-proxy-server/tests/...`. Tests were placed in the correct llm-proxy-server test directories.

2. **Minor JSDoc enhancements**: Added `@file`, `@see`, and comprehensive JSDoc documentation with `@param`, `@returns`, and `@private` annotations for better IDE support and maintainability.

3. **Dependency validation**: Added constructor validation for required dependencies (logger, gameConfigService) with descriptive error messages.

4. **Debug logging**: Added debug log on service instantiation showing the resolved config path for troubleshooting.

---

## Objective

Create an endpoint in llm-proxy-server to write the game.json configuration file. Accepts a JSON body with `mods` array and `startWorld` string. Validates input before writing and writes atomically (temp file then rename).

---

## Files to Touch

### New Files

- `llm-proxy-server/src/routes/gameConfigRoutes.js`
- `llm-proxy-server/src/handlers/gameConfigController.js`
- `llm-proxy-server/src/services/gameConfigService.js`
- `tests/unit/llm-proxy-server/handlers/gameConfigController.test.js`
- `tests/integration/llm-proxy-server/gameConfigRoutes.integration.test.js`

### Modified Files

- `llm-proxy-server/src/core/server.js` (ADD route registration)

---

## Out of Scope

**DO NOT modify:**

- Any files in `/src/` (main app source)
- Any existing game.json content validation logic
- Mod discovery endpoint (MODMANIMP-001)
- Frontend code
- Backup/versioning of game.json
- Validation that mods exist
- Dependency resolution

---

## Implementation Details

### Route Structure

```javascript
// llm-proxy-server/src/routes/gameConfigRoutes.js
import { Router } from 'express';

export const createGameConfigRoutes = (gameConfigController) => {
  const router = Router();

  router.post('/save', (req, res) => gameConfigController.handleSave(req, res));
  router.get('/current', (req, res) => gameConfigController.handleGetCurrent(req, res));

  return router;
};
```

### Controller Structure

```javascript
// llm-proxy-server/src/handlers/gameConfigController.js
export class GameConfigController {
  #logger;
  #gameConfigService;

  constructor(logger, gameConfigService) {
    this.#logger = logger;
    this.#gameConfigService = gameConfigService;
  }

  async handleSave(req, res) {
    try {
      const { mods, startWorld } = req.body;

      // Validate required fields
      const validationError = this.#validatePayload(mods, startWorld);
      if (validationError) {
        return res.status(400).json({
          error: true,
          message: validationError
        });
      }

      const config = { mods, startWorld };
      await this.#gameConfigService.saveConfig(config);

      this.#logger.info('Game config saved successfully', {
        modCount: mods.length,
        startWorld
      });

      return res.status(200).json({
        success: true,
        message: 'Configuration saved successfully',
        config
      });
    } catch (error) {
      this.#logger.error('Failed to save game config', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to save configuration',
        details: error.message
      });
    }
  }

  async handleGetCurrent(req, res) {
    try {
      const config = await this.#gameConfigService.loadConfig();
      return res.status(200).json({
        success: true,
        config
      });
    } catch (error) {
      this.#logger.error('Failed to load game config', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to load configuration',
        details: error.message
      });
    }
  }

  #validatePayload(mods, startWorld) {
    if (!mods) {
      return 'Missing required field: mods';
    }
    if (!Array.isArray(mods)) {
      return 'Field mods must be an array';
    }
    if (mods.length === 0) {
      return 'Field mods cannot be empty';
    }
    if (!mods.every(mod => typeof mod === 'string' && mod.length > 0)) {
      return 'All mods must be non-empty strings';
    }
    if (!startWorld) {
      return 'Missing required field: startWorld';
    }
    if (typeof startWorld !== 'string' || startWorld.trim() === '') {
      return 'Field startWorld must be a non-empty string';
    }
    return null;
  }
}
```

### Service Structure

```javascript
// llm-proxy-server/src/services/gameConfigService.js
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class GameConfigService {
  #logger;
  #configPath;

  constructor(logger, configPath = '../data/game.json') {
    this.#logger = logger;
    this.#configPath = path.resolve(process.cwd(), configPath);
  }

  async saveConfig(config) {
    const content = JSON.stringify(config, null, 2);

    // Write to temp file first for atomicity
    const tempPath = path.join(os.tmpdir(), `game-${Date.now()}.json`);

    try {
      await fs.writeFile(tempPath, content, 'utf-8');

      // Verify written content is valid JSON
      const verification = await fs.readFile(tempPath, 'utf-8');
      JSON.parse(verification);

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.#configPath), { recursive: true });

      // Atomic rename
      await fs.rename(tempPath, this.#configPath);

      this.#logger.debug('Config file written', { path: this.#configPath });
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async loadConfig() {
    try {
      const content = await fs.readFile(this.#configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Return default config if file doesn't exist
        return {
          mods: ['core'],
          startWorld: ''
        };
      }
      throw error;
    }
  }
}
```

### Server Registration

```javascript
// In llm-proxy-server/src/core/server.js
// Add after other route imports:
import { createGameConfigRoutes } from '../routes/gameConfigRoutes.js';
import { GameConfigController } from '../handlers/gameConfigController.js';
import { GameConfigService } from '../services/gameConfigService.js';

// Add after other controller creation:
const gameConfigService = new GameConfigService(logger);
const gameConfigController = new GameConfigController(logger, gameConfigService);

// Add after other route registration:
app.use('/api/game-config', createGameConfigRoutes(gameConfigController));
```

### Request Format

```json
POST /api/game-config/save
Content-Type: application/json

{
  "mods": ["core", "positioning", "clothing", "intimacy"],
  "startWorld": "dredgers:dredgers"
}
```

### Response Format (Success)

```json
{
  "success": true,
  "message": "Configuration saved successfully",
  "config": {
    "mods": ["core", "positioning", "clothing", "intimacy"],
    "startWorld": "dredgers:dredgers"
  }
}
```

### Response Format (Error)

```json
{
  "error": true,
  "message": "Missing required field: mods"
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`gameConfigController.test.js`):
   - `handleSave returns 200 on valid payload`
   - `handleSave returns 400 when mods is missing`
   - `handleSave returns 400 when mods is not an array`
   - `handleSave returns 400 when mods is empty`
   - `handleSave returns 400 when mods contains non-strings`
   - `handleSave returns 400 when startWorld is missing`
   - `handleSave returns 400 when startWorld is empty string`
   - `handleSave returns 500 on service error`
   - `handleGetCurrent returns 200 with config`

2. **Service Tests** (`gameConfigService.test.js`):
   - `saveConfig writes valid JSON to file`
   - `saveConfig creates directory if not exists`
   - `saveConfig uses atomic write (temp then rename)`
   - `saveConfig cleans up temp file on failure`
   - `loadConfig returns file contents`
   - `loadConfig returns default when file missing`

3. **Integration Tests** (`gameConfigRoutes.integration.test.js`):
   - `POST /api/game-config/save returns 200 on valid payload`
   - `POST /api/game-config/save returns 400 on invalid payload`
   - `POST /api/game-config/save writes to correct file location`
   - `GET /api/game-config/current returns saved config`
   - `Written file is valid JSON`

4. **Validation Commands**:
   ```bash
   npm run typecheck
   npx eslint llm-proxy-server/src/routes/gameConfigRoutes.js
   npx eslint llm-proxy-server/src/handlers/gameConfigController.js
   npx eslint llm-proxy-server/src/services/gameConfigService.js
   ```

### Invariants That Must Remain True

1. Only writes to `data/game.json` path
2. Creates file if it does not exist
3. Overwrites existing file atomically
4. Returns written content in response body
5. Validates payload before attempting write
6. All existing endpoints continue to function
7. No changes to main application source code
8. Temp files are cleaned up on failure

---

## Reference Files

- Route pattern: `llm-proxy-server/src/routes/salvageRoutes.js`
- Controller pattern: `llm-proxy-server/src/handlers/salvageRequestController.js`
- Server registration: `llm-proxy-server/src/core/server.js`
- Game config schema: `data/schemas/game.schema.json`
- Current game config: `data/game.json`
