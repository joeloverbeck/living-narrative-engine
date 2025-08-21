# DEBUGLOGGING-001: Create Debug Log Endpoint in llm-proxy-server

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Server-Side Service  
**Estimated**: 4 hours  

## Description

Create a new HTTP POST endpoint `/api/debug-log` in the llm-proxy-server to receive batched debug logs from the browser client. This endpoint will follow the existing pattern established by the trace endpoint at `/api/traces/write`.

## Technical Requirements

### 1. Endpoint Specification
- **Method**: POST
- **Path**: `/api/debug-log`
- **Content-Type**: `application/json`
- **Rate Limit**: 100 requests/15min per IP (consistent with general API rate limits)
- **Alternative**: Create debug-specific rate limiter with 50 requests/5min for batched logs
- **Authentication**: None (consistent with current architecture)
- **Security**: Rely on rate limiting and input validation for protection

### 2. Request Schema Implementation
```javascript
// Expected request body structure
{
  logs: [
    {
      level: "debug|info|warn|error",
      message: "Log message text",
      category: "engine|ui|ecs|ai|etc",
      timestamp: "ISO 8601 datetime",
      source: "filename.js:line",
      sessionId: "uuid-v4",
      metadata: { /* optional context */ }
    }
  ]
}
```

### 3. Response Schema Implementation
```javascript
// Success response (200)
{
  success: true,
  processed: 100,
  timestamp: "ISO 8601 datetime"
}

// Error response (400/503)
{
  success: false,
  processed: 0,
  errors: ["error messages"],
  retryAfter: 60 // for 503 only
}
```

## Implementation Steps

1. **Create Controller File**
   - [ ] Create `llm-proxy-server/src/handlers/debugLogController.js`
   - [ ] Implement request validation using existing validation patterns
   - [ ] Add batch size limits (max 1000 logs per request)
   - [ ] Implement error handling and response formatting

2. **Create Route Configuration**
   - [ ] Create `llm-proxy-server/src/routes/debugRoutes.js` (similar to traceRoutes.js)
   - [ ] Register POST endpoint with Express router
   - [ ] Add debug-specific rate limiting middleware (consider creating `createDebugRateLimiter()` similar to `createLlmRateLimiter()`)
   - [ ] Alternative: Use existing `createApiRateLimiter()` for consistency
   - [ ] Configure CORS if needed

3. **Input Validation Schema**
   - [ ] Create debug log validation schema using express-validator patterns from validation.js
   - [ ] Validate required fields (level, message, timestamp) with proper error messages
   - [ ] Validate enum values for level field: "debug"|"info"|"warn"|"error"
   - [ ] Validate timestamp format (ISO 8601) using existing date validation patterns
   - [ ] Validate sessionId as UUID v4 format if provided
   - [ ] Validate category string with length limits (similar to header validation)
   - [ ] Validate batch size doesn't exceed 1000 logs per request
   - [ ] Return detailed validation errors using handleValidationErrors pattern

4. **Error Handling**
   - [ ] Handle malformed JSON gracefully
   - [ ] Implement proper HTTP status codes
   - [ ] Add service unavailable (503) response with retry-after header
   - [ ] Log server-side errors appropriately

## Acceptance Criteria

- [ ] Endpoint accepts POST requests at `/api/debug-log`
- [ ] Request validation rejects invalid payloads with detailed errors
- [ ] Batch size limit of 1000 logs is enforced
- [ ] Success response includes count of processed logs
- [ ] Error responses include actionable error messages
- [ ] Rate limiting is configured and functional
- [ ] Endpoint follows existing llm-proxy-server patterns
- [ ] All error cases return appropriate HTTP status codes

## Dependencies

**Code Dependencies:**
- Validation middleware patterns from `src/middleware/validation.js`
- Rate limiting constants and patterns from `src/config/constants.js` and `src/middleware/rateLimiting.js`
- Server routing patterns from `src/core/server.js` (line 261: trace routes registration)
- Error response utilities from `src/utils/responseUtils.js`
- Express-validator import patterns from existing validation middleware

**Architecture Dependencies:**
- None (first ticket in the debug logging implementation chain)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test request validation for all field types
   - [ ] Test batch size limits
   - [ ] Test error response formatting
   - [ ] Test rate limiting logic

2. **Integration Tests**
   - [ ] Test endpoint with valid payload
   - [ ] Test endpoint with invalid payloads
   - [ ] Test rate limiting behavior
   - [ ] Test large batch handling

## Files to Create/Modify

- **Create**: `llm-proxy-server/src/handlers/debugLogController.js`
- **Create**: `llm-proxy-server/src/routes/debugRoutes.js`
- **Modify**: `llm-proxy-server/src/index.js` (register routes)

## Notes

**Architecture Alignment:**
- Follow the existing pattern from `/api/traces/write` endpoint for consistency
- Use same validation patterns as `validateLlmRequest()` in `src/middleware/validation.js`
- Follow same rate limiting approach as existing API endpoints
- Use same error response formatting as `sendProxyError()` utility

**Performance Considerations:**
- Ensure the endpoint can handle high-frequency requests during game startup (13,000+ logs)
- Rate limiting may need adjustment for burst logging scenarios
- Consider adding request compression support in future tickets

**Integration:**
- Coordinate with DEBUGLOGGING-002 for storage service integration
- Register routes in `src/core/server.js` following trace routes pattern (line 261)

## Related Tickets

- **Next**: DEBUGLOGGING-002 (Implement LogStorageService)
- **Parallel**: DEBUGLOGGING-003 (Server configuration)