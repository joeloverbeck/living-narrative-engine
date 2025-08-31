# Source-Based Logging Categorization System - Brainstorming Document

## Executive Summary

This document explores the implementation of a new logging categorization system for the Living Narrative Engine's LLM Proxy Server. The proposed system would categorize logs based on their source location in the JavaScript file hierarchy rather than the current pattern-matching approach based on message content.

**Updated Scope**: Analysis of the codebase reveals 40+ source directories (vs. 16 originally identified), requiring a more comprehensive categorization strategy and careful consideration of performance implications.

## Problem Statement

The current logging system has a fundamental flaw:
- **Pattern-based categorization** matches words in log messages (e.g., "failed", "error") rather than using actual log levels
- **100% of error.jsonl entries** are miscategorized debug logs that merely contain error-related keywords
- **Developer confusion** when debugging specific modules, as logs appear in unexpected files
- **Performance overhead** from regex pattern matching on every log message

## Proposed Solution

### Core Concept

Transform the logging system to use a **dual-axis categorization**:

1. **Primary Axis: Log Level**
   - `error.jsonl` - Only logs with level="error"
   - `warning.jsonl` - Only logs with level="warn"
   - All other logs categorized by source location

2. **Secondary Axis: Source Location**
   - Extract the source file path from stack traces
   - Map source paths to logical categories based on directory structure
   - Example: `src/actions/*` → `actions.jsonl`

### File Structure

```
logs/YYYY-MM-DD/
├── error.jsonl          # All error-level logs (level="error")
├── warning.jsonl        # All warning-level logs (level="warn")
├── actions.jsonl        # Logs from src/actions/*
├── logic.jsonl          # Logs from src/logic/*
├── entities.jsonl       # Logs from src/entities/*
├── ai.jsonl            # Logs from src/ai/*
├── domUI.jsonl         # Logs from src/domUI/*
├── engine.jsonl        # Logs from src/engine/*
├── events.jsonl        # Logs from src/events/*
├── loaders.jsonl       # Logs from src/loaders/*
├── scopeDsl.jsonl      # Logs from src/scopeDsl/*
├── initializers.jsonl  # Logs from src/initializers/*
├── dependencyInjection.jsonl  # Logs from src/dependencyInjection/*
├── logging.jsonl       # Logs from src/logging/*
├── config.jsonl        # Logs from src/config/*
├── utils.jsonl         # Logs from src/utils/*
├── services.jsonl      # Logs from src/services/*
├── constants.jsonl     # Logs from src/constants/*
├── storage.jsonl       # Logs from src/storage/*
├── types.jsonl         # Logs from src/types/*
├── alerting.jsonl      # Logs from src/alerting/*
├── context.jsonl       # Logs from src/context/*
├── turns.jsonl         # Logs from src/turns/*
├── adapters.jsonl      # Logs from src/adapters/*
├── query.jsonl         # Logs from src/query/*
├── characterBuilder.jsonl  # Logs from src/characterBuilder/*
├── prompting.jsonl     # Logs from src/prompting/*
├── anatomy.jsonl       # Logs from src/anatomy/*
├── scheduling.jsonl    # Logs from src/scheduling/*
├── errors.jsonl        # Logs from src/errors/*
├── interfaces.jsonl    # Logs from src/interfaces/*
├── clothing.jsonl      # Logs from src/clothing/*
├── input.jsonl         # Logs from src/input/*
├── testing.jsonl       # Logs from src/testing/*
├── configuration.jsonl # Logs from src/configuration/*
├── modding.jsonl       # Logs from src/modding/*
├── persistence.jsonl   # Logs from src/persistence/*
├── data.jsonl          # Logs from src/data/*
├── shared.jsonl        # Logs from src/shared/*
├── bootstrapper.jsonl  # Logs from src/bootstrapper/*
├── commands.jsonl      # Logs from src/commands/*
├── thematicDirection.jsonl  # Logs from src/thematicDirection/*
├── models.jsonl        # Logs from src/models/*
├── llms.jsonl          # Logs from src/llms/*
├── validation.jsonl    # Logs from src/validation/*
├── pathing.jsonl       # Logs from src/pathing/*
├── formatting.jsonl    # Logs from src/formatting/*
├── ports.jsonl         # Logs from src/ports/*
├── shutdown.jsonl      # Logs from src/shutdown/*
├── common.jsonl        # Logs from src/common/*
├── tests.jsonl         # Logs from tests/*
├── llm-proxy.jsonl     # Logs from llm-proxy-server/*
└── general.jsonl       # Fallback for unmatched sources
```

## Implementation Strategy

### Phase 1: Source Detection Enhancement

#### 1.1 Client-Side Source Extraction

**Location**: `src/logging/logMetadataEnricher.js`

**Current State**: The `LogMetadataEnricher` class already has a `detectSource()` method that extracts source location from stack traces, but it only returns `filename:line` format. This needs to be enhanced to extract full paths for category mapping.

```javascript
class LogMetadataEnricher {
  /**
   * Enhanced source category detection
   * Building on existing detectSource() method
   */
  detectSourceCategory(skipFrames = 4) {
    // Use existing detectSource as base
    const sourceLocation = this.detectSource(skipFrames);
    if (!sourceLocation) return 'general';
    
    // Enhance to extract full path from existing stack parsing
    const fullPath = this.#extractFullPathFromStack(skipFrames);
    
    // Map path to category
    return this.#mapPathToCategory(fullPath);
  }
  
  #extractFullPathFromStack(skipFrames) {
    try {
      const stack = new Error().stack;
      if (!stack) return null;
      
      const lines = stack.split('
');
      
      // Use existing browser patterns from #browserPatterns Map
      for (let i = skipFrames; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !this.#isInternalFrame(line)) {
          // Parse full path instead of just filename
          const fullPath = this.#parseStackLineForFullPath(line);
          if (fullPath) return fullPath;
        }
      }
    } catch {
      return null;
    }
  }
  
  #mapPathToCategory(path) {
    if (!path) return 'general';
    
    // Comprehensive source path mappings for all directories
    const categoryMappings = [
      { pattern: /src\/actions\//i, category: 'actions' },
      { pattern: /src\/logic\//i, category: 'logic' },
      { pattern: /src\/entities\//i, category: 'entities' },
      { pattern: /src\/ai\//i, category: 'ai' },
      { pattern: /src\/domUI\//i, category: 'domUI' },
      { pattern: /src\/engine\//i, category: 'engine' },
      { pattern: /src\/events\//i, category: 'events' },
      { pattern: /src\/loaders\//i, category: 'loaders' },
      { pattern: /src\/scopeDsl\//i, category: 'scopeDsl' },
      { pattern: /src\/initializers\//i, category: 'initializers' },
      { pattern: /src\/dependencyInjection\//i, category: 'dependencyInjection' },
      { pattern: /src\/logging\//i, category: 'logging' },
      { pattern: /src\/config\//i, category: 'config' },
      { pattern: /src\/utils\//i, category: 'utils' },
      { pattern: /src\/services\//i, category: 'services' },
      { pattern: /src\/constants\//i, category: 'constants' },
      { pattern: /src\/storage\//i, category: 'storage' },
      { pattern: /src\/types\//i, category: 'types' },
      { pattern: /src\/alerting\//i, category: 'alerting' },
      { pattern: /src\/context\//i, category: 'context' },
      { pattern: /src\/turns\//i, category: 'turns' },
      { pattern: /src\/adapters\//i, category: 'adapters' },
      { pattern: /src\/query\//i, category: 'query' },
      { pattern: /src\/characterBuilder\//i, category: 'characterBuilder' },
      { pattern: /src\/prompting\//i, category: 'prompting' },
      { pattern: /src\/anatomy\//i, category: 'anatomy' },
      { pattern: /src\/scheduling\//i, category: 'scheduling' },
      { pattern: /src\/errors\//i, category: 'errors' },
      { pattern: /src\/interfaces\//i, category: 'interfaces' },
      { pattern: /src\/clothing\//i, category: 'clothing' },
      { pattern: /src\/input\//i, category: 'input' },
      { pattern: /src\/testing\//i, category: 'testing' },
      { pattern: /src\/configuration\//i, category: 'configuration' },
      { pattern: /src\/modding\//i, category: 'modding' },
      { pattern: /src\/persistence\//i, category: 'persistence' },
      { pattern: /src\/data\//i, category: 'data' },
      { pattern: /src\/shared\//i, category: 'shared' },
      { pattern: /src\/bootstrapper\//i, category: 'bootstrapper' },
      { pattern: /src\/commands\//i, category: 'commands' },
      { pattern: /src\/thematicDirection\//i, category: 'thematicDirection' },
      { pattern: /src\/models\//i, category: 'models' },
      { pattern: /src\/llms\//i, category: 'llms' },
      { pattern: /src\/validation\//i, category: 'validation' },
      { pattern: /src\/pathing\//i, category: 'pathing' },
      { pattern: /src\/formatting\//i, category: 'formatting' },
      { pattern: /src\/ports\//i, category: 'ports' },
      { pattern: /src\/shutdown\//i, category: 'shutdown' },
      { pattern: /src\/common\//i, category: 'common' },
      { pattern: /tests\//i, category: 'tests' },
      { pattern: /llm-proxy-server\//i, category: 'llm-proxy' },
    ];
    
    for (const mapping of categoryMappings) {
      if (mapping.pattern.test(path)) {
        return mapping.category;
      }
    }
    
    return 'general';
  }
}

#### 1.2 Enhanced Stack Trace Parsing

Improve the stack trace parsing to extract full paths:

```javascript
#parseStackLine(line) {
  // Enhanced patterns to capture full paths
  const patterns = [
    // Chrome/Edge format
    /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/,
    // Firefox format
    /@(.+?):(\d+):(\d+)/,
    // Safari format
    /(.+?)@(.+?):(\d+):(\d+)/,
    // Webpack/bundled format
    /webpack:\/\/\/(.+?):(\d+):(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const fullPath = match[1];
      const lineNumber = match[2];
      
      // Return both full path and line for categorization
      return {
        fullPath,
        lineNumber,
        fileName: fullPath.split('/').pop(),
      };
    }
  }
  
  return null;
}
```

### Phase 2: Category Detection Refactoring

#### 2.1 Replace Pattern-Based Detection

**Location**: `src/logging/logCategoryDetector.js`

**Current State**: The `LogCategoryDetector` class currently uses regex patterns to match log messages. The problematic error pattern at line ~155 matches keywords like "failed", "error", "exception" which causes false positives.

**Architecture Issue**: Category detection exists in both client-side (`LogCategoryDetector`) and server-side (`LogStorageService#detectCategory`). This duplication should be addressed.

```javascript
class LogCategoryDetector {
  constructor(config = {}) {
    this.#cache = new LRUCache(config.cacheSize || 200);
    this.#useSourceBased = config.useSourceBased !== false;
    
    // IMPORTANT: Remove the problematic error pattern that matches keywords
    // Current pattern at line ~155: /\berror\b|exception|failed|failure|catch|throw|stack\s*trace/i
    // This causes false positives when debug logs contain these words
    
    // Keep domain patterns only as fallback for when source detection fails
    this.#initializeFallbackPatterns();
  }
  
  detectCategory(message, metadata = {}) {
    // Priority 1: Use log level for errors and warnings
    if (metadata.level === 'error') return 'error';
    if (metadata.level === 'warn') return 'warning';
    
    // Priority 2: Use source-based categorization if available
    if (this.#useSourceBased && metadata.sourceCategory) {
      return metadata.sourceCategory;
    }
    
    // Priority 3: Fallback to message patterns (without error pattern)
    // This maintains backward compatibility when source detection fails
    return this.#detectFromMessage(message);
  }
  
  #initializeFallbackPatterns() {
    // Remove the error pattern entirely - it's now handled by log level
    // Keep only domain-specific patterns as fallback
    this.#patterns = new Map([
      // Domain patterns remain but without the problematic error pattern
      ['ecs', { pattern: /EntityManager|ComponentManager|SystemManager/i, priority: 80 }],
      ['engine', { pattern: /GameEngine|engineState|gameSession/i, priority: 80 }],
      ['ai', { pattern: /\bAI\b|\bLLM\b|\bnotes\b|\bthoughts\b/i, priority: 80 }],
      ['anatomy', { pattern: /\banatomy\b|body\s*part|descriptor|blueprint/i, priority: 80 }],
      ['persistence', { pattern: /\bsave\b|\bload\b|persist|storage/i, priority: 75 }],
      ['actions', { pattern: /\baction\b|\btarget\b|resolution|candidate/i, priority: 75 }],
      ['turns', { pattern: /turn|round|cycle|turnManager/i, priority: 75 }],
      ['events', { pattern: /event|dispatch|listener|eventBus/i, priority: 75 }],
      ['validation', { pattern: /\bvalidat|\bschema\b|\bajv\b/i, priority: 75 }],
      // ... other domain patterns without error pattern
    ]);
  }
}
```javascript
class LogCategoryDetector {
  constructor(config = {}) {
    this.#cache = new LRUCache(config.cacheSize || 200);
    this.#useSourceBased = config.useSourceBased !== false;
    
    // Remove the problematic error pattern
    // Keep domain patterns only as fallback
    this.#initializeFallbackPatterns();
  }
  
  detectCategory(message, metadata = {}) {
    // Priority 1: Use log level for errors and warnings
    if (metadata.level === 'error') return 'error';
    if (metadata.level === 'warn') return 'warning';
    
    // Priority 2: Use source-based categorization
    if (this.#useSourceBased && metadata.sourceCategory) {
      return metadata.sourceCategory;
    }
    
    // Priority 3: Fallback to message patterns (without error pattern)
    return this.#detectFromMessage(message);
  }
  
  #initializeFallbackPatterns() {
    // Remove the error pattern entirely
    // Keep only domain-specific patterns as fallback
    this.#patterns = new Map([
      ['ecs', { pattern: /EntityManager|ComponentManager|SystemManager/i, priority: 80 }],
      ['engine', { pattern: /GameEngine|engineState|gameSession/i, priority: 80 }],
      ['ai', { pattern: /\bAI\b|\bLLM\b|\bnotes\b|\bthoughts\b/i, priority: 80 }],
      // ... other domain patterns without error pattern
    ]);
  }
}
```

### Phase 3: Server-Side Processing

#### 3.1 Update LogStorageService

**Location**: `llm-proxy-server/src/services/logStorageService.js`

**Current State**: The `LogStorageService` class has its own `#detectCategory()` method that duplicates client-side pattern matching. This creates a maintenance burden and potential inconsistencies.

```javascript
class LogStorageService {
  #getFilePath(log, date) {
    // Priority routing based on log level
    if (log.level === 'error') {
      return path.join(this.#config.baseLogPath, date, 'error.jsonl');
    }
    
    if (log.level === 'warn') {
      return path.join(this.#config.baseLogPath, date, 'warning.jsonl');
    }
    
    // Use source-based category from client or fallback to server detection
    const category = log.sourceCategory || log.category || this.#detectCategory(log) || 'general';
    return path.join(this.#config.baseLogPath, date, `${category}.jsonl`);
  }
  
  #detectCategory(log) {
    // NOTE: This method duplicates client-side logic
    // Should be simplified to only handle edge cases where client didn't provide category
    
    // Use explicit category if provided
    if (log.category && typeof log.category === 'string') {
      return log.category.toLowerCase();
    }
    
    // Minimal fallback pattern matching for backward compatibility
    // Remove duplicate pattern matching logic once client-side migration is complete
    return 'general';
  }
  
  async storeLogs(logs) {
    // Group logs by date and file path
    const grouped = new Map();
    
    for (const log of logs) {
      const date = this.#getDateString(log.timestamp);
      const filePath = this.#getFilePath(log, date);
      
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath).push(log);
    }
    
    // Write to respective files
    for (const [filePath, logsForFile] of grouped) {
      await this.#writeToFile(filePath, logsForFile);
    }
  }
}
```javascript
class LogStorageService {
  #getFilePath(log, date) {
    // Priority routing based on log level
    if (log.level === 'error') {
      return path.join(this.#config.baseLogPath, date, 'error.jsonl');
    }
    
    if (log.level === 'warn') {
      return path.join(this.#config.baseLogPath, date, 'warning.jsonl');
    }
    
    // Use source-based category for other levels
    const category = log.category || 'general';
    return path.join(this.#config.baseLogPath, date, `${category}.jsonl`);
  }
  
  async storeLogs(logs) {
    // Group logs by date and file path
    const grouped = new Map();
    
    for (const log of logs) {
      const date = this.#getDateString(log.timestamp);
      const filePath = this.#getFilePath(log, date);
      
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath).push(log);
    }
    
    // Write to respective files
    for (const [filePath, logsForFile] of grouped) {
      await this.#writeToFile(filePath, logsForFile);
    }
  }
}
```

### Phase 4: Configuration & Migration

#### 4.1 Configuration Schema

**Current State**: The existing `config/debug-logging-config.json` has a different structure than proposed. We need to integrate with the existing schema while maintaining backward compatibility.

```json
{
  "$schema": "schema://living-narrative-engine/debug-logging-config.schema.json",
  "enabled": true,
  "mode": "development",
  "fallbackToConsole": true,
  "logLevel": "INFO",
  
  // New source-based categorization configuration
  "categorization": {
    "strategy": "source-based",  // "source-based" | "pattern-based" | "hybrid"
    "enableStackTraceExtraction": true,
    "sourceMappings": {
      "src/actions": "actions",
      "src/logic": "logic",
      "src/entities": "entities",
      "src/ai": "ai",
      "src/domUI": "domUI",
      "src/engine": "engine",
      "src/events": "events",
      "src/loaders": "loaders",
      "src/scopeDsl": "scopeDsl",
      "src/initializers": "initializers",
      "src/dependencyInjection": "dependencyInjection",
      "src/logging": "logging",
      "src/config": "config",
      "src/utils": "utils",
      "src/services": "services",
      "src/constants": "constants",
      "src/storage": "storage",
      "src/types": "types",
      "src/alerting": "alerting",
      "src/context": "context",
      "src/turns": "turns",
      "src/adapters": "adapters",
      "src/query": "query",
      "src/characterBuilder": "characterBuilder",
      "src/prompting": "prompting",
      "src/anatomy": "anatomy",
      "src/scheduling": "scheduling",
      "src/errors": "errors",
      "src/interfaces": "interfaces",
      "src/clothing": "clothing",
      "src/input": "input",
      "src/testing": "testing",
      "src/configuration": "configuration",
      "src/modding": "modding",
      "src/persistence": "persistence",
      "src/data": "data",
      "src/shared": "shared",
      "src/bootstrapper": "bootstrapper",
      "src/commands": "commands",
      "src/thematicDirection": "thematicDirection",
      "src/models": "models",
      "src/llms": "llms",
      "src/validation": "validation",
      "src/pathing": "pathing",
      "src/formatting": "formatting",
      "src/ports": "ports",
      "src/shutdown": "shutdown",
      "src/common": "common",
      "tests": "tests",
      "llm-proxy-server": "llm-proxy"
    },
    "fallbackCategory": "general",
    "levelBasedRouting": {
      "error": "error.jsonl",
      "warn": "warning.jsonl"
    }
  },
  
  // Existing remote configuration remains unchanged
  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log",
    "batchSize": 25,
    "flushInterval": 250,
    // ... rest of remote config
  },
  
  // Existing categories configuration for backward compatibility
  // Can be deprecated once source-based is fully adopted
  "categories": {
    // ... existing category configs
  }
}
```

#### 4.2 Migration Strategy

1. **Backward Compatibility Mode**
   - Add a configuration flag to switch between old and new systems
   - Allow gradual migration with feature flags

2. **Data Migration**
   - Provide utility to re-categorize existing logs
   - Optional: Keep old logs as-is, apply new system going forward

3. **Rollback Plan**
   - Configuration flag to revert to pattern-based system
   - Keep old code paths available during transition period

## Benefits

### 1. Accurate Error Tracking
- **Error logs contain only actual errors** (level="error")
- **Warning logs contain only warnings** (level="warn")
- **No false positives** from keyword matching

### 2. Improved Debugging Experience
- **Module-specific logs** are easy to find (e.g., `actions.jsonl` for action debugging)
- **Predictable log locations** based on source code structure
- **Reduced cognitive load** when troubleshooting specific components

### 3. Performance Improvements
- **Reduced regex operations** (only fallback patterns)
- **Simpler categorization logic** (direct path mapping)
- **Better cache efficiency** with source-based keys

### 4. Scalability
- **Easy to add new categories** as codebase grows
- **Configurable mappings** without code changes
- **Flexible hierarchy** supports nested categorization

## Architectural Considerations

### Duplicate Category Detection

**Issue**: Category detection logic exists in both client-side (`LogCategoryDetector`) and server-side (`LogStorageService#detectCategory`). This creates:
- Maintenance burden
- Potential inconsistencies
- Redundant processing

**Solution**: 
1. **Primary**: Client-side should be the source of truth for categorization
2. **Server-side**: Should only handle edge cases where client didn't provide category
3. **Migration Path**: 
   - Phase 1: Client sends both `category` (pattern-based) and `sourceCategory` (source-based)
   - Phase 2: Server prefers `sourceCategory` when available
   - Phase 3: Deprecate server-side pattern matching

### Performance Impact with 40+ Categories

**Issue**: The proposed system creates 40+ separate log files per day instead of ~10.

**Considerations**:
- **File System Impact**: More file handles, more inodes
- **Write Performance**: Potential for more frequent file operations
- **Rotation Complexity**: More files to rotate and manage
- **Backup/Archive**: More files to compress and store

**Mitigations**:
1. **Buffering Strategy**: Increase write buffer size to reduce I/O operations
2. **Hierarchical Organization**: Consider grouping related categories:
   ```
   logs/YYYY-MM-DD/
   ├── critical/
   │   ├── error.jsonl
   │   └── warning.jsonl
   ├── core/
   │   ├── engine.jsonl
   │   ├── entities.jsonl
   │   └── events.jsonl
   ├── features/
   │   ├── ai.jsonl
   │   ├── characterBuilder.jsonl
   │   └── anatomy.jsonl
   └── infrastructure/
       ├── logging.jsonl
       ├── config.jsonl
       └── persistence.jsonl
   ```
3. **Dynamic Category Creation**: Only create files for categories that have logs
4. **Category Consolidation**: Option to merge low-volume categories

### Configuration Migration

**Issue**: Existing configuration structure doesn't support source-based categorization.

**Migration Strategy**:
1. **Backward Compatible**: Keep existing `categories` configuration
2. **Feature Flag**: Add `categorization.strategy` field
3. **Gradual Rollout**: 
   - Default to `"hybrid"` mode initially
   - Allow `"pattern-based"` for rollback
   - Move to `"source-based"` when stable

## Implementation Challenges

### 1. Stack Trace Reliability

**Challenge**: Stack traces may be unavailable or corrupted in production builds

**Mitigation**:
- Fallback to message-based categorization when stack unavailable
- Use source maps for production builds
- Cache successful source extractions

### 2. Bundled/Minified Code

**Challenge**: Webpack and other bundlers modify file paths

**Mitigation**:
- Support webpack-specific stack formats
- Use source maps for path resolution
- Provide configuration for custom path transformations

### 3. Performance Impact

**Challenge**: Stack trace extraction adds overhead

**Mitigation**:
- Aggressive caching of source extractions
- Lazy evaluation for non-critical logs
- Configurable extraction depth

### 4. Cross-Browser Compatibility

**Challenge**: Different browsers format stack traces differently

**Mitigation**:
- Multiple regex patterns for different browsers
- Comprehensive testing across browsers
- Graceful degradation to fallback categorization

## Testing Strategy

### Unit Tests

1. **Source extraction accuracy**
   - Test with various stack trace formats
   - Verify path mapping logic for all 40+ categories
   - Test cache behavior with increased category count
   - Validate category detection for each source directory

2. **Level-based routing**
   - Ensure errors go to error.jsonl
   - Ensure warnings go to warning.jsonl
   - Verify other levels use source categorization
   - Test that pattern-based error detection is removed

3. **Fallback behavior**
   - Test when stack traces unavailable
   - Verify pattern-based fallback works without error pattern
   - Test configuration switching between strategies
   - Validate behavior for unknown source directories

### Integration Tests

1. **End-to-end flow**
   - Generate logs from all 40+ source locations
   - Verify correct file placement for each category
   - Test with real browser environments
   - Validate hierarchical directory structure if implemented

2. **Performance testing**
   - Measure categorization overhead with 40+ categories
   - Test cache effectiveness with expanded mappings
   - Benchmark against current system
   - Monitor file system impact with increased file count
   - Test write buffer performance with more destinations

3. **Migration testing**
   - Test configuration switching between strategies
   - Verify backward compatibility with pattern-based mode
   - Test data migration utilities for existing logs
   - Validate hybrid mode operation
   - Ensure smooth rollback capability

## Implementation Timeline

### Week 1: Foundation
- [ ] Implement enhanced source extraction with full path support
- [ ] Update LogMetadataEnricher to detect all 40+ categories
- [ ] Create comprehensive path-to-category mapping
- [ ] Handle existing `detectSource()` method integration

### Week 2: Core Changes
- [ ] Refactor LogCategoryDetector to remove error pattern
- [ ] Implement source-based detection with fallback
- [ ] Update server-side LogStorageService
- [ ] Address client/server duplication issue

### Week 3: Configuration & Testing
- [ ] Add configuration management with backward compatibility
- [ ] Implement feature flags for strategy selection
- [ ] Write comprehensive tests for 40+ categories
- [ ] Performance benchmarking with increased file count

### Week 4: Migration & Documentation
- [ ] Create migration utilities for existing logs
- [ ] Update documentation with all categories
- [ ] Performance optimization for 40+ files
- [ ] Gradual rollout plan with monitoring

### Week 5: Optimization & Polish
- [ ] Implement hierarchical directory structure if needed
- [ ] Optimize buffer strategies for multiple files
- [ ] Add monitoring and metrics
- [ ] Final performance tuning

## Alternative Approaches Considered

### 1. Decorator-Based Logging
- Use decorators to annotate log sources
- **Pros**: Explicit, no stack trace needed
- **Cons**: Requires code changes throughout codebase

### 2. Module-Level Logger Instances
- Create separate logger instances per module
- **Pros**: Clear ownership, no detection needed
- **Cons**: Major refactoring required

### 3. Build-Time Transformation
- Use babel plugin to inject source information
- **Pros**: Zero runtime overhead
- **Cons**: Complex build configuration

### 4. Hybrid Approach (Selected)
- Combine level-based and source-based categorization
- **Pros**: Solves immediate problem, maintainable
- **Cons**: Still requires stack trace extraction

## Risk Assessment

### High Priority Risks
1. **Stack trace unavailability** - Mitigation: Robust fallback system
2. **Performance regression** - Mitigation: Comprehensive benchmarking
3. **Browser incompatibility** - Mitigation: Multi-browser testing

### Medium Priority Risks
1. **Configuration complexity** - Mitigation: Good defaults, clear docs
2. **Migration errors** - Mitigation: Gradual rollout, monitoring
3. **Cache invalidation** - Mitigation: TTL-based cache, size limits

### Low Priority Risks
1. **Edge case failures** - Mitigation: Comprehensive error handling
2. **Documentation gaps** - Mitigation: Inline comments, examples
3. **Future extensibility** - Mitigation: Modular design

## Success Metrics

1. **Accuracy**: 100% of error.jsonl entries have level="error"
2. **Performance**: <5ms categorization overhead per log
3. **Cache Hit Rate**: >80% for source extraction cache
4. **Developer Satisfaction**: Reduced debugging time by 50%
5. **System Reliability**: Zero false positive errors

## Conclusion

The proposed source-based logging categorization system addresses the fundamental flaws in the current pattern-matching approach. By using log levels for critical categorization and source location for organizational categorization, we achieve both accuracy and developer convenience.

The implementation is technically feasible with manageable risks and clear benefits. The phased approach allows for gradual migration with minimal disruption to existing systems.

## Next Steps

1. **Review and approve** this proposal with the team
2. **Create proof of concept** for source extraction
3. **Benchmark performance** impact
4. **Plan migration strategy** based on findings
5. **Begin implementation** following the timeline

## Appendix: Code Examples

### Example Log Entry (New Format)

```json
{
  "level": "debug",
  "message": "Action resolution failed for player movement",
  "category": "actions",
  "sourceLocation": "actionResolver.js:145",
  "sourcePath": "src/actions/actionResolver.js",
  "timestamp": "2025-08-31T10:30:45.123Z",
  "sessionId": "abc-123",
  "metadata": {
    "browser": { "userAgent": "..." },
    "performance": { "timing": 1234.56 }
  }
}
```

### Example Configuration

```javascript
// config/debug-logging-config.json
{
  "debugLogging": {
    "enabled": true,
    "strategy": "source-based",
    "routing": {
      "byLevel": {
        "error": "error.jsonl",
        "warn": "warning.jsonl"
      },
      "bySource": {
        "enabled": true,
        "mappings": {
          "src/actions": "actions",
          "src/logic": "logic",
          // ... other mappings
        },
        "fallback": "general"
      }
    },
    "extraction": {
      "stackTrace": {
        "enabled": true,
        "skipFrames": 4,
        "cache": {
          "enabled": true,
          "maxSize": 200,
          "ttl": 300000
        }
      }
    },
    "compatibility": {
      "supportLegacyPatterns": false,
      "migrationMode": false
    }
  }
}
```

### Example Test Case

```javascript
describe('Source-based categorization', () => {
  it('should categorize logs from actions directory correctly', () => {
    const enricher = new LogMetadataEnricher();
    const log = {
      level: 'debug',
      message: 'Action failed', // Contains "failed" but not categorized as error
      timestamp: new Date().toISOString(),
    };
    
    // Mock stack trace
    const mockStack = `
      Error
        at ActionResolver.resolve (src/actions/actionResolver.js:145:10)
        at GameEngine.tick (src/engine/gameEngine.js:234:15)
    `;
    
    jest.spyOn(Error, 'stack', 'get').mockReturnValue(mockStack);
    
    const metadata = enricher.enrich(log);
    
    expect(metadata.sourceCategory).toBe('actions');
    expect(metadata.level).toBe('debug');
    // Should NOT be categorized as error despite "failed" in message
  });
});
```

---

*End of Brainstorming Document*