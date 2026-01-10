# Specification: Expression Diagnostics Client-Server Communication Robustness

## Context

### Where in Codebase

| Component | File | Purpose |
|-----------|------|---------|
| Client Service | `src/expressionDiagnostics/services/ExpressionStatusService.js` | Browser-side HTTP communication with llm-proxy-server |
| Server Routes | `llm-proxy-server/src/routes/expressionRoutes.js` | Express routes for expression status endpoints |
| Server Controller | `llm-proxy-server/src/handlers/expressionStatusController.js` | Request handling and validation |
| Server Service | `llm-proxy-server/src/services/expressionFileService.js` | File I/O for expression status persistence |
| Health Routes | `llm-proxy-server/src/routes/healthRoutes.js` | Existing health check infrastructure |
| Server Core | `llm-proxy-server/src/core/server.js` | CORS configuration, route mounting, port checks |

### What the Module Does

The Expression Diagnostics system allows content authors to analyze expressions for trigger probability issues. The browser-side `ExpressionStatusService` communicates with the `llm-proxy-server` to:
1. **Scan all expression statuses** (GET `/api/expressions/scan-statuses`)
2. **Update individual expression status** (POST `/api/expressions/update-status`)

The server persists diagnostic statuses (impossible, extremely_rare, rare, normal, frequent, unknown) directly into expression JSON files.

---

## Problem

### What Failed

User experienced silent failures with the expression diagnostics panel:

1. **CORS Blocked GET Requests**: GET request to `/api/expressions/scan-statuses` was blocked by CORS (GET was not in allowed methods), but the client received no clear error - it just timed out after 30 seconds.

2. **Port Already in Use**: The server could not start because port 3001 was occupied, but the client-side had no mechanism to detect or report this proactively.

3. **No Proactive Health Checking**: The client makes expensive operations (30s timeout for scan) without first verifying the server is reachable and properly configured.

### How It Failed

**CORS Configuration Issue** (from `server.js` lines 170-175):
```javascript
// BEFORE FIX - GET was missing!
const corsOptions = {
  origin: allowedOriginsArray,
  methods: [HTTP_METHOD_POST, HTTP_METHOD_OPTIONS],  // ← GET NOT ALLOWED
  allowedHeaders: [HTTP_HEADER_CONTENT_TYPE, 'X-Title', 'HTTP-Referer'],
};
```

**What happened:**
1. Browser sends preflight OPTIONS request
2. Server responds with `Access-Control-Allow-Methods: POST, OPTIONS`
3. Browser blocks the actual GET request because GET is not in allowed methods
4. Client-side fetch times out after 30s waiting for a response that never comes

**Client Error Handling** (from `ExpressionStatusService.js`):
```javascript
} catch (error) {
  if (error.name === 'AbortError') {
    this.#logger.error('ExpressionStatusService: Scan timed out after 30s');
  } else {
    this.#logger.error('ExpressionStatusService: Network error during scan', {
      error: error.message,
    });
  }
  return [];  // Silent failure - returns empty array
}
```

The client catches errors but:
- Cannot distinguish CORS blocking from server unavailability
- Returns empty array silently on failure
- Logs to console which user may not see
- No proactive health check before operations

### Why It Failed

**Root Causes:**

1. **Silent Degradation**: The client treats all failures the same way - return empty/false and log. This masks the actual problem from users.

2. **No Pre-flight Verification**: Operations that take 10-30 seconds start without verifying server availability. Fast failure would improve UX.

3. **Error Type Opacity**: Browser fetch API does not expose CORS failures distinctly - they manifest as generic network errors or opaque responses.

4. **No CORS Method/Route Validation**: Server has no mechanism to verify routes don't use HTTP methods excluded from CORS config.

### Link to Tests

- `tests/unit/expressionDiagnostics/services/expressionStatusService.test.js` - 54 tests now passing with timeout behavior tests added

---

## Truth Sources

### Documentation

| Document | Relevance |
|----------|-----------|
| `specs/problematic-expressions-panel.md` | Original specification for the expression status system |
| `llm-proxy-server/PROXY_API_CONTRACT.md` | API contract for proxy server endpoints |
| `llm-proxy-server/CLAUDE.md` | Development guidelines for proxy server |

### Domain Rules

1. **Health Check Pattern**: Server already implements `/health/live`:
   ```javascript
   router.get('/live', (req, res) => {
     res.status(200).json({
       status: 'UP',
       timestamp: new Date().toISOString(),
       pid: process.pid,
       service: 'llm-proxy-server',
     });
   });
   ```

2. **CORS Configuration**: Server CORS now allows GET, POST, OPTIONS (server.js line 171)

3. **Timeout Configuration**: Client uses 10s for updates, 30s for scans

4. **Port Pre-flight Check**: Server checks port availability before binding (server.js lines 442-466)

### External Contracts

- **Fetch API**: Browser fetch provides limited error information for CORS failures
- **CORS Specification**: Pre-flight OPTIONS request required for non-simple requests
- **Express CORS Middleware**: Uses `cors` package version 2.8.5

---

## Desired Behavior

### Normal Cases

**N1: Successful Health Check Before Operations**
```
Client: HEAD /health/live (timeout: 2s)
Server: 200 OK
Client: Proceeds with GET /api/expressions/scan-statuses
Server: 200 OK with expressions array
```

**N2: Status Update with Cached Health Check**
```
Client: (Health check passed within last 60s - cached)
Client: POST /api/expressions/update-status
Server: 200 OK with success response
```

### Edge Cases

**E1: Server Running but CORS Misconfigured**
```
Client: OPTIONS /api/expressions/scan-statuses (preflight, timeout: 2s)
Server: 200 OK but Access-Control-Allow-Methods missing required method
Client: Detect CORS issue BEFORE attempting operation
Client: Return error with message: "Server CORS configuration does not allow required HTTP method. Check PROXY_ALLOWED_ORIGIN."
```

**E2: Server Port Occupied (Client Cannot Connect)**
```
Client: HEAD /health/live (timeout: 2s)
Client: Connection refused / fetch fails
Client: Return error with message: "Cannot connect to llm-proxy-server at localhost:3001. Is the server running?"
```

**E3: Server Running but Slow to Respond**
```
Client: HEAD /health/live (timeout: 2s)
Client: Timeout occurs
Client: Return error with message: "Server at localhost:3001 is not responding. Check server logs."
```

**E4: Health Check Passes but Operation Fails**
```
Client: HEAD /health/live → 200 OK
Client: GET /api/expressions/scan-statuses → Network error
Client: Return error with message: "Server health check passed but operation failed. Error: [error.message]"
```

### Failure Modes (What Errors to Raise/Return)

**F1: Connection Refused** (server not running)
- Detection: fetch throws TypeError with "Failed to fetch"
- Return: `{ success: false, errorType: 'connection_refused', message: "Cannot connect to server at {baseUrl}. Ensure the LLM proxy server is running." }`
- Recovery: User starts server with `npm run dev` in llm-proxy-server

**F2: CORS Blocked** (origin not allowed or method not allowed)
- Detection: Response has `type: 'opaque'` or missing CORS headers
- Return: `{ success: false, errorType: 'cors_blocked', message: "Server rejected request due to CORS policy. Check PROXY_ALLOWED_ORIGIN." }`
- Recovery: User adds client origin to PROXY_ALLOWED_ORIGIN environment variable

**F3: Request Timeout** (server unresponsive)
- Detection: AbortError from AbortController timeout
- Return: `{ success: false, errorType: 'timeout', message: "Request timed out after {timeout}ms. Server may be overloaded." }`
- Recovery: User checks server logs, restarts server

**F4: Server Error** (500-level response)
- Detection: Response.ok === false AND status >= 500
- Return: `{ success: false, errorType: 'server_error', message: "Server error: {status}. Check server logs." }`
- Recovery: User checks server logs

**F5: Validation Error** (400-level response)
- Detection: Response.ok === false AND status >= 400 AND status < 500
- Return: `{ success: false, errorType: 'validation_error', message: "Request validation failed: {error.message}" }`
- Recovery: Client code fix or data correction

### Invariants (Properties That Must Always Hold)

**I1: Health Check Timeout Invariant**
```
INVARIANT: healthCheckTimeout <= 2000ms
RATIONALE: Users should receive feedback within 2 seconds if server is unreachable
ENFORCEMENT: Constant in client service configuration
```

**I2: CORS Method Coverage Invariant**
```
INVARIANT: Every route's HTTP method MUST be in CORS allowedMethods array
CURRENT_METHODS: ['GET', 'POST', 'OPTIONS']
ENFORCEMENT: Server startup validation log or runtime warning
```

**I3: Pre-Operation Health Check Invariant**
```
INVARIANT: All operations SHOULD verify server availability before execution
EXCEPTION: If health check passed within HEALTH_CHECK_CACHE_TTL (60s)
ENFORCEMENT: Client service implementation
```

**I4: User-Visible Feedback Invariant**
```
INVARIANT: Every failure MUST produce user-visible feedback (not just console.log)
FEEDBACK_FORMAT: { success: false, errorType: string, message: string }
ENFORCEMENT: Client service return type contract
```

**I5: Error Type Differentiation Invariant**
```
INVARIANT: Errors MUST be classified into one of:
  - 'connection_refused': Cannot establish TCP connection
  - 'cors_blocked': CORS policy prevented request
  - 'timeout': Request exceeded timeout threshold
  - 'server_error': Server returned 5xx status
  - 'validation_error': Server returned 4xx status
  - 'unknown': Unclassified error
ENFORCEMENT: Client service error classification logic
```

### API Contracts

**What Stays Stable (DO NOT CHANGE)**

1. Health endpoint path: `/health/live`
2. Expression routes: `/api/expressions/scan-statuses`, `/api/expressions/update-status`
3. HTTP methods: GET for scan, POST for update
4. Success response format: `{ success: true, ... }`

**What is Allowed to Change**

1. Add `checkServerHealth()` method to ExpressionStatusService
2. Add `errorType` field to failure return objects
3. Add health check caching mechanism
4. Add error classification helper functions
5. Add startup validation for CORS/route consistency

---

## Testing Plan

### Which Tests Must Be Updated

**1. ExpressionStatusService Unit Tests** (ALREADY UPDATED)
- File: `tests/unit/expressionDiagnostics/services/expressionStatusService.test.js`
- Added: Tests for AbortError handling, signal passing to fetch
- Status: ✅ 54 tests passing

### Tests to Add

**Unit Tests - Client Side**
```
tests/unit/expressionDiagnostics/services/expressionStatusService.healthCheck.test.js (NEW)
- checkServerHealth() returns available:true when server responds
- checkServerHealth() returns connection_refused when fetch throws TypeError
- checkServerHealth() returns timeout when AbortError occurs
- checkServerHealth() returns cors_blocked when response is opaque
- Health check is cached for CACHE_TTL_MS (60s)
- Cached health check is invalidated after TTL
- scanAllStatuses() calls checkServerHealth() first (optional enhancement)
- Error messages are user-friendly and actionable
```

**Unit Tests - Server Side**
```
llm-proxy-server/tests/unit/services/corsValidation.test.js (NEW - optional)
- Log warning if route method not in CORS allowed methods
- All expression routes use methods in CORS config
```

**Integration Tests**
```
llm-proxy-server/tests/integration/expression-routes-cors.integration.test.js (NEW)
- OPTIONS preflight returns correct headers for /api/expressions/*
- GET /api/expressions/scan-statuses respects CORS origin
- POST /api/expressions/update-status respects CORS origin
```

### Regression Tests That Should Exist

**R1: Silent Failure Prevention**
```javascript
it('should NOT return empty array silently on failure', async () => {
  // Mock server unavailable
  global.fetch.mockRejectedValue(new Error('Connection refused'));
  const result = await service.scanAllStatuses();
  // With new behavior, should return object with errorType
  expect(result.errorType).toBeDefined();
  expect(result.message).toBeTruthy();
});
```

**R2: CORS Method Coverage**
```javascript
it('should have all route methods in CORS allowed methods', () => {
  const routeMethods = ['GET', 'POST']; // Used by expression routes
  const corsAllowedMethods = ['GET', 'POST', 'OPTIONS'];
  for (const method of routeMethods) {
    expect(corsAllowedMethods).toContain(method);
  }
});
```

### Property Tests That Should Exist

**P1: Error Classification Completeness**
```javascript
// For any network error, the classification should be one of the defined types
it.each([
  new TypeError('Failed to fetch'),
  new DOMException('The operation was aborted', 'AbortError'),
  { ok: false, status: 500 },
  { ok: false, status: 404 },
])('classifies error correctly: %p', (error) => {
  const classification = classifyError(error);
  expect(['connection_refused', 'cors_blocked', 'timeout', 'server_error', 'validation_error', 'unknown']).toContain(classification);
});
```

**P2: Health Check Timeout Bound**
```javascript
it('health check completes within timeout bound', async () => {
  const startTime = Date.now();
  await service.checkServerHealth();
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(2100); // 2000ms + 100ms buffer
});
```

---

## Implementation Phases

### Phase 1: Enhanced Error Classification (Priority: High)
1. Add error type constants to ExpressionStatusService
2. Implement `classifyError()` helper function
3. Update `scanAllStatuses()` and `updateStatus()` return types to include `errorType`
4. Update existing tests for new return format

### Phase 2: Proactive Health Checking (Priority: Medium)
1. Add `checkServerHealth()` method with 2s timeout
2. Add health check caching with 60s TTL
3. Optionally integrate health check into operations
4. Add unit tests for health check behavior

### Phase 3: UI Feedback Integration (Priority: Medium)
1. Update ExpressionDiagnosticsController to display error types
2. Add error banner/toast for different error types
3. Provide "How to fix" guidance for each error type

### Phase 4: Server-Side Validation (Priority: Low)
1. Add startup log verifying all route methods are in CORS config
2. Consider adding `/health/cors-check` endpoint for debugging

---

## Verification Steps

1. Run unit tests: `npm run test:unit -- --testPathPatterns="expressionStatusService"`
2. Run lint: `npx eslint src/expressionDiagnostics/services/ExpressionStatusService.js`
3. Start server: `cd llm-proxy-server && npm run dev`
4. Load `expression-diagnostics.html` and verify:
   - Problematic expressions panel loads successfully
   - Stopping server shows clear error within 2s (after health check implementation)
   - Run Simulation button resets properly after completion
