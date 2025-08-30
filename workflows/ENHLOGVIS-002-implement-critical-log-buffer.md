# ENHLOGVIS-002: Implement Critical Log Buffer in HybridLogger

## Ticket Overview
**Type**: Feature Implementation  
**Component**: Logging System  
**Priority**: High  
**Phase**: 1 - Core Functionality  
**Estimated Effort**: 2-3 hours  

## Objective
Add a circular buffer to HybridLogger that stores the last N critical logs (warnings and errors) in memory, making them accessible for the visual notification system and debugging purposes.

## Current State
- HybridLogger processes logs but doesn't retain a history of critical logs
- No way to retrieve recent warnings/errors programmatically
- Critical logs are lost once they're logged to destinations

## Technical Implementation

### Files to Modify
- `src/logging/hybridLogger.js`

### Implementation Steps

1. **Add private fields for buffer management**:
   ```javascript
   class HybridLogger {
     #criticalBuffer = [];
     #maxBufferSize = 50; // Default, will be set from config
     #bufferMetadata = {
       totalWarnings: 0,
       totalErrors: 0,
       oldestTimestamp: null,
       newestTimestamp: null
     };
   ```

2. **Initialize buffer configuration in constructor**:
   ```javascript
   constructor({ config, ...dependencies }) {
     // Existing constructor code...
     
     // Set buffer size from config
     this.#maxBufferSize = config?.criticalLogging?.bufferSize || 50;
   }
   ```

3. **Create buffer management methods**:
   ```javascript
   #addToCriticalBuffer(level, message, category, metadata = {}) {
     if (level !== 'warn' && level !== 'error') {
       return; // Only buffer critical logs
     }
     
     const logEntry = {
       timestamp: new Date().toISOString(),
       level,
       message,
       category,
       metadata,
       id: crypto.randomUUID()
     };
     
     // Add to buffer (circular buffer logic)
     this.#criticalBuffer.push(logEntry);
     
     // Maintain buffer size limit
     if (this.#criticalBuffer.length > this.#maxBufferSize) {
       this.#criticalBuffer.shift(); // Remove oldest
     }
     
     // Update metadata
     this.#updateBufferMetadata(level);
     
     return logEntry;
   }
   
   #updateBufferMetadata(level) {
     if (level === 'warn') {
       this.#bufferMetadata.totalWarnings++;
     } else if (level === 'error') {
       this.#bufferMetadata.totalErrors++;
     }
     
     const now = new Date().toISOString();
     if (!this.#bufferMetadata.oldestTimestamp) {
       this.#bufferMetadata.oldestTimestamp = now;
     }
     this.#bufferMetadata.newestTimestamp = now;
   }
   ```

4. **Integrate buffer with warn() and error() methods**:
   ```javascript
   warn(message, context = {}) {
     const category = this.#determineCategory(context);
     
     // Add to critical buffer
     const bufferEntry = this.#addToCriticalBuffer('warn', message, category, context);
     
     // Existing warn logic...
     this.#logToDestinations('warn', message, category, context);
   }
   
   error(message, error = null, context = {}) {
     const category = this.#determineCategory(context);
     
     // Prepare error metadata
     const errorMetadata = {
       ...context,
       stack: error?.stack,
       errorName: error?.name,
       errorMessage: error?.message
     };
     
     // Add to critical buffer
     const bufferEntry = this.#addToCriticalBuffer('error', message, category, errorMetadata);
     
     // Existing error logic...
     this.#logToDestinations('error', message, category, errorMetadata);
   }
   ```

5. **Add public accessor methods**:
   ```javascript
   /**
    * Get all critical logs from the buffer
    * @param {Object} options - Filter options
    * @param {string} options.level - Filter by level ('warn', 'error', or null for both)
    * @param {number} options.limit - Maximum number of logs to return
    * @returns {Array} Array of log entries
    */
   getCriticalLogs(options = {}) {
     let logs = [...this.#criticalBuffer]; // Create copy
     
     if (options.level) {
       logs = logs.filter(log => log.level === options.level);
     }
     
     if (options.limit) {
       logs = logs.slice(-options.limit);
     }
     
     return logs;
   }
   
   /**
    * Get critical buffer metadata
    * @returns {Object} Buffer statistics
    */
   getCriticalBufferStats() {
     return {
       currentSize: this.#criticalBuffer.length,
       maxSize: this.#maxBufferSize,
       ...this.#bufferMetadata
     };
   }
   
   /**
    * Clear the critical log buffer
    */
   clearCriticalBuffer() {
     this.#criticalBuffer = [];
     this.#bufferMetadata = {
       totalWarnings: 0,
       totalErrors: 0,
       oldestTimestamp: null,
       newestTimestamp: null
     };
   }
   ```

## Dependencies
- **Requires**: ENHLOGVIS-001 (Enhanced shouldLogToConsole method)
- **Required By**: ENHLOGVIS-006 (Integration with notifier)

## Acceptance Criteria
- [ ] Buffer stores last N critical logs (configurable size)
- [ ] Buffer operates as circular buffer (old logs removed when full)
- [ ] Each buffered log includes: timestamp, level, message, category, metadata
- [ ] `getCriticalLogs()` method returns logs with optional filtering
- [ ] `getCriticalBufferStats()` provides buffer statistics
- [ ] `clearCriticalBuffer()` empties the buffer
- [ ] Buffer size is configurable via config file
- [ ] Memory usage stays under 10KB for 50 logs

## Testing Requirements

### Unit Tests
- Test buffer adds warnings correctly
- Test buffer adds errors correctly
- Test circular buffer behavior (old logs removed when full)
- Test getCriticalLogs() with various filter options
- Test buffer statistics are accurate
- Test clearCriticalBuffer() empties buffer
- Test memory usage for 50 log entries
- Test buffer ignores non-critical logs (info, debug)

### Performance Tests
- Measure memory usage with 50 logs
- Measure performance impact of buffer operations
- Verify no memory leaks over time

### Manual Testing
1. Configure buffer size to small value (e.g., 5)
2. Generate 10 warnings/errors
3. Verify only last 5 are retained
4. Call getCriticalLogs() - verify correct logs returned
5. Check buffer stats match actual state
6. Clear buffer and verify it's empty

## Code Review Checklist
- [ ] Efficient circular buffer implementation
- [ ] No memory leaks
- [ ] Proper error handling
- [ ] Thread-safe operations
- [ ] JSDoc comments for public methods
- [ ] Follows existing HybridLogger patterns

## Notes
- Consider using a more efficient data structure if performance becomes an issue
- The buffer should be resilient to errors in the logging process
- Consider adding event emission when buffer is updated for real-time notifications
- Ensure buffer entries are serializable for potential export functionality

## Related Tickets
- **Depends On**: ENHLOGVIS-001 (Enhanced shouldLogToConsole)
- **Next**: ENHLOGVIS-003 (Update configuration schema)
- **Blocks**: ENHLOGVIS-006 (Integration with notifier), ENHLOGVIS-012 (Export functionality)