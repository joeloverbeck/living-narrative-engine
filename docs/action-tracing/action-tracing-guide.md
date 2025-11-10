# Action Tracing System User Guide

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Configuration Guide](#2-configuration-guide)
3. [Common Use Cases](#3-common-use-cases)
4. [Interpreting Trace Files](#4-interpreting-trace-files)
5. [Performance Tuning](#5-performance-tuning)
6. [Troubleshooting](#6-troubleshooting)
7. [Best Practices](#7-best-practices)
8. [Reference](#8-reference)

## 1. Quick Start

### Enabling Action Tracing

To enable action tracing for your first debugging session:

1. **Open the configuration file**: `config/trace-config.json`

2. **Add the action tracing configuration**:

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard"
  }
}
```

3. **Run your game**: Action traces will be written to `./traces/actions/`

4. **View the traces**: Open the generated JSON or text files

### Your First Trace

Let's trace the "go" action to see how a player moves:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true
  }
}
```

When the player executes "go north", you'll see trace files like:

- `core-go_2024-01-15_10-30-00.json` - Machine-readable format
- `core-go_2024-01-15_10-30-00.txt` - Human-readable format

### Reading the Output

The trace shows the complete journey of an action:

```
ACTION TRACE REPORT
==================
Action: movement:go
Actor: player-1
Total Time: 119.7ms

PIPELINE STAGES:
1. Component Filtering (2.5ms) - ✅ PASSED
2. Prerequisite Evaluation (5.3ms) - ✅ PASSED
3. Target Resolution (8.7ms) - Found 2 targets
4. Action Formatting (1.2ms) - "go north"

EXECUTION:
Duration: 102ms
Status: SUCCESS
```

## 2. Configuration Guide

### Basic Configuration

The action tracing system is configured in `config/trace-config.json`:

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": false, // Master switch
    "tracedActions": [], // Actions to trace
    "outputDirectory": "./traces/actions", // Where to write traces
    "verbosity": "standard", // Detail level
    "includeComponentData": true, // Include entity component states
    "includePrerequisites": true, // Include prerequisite details
    "includeTargets": true, // Include target resolution
    "maxTraceFiles": 100, // Maximum files to keep
    "rotationPolicy": "age", // "age" or "count"
    "maxFileAge": 86400 // Max age in seconds (24 hours)
  }
}
```

### Traced Actions Patterns

You can specify actions to trace using different patterns:

| Pattern       | Description                  | Example                    |
| ------------- | ---------------------------- | -------------------------- |
| `"action:id"` | Trace specific action        | `"movement:go"`                |
| `"mod:*"`     | Trace all actions from a mod | `"core:*"`                 |
| `"*"`         | Trace all actions            | `"*"`                      |
| Array         | Trace multiple actions       | `["movement:go", "core:take"]` |

### Verbosity Levels

Control the amount of detail captured:

| Level      | Description     | Use Case                    | Performance Impact |
| ---------- | --------------- | --------------------------- | ------------------ |
| `minimal`  | Basic info only | Production monitoring       | <2ms               |
| `standard` | Balanced detail | General debugging           | <5ms               |
| `detailed` | Full context    | Complex issue investigation | <10ms              |
| `verbose`  | Everything      | Deep debugging              | <15ms              |

### Advanced Options

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*"],
    "outputDirectory": "./traces/actions",
    "verbosity": "detailed",

    // Control what data to include
    "includeComponentData": true, // Entity component states
    "includePrerequisites": true, // Prerequisite evaluation details
    "includeTargets": true, // Target resolution data

    // File management
    "maxTraceFiles": 100, // Maximum files to keep
    "rotationPolicy": "age", // "age" or "count"
    "maxFileAge": 86400 // Max age in seconds (24 hours)
  }
}
```

### Environment-Specific Settings

#### Development Environment

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"], // Trace everything
    "verbosity": "detailed", // Maximum detail
    "maxTraceFiles": 500, // Keep more history
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true
  }
}
```

#### Production Environment

```json
{
  "actionTracing": {
    "enabled": false, // Disabled by default
    "tracedActions": [], // Enable selectively
    "verbosity": "minimal", // Reduce overhead
    "maxTraceFiles": 10, // Limit storage
    "rotationPolicy": "age",
    "maxFileAge": 3600 // 1 hour retention
  }
}
```

### Integration with Other Trace Features

The action tracing system integrates with other tracing features:

```json
{
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*"]
  },
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 100,
      "criticalOperationMs": 500
    }
  },
  "visualization": {
    "enabled": true,
    "options": {
      "showTimings": true,
      "showErrors": true
    }
  }
}
```

## 3. Common Use Cases

### Debugging a Specific Action

**Problem**: The "take" action isn't working for a specific item.

**Configuration**:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:take"],
    "verbosity": "detailed",
    "includeTargets": true,
    "includePrerequisites": true
  }
}
```

**What to look for in the trace**:

- Component filtering: Does the actor have required components?
- Prerequisites: Are all conditions met?
- Target resolution: Is the item being found?
- Formatting: Is the command being constructed correctly?

### Monitoring Performance

**Problem**: Actions are taking too long to execute.

**Configuration**:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "verbosity": "minimal",
    "outputDirectory": "./traces/performance"
  },
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 100,
      "criticalOperationMs": 500
    }
  }
}
```

**Analysis approach**:

1. Look at the `duration` field in each trace
2. Identify stages with high latency
3. Compare timing across different actions
4. Look for patterns in slow operations

### Tracking Action Flow

**Problem**: Understanding the complete flow from discovery to execution.

**Configuration**:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:combat_*"],
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true
  }
}
```

**Key trace sections**:

- `pipeline.componentFiltering` - Initial discovery
- `pipeline.prerequisiteEvaluation` - Condition checking
- `pipeline.targetResolution` - Finding valid targets
- `pipeline.formatting` - Command generation
- `execution` - Final dispatch and result

### Debugging Prerequisites

**Problem**: Action appears in menu but fails when selected.

**Configuration**:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["problematic:action"],
    "verbosity": "verbose",
    "includePrerequisites": true
  }
}
```

**Trace analysis**:

```json
{
  "pipeline": {
    "prerequisiteEvaluation": {
      "prerequisites": {
        "condition": "energy >= 10",
        "evaluation": {
          "actualValue": 5,
          "required": 10,
          "result": false
        }
      }
    }
  }
}
```

### Analyzing Target Resolution

**Problem**: Multi-target actions not finding all expected targets.

**Configuration**:

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:area_effect"],
    "verbosity": "detailed",
    "includeTargets": true
  }
}
```

**What to check**:

- Scope expression evaluation
- Number of targets found vs expected
- Target filtering criteria
- Entity component requirements

## 4. Interpreting Trace Files

### JSON Format Structure

Each trace file contains a complete record of an action's journey:

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",  // When traced
  "actionId": "movement:go",                    // Action identifier
  "actorId": "player-1",                    // Who performed it

  "pipeline": {                             // Discovery & processing
    "componentFiltering": {
      "startTime": 1234567890123,
      "duration": 2.5,
      "actorComponents": ["core:position"],
      "passed": true
    },
    "prerequisiteEvaluation": {
      "startTime": 1234567890126,
      "duration": 5.3,
      "prerequisites": {...},
      "result": true
    },
    "targetResolution": {
      "startTime": 1234567890132,
      "duration": 8.7,
      "resolvedTargets": [
        {"id": "north", "displayName": "North"},
        {"id": "south", "displayName": "South"}
      ]
    },
    "formatting": {
      "startTime": 1234567890141,
      "duration": 1.2,
      "formattedCommand": "go north"
    }
  },

  "execution": {                            // Actual execution
    "startTime": 1234567890143,
    "endTime": 1234567890245,
    "duration": 102,
    "result": "success"
  }
}
```

### Human-Readable Format

The text format provides an easier-to-read overview:

```
ACTION TRACE REPORT
==================
Timestamp: 2024-01-15 10:30:00.123
Action: movement:go
Actor: player-1

PIPELINE STAGES
===============

1. Component Filtering (2.5ms)
   - Actor Components: core:position
   - Required: core:position
   - Result: PASSED

2. Prerequisite Evaluation (5.3ms)
   - Conditions Evaluated: 1
   - Result: PASSED
   - Details: All prerequisites met

3. Target Resolution (8.7ms)
   - Scope: visible_directions
   - Targets Found: 2
     * north (direction) - "North"
     * south (direction) - "South"

4. Action Formatting (1.2ms)
   - Template: "go {direction}"
   - Formatted: "go north"
   - Display: "Go North"

EXECUTION
=========
Duration: 102ms
Status: SUCCESS
Event Type: ATTEMPT_ACTION

Total Pipeline Time: 17.7ms
Total Execution Time: 119.7ms
```

### Key Fields Explained

| Field       | Description              | What it tells you           |
| ----------- | ------------------------ | --------------------------- |
| `actionId`  | Action being traced      | Which action was attempted  |
| `actorId`   | Entity performing action | Who/what triggered it       |
| `pipeline`  | Processing stages        | How action was validated    |
| `execution` | Runtime behavior         | What happened when executed |
| `duration`  | Time in milliseconds     | Performance metrics         |
| `error`     | Error details if failed  | Why something went wrong    |

### Understanding Pipeline Stages

#### Component Filtering

Shows if the actor has required components:

```json
{
  "componentFiltering": {
    "actorComponents": ["core:position", "core:inventory"],
    "requiredComponents": ["core:position"],
    "passed": true
  }
}
```

#### Prerequisite Evaluation

Details condition checking:

```json
{
  "prerequisiteEvaluation": {
    "prerequisites": {
      "condition": "energy >= 10",
      "actualValue": 15,
      "result": true
    }
  }
}
```

#### Target Resolution

Shows what targets were found:

```json
{
  "targetResolution": {
    "scopeExpression": "visible_enemies",
    "resolvedTargets": [
      { "id": "goblin-1", "displayName": "Goblin Scout" },
      { "id": "goblin-2", "displayName": "Goblin Warrior" }
    ],
    "targetCount": 2
  }
}
```

### Timeline Analysis

Analyze performance by examining timing:

```
Total Pipeline Time: 17.7ms
├── Component Filtering: 2.5ms (14%)
├── Prerequisites: 5.3ms (30%)
├── Target Resolution: 8.7ms (49%)
└── Formatting: 1.2ms (7%)

Execution Time: 102ms
Total Time: 119.7ms
```

**Red flags to watch for**:

- Pipeline time > 50ms
- Execution time > 200ms
- Any single stage > 20ms

## 5. Performance Tuning

### Minimizing Overhead

The tracing system is designed for minimal impact:

| Configuration      | Overhead | Use Case             |
| ------------------ | -------- | -------------------- |
| Disabled           | 0ms      | Production default   |
| Minimal verbosity  | <2ms     | Production debugging |
| Standard verbosity | <5ms     | Development          |
| Detailed verbosity | <10ms    | Deep debugging       |
| Verbose            | <15ms    | Complex issues       |

### Optimization Strategies

#### 1. Selective Tracing

Instead of tracing all actions:

```json
{
  "tracedActions": ["core:problematic_action"] // Just what you need
}
```

#### 2. Reduce Verbosity

Lower detail levels for production:

```json
{
  "verbosity": "minimal",
  "includeComponentData": false,
  "includePrerequisites": false
}
```

#### 3. Limit File Retention

Manage disk usage:

```json
{
  "maxTraceFiles": 50,
  "rotationPolicy": "age",
  "maxFileAge": 3600 // 1 hour
}
```

### Managing File Storage

#### Automatic Rotation

Files are automatically rotated based on your policy:

- **Age-based**: Deletes files older than `maxFileAge` seconds
- **Count-based**: Keeps only the latest `maxTraceFiles` files

#### Storage Estimates

| Verbosity | Avg File Size | Files/Hour | Storage/Day |
| --------- | ------------- | ---------- | ----------- |
| minimal   | ~2KB          | 100        | ~5MB        |
| standard  | ~5KB          | 100        | ~12MB       |
| detailed  | ~15KB         | 100        | ~36MB       |
| verbose   | ~30KB         | 100        | ~72MB       |

#### Cleanup Script

For manual cleanup:

```bash
# Delete traces older than 24 hours
find ./traces/actions -name "*.json" -mtime +1 -delete
find ./traces/actions -name "*.txt" -mtime +1 -delete
```

## 6. Troubleshooting

### Common Issues and Solutions

#### Traces Not Being Generated

**Symptoms**: No files in output directory

**Checklist**:

1. Is `enabled` set to `true`?
2. Are `tracedActions` configured correctly?
3. Does the output directory exist and have write permissions?
4. Is the action actually being executed?
5. Is `traceAnalysisEnabled` set to `true` at the top level?

**Debug configuration**:

```json
{
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"], // Trace everything temporarily
    "verbosity": "verbose"
  }
}
```

#### High Memory Usage

**Symptoms**: Memory consumption increases over time

**Solutions**:

1. Reduce verbosity level
2. Disable component data inclusion
3. Implement more aggressive rotation:

```json
{
  "maxTraceFiles": 20,
  "rotationPolicy": "count"
}
```

#### Performance Degradation

**Symptoms**: Game slows down with tracing enabled

**Solutions**:

1. Trace specific actions only
2. Use minimal verbosity
3. Disable non-essential data:

```json
{
  "verbosity": "minimal",
  "includeComponentData": false,
  "includePrerequisites": false,
  "includeTargets": false
}
```

#### Invalid Configuration

**Symptoms**: Tracing doesn't start or errors in logs

**Check**:

- JSON syntax is valid
- Schema validation passes
- File paths are accessible
- Action ID patterns are correct

### Error Messages

| Error                             | Cause                                     | Solution                                |
| --------------------------------- | ----------------------------------------- | --------------------------------------- |
| "Failed to write trace"           | Directory doesn't exist or no permissions | Create directory, check permissions     |
| "Invalid action pattern"          | Malformed action ID in config             | Check pattern format (mod:action or \*) |
| "Trace queue overflow"            | Too many traces being generated           | Reduce traced actions or verbosity      |
| "Configuration validation failed" | Invalid config structure                  | Validate against schema                 |

### Debugging the Tracer Itself

Enable debug logging for the trace system:

```javascript
// In your initialization code
logger.setLevel('debug');
```

Check the game logs for trace-related messages:

```
[DEBUG] ActionTraceFilter: Initialized with 3 traced actions
[DEBUG] ActionTraceOutputService: Writing trace for movement:go
[ERROR] ActionTraceOutputService: Failed to write trace: ENOENT
```

## 7. Best Practices

### Development vs Production

#### Development Settings

- Enable tracing for all actions during development
- Use detailed verbosity for comprehensive debugging
- Keep more trace files for historical analysis
- Include all optional data fields

#### Production Settings

- Keep tracing disabled by default
- Enable selectively for specific issues
- Use minimal verbosity to reduce overhead
- Implement strict rotation policies
- Monitor disk usage

### Security Considerations

#### Sensitive Data

- Traces may contain player data
- Store traces securely
- Don't expose trace endpoints publicly
- Sanitize traces before sharing

#### Access Control

- Limit trace file access to developers
- Use appropriate file permissions
- Consider encryption for sensitive environments

### Maintenance

#### Regular Cleanup

- Implement automated cleanup scripts
- Monitor disk usage trends
- Archive important traces
- Clear old traces regularly

#### Configuration Management

- Version control your trace configs
- Document configuration changes
- Use environment variables for paths
- Maintain separate configs per environment

### Tips for Effective Debugging

1. **Start Broad, Then Narrow**
   - Begin with `"*"` to see all actions
   - Identify problematic actions
   - Focus tracing on specific issues

2. **Use Appropriate Verbosity**
   - minimal: Quick performance checks
   - standard: General debugging
   - detailed: Complex issues
   - verbose: Last resort for tough problems

3. **Correlate with Game Logs**
   - Match trace timestamps with game events
   - Use actor IDs to track specific entities
   - Cross-reference with error logs

4. **Performance Profiling**
   - Trace during typical gameplay
   - Identify bottleneck patterns
   - Focus optimization on slow stages

5. **Collaborative Debugging**
   - Share trace files with team
   - Use consistent configuration
   - Document findings in traces

## 8. Reference

### Configuration Options Table

| Option                 | Type     | Default            | Description                                        |
| ---------------------- | -------- | ------------------ | -------------------------------------------------- |
| `enabled`              | boolean  | false              | Master switch for tracing                          |
| `tracedActions`        | string[] | []                 | Actions to trace (supports wildcards)              |
| `outputDirectory`      | string   | "./traces/actions" | Where to write trace files                         |
| `verbosity`            | string   | "standard"         | Detail level: minimal, standard, detailed, verbose |
| `includeComponentData` | boolean  | true               | Include entity component states                    |
| `includePrerequisites` | boolean  | true               | Include prerequisite evaluation                    |
| `includeTargets`       | boolean  | true               | Include target resolution data                     |
| `maxTraceFiles`        | number   | 100                | Maximum trace files to keep                        |
| `rotationPolicy`       | string   | "age"              | How to rotate: "age" or "count"                    |
| `maxFileAge`           | number   | 86400              | Max age in seconds (with age policy)               |

### Verbosity Levels Detail

| Level      | Pipeline Data    | Execution Data  | File Output | Performance Impact |
| ---------- | ---------------- | --------------- | ----------- | ------------------ |
| `minimal`  | Basic only       | Success/failure | JSON only   | <2ms               |
| `standard` | Timing & results | Full execution  | JSON + text | <5ms               |
| `detailed` | All context      | Event payloads  | JSON + text | <10ms              |
| `verbose`  | Everything       | Complete state  | JSON + text | <15ms              |

### File Naming Convention

Trace files follow this pattern:

```
{actionId}_{timestamp}.{format}
```

Examples:

- `core-go_2024-01-15_10-30-00.json`
- `core-take_2024-01-15_10-31-45.txt`
- `custom-spell-cast_2024-01-15_10-32-30.json`

### Wildcard Patterns

| Pattern        | Matches              | Example                                |
| -------------- | -------------------- | -------------------------------------- |
| `*`            | All actions          | Traces everything                      |
| `mod:*`        | All actions from mod | `core:*` matches all core actions      |
| `mod:prefix_*` | Actions with prefix  | `core:combat_*` matches combat actions |
| `["a", "b"]`   | Multiple specific    | `["movement:go", "core:take"]`             |

### Output Directory Structure

```
traces/
└── actions/
    ├── core-go_2024-01-15_10-30-00.json
    ├── core-go_2024-01-15_10-30-00.txt
    ├── core-take_2024-01-15_10-31-45.json
    └── core-take_2024-01-15_10-31-45.txt
```

### Trace File Size Estimates

| Content               | Minimal | Standard | Detailed | Verbose |
| --------------------- | ------- | -------- | -------- | ------- |
| Simple action         | 1KB     | 3KB      | 8KB      | 15KB    |
| Multi-target          | 2KB     | 5KB      | 15KB     | 30KB    |
| Complex prerequisites | 2KB     | 6KB      | 20KB     | 40KB    |
| With errors           | 3KB     | 7KB      | 25KB     | 50KB    |

## Appendix A: Sample Configurations

### Debugging Specific Mod

```json
{
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["my_mod:*"],
    "outputDirectory": "./traces/my_mod",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 200
  }
}
```

### Performance Monitoring

```json
{
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/performance",
    "verbosity": "minimal",
    "includeComponentData": false,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 1000,
    "rotationPolicy": "count"
  },
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 50,
      "criticalOperationMs": 200
    }
  }
}
```

### Production Incident Response

```json
{
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:problematic_action"],
    "outputDirectory": "./traces/incident",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 50,
    "rotationPolicy": "age",
    "maxFileAge": 7200
  }
}
```

## Appendix B: Glossary

| Term                  | Definition                                                   |
| --------------------- | ------------------------------------------------------------ |
| **Action**            | A command or operation that can be performed by an entity    |
| **Actor**             | The entity (player, NPC, etc.) performing an action          |
| **Pipeline**          | The series of stages an action goes through before execution |
| **Prerequisites**     | Conditions that must be met for an action to be valid        |
| **Target Resolution** | Finding valid targets for an action                          |
| **Trace**             | A detailed record of an action's processing and execution    |
| **Verbosity**         | The level of detail captured in traces                       |
| **Rotation**          | Automatic deletion of old trace files                        |

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-01-13  
**For System Version**: Current
