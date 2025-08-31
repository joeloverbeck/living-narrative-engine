# SRCBASLOG-010: Update Documentation

## Overview

Create comprehensive documentation for the source-based logging categorization system, including architecture overview, migration guide, configuration reference, and operational procedures.

## Objectives

- Document the new logging architecture and design decisions
- Create migration guide for transitioning from pattern-based to source-based
- Provide configuration reference with examples
- Write operational runbooks for monitoring and troubleshooting
- Update existing documentation to reflect changes

## Dependencies

- SRCBASLOG-001 through SRCBASLOG-009: All implementation and testing complete

## Documentation Structure

```
docs/
├── logging/
│   ├── README.md                      # Overview and quick start
│   ├── architecture.md                # System architecture and design
│   ├── migration-guide.md             # Step-by-step migration instructions
│   ├── configuration-reference.md     # Complete configuration options
│   ├── api-reference.md              # API documentation
│   ├── troubleshooting.md            # Common issues and solutions
│   └── monitoring.md                  # Monitoring and alerting guide
├── examples/
│   ├── configuration/
│   │   ├── basic-config.json         # Basic configuration example
│   │   ├── advanced-config.json      # Advanced configuration with tuning
│   │   └── migration-config.json     # Migration-specific configuration
│   └── code/
│       ├── custom-categorization.js  # Custom category mapping example
│       └── monitoring-integration.js # Monitoring integration example
└── runbooks/
    ├── rollback-procedure.md         # Emergency rollback steps
    ├── performance-tuning.md         # Performance optimization guide
    └── incident-response.md          # Incident response procedures
```

## Documentation Content

### 1. README.md - Overview and Quick Start

```markdown
# Source-Based Logging Categorization System

## Overview

The Source-Based Logging Categorization System revolutionizes how logs are organized by categorizing them based on their source location in the codebase rather than pattern matching on message content. This approach eliminates false positives and provides more accurate, predictable log organization.

## Key Features

- **50+ Source Categories**: Comprehensive categorization covering all major code directories
- **Level-Based Routing**: True error/warning separation based on log levels
- **Zero False Positives**: Eliminates keyword-based miscategorization
- **High Performance**: < 5% overhead with intelligent caching
- **Browser Compatibility**: Works across Chrome, Firefox, Safari, and Edge
- **Migration Support**: Gradual transition from pattern-based system

## Quick Start

### Basic Configuration

```json
{
  "categorization": {
    "strategy": "source-based",
    "enableStackTraceExtraction": true,
    "fallbackCategory": "general"
  }
}
```

### Installation

1. Update your `package.json`:
```bash
npm install --save @living-narrative/source-logging
```

2. Configure the logging system:
```javascript
import { LoggingSystem } from '@living-narrative/source-logging';

const logger = new LoggingSystem({
  categorization: {
    strategy: 'source-based'
  }
});
```

3. Start logging:
```javascript
logger.debug('Application started'); // Automatically categorized by source
```

## Architecture

The system consists of three main components:

1. **Client-Side Extraction**: Extracts source location from stack traces
2. **Categorization Engine**: Maps source paths to logical categories
3. **Storage Service**: Routes logs to appropriate files

## Migration from Pattern-Based System

See [Migration Guide](./migration-guide.md) for detailed instructions.

## Categories

The system supports 50 predefined categories:

| Category | Source Directory | Purpose |
|----------|-----------------|---------|
| actions | src/actions/* | Action system logs |
| logic | src/logic/* | Game logic and rules |
| entities | src/entities/* | Entity Component System |
| ai | src/ai/* | AI and LLM integration |
| domUI | src/domUI/* | UI components and rendering |
| ... | ... | ... |

[View all 50 categories](./architecture.md#categories)

## Performance

- **Extraction Time**: < 2ms per log
- **Cache Hit Rate**: > 80%
- **Throughput**: > 10,000 logs/second
- **Memory Usage**: < 100MB

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Node.js 14+

## License

MIT
```

### 2. Architecture Documentation

```markdown
# System Architecture

## Design Principles

### Why Source-Based Categorization?

The previous pattern-based system had a fundamental flaw: it matched keywords in log messages rather than using actual log levels. This led to:

- **100% false positive rate** for error categorization
- **Unpredictable log placement** based on message content
- **Performance overhead** from regex pattern matching

Source-based categorization solves these issues by:

1. Using **log levels** for critical categorization (error/warning)
2. Using **source location** for organizational categorization
3. Eliminating pattern matching except as fallback

## System Components

### 1. LogMetadataEnricher

Enhanced to extract full source paths from stack traces:

```javascript
class LogMetadataEnricher {
  detectSourceCategory(skipFrames = 4) {
    const fullPath = this.#extractFullPathFromStack(skipFrames);
    return this.#mapPathToCategory(fullPath);
  }
}
```

**Key Features:**
- Browser-agnostic stack trace parsing
- Support for webpack and bundled code
- Efficient path-to-category mapping
- Backward compatibility with existing `detectSource()`

### 2. LogCategoryDetector

Refactored for priority-based detection:

```javascript
detectCategory(message, metadata = {}) {
  // Priority 1: Log level
  if (metadata.level === 'error') return 'error';
  if (metadata.level === 'warn') return 'warning';
  
  // Priority 2: Source category
  if (metadata.sourceCategory) return metadata.sourceCategory;
  
  // Priority 3: Pattern fallback
  return this.#detectFromMessage(message);
}
```

### 3. LogStorageService

Simplified server-side routing:

```javascript
#getFilePath(log, date) {
  if (log.level === 'error') return 'error.jsonl';
  if (log.level === 'warn') return 'warning.jsonl';
  return `${log.category || 'general'}.jsonl`;
}
```

## Data Flow

```
1. Log Event Generated
      ↓
2. Stack Trace Extraction (LogMetadataEnricher)
      ↓
3. Path-to-Category Mapping
      ↓
4. Priority-Based Categorization (LogCategoryDetector)
      ↓
5. Server-Side Routing (LogStorageService)
      ↓
6. File System Write (50+ files)
```

## Categories Reference

### Complete Category Listing

| # | Category | Source Path | Description |
|---|----------|-------------|-------------|
| 1 | actions | src/actions/* | Action resolution and execution |
| 2 | logic | src/logic/* | JSON Logic evaluation |
| 3 | entities | src/entities/* | Entity Component System |
| 4 | ai | src/ai/* | AI memory and notes system |
| 5 | domUI | src/domUI/* | DOM-based UI components |
| 6 | engine | src/engine/* | Core game engine |
| 7 | events | src/events/* | Event bus and dispatching |
| 8 | loaders | src/loaders/* | Content loaders |
| 9 | scopeDsl | src/scopeDsl/* | Scope DSL query language |
| 10 | initializers | src/initializers/* | System initialization |
| 11 | dependencyInjection | src/dependencyInjection/* | IoC container |
| 12 | logging | src/logging/* | Logging infrastructure |
| 13 | config | src/config/* | Configuration management |
| 14 | utils | src/utils/* | Utility functions |
| 15 | services | src/services/* | Service layer |
| 16 | constants | src/constants/* | Application constants |
| 17 | storage | src/storage/* | Persistence layer |
| 18 | types | src/types/* | Type definitions |
| 19 | alerting | src/alerting/* | Alert system |
| 20 | context | src/context/* | Context management |
| 21 | turns | src/turns/* | Turn management |
| 22 | adapters | src/adapters/* | External adapters |
| 23 | query | src/query/* | Query processing |
| 24 | characterBuilder | src/characterBuilder/* | Character creation |
| 25 | prompting | src/prompting/* | AI prompting |
| 26 | anatomy | src/anatomy/* | Anatomy system |
| 27 | scheduling | src/scheduling/* | Task scheduling |
| 28 | errors | src/errors/* | Error handling |
| 29 | interfaces | src/interfaces/* | Interface definitions |
| 30 | clothing | src/clothing/* | Clothing system |
| 31 | input | src/input/* | Input handling |
| 32 | testing | src/testing/* | Test utilities |
| 33 | configuration | src/configuration/* | Advanced config |
| 34 | modding | src/modding/* | Mod system |
| 35 | persistence | src/persistence/* | Data persistence |
| 36 | data | src/data/* | Data management |
| 37 | shared | src/shared/* | Shared resources |
| 38 | bootstrapper | src/bootstrapper/* | App bootstrap |
| 39 | commands | src/commands/* | Command system |
| 40 | thematicDirection | src/thematicDirection/* | Theme management |
| 41 | models | src/models/* | Data models |
| 42 | llms | src/llms/* | LLM integration |
| 43 | validation | src/validation/* | Validation logic |
| 44 | pathing | src/pathing/* | Path finding |
| 45 | formatting | src/formatting/* | Text formatting |
| 46 | ports | src/ports/* | Port adapters |
| 47 | shutdown | src/shutdown/* | Graceful shutdown |
| 48 | common | src/common/* | Common utilities |
| 49 | clichesGenerator | src/clichesGenerator/* | Cliché generation |
| 50 | coreMotivationsGenerator | src/coreMotivationsGenerator/* | Motivation generation |
| 51 | thematicDirectionsManager | src/thematicDirectionsManager/* | Theme direction management |
| 52 | tests | tests/* | Test files |
| 53 | llm-proxy | llm-proxy-server/* | Proxy server logs |
| 54 | general | * | Fallback category |

## Performance Characteristics

### Caching Strategy

- **Source Extraction Cache**: LRU with 500 entries
- **Category Mapping Cache**: In-memory with TTL
- **File Handle Pool**: Max 50 handles with auto-eviction

### Optimization Techniques

1. **Hierarchical Write Buffer**: Groups logs by priority
2. **Batch Processing**: Writes multiple logs simultaneously
3. **Parallel I/O**: Concurrent writes to different files
4. **Smart Eviction**: LFU algorithm with aging
```

### 3. Migration Guide

```markdown
# Migration Guide: Pattern-Based to Source-Based Logging

## Overview

This guide walks you through migrating from the pattern-based logging system to the new source-based categorization system.

## Migration Phases

### Phase 1: Preparation (Week 1)

1. **Install Migration Tools**
```bash
npm install @living-narrative/logging-migration
```

2. **Create Baseline**
```bash
npm run migrate-logs analyze --directory logs/
```

3. **Configure Shadow Mode**
```json
{
  "categorization": {
    "strategy": "pattern-based"
  },
  "migration": {
    "mode": "shadow",
    "collectMetrics": true
  }
}
```

### Phase 2: Shadow Testing (Week 2)

1. **Enable Shadow Logging**
```javascript
const controller = new MigrationController({
  migration: { mode: 'shadow' }
});
```

2. **Monitor Accuracy**
```bash
npm run migration monitor
```

3. **Review Metrics**
- Categorization accuracy should be > 95%
- Performance impact should be < 5%
- No increase in error rate

### Phase 3: Dual Logging (Week 3)

1. **Transition to Dual Mode**
```bash
npm run migration transition --to dual
```

2. **Verify Both Systems**
- Check old log files still being written
- Verify new categorization working
- Monitor system resources

### Phase 4: Primary Transition (Week 4)

1. **Switch to New System as Primary**
```bash
npm run migration transition --to primary
```

2. **Keep Old System as Backup**
- Old system remains available for rollback
- Monitor for any issues

### Phase 5: Completion (Week 5)

1. **Complete Migration**
```bash
npm run migration transition --to complete
```

2. **Archive Old Configuration**
```bash
npm run migration archive
```

## Rollback Procedure

If issues arise at any phase:

1. **Create Checkpoint**
```bash
npm run migration checkpoint --name "pre-rollback"
```

2. **Execute Rollback**
```bash
npm run migration rollback
```

3. **Verify System**
```bash
npm run migration verify
```

## Configuration Examples

### Hybrid Mode (Migration Period)
```json
{
  "categorization": {
    "strategy": "hybrid",
    "sourceMappings": { /* ... */ },
    "preserveOldPatterns": true
  }
}
```

### Source-Based Mode (Final)
```json
{
  "categorization": {
    "strategy": "source-based",
    "enableStackTraceExtraction": true,
    "sourceMappings": { /* ... */ }
  }
}
```

## Common Issues

### Issue: Low Categorization Accuracy

**Solution**: Verify stack trace extraction is working:
```javascript
const enricher = new LogMetadataEnricher();
console.log(enricher.detectSourceCategory());
```

### Issue: Performance Degradation

**Solution**: Tune buffer and cache settings:
```json
{
  "performance": {
    "buffer": {
      "maxBufferSize": 200,
      "flushInterval": 2000
    }
  }
}
```

### Issue: Missing Categories

**Solution**: Check source mappings configuration includes all directories.

## Validation Checklist

- [ ] All 50+ categories being created
- [ ] Error logs only in error.jsonl
- [ ] Warning logs only in warning.jsonl
- [ ] Performance metrics within targets
- [ ] Monitoring dashboard showing correct data
- [ ] Rollback procedure tested
```

### 4. Operational Runbook

```markdown
# Operational Runbook: Source-Based Logging

## Daily Operations

### Health Check

1. **Check Dashboard**
   - Navigate to http://localhost:3002
   - Verify health score > 80%
   - Check categorization accuracy > 95%

2. **Review Alerts**
```bash
curl http://localhost:3002/api/alerts
```

3. **Monitor File System**
```bash
# Check file handle usage
lsof | grep -c jsonl

# Check disk usage
du -sh logs/$(date +%Y-%m-%d)/
```

## Troubleshooting

### High Memory Usage

1. **Check Buffer Status**
```javascript
const stats = writeBuffer.getStats();
console.log(stats.memoryUsage);
```

2. **Force Flush**
```javascript
await writeBuffer.emergencyFlush();
```

3. **Adjust Configuration**
```json
{
  "performance": {
    "buffer": {
      "maxMemoryUsage": 26214400
    }
  }
}
```

### File Handle Exhaustion

1. **Check Open Handles**
```bash
lsof -p $(pgrep node) | wc -l
```

2. **Force Eviction**
```javascript
await fileHandlePool.forceEviction();
```

3. **Reduce Pool Size**
```json
{
  "performance": {
    "fileHandles": {
      "maxHandles": 30
    }
  }
}
```

### Categorization Errors

1. **Verify Stack Traces**
```javascript
// Test in browser console
try {
  throw new Error('Test');
} catch (e) {
  console.log(e.stack);
}
```

2. **Check Source Mappings**
```javascript
const mappings = config.categorization.sourceMappings;
console.log(Object.keys(mappings).length); // Should be 50+
```

3. **Enable Debug Mode**
```json
{
  "debug": {
    "logStackTraces": true,
    "logCategorization": true
  }
}
```

## Performance Tuning

### Optimize for High Volume

```json
{
  "performance": {
    "buffer": {
      "maxBufferSize": 500,
      "flushInterval": 5000
    },
    "cache": {
      "maxSize": 1000,
      "ttl": 600000
    },
    "writes": {
      "maxConcurrentWrites": 10
    }
  }
}
```

### Optimize for Low Latency

```json
{
  "performance": {
    "buffer": {
      "maxBufferSize": 10,
      "flushInterval": 100
    },
    "cache": {
      "maxSize": 200
    },
    "writes": {
      "maxConcurrentWrites": 20
    }
  }
}
```

## Incident Response

### Severity Levels

- **P1 (Critical)**: Complete logging failure
- **P2 (High)**: > 10% logs miscategorized
- **P3 (Medium)**: Performance degradation > 20%
- **P4 (Low)**: Minor issues, cosmetic problems

### Response Procedures

#### P1: Complete Failure

1. **Immediate Actions**
   - Execute rollback procedure
   - Enable fallback to console logging
   - Page on-call engineer

2. **Diagnosis**
   - Check server health
   - Review error logs
   - Verify configuration

3. **Recovery**
   - Restart logging service
   - Clear corrupted state
   - Verify functionality

#### P2: Categorization Issues

1. **Identify Scope**
   - Which categories affected?
   - What percentage of logs?
   - When did it start?

2. **Mitigation**
   - Switch to hybrid mode
   - Enable pattern fallback
   - Monitor accuracy

3. **Resolution**
   - Fix source mappings
   - Update configuration
   - Test thoroughly

## Monitoring Integration

### Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'logging-system'
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import dashboard from `monitoring/grafana-dashboard.json`

Key panels:
- Categorization accuracy
- Throughput by category
- Error rate
- File handle usage
- Memory consumption

## Maintenance Tasks

### Weekly

- Review categorization accuracy report
- Check disk usage trends
- Analyze error patterns
- Update documentation

### Monthly

- Rotate old logs
- Review and tune thresholds
- Update source mappings for new directories
- Performance baseline review

### Quarterly

- Capacity planning review
- Disaster recovery test
- Configuration audit
- Dependency updates
```

## Success Criteria

- [ ] All documentation files created
- [ ] Architecture clearly explained
- [ ] Migration steps detailed
- [ ] Configuration options documented
- [ ] Troubleshooting guide complete
- [ ] Operational procedures defined
- [ ] Examples provided
- [ ] Runbooks tested

## Risk Assessment

### Risks

1. **Documentation Drift**
   - Mitigation: Version control
   - Regular review cycles
   - Automated validation

2. **Incomplete Coverage**
   - Mitigation: Stakeholder review
   - User feedback incorporation
   - Continuous updates

3. **Complexity**
   - Mitigation: Clear structure
   - Progressive disclosure
   - Visual diagrams

## Estimated Effort

- Documentation writing: 6-8 hours
- Examples creation: 2-3 hours
- Review and editing: 2 hours
- Total: 10-13 hours

## Follow-up Tasks

- Create video tutorials
- Set up documentation site
- Implement automated documentation generation
- Create interactive configuration builder