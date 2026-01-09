# Specification: Problematic Expressions Panel

## Goal

Add a "Problematic Expressions Panel" to the Expression Diagnostics page that displays pill-shaped badges for expressions with problematic diagnostic statuses (IMPOSSIBLE, UNKNOWN, EXTREMELY_RARE, RARE). This provides quick navigation to expressions needing attention and persists status information to expression files.

## Context

### Current State

The Expression Diagnostics page (`expression-diagnostics.html`) allows content authors to:
- Select expressions from a dropdown
- Run static analysis and Monte Carlo simulation
- View detailed diagnostic results

However, with 70+ expressions across 10+ emotion mods, users lose track of which expressions they've analyzed and which still need attention.

### Problem Statement

- No persistent tracking of expression diagnostic status
- No quick navigation to problematic expressions
- Analysis results are lost on page reload
- Difficult to prioritize which expressions to fix next

### Key Files

| File | Purpose |
|------|---------|
| `expression-diagnostics.html` | Main page structure |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | UI orchestration |
| `src/expressionDiagnostics/models/DiagnosticResult.js` | Status constants |
| `data/schemas/expression.schema.json` | Expression file schema |
| `llm-proxy-server/src/routes/traceRoutes.js` | Reference for file I/O patterns |

---

## Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER APPLICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐      ┌──────────────────────────────────────┐ │
│  │  expression-diagnostics │      │ ExpressionDiagnosticsController      │ │
│  │       .html             │◄────►│  - #problematicPillsContainer        │ │
│  │  (New Panel Section)    │      │  - #loadProblematicExpressions()     │ │
│  └─────────────────────────┘      │  - #renderProblematicPills()         │ │
│                                   │  - #onPillClicked()                  │ │
│                                   │  - #persistDiagnosticStatus()        │ │
│                                   └────────────────┬─────────────────────┘ │
│                                                    │                       │
│  ┌─────────────────────────────────────────────────▼─────────────────────┐ │
│  │                    ExpressionStatusService (NEW)                       │ │
│  │  - fetchAllStatuses()                                                 │ │
│  │  - updateStatus(expressionId, status)                                 │ │
│  │  - getProblematicExpressions(limit)                                   │ │
│  │  - getStatus(expressionId)                                            │ │
│  └────────────────────────────────────┬──────────────────────────────────┘ │
│                                       │                                    │
│                                       │ HTTP                               │
│                                       ▼                                    │
└───────────────────────────────────────┼────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼───────────────────────────────────┐
│                          LLM-PROXY-SERVER (Port 3001)                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    expressionRoutes.js (NEW)                        │ │
│  │  POST /api/expressions/update-status                                │ │
│  │  GET  /api/expressions/scan-statuses                                │ │
│  └────────────────────────────────────┬────────────────────────────────┘ │
│                                       │                                  │
│  ┌────────────────────────────────────▼────────────────────────────────┐ │
│  │              ExpressionStatusController (NEW)                       │ │
│  │  - handleUpdateStatus(req, res)                                     │ │
│  │  - handleScanStatuses(req, res)                                     │ │
│  └────────────────────────────────────┬────────────────────────────────┘ │
│                                       │                                  │
│  ┌────────────────────────────────────▼────────────────────────────────┐ │
│  │              ExpressionFileService (NEW)                            │ │
│  │  - updateExpressionStatus(filePath, newStatus)                      │ │
│  │  - scanAllExpressionStatuses()                                      │ │
│  │  - validateFilePath(filePath)                                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ File I/O
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          data/mods/emotions-*/expressions/               │
│  - *.expression.json files with optional "diagnosticStatus" field       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Schema Extension

**File:** `data/schemas/expression.schema.json`

Add `diagnosticStatus` property to the schema:

```json
{
  "properties": {
    "diagnosticStatus": {
      "type": "string",
      "enum": ["unknown", "impossible", "extremely_rare", "rare", "normal", "frequent"],
      "description": "Diagnostic status determined by static analysis or Monte Carlo simulation. Absence means 'unknown'. This field is managed by the Expression Diagnostics tool."
    }
  }
}
```

**Notes:**
- Field is optional (not in `required` array)
- Absence treated as "unknown"
- Only the Expression Diagnostics tool should modify this field

---

### 2. Proxy Server API

#### 2.1 ExpressionFileService

**File:** `llm-proxy-server/src/services/expressionFileService.js`

```javascript
/**
 * Service for reading and updating expression files
 */
export class ExpressionFileService {
  #logger;
  #modsPath;
  #projectRoot;

  constructor(logger, projectRoot = '../') {
    this.#logger = logger;
    this.#projectRoot = path.resolve(process.cwd(), projectRoot);
    this.#modsPath = path.join(this.#projectRoot, 'data', 'mods');
  }

  /**
   * Validates that the file path is within data/mods/ and is an expression file
   */
  validateFilePath(filePath) {
    const fullPath = path.resolve(this.#projectRoot, filePath);
    const relativePath = path.relative(this.#modsPath, fullPath);

    return !relativePath.startsWith('..') &&
           !path.isAbsolute(relativePath) &&
           filePath.endsWith('.expression.json');
  }

  /**
   * Updates the diagnosticStatus field in an expression file
   */
  async updateExpressionStatus(filePath, newStatus) {
    const validStatuses = ['unknown', 'impossible', 'extremely_rare', 'rare', 'normal', 'frequent'];

    if (!validStatuses.includes(newStatus)) {
      return { success: false, message: `Invalid status: ${newStatus}` };
    }

    if (!this.validateFilePath(filePath)) {
      return { success: false, message: 'Invalid file path' };
    }

    const fullPath = path.resolve(this.#projectRoot, filePath);

    // Read, update, write
    const content = await fs.readFile(fullPath, 'utf-8');
    const expression = JSON.parse(content);
    expression.diagnosticStatus = newStatus;
    await fs.writeFile(fullPath, JSON.stringify(expression, null, 4), 'utf-8');

    return { success: true, message: 'Status updated successfully', expressionId: expression.id };
  }

  /**
   * Scans all expression files and returns their diagnostic statuses
   */
  async scanAllExpressionStatuses() {
    const results = [];
    const modDirs = await fs.readdir(this.#modsPath, { withFileTypes: true });

    for (const modDir of modDirs) {
      if (!modDir.isDirectory() || !modDir.name.startsWith('emotions-')) continue;

      const expressionsPath = path.join(this.#modsPath, modDir.name, 'expressions');
      // Scan each expression file, extract id and diagnosticStatus
      // Return array of {id, filePath, diagnosticStatus}
    }

    return results;
  }
}
```

#### 2.2 API Routes

**File:** `llm-proxy-server/src/routes/expressionRoutes.js`

```javascript
export const createExpressionRoutes = (expressionStatusController) => {
  const router = Router();

  // Update a single expression's diagnostic status
  router.post('/update-status', (req, res) =>
    expressionStatusController.handleUpdateStatus(req, res)
  );

  // Scan all expressions and return their statuses
  router.get('/scan-statuses', (req, res) =>
    expressionStatusController.handleScanStatuses(req, res)
  );

  return router;
};
```

#### 2.3 API Contracts

**POST /api/expressions/update-status**

Request:
```json
{
  "filePath": "data/mods/emotions-attention/expressions/flow_absorption.expression.json",
  "newStatus": "extremely_rare"
}
```

Success Response (200):
```json
{
  "success": true,
  "message": "Status updated successfully",
  "expressionId": "emotions-attention:flow_absorption"
}
```

Error Response (400):
```json
{
  "success": false,
  "message": "Invalid file path"
}
```

**GET /api/expressions/scan-statuses**

Response (200):
```json
{
  "success": true,
  "count": 77,
  "expressions": [
    {
      "id": "emotions-attention:flow_absorption",
      "filePath": "data/mods/emotions-attention/expressions/flow_absorption.expression.json",
      "diagnosticStatus": "extremely_rare"
    },
    {
      "id": "emotions-anger:rage_surge",
      "filePath": "data/mods/emotions-anger/expressions/rage_surge.expression.json",
      "diagnosticStatus": null
    }
  ]
}
```

---

### 3. Browser-Side Service

**File:** `src/expressionDiagnostics/services/ExpressionStatusService.js`

```javascript
const STATUS_PRIORITY = Object.freeze({
  impossible: 1,
  unknown: 2,
  extremely_rare: 3,
  rare: 4,
  normal: 100,    // Not problematic - excluded
  frequent: 100,  // Not problematic - excluded
});

export class ExpressionStatusService {
  #logger;
  #proxyBaseUrl;
  #statusCache = new Map();

  constructor({ logger, expressionRegistry, proxyBaseUrl = 'http://localhost:3001' }) {
    this.#logger = logger;
    this.#proxyBaseUrl = proxyBaseUrl;
  }

  /**
   * Fetches all expression statuses from the proxy server
   */
  async fetchAllStatuses() {
    const response = await fetch(`${this.#proxyBaseUrl}/api/expressions/scan-statuses`);
    const data = await response.json();
    // Populate cache
    return this.#statusCache;
  }

  /**
   * Updates an expression's diagnostic status
   */
  async updateStatus(expressionId, newStatus) {
    const cached = this.#statusCache.get(expressionId);
    const response = await fetch(`${this.#proxyBaseUrl}/api/expressions/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: cached.filePath, newStatus }),
    });
    // Update cache on success
    return result.success;
  }

  /**
   * Gets problematic expressions (not normal/frequent), sorted by severity
   */
  getProblematicExpressions(limit = 10) {
    const problematic = [];
    for (const [id, data] of this.#statusCache) {
      const priority = STATUS_PRIORITY[data.status] ?? 2;
      if (priority < 100) {
        problematic.push({ id, status: data.status, priority });
      }
    }
    // Sort by priority (ascending), then by ID
    problematic.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    return problematic.slice(0, limit);
  }

  getStatus(expressionId) {
    return this.#statusCache.get(expressionId)?.status ?? null;
  }
}
```

---

### 4. UI Panel

#### 4.1 HTML Structure

**File:** `expression-diagnostics.html`

Insert between "Expression Selection" and "Analysis Controls":

```html
<!-- Problematic Expressions Panel -->
<section class="panel problematic-expressions-panel" id="problematic-expressions-panel">
  <h2>Problematic Expressions</h2>
  <div id="problematic-pills-container" class="problematic-pills-container">
    <p class="loading-text" id="problematic-loading">Loading expressions...</p>
  </div>
  <p class="help-text" id="problematic-help">
    Click an expression to select it for analysis. Prioritized by severity.
  </p>
</section>
```

#### 4.2 CSS Styles

**File:** `css/expression-diagnostics.css`

```css
/* Problematic Expressions Panel */
.problematic-expressions-panel {
  margin-bottom: 1rem;
}

.problematic-pills-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 2.5rem;
  align-items: center;
}

.problematic-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  border: 1px solid var(--border-color-subtle);
  background: var(--panel-bg-color);
  transition: transform 0.15s, box-shadow 0.15s;
  max-width: 200px;
  overflow: hidden;
}

.problematic-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.problematic-pill .pill-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.problematic-pill .pill-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pill status colors - reusing existing color scheme */
.problematic-pill.status-impossible .pill-indicator { background: #c0392b; }
.problematic-pill.status-unknown .pill-indicator { background: #666; }
.problematic-pill.status-extremely-rare .pill-indicator { background: #e67e22; }
.problematic-pill.status-rare .pill-indicator { background: #b7950b; }

.problematic-pill.status-impossible { background: #fadbd8; border-color: #c0392b; }
.problematic-pill.status-unknown { background: #e8e8e8; border-color: #666; }
.problematic-pill.status-extremely-rare { background: #fdebd0; border-color: #e67e22; }
.problematic-pill.status-rare { background: #fcf3cf; border-color: #b7950b; }
```

#### 4.3 Pill Visual Example

```
┌──────────────────────────────────────────────────────────────────┐
│ Problematic Expressions                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [🔴 dissociation]  [🔴 panic_onset]  [⚪ flow_absorption]       │
│                                                                  │
│  [⚪ confused_frown]  [🟠 freeze_response]  [🟡 rage_surge]      │
│                                                                  │
│  Click an expression to select it for analysis.                 │
└──────────────────────────────────────────────────────────────────┘
```

---

### 5. Controller Integration

**File:** `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`

#### New Private Fields

```javascript
#expressionStatusService;
#problematicPillsContainer;
#problematicLoading;
```

#### Updated Constructor

```javascript
constructor({
  logger,
  expressionRegistry,
  gateAnalyzer,
  boundsCalculator,
  monteCarloSimulator,
  failureExplainer,
  expressionStatusService, // NEW
}) {
  // ... existing validations ...
  validateDependency(expressionStatusService, 'IExpressionStatusService', logger, {
    requiredMethods: ['fetchAllStatuses', 'updateStatus', 'getProblematicExpressions', 'getStatus'],
  });
  this.#expressionStatusService = expressionStatusService;
}
```

#### New Methods

```javascript
async #loadProblematicExpressions() {
  try {
    await this.#expressionStatusService.fetchAllStatuses();
    this.#renderProblematicPills();
  } catch (error) {
    this.#logger.error('Failed to load problematic expressions', { error: error.message });
    this.#problematicLoading.textContent = 'Failed to load expressions';
  }
}

#renderProblematicPills() {
  const problematic = this.#expressionStatusService.getProblematicExpressions(10);
  this.#problematicPillsContainer.innerHTML = '';

  if (problematic.length === 0) {
    const noProblems = document.createElement('p');
    noProblems.className = 'no-problems-text';
    noProblems.textContent = 'No problematic expressions found.';
    this.#problematicPillsContainer.appendChild(noProblems);
    return;
  }

  for (const item of problematic) {
    const pill = this.#createProblematicPill(item);
    this.#problematicPillsContainer.appendChild(pill);
  }
}

#createProblematicPill({ id, status }) {
  const pill = document.createElement('button');
  const cssStatus = status.replace('_', '-');
  pill.className = `problematic-pill status-${cssStatus}`;
  pill.type = 'button';
  pill.dataset.expressionId = id;

  const indicator = document.createElement('span');
  indicator.className = 'pill-indicator';

  const name = document.createElement('span');
  name.className = 'pill-name';
  name.textContent = id.split(':')[1] || id;
  name.title = id;

  pill.appendChild(indicator);
  pill.appendChild(name);
  pill.addEventListener('click', () => this.#onPillClicked(id));

  return pill;
}

#onPillClicked(expressionId) {
  const option = Array.from(this.#expressionSelect.options).find(
    opt => opt.value === expressionId
  );
  if (option) {
    this.#expressionSelect.value = expressionId;
    this.#expressionSelect.dispatchEvent(new Event('change'));
  }
}

async #persistDiagnosticStatus(status) {
  if (!this.#selectedExpression) return;
  const success = await this.#expressionStatusService.updateStatus(
    this.#selectedExpression.id,
    status
  );
  if (success) {
    this.#renderProblematicPills();
  }
}
```

#### Modified Methods

In `initialize()`:
```javascript
async initialize() {
  this.#bindDomElements();
  this.#setupEventListeners();
  this.#populateExpressionSelect();
  await this.#loadProblematicExpressions(); // NEW
}
```

In `#runStaticAnalysis()` and `#runMonteCarloSimulation()`:
```javascript
// After determining the result status
const category = this.#currentResult.rarityCategory;
if (category) {
  await this.#persistDiagnosticStatus(category);
}
```

---

### 6. DI Registration

**File:** `src/dependencyInjection/tokens/tokens-diagnostics.js`

```javascript
IExpressionStatusService: 'IExpressionStatusService',
```

**File:** `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

```javascript
import { ExpressionStatusService } from '../../expressionDiagnostics/services/ExpressionStatusService.js';

registrar.singletonFactory(
  diagnosticsTokens.IExpressionStatusService,
  (c) => new ExpressionStatusService({
    logger: c.resolve(tokens.ILogger),
    expressionRegistry: c.resolve(tokens.IExpressionRegistry),
    proxyBaseUrl: 'http://localhost:3001',
  })
);
```

---

## Priority Order Rules

Status priority for display (lower number = higher priority):

| Status | Priority | Display |
|--------|----------|---------|
| impossible | 1 | 🔴 Red |
| unknown | 2 | ⚪ Gray |
| extremely_rare | 3 | 🟠 Orange |
| rare | 4 | 🟡 Yellow |
| normal | N/A | Not shown |
| frequent | N/A | Not shown |

**Example panel with 10 expressions:**
1. dissociation (impossible)
2. panic_onset (impossible)
3. flow_absorption (unknown)
4. confused_frown (unknown)
5. freeze_response (extremely_rare)
6. rage_surge (extremely_rare)
7. terror_spike (rare)
8. deep_despair (rare)
9. nostalgic_distance (unknown)
10. euphoric_excitement (unknown)

---

## Security Considerations

### Path Traversal Prevention

The `ExpressionFileService.validateFilePath()` method ensures:

1. **Path resolution**: Resolves the full path relative to project root
2. **Boundary check**: Ensures path doesn't escape `data/mods/` directory
3. **Extension validation**: Only `.expression.json` files can be modified

```javascript
validateFilePath(filePath) {
  const fullPath = path.resolve(this.#projectRoot, filePath);
  const relativePath = path.relative(this.#modsPath, fullPath);

  return !relativePath.startsWith('..') &&
         !path.isAbsolute(relativePath) &&
         filePath.endsWith('.expression.json');
}
```

### Status Validation

Only valid enum values are accepted:
```javascript
const validStatuses = ['unknown', 'impossible', 'extremely_rare', 'rare', 'normal', 'frequent'];
if (!validStatuses.includes(newStatus)) {
  return { success: false, message: `Invalid status: ${newStatus}` };
}
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Network failure during fetch | Falls back to cached data, logs warning |
| Expression file not found | Returns error, doesn't crash |
| Invalid JSON in expression file | Logs error, skips file in scan |
| Concurrent updates | Last write wins (acceptable for diagnostic use) |
| No problematic expressions | Shows "No problematic expressions found" |
| Expression not in dropdown | Logs warning, no action |
| Page reload | Status persisted in files, reloaded on page init |

---

## Testing Strategy

### Unit Tests Required

#### Browser-Side (`tests/unit/`)

1. **expressionStatusService.test.js**
   - Constructor validates dependencies
   - `fetchAllStatuses()` correctly populates cache
   - `fetchAllStatuses()` handles network errors gracefully
   - `updateStatus()` calls API with correct parameters
   - `updateStatus()` updates cache on success
   - `updateStatus()` returns false on failure
   - `getProblematicExpressions()` filters out normal/frequent
   - `getProblematicExpressions()` sorts by priority correctly
   - `getProblematicExpressions()` respects limit parameter
   - `getStatus()` returns cached status or null

2. **ExpressionDiagnosticsController.test.js** (additions)
   - `#loadProblematicExpressions()` calls service and renders
   - `#renderProblematicPills()` creates correct DOM structure
   - `#renderProblematicPills()` shows message when empty
   - `#createProblematicPill()` applies correct CSS classes
   - `#onPillClicked()` selects expression in dropdown
   - `#onPillClicked()` logs warning if expression not found
   - `#persistDiagnosticStatus()` calls service after analysis
   - Panel updates after analysis completes

#### Proxy Server (`llm-proxy-server/tests/unit/`)

3. **expressionFileService.test.js**
   - `validateFilePath()` accepts valid paths within data/mods/
   - `validateFilePath()` rejects paths with `..`
   - `validateFilePath()` rejects non-.expression.json files
   - `updateExpressionStatus()` reads, modifies, writes file
   - `updateExpressionStatus()` rejects invalid status values
   - `updateExpressionStatus()` handles file not found
   - `scanAllExpressionStatuses()` finds all expression files
   - `scanAllExpressionStatuses()` handles missing expressions directory

4. **expressionStatusController.test.js**
   - `handleUpdateStatus()` validates required fields
   - `handleUpdateStatus()` returns success from service
   - `handleUpdateStatus()` returns error on invalid path
   - `handleScanStatuses()` returns expressions array
   - `handleScanStatuses()` handles service errors

### Integration Tests Required

5. **expressionStatusPersistence.integration.test.js** (`tests/integration/expression-diagnostics/`)
   - Full flow: Load page → panel shows expressions
   - Full flow: Run analysis → status persisted → panel updated
   - Status survives page reload (reads from file)
   - API endpoints accessible via HTTP

6. **expression-status-routes.integration.test.js** (`llm-proxy-server/tests/integration/`)
   - POST /update-status with valid data succeeds
   - POST /update-status with invalid path returns 400
   - POST /update-status with missing fields returns 400
   - GET /scan-statuses returns all expressions
   - Path traversal attempts are blocked

### Test Fixtures

Create test expression files in `tests/fixtures/expressionDiagnostics/`:

```
tests/fixtures/expressionDiagnostics/
├── testExpression.expression.json       # No diagnosticStatus
├── impossibleExpression.expression.json # diagnosticStatus: "impossible"
├── rareExpression.expression.json       # diagnosticStatus: "rare"
└── frequentExpression.expression.json   # diagnosticStatus: "frequent"
```

---

## File Structure Summary

### New Files to Create

```
src/expressionDiagnostics/services/
└── ExpressionStatusService.js

llm-proxy-server/src/
├── routes/
│   └── expressionRoutes.js
├── handlers/
│   └── expressionStatusController.js
└── services/
    └── expressionFileService.js

tests/unit/expressionDiagnostics/services/
└── expressionStatusService.test.js

tests/integration/expression-diagnostics/
└── expressionStatusPersistence.integration.test.js

llm-proxy-server/tests/unit/
├── handlers/
│   └── expressionStatusController.test.js
└── services/
    └── expressionFileService.test.js

llm-proxy-server/tests/integration/
└── expression-status-routes.integration.test.js
```

### Files to Modify

```
data/schemas/expression.schema.json           # Add diagnosticStatus field
expression-diagnostics.html                   # Add panel section
css/expression-diagnostics.css                # Add pill styles
src/domUI/expression-diagnostics/
    ExpressionDiagnosticsController.js        # Add panel management
src/expression-diagnostics.js                 # Wire up new service
src/dependencyInjection/tokens/
    tokens-diagnostics.js                     # Add service token
src/dependencyInjection/registrations/
    expressionDiagnosticsRegistrations.js     # Register service
llm-proxy-server/src/core/server.js           # Mount new routes
```

---

## Implementation Phases

### Phase 1: Server-Side (1-2 days)
1. Update `expression.schema.json`
2. Create `ExpressionFileService`
3. Create `ExpressionStatusController`
4. Create `expressionRoutes.js`
5. Wire into `server.js`
6. Write server unit and integration tests

### Phase 2: Browser Service (1 day)
1. Create `ExpressionStatusService`
2. Add DI token and registration
3. Write service unit tests

### Phase 3: UI Integration (1-2 days)
1. Update HTML with panel section
2. Add CSS styles
3. Update `ExpressionDiagnosticsController`
4. Update entry point
5. Write controller tests

### Phase 4: Testing & Polish (1 day)
1. Integration tests
2. Manual testing
3. Bug fixes

---

## Verification Checklist

After implementation, verify:

- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes - all new tests
- [ ] `npm run test:integration` passes
- [ ] Manual: Panel appears on page load
- [ ] Manual: Pills show correct colors for each status
- [ ] Manual: Clicking a pill selects the expression
- [ ] Manual: Running analysis updates the expression file
- [ ] Manual: Running analysis refreshes the panel
- [ ] Manual: Page reload shows persisted statuses
- [ ] Manual: NORMAL/FREQUENT expressions don't appear in panel
- [ ] Security: Path traversal attempts are blocked
