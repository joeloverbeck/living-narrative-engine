# DEBUGLOGGING-004: Setup File Rotation and Cleanup Mechanisms

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 1 - Infrastructure  
**Component**: Server-Side Service  
**Estimated**: 4 hours

## Description

Implement automated file rotation when logs exceed size limits and scheduled cleanup of old log files based on retention policy. This ensures the logging system doesn't consume unlimited disk space.

## Technical Requirements

### 1. File Rotation Strategy

- Rotate files when they exceed 10MB (configurable)
- Naming pattern: `category.jsonl` → `category.1.jsonl` → `category.2.jsonl`
- Keep maximum of 5 rotated files per category per day
- Atomic rotation to prevent data loss

### 2. Cleanup Schedule

- Run daily at 2 AM (configurable via cron expression)
- Delete directories older than retention period (default: 7 days)
- Log cleanup operations for audit trail
- Handle cleanup failures gracefully

### 3. Monitoring

- Track disk usage trends
- Alert when disk usage exceeds 80%
- Monitor rotation frequency
- Track cleanup success/failure rates

## Implementation Steps

1. **Create File Rotation Service**
   - [ ] Create `llm-proxy-server/src/services/logRotationService.js`
   - [ ] Implement size checking before writes
   - [ ] Add atomic file rotation logic
   - [ ] Implement rotated file naming scheme

2. **Rotation Logic Implementation**

   ```javascript
   class LogRotationService {
     async checkAndRotate(filePath, maxSize)
     async rotateFile(filePath)
     async getFileSize(filePath)
     #getRotatedFileName(filePath, index)
     #shiftRotatedFiles(basePath, maxRotations)
   }
   ```

3. **Create Cleanup Scheduler**
   - [ ] Create `llm-proxy-server/src/services/logCleanupScheduler.js`
   - [ ] Implement cron-based scheduling (use node-cron)
   - [ ] Add directory age calculation
   - [ ] Implement recursive directory deletion

4. **Cleanup Logic Implementation**

   ```javascript
   class LogCleanupScheduler {
     constructor(config, storageService)
     start() // Start scheduled cleanup
     stop() // Stop scheduled cleanup
     async performCleanup()
     async getDirectoriesToDelete(retentionDays)
     async deleteDirectory(path)
     #isDirectoryOld(dirName, retentionDays)
   }
   ```

5. **Disk Usage Monitoring**
   - [ ] Implement disk usage checking
   - [ ] Add threshold-based alerts
   - [ ] Create metrics collection
   - [ ] Log usage statistics

6. **Integration with Storage Service**
   - [ ] Call rotation check before each write
   - [ ] Handle rotation during active writes
   - [ ] Ensure no log loss during rotation
   - [ ] Update file paths after rotation

## Acceptance Criteria

- [ ] Files rotate when exceeding size limit
- [ ] Rotation maintains maximum 5 versions per category
- [ ] Cleanup runs on configured schedule
- [ ] Old directories are deleted after retention period
- [ ] No data loss during rotation
- [ ] Cleanup failures don't crash the service
- [ ] Disk usage is monitored and logged
- [ ] Rotation and cleanup operations are logged

## Dependencies

- **Requires**: DEBUGLOGGING-002 (LogStorageService)
- **Requires**: DEBUGLOGGING-003 (Configuration)
- **NPM Package**: node-cron (for scheduling)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test file size calculation
   - [ ] Test rotation naming logic
   - [ ] Test directory age calculation
   - [ ] Test cron expression parsing

2. **Integration Tests**
   - [ ] Test file rotation under load
   - [ ] Test cleanup of old directories
   - [ ] Test concurrent rotation handling
   - [ ] Test cleanup schedule execution

3. **Performance Tests**
   - [ ] Test rotation performance with large files
   - [ ] Test cleanup with many directories
   - [ ] Verify no blocking during rotation

## Files to Create/Modify

- **Create**: `llm-proxy-server/src/services/logRotationService.js`
- **Create**: `llm-proxy-server/src/services/logCleanupScheduler.js`
- **Create**: `llm-proxy-server/tests/logRotation.test.js`
- **Create**: `llm-proxy-server/tests/logCleanup.test.js`
- **Modify**: `llm-proxy-server/src/services/logStorageService.js`
- **Modify**: `llm-proxy-server/package.json` (add node-cron)

## Rotation Algorithm

```javascript
// Before writing logs
if (fileSize + newDataSize > maxFileSize) {
  await rotateFile(filePath);
}

// Rotation process
1. Rename category.jsonl → category.1.jsonl
2. Shift existing rotated files (1→2, 2→3, etc.)
3. Delete oldest if exceeding maxRotations
4. Create new empty category.jsonl
```

## Cleanup Algorithm

```javascript
// Daily at 2 AM
1. List all directories in logs/
2. Parse directory names as dates
3. Calculate age of each directory
4. Delete directories older than retentionDays
5. Log cleanup summary
```

## Error Handling

- Rotation failures should fall back to creating new file
- Cleanup failures should be logged but not stop future cleanups
- Disk space errors should trigger immediate cleanup
- File permission errors should be reported clearly

## Monitoring Metrics

- `logs.rotation.count` - Number of rotations performed
- `logs.rotation.size` - Size of rotated files
- `logs.cleanup.deleted` - Number of directories deleted
- `logs.cleanup.freed` - Disk space freed by cleanup
- `logs.disk.usage` - Current disk usage percentage
- `logs.disk.available` - Available disk space

## Notes

- Consider implementing compression for rotated files in future
- May need to implement emergency cleanup if disk critically low
- Ensure cleanup doesn't delete today's logs
- Test thoroughly with different timezone settings

## Related Tickets

- **Depends On**: DEBUGLOGGING-002, DEBUGLOGGING-003
- **Next**: Phase 2 tickets (client-side implementation)
- **Related**: DEBUGLOGGING-022 (compression optimization)
