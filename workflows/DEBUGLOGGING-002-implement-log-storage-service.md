# DEBUGLOGGING-002: Implement LogStorageService with File Persistence

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 1 - Infrastructure  
**Component**: Server-Side Service  
**Estimated**: 6 hours  

## Description

Implement a LogStorageService that handles file-based persistence of debug logs using JSONL format. The service will organize logs by date and category, manage file rotation, and provide efficient write operations.

## Technical Requirements

### 1. File Structure Pattern
```
logs/
├── 2024-12-20/
│   ├── engine.jsonl
│   ├── ui.jsonl
│   ├── ecs.jsonl
│   ├── ai.jsonl
│   ├── persistence.jsonl
│   ├── anatomy.jsonl
│   ├── actions.jsonl
│   ├── turns.jsonl
│   ├── events.jsonl
│   ├── validation.jsonl
│   └── general.jsonl
└── 2024-12-21/
    └── ...
```

### 2. JSONL Format
```jsonl
{"level":"debug","message":"GameEngine: Constructor called","category":"engine","timestamp":"2024-12-20T10:15:30.123Z","source":"gameEngine.js:45","sessionId":"uuid-v4","metadata":{}}
{"level":"debug","message":"EntityManager: Creating entity","category":"ecs","timestamp":"2024-12-20T10:15:30.125Z","source":"entityManager.js:123","sessionId":"uuid-v4","metadata":{"entityId":"actor_1234"}}
```

### 3. Storage Configuration
- **Retention Period**: Configurable (default: 7 days)
- **Max File Size**: 10MB per file (rotate if exceeded)
- **Write Buffer**: Implement write buffering for performance
- **File Permissions**: Ensure proper file permissions (644)

## Implementation Steps

1. **Create LogStorageService Class**
   - [ ] Create `llm-proxy-server/src/services/logStorageService.js`
   - [ ] Implement constructor with configuration injection
   - [ ] Add file system error handling
   - [ ] Implement async write operations

2. **Implement Core Methods**
   ```javascript
   class LogStorageService {
     constructor(config)
     async writeLogs(logs) // Write batch of logs
     async rotateLargeFiles() // Check and rotate files >10MB
     async cleanupOldLogs() // Remove logs older than retention
     async ensureDirectoryStructure(date) // Create date folders
     #getCategoryFilePath(date, category) // Get file path
     #formatLogEntry(log) // Convert to JSONL format
   }
   ```

3. **Category Detection Logic**
   - [ ] Implement pattern matching for categories
   - [ ] Define category patterns object
   - [ ] Add fallback to 'general' category
   - [ ] Support dynamic category addition

4. **File Management**
   - [ ] Implement atomic file writes
   - [ ] Add file rotation when size exceeds 10MB
   - [ ] Create date-based directory structure
   - [ ] Ensure directory exists before writing

5. **Performance Optimizations**
   - [ ] Implement write buffering (batch writes)
   - [ ] Use streams for large write operations
   - [ ] Add async queue for write operations
   - [ ] Implement back-pressure handling

## Category Patterns

```javascript
const CATEGORY_PATTERNS = {
  engine: /GameEngine|engineState|gameSession/i,
  ui: /UI|Renderer|domUI|display/i,
  ecs: /Entity|Component|System|entityManager/i,
  ai: /AI|LLM|notes|thoughts|memory/i,
  persistence: /Save|Load|persist|storage/i,
  anatomy: /anatomy|body|part|descriptor/i,
  actions: /action|target|resolution/i,
  turns: /turn|round|cycle/i,
  events: /event|dispatch|listener/i,
  validation: /validate|schema|ajv/i,
  general: // default fallback
};
```

## Acceptance Criteria

- [ ] Service creates proper directory structure (YYYY-MM-DD format)
- [ ] Logs are written to correct category files
- [ ] JSONL format is properly maintained
- [ ] File rotation works when size exceeds 10MB
- [ ] Old logs are cleaned up based on retention period
- [ ] Service handles file system errors gracefully
- [ ] Concurrent writes don't corrupt files
- [ ] Performance handles 1000+ logs/second

## Dependencies

- **Requires**: DEBUGLOGGING-001 (endpoint to call this service)
- **Requires**: Node.js fs module and path module

## Testing Requirements

1. **Unit Tests**
   - [ ] Test category detection logic
   - [ ] Test JSONL formatting
   - [ ] Test file path generation
   - [ ] Test date folder creation

2. **Integration Tests**
   - [ ] Test file writing and reading
   - [ ] Test file rotation logic
   - [ ] Test cleanup of old logs
   - [ ] Test concurrent write handling

3. **Performance Tests**
   - [ ] Test with 1000+ logs per batch
   - [ ] Test sustained write performance
   - [ ] Test file rotation under load

## Files to Create/Modify

- **Create**: `llm-proxy-server/src/services/logStorageService.js`
- **Create**: `llm-proxy-server/tests/logStorageService.test.js`
- **Modify**: `llm-proxy-server/.gitignore` (add logs/ directory)

## Error Handling

- File system errors should be logged but not crash the service
- Implement fallback to console logging if file write fails
- Add metrics for write failures
- Ensure partial batch failures don't lose entire batch

## Notes

- Follow existing trace file storage patterns for consistency
- Consider implementing compression for archived logs in future
- Ensure service can handle game startup surge (13,000+ logs)
- Coordinate with DEBUGLOGGING-004 for cleanup scheduling

## Related Tickets

- **Depends On**: DEBUGLOGGING-001 (endpoint integration)
- **Next**: DEBUGLOGGING-004 (cleanup mechanisms)
- **Parallel**: DEBUGLOGGING-003 (configuration)