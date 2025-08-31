# SRCBASLOG-006: Create Migration Utilities

## Overview

Build comprehensive migration utilities to transition from pattern-based to source-based logging categorization. This includes tools for re-categorizing existing logs, rollback mechanisms, and a gradual migration strategy.

## Objectives

- Create utilities to re-categorize historical log files
- Implement rollback mechanisms for safe deployment
- Build migration monitoring and validation tools
- Provide gradual migration path with feature flags
- Ensure zero data loss during transition

## Dependencies

- SRCBASLOG-004: Configuration schema must be defined
- SRCBASLOG-003: Server storage updates completed

## Implementation Details

### Components to Build

1. **Log Re-categorizer** - Process existing logs with new categorization
2. **Migration Controller** - Manage transition between systems
3. **Rollback Manager** - Quick reversion to old system
4. **Migration Monitor** - Track migration progress and issues
5. **Validation Tools** - Ensure data integrity

### Location

- Migration utilities: `tools/logging-migration/` (new directory)
- Scripts: `scripts/migrate-logs.js`
- Configuration: `config/migration-config.json`
- Monitoring: `src/logging/migrationMonitor.js`

### 1. Log Re-categorizer Utility

```javascript
// tools/logging-migration/logRecategorizer.js
class LogRecategorizer {
  constructor(config) {
    this.#sourceParser = new StackTraceParser();
    this.#categoryDetector = new LogCategoryDetector();
    this.#stats = {
      processed: 0,
      recategorized: 0,
      errors: 0,
      byCategory: new Map()
    };
  }
  
  async recategorizeDirectory(inputDir, outputDir, options = {}) {
    const files = await this.#getLogFiles(inputDir);
    
    for (const file of files) {
      try {
        await this.#processFile(file, outputDir, options);
      } catch (error) {
        this.#stats.errors++;
        console.error(`Failed to process ${file}:`, error);
      }
    }
    
    return this.#stats;
  }
  
  async #processFile(inputFile, outputDir, options) {
    const logs = await this.#readJsonLines(inputFile);
    const recategorized = new Map();
    
    for (const log of logs) {
      const newCategory = this.#determineNewCategory(log, options);
      
      if (!recategorized.has(newCategory)) {
        recategorized.set(newCategory, []);
      }
      recategorized.get(newCategory).push(log);
      
      this.#updateStats(log.category, newCategory);
    }
    
    await this.#writeRecategorizedLogs(recategorized, outputDir);
  }
  
  #determineNewCategory(log, options) {
    // Priority 1: Level-based for errors/warnings
    if (log.level === 'error') return 'error';
    if (log.level === 'warn') return 'warning';
    
    // Priority 2: Try to extract source from message/metadata
    if (log.sourceLocation) {
      const sourcePath = this.#extractSourcePath(log.sourceLocation);
      const category = this.#mapPathToCategory(sourcePath);
      if (category !== 'general') return category;
    }
    
    // Priority 3: Fallback to pattern matching (if enabled)
    if (options.usePatternFallback) {
      return this.#categoryDetector.detectCategory(log.message);
    }
    
    return 'general';
  }
}
```

### 2. Migration Controller

```javascript
// src/logging/migrationController.js
class LoggingMigrationController {
  constructor(config) {
    this.#config = config;
    this.#oldSystem = new PatternBasedLogger();
    this.#newSystem = new SourceBasedLogger();
    this.#mode = config.migration.mode; // 'off', 'shadow', 'dual', 'primary', 'complete'
  }
  
  async log(level, message, metadata) {
    switch (this.#mode) {
      case 'off':
        // Use old system only
        return this.#oldSystem.log(level, message, metadata);
        
      case 'shadow':
        // Log to old system, shadow log to new (no user impact)
        await this.#oldSystem.log(level, message, metadata);
        this.#shadowLog(level, message, metadata);
        break;
        
      case 'dual':
        // Log to both systems
        await Promise.all([
          this.#oldSystem.log(level, message, metadata),
          this.#newSystem.log(level, message, metadata)
        ]);
        break;
        
      case 'primary':
        // New system primary, old system backup
        try {
          await this.#newSystem.log(level, message, metadata);
        } catch (error) {
          console.warn('New system failed, falling back:', error);
          await this.#oldSystem.log(level, message, metadata);
        }
        break;
        
      case 'complete':
        // New system only
        return this.#newSystem.log(level, message, metadata);
    }
  }
  
  async #shadowLog(level, message, metadata) {
    // Log asynchronously without affecting performance
    setImmediate(async () => {
      try {
        await this.#newSystem.log(level, message, metadata);
        this.#recordSuccess();
      } catch (error) {
        this.#recordFailure(error);
      }
    });
  }
  
  async transitionToNextPhase() {
    const phases = ['off', 'shadow', 'dual', 'primary', 'complete'];
    const currentIndex = phases.indexOf(this.#mode);
    
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      
      // Validate readiness for next phase
      if (await this.#validatePhaseTransition(nextPhase)) {
        this.#mode = nextPhase;
        await this.#saveConfiguration();
        return { success: true, newPhase: nextPhase };
      }
    }
    
    return { success: false, reason: 'Not ready for transition' };
  }
}
```

### 3. Rollback Manager

```javascript
// tools/logging-migration/rollbackManager.js
class RollbackManager {
  constructor() {
    this.#checkpoints = [];
    this.#maxCheckpoints = 5;
  }
  
  async createCheckpoint(name) {
    const checkpoint = {
      name,
      timestamp: new Date().toISOString(),
      configuration: await this.#saveCurrentConfig(),
      stats: await this.#captureSystemStats()
    };
    
    this.#checkpoints.push(checkpoint);
    
    // Keep only recent checkpoints
    if (this.#checkpoints.length > this.#maxCheckpoints) {
      this.#checkpoints.shift();
    }
    
    await this.#persistCheckpoint(checkpoint);
    return checkpoint;
  }
  
  async rollback(checkpointName = null) {
    const checkpoint = checkpointName 
      ? this.#checkpoints.find(cp => cp.name === checkpointName)
      : this.#checkpoints[this.#checkpoints.length - 1];
    
    if (!checkpoint) {
      throw new Error('No checkpoint found for rollback');
    }
    
    // Stop current logging
    await this.#stopLogging();
    
    // Restore configuration
    await this.#restoreConfiguration(checkpoint.configuration);
    
    // Restart with old configuration
    await this.#restartLogging();
    
    // Verify rollback success
    const verified = await this.#verifyRollback(checkpoint);
    
    return {
      success: verified,
      checkpoint,
      timestamp: new Date().toISOString()
    };
  }
  
  async #verifyRollback(checkpoint) {
    // Test logging with old system
    const testLog = {
      level: 'debug',
      message: 'Rollback verification test',
      timestamp: new Date().toISOString()
    };
    
    try {
      await this.#testOldSystem(testLog);
      return true;
    } catch (error) {
      console.error('Rollback verification failed:', error);
      return false;
    }
  }
}
```

### 4. Migration Monitor

```javascript
// src/logging/migrationMonitor.js
class MigrationMonitor {
  constructor() {
    this.#metrics = {
      oldSystemLogs: 0,
      newSystemLogs: 0,
      categorizationAccuracy: 0,
      performanceImpact: 0,
      errorRate: 0,
      lastUpdated: null
    };
  }
  
  trackLog(system, category, success) {
    if (system === 'old') {
      this.#metrics.oldSystemLogs++;
    } else {
      this.#metrics.newSystemLogs++;
    }
    
    if (!success) {
      this.#metrics.errorRate = this.#calculateErrorRate();
    }
    
    this.#updateAccuracy(category);
    this.#metrics.lastUpdated = new Date().toISOString();
  }
  
  generateReport() {
    return {
      summary: {
        totalLogs: this.#metrics.oldSystemLogs + this.#metrics.newSystemLogs,
        distribution: {
          old: this.#metrics.oldSystemLogs,
          new: this.#metrics.newSystemLogs
        },
        accuracy: this.#metrics.categorizationAccuracy,
        errorRate: this.#metrics.errorRate,
        performanceImpact: this.#metrics.performanceImpact
      },
      recommendations: this.#generateRecommendations(),
      readinessScore: this.#calculateReadinessScore()
    };
  }
  
  #generateRecommendations() {
    const recommendations = [];
    
    if (this.#metrics.errorRate > 0.01) {
      recommendations.push({
        level: 'warning',
        message: 'Error rate exceeds 1%, investigate before proceeding'
      });
    }
    
    if (this.#metrics.categorizationAccuracy < 0.95) {
      recommendations.push({
        level: 'info',
        message: 'Categorization accuracy below 95%, consider tuning'
      });
    }
    
    if (this.#metrics.performanceImpact > 10) {
      recommendations.push({
        level: 'warning',
        message: 'Performance impact >10%, optimize before full migration'
      });
    }
    
    return recommendations;
  }
  
  #calculateReadinessScore() {
    let score = 100;
    
    // Deduct points for issues
    score -= this.#metrics.errorRate * 1000;
    score -= (1 - this.#metrics.categorizationAccuracy) * 50;
    score -= Math.max(0, this.#metrics.performanceImpact - 5);
    
    return Math.max(0, Math.min(100, score));
  }
}
```

### 5. Migration Script

```bash
#!/usr/bin/env node
// scripts/migrate-logs.js

const { program } = require('commander');
const { LogRecategorizer } = require('../tools/logging-migration/logRecategorizer');
const { RollbackManager } = require('../tools/logging-migration/rollbackManager');
const { MigrationMonitor } = require('../src/logging/migrationMonitor');

program
  .name('migrate-logs')
  .description('Migrate logging from pattern-based to source-based categorization')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze existing logs without modification')
  .option('-d, --directory <path>', 'Log directory to analyze')
  .action(async (options) => {
    const analyzer = new LogAnalyzer();
    const report = await analyzer.analyze(options.directory);
    console.log('Analysis Report:', JSON.stringify(report, null, 2));
  });

program
  .command('migrate')
  .description('Migrate logs to new categorization')
  .option('-i, --input <path>', 'Input directory')
  .option('-o, --output <path>', 'Output directory')
  .option('--dry-run', 'Simulate migration without changes')
  .action(async (options) => {
    const recategorizer = new LogRecategorizer();
    const stats = await recategorizer.recategorizeDirectory(
      options.input,
      options.output,
      { dryRun: options.dryRun }
    );
    console.log('Migration Stats:', stats);
  });

program
  .command('rollback')
  .description('Rollback to previous configuration')
  .option('-c, --checkpoint <name>', 'Checkpoint name')
  .action(async (options) => {
    const rollback = new RollbackManager();
    const result = await rollback.rollback(options.checkpoint);
    console.log('Rollback Result:', result);
  });

program
  .command('monitor')
  .description('Monitor migration progress')
  .action(async () => {
    const monitor = new MigrationMonitor();
    const report = monitor.generateReport();
    console.log('Migration Status:', JSON.stringify(report, null, 2));
  });

program.parse();
```

## Testing Requirements

### Unit Tests

1. **Re-categorization Logic**
   - Test level-based routing
   - Test source extraction fallbacks
   - Test pattern matching fallback

2. **Migration Phases**
   - Test each migration mode
   - Test phase transitions
   - Test rollback scenarios

3. **Monitoring Accuracy**
   - Test metric collection
   - Test readiness scoring
   - Test recommendation generation

### Integration Tests

1. **End-to-End Migration**
   - Test full directory migration
   - Verify data integrity
   - Test rollback and recovery

2. **Performance Impact**
   - Measure migration overhead
   - Test shadow logging impact
   - Verify dual logging performance

## Migration Timeline

### Week 1: Preparation
- Deploy migration utilities
- Create checkpoints
- Begin shadow logging

### Week 2: Validation
- Analyze shadow logs
- Compare categorization accuracy
- Tune configuration

### Week 3: Dual Logging
- Enable dual logging for canary users
- Monitor performance impact
- Collect metrics

### Week 4: Primary Transition
- Switch to new system as primary
- Keep old system as backup
- Monitor error rates

### Week 5: Completion
- Full migration to new system
- Disable old system
- Archive old configuration

## Success Criteria

- [ ] Zero data loss during migration
- [ ] Rollback completes in < 1 minute
- [ ] Migration accuracy > 95%
- [ ] Performance impact < 5%
- [ ] All migration phases tested
- [ ] Monitoring dashboard functional
- [ ] Documentation complete

## Risk Assessment

### Risks

1. **Data Loss**
   - Mitigation: Dual logging during transition
   - Backup all logs before migration
   - Checkpoint system for recovery

2. **Performance Degradation**
   - Mitigation: Shadow logging for testing
   - Gradual rollout with monitoring
   - Quick rollback capability

3. **Categorization Errors**
   - Mitigation: Extensive validation phase
   - Manual review of sample logs
   - Fallback patterns available

## Estimated Effort

- Implementation: 8-10 hours
- Testing: 4-5 hours
- Documentation: 2 hours
- Total: 14-17 hours

## Follow-up Tasks

- SRCBASLOG-009: Implement monitoring dashboard
- SRCBASLOG-010: Create migration documentation