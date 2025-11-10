# Action Tracing Configuration Examples

This document provides comprehensive configuration examples for the Living Narrative Engine action tracing system. Each example includes detailed explanations of use cases, expected outcomes, performance implications, and security considerations.

## Table of Contents

1. [Basic Examples](#1-basic-examples)
2. [Environment-Specific Configurations](#2-environment-specific-configurations)
3. [Debugging Scenarios](#3-debugging-scenarios)
4. [Performance Optimization](#4-performance-optimization)
5. [Security Configurations](#5-security-configurations)
6. [Multi-Mod Projects](#6-multi-mod-projects)
7. [Troubleshooting Setups](#7-troubleshooting-setups)
8. [Advanced Patterns](#8-advanced-patterns)
9. [Validation Examples](#9-validation-examples)
10. [Migration Examples](#10-migration-examples)

## 1. Basic Examples

### Getting Started Configuration

The simplest configuration to trace a single action and get familiar with the system.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard"
  }
}
```

**Use Case**: First-time setup to trace a single action  
**Expected Outcome**: Traces written to `./traces/actions/` when "go" action is used  
**Files Generated**: `core-go_YYYY-MM-DD_HH-MM-SS.json` and `.txt`  
**Performance Impact**: Minimal - only traces one action type  
**Security**: Safe - limited data exposure

### Enable All Actions

Comprehensive tracing for development work when you need to see everything happening.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/actions",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "count"
  }
}
```

**Use Case**: Comprehensive tracing for development and debugging  
**Expected Outcome**: All actions traced with full detail  
**Performance Impact**: High - only use during focused debugging sessions  
**Security**: Moderate - exposes all component data  
**Best For**: Local development environment only

### Specific Mod Tracing

Focus tracing on actions from a particular mod you're developing or debugging.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["my_mod:*"],
    "outputDirectory": "./traces/my_mod",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 200,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Use Case**: Debug all actions from a specific mod  
**Expected Outcome**: Only actions from `my_mod` are traced  
**Organization**: Traces organized in separate directory  
**Performance Impact**: Moderate - depends on mod activity  
**Security**: Low-moderate - limited to specific mod actions

## 2. Environment-Specific Configurations

### Development Environment

Maximum visibility configuration for local development work.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 50,
      "criticalOperationMs": 200
    }
  },
  "visualization": {
    "enabled": true,
    "options": {
      "showAttributes": true,
      "showTimings": true,
      "showErrors": true,
      "showCriticalPath": true
    }
  },
  "analysis": {
    "enabled": true,
    "bottleneckThresholdMs": 50
  },
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/dev",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 500,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Purpose**: Maximum visibility during development  
**Trade-offs**: High detail but slower performance  
**Best For**: Local development and debugging  
**Performance Impact**: High - comprehensive monitoring and tracing  
**Security**: Low concern in development environment

### Staging Environment

Balanced configuration for integration testing and system validation.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 100,
      "criticalOperationMs": 500
    }
  },
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:combat_*", "core:dialogue_*", "core:quest_*"],
    "outputDirectory": "./traces/staging",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": false,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 43200
  }
}
```

**Purpose**: Focus on critical game systems  
**Trade-offs**: Balanced detail and performance  
**Best For**: Integration testing and system validation  
**Performance Impact**: Moderate - selective tracing  
**Security**: Moderate - limited to critical systems

### Production Environment

Security-focused configuration with minimal impact, ready for emergency debugging.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "performanceMonitoring": {
    "enabled": false
  },
  "visualization": {
    "enabled": false
  },
  "analysis": {
    "enabled": false
  },
  "actionTracing": {
    "enabled": false,
    "tracedActions": [],
    "outputDirectory": "./traces/production",
    "verbosity": "minimal",
    "includeComponentData": false,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 10,
    "rotationPolicy": "age",
    "maxFileAge": 3600
  }
}
```

**Purpose**: Disabled by default, ready for emergency debugging  
**Security**: Minimal data exposure  
**Best For**: Production deployment with incident response capability  
**Performance Impact**: None when disabled  
**Emergency Use**: Can be quickly enabled for specific actions during incidents

## 3. Debugging Scenarios

### Action Not Working

Configuration for troubleshooting a specific action that's failing or behaving unexpectedly.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["problematic:action"],
    "outputDirectory": "./traces/debug",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 50,
    "rotationPolicy": "count"
  }
}
```

**Debugging Steps**:

1. Enable tracing for the problematic action
2. Attempt the action that's failing
3. Check trace files for:
   - Component requirements not met
   - Prerequisites failing
   - Target resolution issues
   - Execution errors

**What to Look For**:

- Failed prerequisite evaluations in verbose output
- Missing or incorrect component data
- Target resolution failures
- Pipeline stage failures

### Performance Investigation

Minimal overhead configuration to identify performance bottlenecks without impacting timing significantly.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 50,
      "criticalOperationMs": 200
    }
  },
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
  }
}
```

**Analysis Focus**:

- Pipeline stage durations
- Total execution times
- Patterns in slow actions
- Bottleneck identification

**Performance Impact**: Low - minimal data collection  
**Data Captured**: Timing information without detailed component data

### Prerequisites Debugging

Detailed analysis of prerequisite evaluation for actions that aren't triggering when expected.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*"],
    "outputDirectory": "./traces/prerequisites",
    "verbosity": "detailed",
    "includeComponentData": false,
    "includePrerequisites": true,
    "includeTargets": false,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**What to Look For**:

- Failed prerequisite evaluations
- JSON Logic evaluation details
- Condition vs. actual value comparisons
- Complex prerequisite chains
- Boolean logic evaluation results

## 4. Performance Optimization

### Minimal Overhead Configuration

Configuration designed for production-like performance with minimal tracing overhead.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:critical_action"],
    "outputDirectory": "./traces/minimal",
    "verbosity": "minimal",
    "includeComponentData": false,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 20,
    "rotationPolicy": "count"
  }
}
```

**Performance Impact**: <2ms overhead per action  
**Use Case**: Production debugging with minimal impact  
**Data Captured**: Basic execution success/failure and timing  
**Trade-offs**: Minimal debugging information for maximum performance

### Selective High-Detail Tracing

High detail for critical actions only, minimal overhead for others.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:combat_attack", "core:spell_cast"],
    "outputDirectory": "./traces/combat",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 200,
    "rotationPolicy": "age",
    "maxFileAge": 7200
  }
}
```

**Strategy**: High detail for critical actions only  
**Balance**: Comprehensive data where needed, minimal overhead elsewhere  
**Use Case**: Combat system debugging with focused attention  
**Performance**: Good balance between detail and performance

## 5. Security Configurations

### Security-Conscious Setup

Minimal data exposure for security-sensitive environments.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:auth_*"],
    "outputDirectory": "./traces/security",
    "verbosity": "standard",
    "includeComponentData": false,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 50,
    "rotationPolicy": "age",
    "maxFileAge": 3600
  }
}
```

**Security Considerations**:

- Limited data exposure
- Short retention period (1 hour)
- Restricted to security-related actions
- No component data that might contain sensitive info

### Audit Trail Configuration

Long-term audit trail for administrative and system-modifying actions.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:admin_*", "core:modify_*", "core:delete_*"],
    "outputDirectory": "./traces/audit",
    "verbosity": "standard",
    "includeComponentData": false,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 1000,
    "rotationPolicy": "age",
    "maxFileAge": 2592000
  }
}
```

**Purpose**: Long-term audit trail for administrative actions  
**Retention**: 30 days for compliance  
**Data**: Focus on who, what, when, but not sensitive details  
**Compliance**: Suitable for audit requirements

## 6. Multi-Mod Projects

### Large Game Project

Configuration for complex games with multiple interacting mod systems.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "core:*",
      "combat_system:*",
      "quest_system:*",
      "dialogue_system:*"
    ],
    "outputDirectory": "./traces/game_systems",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 500,
    "rotationPolicy": "age",
    "maxFileAge": 43200
  }
}
```

**Organization Strategy**: All major systems tracked  
**Scale Considerations**: Higher file limits for complex projects  
**Use Case**: Large RPG or adventure game development  
**Performance**: Moderate impact due to multiple systems

### Mod Development Focus

Configuration for developing a new mod while monitoring its interactions with core systems.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["my_new_mod:*", "core:combat_*", "core:inventory_*"],
    "outputDirectory": "./traces/mod_dev",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 300,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Strategy**: New mod actions plus related core systems  
**Benefit**: See interactions between custom and core functionality  
**Use Case**: Active mod development with integration testing  
**Analysis**: Comprehensive tracing enabled for pattern analysis

## 7. Troubleshooting Setups

### Crash Investigation

Comprehensive data collection before attempting to reproduce a crash.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/crash_debug",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "count"
  }
}
```

**Temporary Setup**: Enable before attempting to reproduce crash  
**Data Goal**: Maximum information for crash analysis  
**Disable**: Turn off after collecting crash data  
**Performance**: High impact - only use during crash reproduction

### Memory Leak Investigation

High-volume, minimal overhead tracing for memory leak analysis.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/memory",
    "verbosity": "minimal",
    "includeComponentData": false,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 2000,
    "rotationPolicy": "count"
  }
}
```

**Focus**: High-volume, minimal overhead tracing  
**Analysis**: Look for memory usage patterns over time  
**Long-term**: Run over extended periods to identify leaks  
**Data**: Basic execution patterns without detailed component data

### Integration Issues

Multi-mod interaction analysis for identifying conflicts or unexpected behaviors.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": true,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["mod_a:*", "mod_b:*", "core:*"],
    "outputDirectory": "./traces/integration",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 400,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Scope**: Multiple mods that might interact  
**Goal**: Understand cross-mod interactions and conflicts  
**Analysis**: Pattern analysis enabled for relationship detection  
**Use Case**: Debugging mod compatibility issues

## 8. Advanced Patterns

### Conditional Tracing

Flexible configuration that can be easily adjusted for different scenarios.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:combat_*", "core:spell_*"],
    "outputDirectory": "./traces/conditional",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 200,
    "rotationPolicy": "age",
    "maxFileAge": 3600
  }
}
```

**Pattern**: Enable specific categories for targeted analysis  
**Flexibility**: Easy to adjust traced action patterns as needed  
**Use Case**: Iterative debugging of related action groups  
**Rotation**: Short retention for focused debugging sessions

### Time-Based Rotation

Automatic cleanup configuration for high-frequency debugging sessions.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/time_rotated",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 3600
  }
}
```

**Strategy**: Keep traces for 1 hour only  
**Use Case**: High-frequency debugging sessions  
**Benefit**: Automatic cleanup prevents disk filling  
**Balance**: Moderate detail with automatic maintenance

## 9. Validation Examples

### Schema Validation Test

Example configuration that demonstrates proper schema compliance.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:validate"],
    "outputDirectory": "./traces/validation",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 10,
    "rotationPolicy": "count"
  }
}
```

**Purpose**: Verify configuration against schema  
**Validation**: Run through AJV schema validator  
**Expected**: No validation errors  
**Testing**: Use for configuration validation testing

### Invalid Configuration Example

Common mistakes and validation errors to avoid.

```json
{
  "actionTracing": {
    "enabled": "true",
    "tracedActions": "movement:go",
    "outputDirectory": 123,
    "verbosity": "invalid_level",
    "maxTraceFiles": -1,
    "rotationPolicy": "invalid_policy"
  }
}
```

**Issues Demonstrated**:

- `enabled` should be boolean, not string
- `tracedActions` should be array, not string
- `outputDirectory` should be string, not number
- `verbosity` has invalid value (valid: minimal, standard, detailed, verbose)
- `maxTraceFiles` should be positive integer (1-1000)
- `rotationPolicy` has invalid value (valid: age, count)
- Missing required `$schema` reference

## 10. Migration Examples

### Upgrading Configuration Format

Example showing how to migrate from older configuration formats.

```json
// OLD format (if migrating from legacy system)
{
  "actionTracing": {
    "enabled": true,
    "enabledActions": ["movement:go", "core:take"],
    "outputDir": "./traces",
    "detail": "high"
  }
}

// NEW format (current schema)
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go", "core:take"],
    "outputDirectory": "./traces",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Migration Changes**:

- Added `$schema` reference for validation
- `enabledActions` → `tracedActions`
- `outputDir` → `outputDirectory`
- `detail` → `verbosity` with specific enum values
- Added granular include options
- Added file rotation configuration

### Environment Variable Integration

Configuration supporting environment-based customization.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*"],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Environment Variables Usage**:

```bash
# Enable/disable tracing
export TRACING_ENABLED=true

# Set traced actions
export TRACED_ACTIONS="core:*,my_mod:*"

# Set output directory
export TRACE_OUTPUT_DIR="./traces/custom"

# Set verbosity level
export TRACE_VERBOSITY="verbose"
```

**Note**: Environment variable substitution would need to be implemented in the configuration loading system.

## Related Documentation

- [Action Tracing User Guide](./action-tracing-guide.md) - Basic usage and getting started
- [Action Tracing Developer Guide](./action-tracing-developer-guide.md) - Implementation details and architecture
- [Trace Configuration Schema](../data/schemas/trace-config.schema.json) - Complete schema validation rules

## Testing Your Configuration

```bash
# Test your configuration
npm run dev

# Check trace output
ls -la traces/actions/

# Verify configuration structure matches schema
# (Configuration validation happens automatically at startup)

# View trace content
cat traces/actions/core-go_*.txt
```

## Quick Reference

### Verbosity Levels

- **minimal**: Basic success/failure and timing
- **standard**: Includes component states and basic pipeline info
- **detailed**: Adds prerequisite and target resolution details
- **verbose**: Maximum detail including all evaluation steps

### Rotation Policies

- **age**: Remove files older than `maxFileAge` seconds
- **count**: Keep only the most recent `maxTraceFiles` files

### Wildcard Patterns

- `*`: All actions from all mods
- `mod_name:*`: All actions from specific mod
- `core:combat_*`: All combat actions from core mod

### Performance Guidelines

- **Development**: Use `verbose` with full includes
- **Staging**: Use `standard` with selective includes
- **Production**: Use `minimal` with specific actions only
- **Debugging**: Use `detailed` or `verbose` with targeted actions
