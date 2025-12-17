# MODMANIMP-001: Backend API - GET /api/mods Endpoint

**Status:** Complete ✅
**Priority:** Phase 1 (Foundation)
**Estimated Effort:** S (4-6 hours)
**Dependencies:** None
**Completed:** 2025-12-17

---

## Objective

Create a new API endpoint in llm-proxy-server that scans the `data/mods/` directory and returns metadata for all available mods. This endpoint reads `mod-manifest.json` from each subdirectory and returns a list of mod metadata for the Mod Manager UI.

---

## Files to Touch

### New Files

- `llm-proxy-server/src/routes/modsRoutes.js`
- `llm-proxy-server/src/handlers/modsController.js`
- `llm-proxy-server/src/services/modScannerService.js`
- `llm-proxy-server/tests/unit/handlers/modsController.test.js`
- `llm-proxy-server/tests/unit/services/modScannerService.test.js`
- `llm-proxy-server/tests/integration/mods-routes.integration.test.js`

### Modified Files

- `llm-proxy-server/src/core/server.js` (ADD route registration)

---

## Out of Scope

**DO NOT modify:**

- Any files in `/src/` (main app source)
- Any files in `/data/mods/` (mod content)
- Frontend code
- Game configuration saving (MODMANIMP-002)
- Caching of scan results
- Version validation logic
- Recursive dependency resolution

---

## Implementation Details

### Route Structure

```javascript
// llm-proxy-server/src/routes/modsRoutes.js
import { Router } from 'express';

export const createModsRoutes = (modsController) => {
  const router = Router();

  router.get('/', (req, res) => modsController.handleGetMods(req, res));

  return router;
};
```

### Controller Structure

```javascript
// llm-proxy-server/src/handlers/modsController.js
export class ModsController {
  #logger;
  #modScannerService;

  constructor(logger, modScannerService) {
    this.#logger = logger;
    this.#modScannerService = modScannerService;
  }

  async handleGetMods(req, res) {
    try {
      const mods = await this.#modScannerService.scanMods();
      return res.status(200).json({
        success: true,
        mods,
        count: mods.length,
        scannedAt: new Date().toISOString()
      });
    } catch (error) {
      this.#logger.error('Failed to scan mods', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to scan mods directory',
        details: error.message
      });
    }
  }
}
```

### Service Structure

```javascript
// llm-proxy-server/src/services/modScannerService.js
import fs from 'fs/promises';
import path from 'path';

export class ModScannerService {
  #logger;
  #modsPath;

  constructor(logger, modsPath = '../data/mods') {
    this.#logger = logger;
    this.#modsPath = path.resolve(process.cwd(), modsPath);
  }

  async scanMods() {
    const mods = [];

    try {
      const entries = await fs.readdir(this.#modsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = path.join(this.#modsPath, entry.name, 'mod-manifest.json');

        try {
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);

          mods.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            author: manifest.author || 'Unknown',
            dependencies: manifest.dependencies || [],
            conflicts: manifest.conflicts || [],
            hasWorlds: await this.#checkForWorlds(entry.name)
          });
        } catch (manifestError) {
          this.#logger.warn(`Skipping mod ${entry.name}: ${manifestError.message}`);
        }
      }
    } catch (dirError) {
      if (dirError.code === 'ENOENT') {
        this.#logger.warn('Mods directory does not exist');
        return [];
      }
      throw dirError;
    }

    return mods;
  }

  async #checkForWorlds(modName) {
    const worldsPath = path.join(this.#modsPath, modName, 'worlds');
    try {
      const stats = await fs.stat(worldsPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
```

### Server Registration

```javascript
// In llm-proxy-server/src/core/server.js
// Add after other route imports:
import { createModsRoutes } from '../routes/modsRoutes.js';
import { ModsController } from '../handlers/modsController.js';
import { ModScannerService } from '../services/modScannerService.js';

// Add after other controller creation:
const modScannerService = new ModScannerService(logger);
const modsController = new ModsController(logger, modScannerService);

// Add after other route registration:
app.use('/api/mods', createModsRoutes(modsController));
```

### Response Format

```json
{
  "success": true,
  "mods": [
    {
      "id": "core",
      "name": "Core",
      "version": "1.0.0",
      "description": "Core game mechanics",
      "author": "joeloverbeck",
      "dependencies": [],
      "conflicts": [],
      "hasWorlds": false
    },
    {
      "id": "positioning",
      "name": "Positioning",
      "version": "1.0.0",
      "description": "Character positioning system",
      "author": "joeloverbeck",
      "dependencies": [
        { "id": "core", "version": ">=1.0.0" }
      ],
      "conflicts": [],
      "hasWorlds": false
    }
  ],
  "count": 64,
  "scannedAt": "2025-12-17T10:30:00.000Z"
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`llm-proxy-server/tests/unit/handlers/modsController.test.js`):
   - `handleGetMods returns 200 with mod array on success`
   - `handleGetMods returns 500 on scanner service error`
   - `handleGetMods logs errors appropriately`

2. **Service Tests** (`llm-proxy-server/tests/unit/services/modScannerService.test.js`):
   - `scanMods returns array of mod metadata`
   - `scanMods returns empty array when no mods directory exists`
   - `scanMods skips directories without mod-manifest.json`
   - `scanMods handles malformed manifest.json gracefully`
   - `scanMods detects hasWorlds correctly`
   - `scanMods parses dependencies array`
   - `scanMods parses conflicts array`

3. **Integration Tests** (`llm-proxy-server/tests/integration/mods-routes.integration.test.js`):
   - `GET /api/mods returns 200 with Content-Type: application/json`
   - `GET /api/mods response contains mods array`
   - `GET /api/mods response contains count field`
   - `GET /api/mods response contains scannedAt timestamp`
   - `GET /api/mods includes core mod when present`

4. **Validation Commands**:
   ```bash
   npm run typecheck
   npx eslint llm-proxy-server/src/routes/modsRoutes.js
   npx eslint llm-proxy-server/src/handlers/modsController.js
   npx eslint llm-proxy-server/src/services/modScannerService.js
   ```

### Invariants That Must Remain True

1. Endpoint does not modify any files (read-only)
2. Returns 200 OK with JSON array (even if empty)
3. Core mod is included in results if present
4. Response time under 500ms for 100 mods
5. Malformed manifests are skipped, not fatal
6. All existing endpoints continue to function
7. No changes to main application source code

---

## Reference Files

- Route pattern: `llm-proxy-server/src/routes/salvageRoutes.js`
- Controller pattern: `llm-proxy-server/src/handlers/salvageRequestController.js`
- Service pattern: `llm-proxy-server/src/services/apiKeyService.js`
- Server registration: `llm-proxy-server/src/core/server.js`
- Mod manifest schema: `data/schemas/mod-manifest.schema.json`

---

## Outcome

### Files Created

| File | Purpose |
|------|---------|
| `llm-proxy-server/src/routes/modsRoutes.js` | Express router factory for `/api/mods` endpoint |
| `llm-proxy-server/src/handlers/modsController.js` | Controller handling GET requests with error handling |
| `llm-proxy-server/src/services/modScannerService.js` | Service scanning mods directory and parsing manifests |
| `llm-proxy-server/tests/unit/handlers/modsController.test.js` | Unit tests for controller (7 tests) |
| `llm-proxy-server/tests/unit/services/modScannerService.test.js` | Unit tests for service (13 tests) |
| `llm-proxy-server/tests/integration/mods-routes.integration.test.js` | Integration tests for HTTP endpoint (9 tests) |

### Files Modified

| File | Changes |
|------|---------|
| `llm-proxy-server/src/core/server.js` | Added imports and route registration for `/api/mods` |

### Test Coverage

- **Unit tests**: 20 tests covering constructor validation, success paths, error handling, edge cases
- **Integration tests**: 9 tests covering HTTP responses, JSON format, error scenarios
- All tests passing after fixing a test mock issue with path substring matching

### Implementation Notes

1. Followed existing patterns from `salvageRoutes.js` and `salvageRequestController.js`
2. Used private class fields (`#logger`, `#modScannerService`) per project conventions
3. Implemented dependency injection with constructor validation
4. Service gracefully handles missing directories and malformed manifests
5. Route registered at `/api/mods` with GET method only
