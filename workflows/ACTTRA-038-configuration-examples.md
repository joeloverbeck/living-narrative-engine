# ACTTRA-038: Create Configuration Examples

## Summary

Create comprehensive configuration examples for the action tracing system, demonstrating common scenarios, best practices, and environment-specific setups to guide users in configuring tracing effectively for their specific use cases.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating a comprehensive collection of configuration examples that demonstrate how to set up action tracing for various scenarios. The examples must cover common debugging situations, environment-specific configurations, performance optimization setups, and best practices. Each example should include detailed explanations of why specific settings are used and what outcomes to expect.

## Acceptance Criteria

- [ ] Configuration examples document created at `docs/action-tracing-examples.md`
- [ ] Basic configuration examples for getting started
- [ ] Advanced configuration examples for complex scenarios
- [ ] Environment-specific configurations (dev, staging, production)
- [ ] Performance-optimized configurations
- [ ] Troubleshooting-focused configurations
- [ ] Security-conscious configurations
- [ ] Multi-mod project configurations
- [ ] Each example includes explanation and expected outcomes
- [ ] Configuration validation examples

## Technical Requirements

### Document Structure

```markdown
# Action Tracing Configuration Examples

## Table of Contents
1. Basic Examples
2. Environment-Specific Configurations
3. Debugging Scenarios
4. Performance Optimization
5. Security Configurations
6. Multi-Mod Projects
7. Troubleshooting Setups
8. Advanced Patterns
9. Validation Examples
10. Migration Examples

## Example Categories
- Quick Start
- Development
- Production
- Performance
- Debugging
- Security
- Multi-Environment
```

### Section 1: Basic Examples

#### Getting Started Configuration

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:go"],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard"
  }
}
```

**Use Case**: First-time setup to trace a single action  
**Expected Outcome**: Traces written to `./traces/actions/` when "go" action is used  
**Files Generated**: `core-go_YYYY-MM-DD_HH-MM-SS.json` and `.txt`

#### Enable All Actions

```json
{
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

**Use Case**: Comprehensive tracing for development  
**Expected Outcome**: All actions traced with full detail  
**Performance Impact**: High - only use during focused debugging sessions

#### Specific Mod Tracing

```json
{
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

**Use Case**: Debug all actions from a specific mod  
**Expected Outcome**: Only actions from `my_mod` are traced  
**Organization**: Traces organized in separate directory

### Section 2: Environment-Specific Configurations

#### Development Environment

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

#### Staging Environment

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "core:combat_*",
      "core:dialogue_*", 
      "core:quest_*"
    ],
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

#### Production Environment

```json
{
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

### Section 3: Debugging Scenarios

#### Action Not Working

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["problematic:action"],
    "outputDirectory": "./traces/debug",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 50
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

#### Performance Investigation

```json
{
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

#### Prerequisites Debugging

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*"],
    "outputDirectory": "./traces/prerequisites",
    "verbosity": "detailed",
    "includeComponentData": false,
    "includePrerequisites": true,
    "includeTargets": false,
    "maxTraceFiles": 100
  }
}
```

**What to Look For**:
- Failed prerequisite evaluations
- JSON Logic evaluation details  
- Condition vs. actual value comparisons
- Complex prerequisite chains

### Section 4: Performance Optimization

#### Minimal Overhead Configuration

```json
{
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

#### Selective High-Detail Tracing

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "core:combat_attack",
      "core:spell_cast"
    ],
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

### Section 5: Security Configurations

#### Security-Conscious Setup

```json
{
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
    "maxFileAge": 1800
  }
}
```

**Security Considerations**:
- Limited data exposure
- Short retention period  
- Restricted to security-related actions
- No component data that might contain sensitive info

#### Audit Trail Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "core:admin_*",
      "core:modify_*",
      "core:delete_*"
    ],
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

### Section 6: Multi-Mod Projects

#### Large Game Project

```json
{
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

#### Mod Development Focus

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "my_new_mod:*",
      "core:combat_*",
      "core:inventory_*"
    ],
    "outputDirectory": "./traces/mod_dev",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 300
  }
}
```

**Strategy**: New mod actions plus related core systems  
**Benefit**: See interactions between custom and core functionality

### Section 7: Troubleshooting Setups

#### Crash Investigation

```json
{
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

#### Memory Leak Investigation

```json
{
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

#### Integration Issues

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "mod_a:*",
      "mod_b:*",
      "core:*"
    ],
    "outputDirectory": "./traces/integration",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 400
  }
}
```

**Scope**: Multiple mods that might interact  
**Goal**: Understand cross-mod interactions and conflicts

### Section 8: Advanced Patterns

#### Conditional Tracing

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": [
      "core:combat_*",
      "core:spell_*"
    ],
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

#### Time-Based Rotation

```json
{
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
    "maxFileAge": 1800
  }
}
```

**Strategy**: Keep traces for 30 minutes only  
**Use Case**: High-frequency debugging sessions  
**Benefit**: Automatic cleanup prevents disk filling

### Section 9: Validation Examples

#### Schema Validation Test

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

#### Invalid Configuration Example

```json
{
  "actionTracing": {
    "enabled": "true",
    "tracedActions": "core:go",
    "outputDirectory": 123,
    "verbosity": "invalid_level",
    "maxTraceFiles": -1
  }
}
```

**Issues**:
- `enabled` should be boolean, not string
- `tracedActions` should be array, not string  
- `outputDirectory` should be string, not number
- `verbosity` has invalid value
- `maxTraceFiles` should be positive

### Section 10: Migration Examples

#### Upgrading from v1.0 to v2.0

```json
// OLD v1.0 format
{
  "actionTracing": {
    "enabled": true,
    "enabledActions": ["core:go", "core:take"],
    "outputDir": "./traces",
    "detail": "high"
  }
}

// NEW v2.0 format
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:go", "core:take"],
    "outputDirectory": "./traces",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true
  }
}
```

**Changes**:
- `enabledActions` → `tracedActions`
- `outputDir` → `outputDirectory`  
- `detail` → `verbosity` with new values
- Added granular include options

#### Environment Variable Integration

```json
{
  "actionTracing": {
    "enabled": "${TRACING_ENABLED:false}",
    "tracedActions": ["${TRACED_ACTIONS:core:*}"],
    "outputDirectory": "${TRACE_OUTPUT_DIR:./traces/actions}",
    "verbosity": "${TRACE_VERBOSITY:standard}",
    "maxTraceFiles": "${MAX_TRACE_FILES:100}"
  }
}
```

**Pattern**: Environment variable substitution with defaults  
**Flexibility**: Runtime configuration without file changes

## Implementation Steps

1. **Create Examples Document** (90 minutes)
   - Structure document with clear categories
   - Write basic configuration examples
   - Add environment-specific examples

2. **Add Debugging Scenarios** (45 minutes)
   - Common troubleshooting configurations
   - Performance investigation setups
   - Integration testing examples

3. **Create Advanced Examples** (30 minutes)
   - Multi-mod project configurations
   - Security-conscious setups
   - Migration examples

4. **Add Validation Examples** (15 minutes)
   - Schema validation tests
   - Error examples with explanations
   - Configuration troubleshooting

## Dependencies

### Depends On

- ACTTRA-001: Create action tracing configuration schema
- ACTTRA-002: Extend existing trace configuration
- ACTTRA-036: Write user documentation

### Blocks

- None (documentation doesn't block implementation)

### Enables

- Better user adoption through clear examples
- Reduced configuration errors
- Faster troubleshooting

## Estimated Effort

- **Estimated Hours**: 2 hours
- **Complexity**: Low
- **Risk**: Low (pure documentation)

## Success Metrics

- [ ] All configuration patterns documented with examples
- [ ] Each example includes use case and expected outcomes
- [ ] Performance implications clearly stated
- [ ] Security considerations addressed where relevant
- [ ] Examples validated against actual schema
- [ ] Migration paths documented for version upgrades
- [ ] Troubleshooting scenarios covered comprehensively

## Notes

- Examples should be tested against the actual configuration schema
- Include both minimal and comprehensive configurations
- Show trade-offs between detail and performance
- Consider security implications in all examples
- Provide migration guidance for configuration upgrades
- Examples should reflect real-world usage patterns
- Include expected file outputs and directory structures

### Configuration File Locations

- Main config: `config/trace-config.json`
- Schema: `data/schemas/trace-config.schema.json`
- Examples doc: `docs/action-tracing-examples.md`
- User guide reference: `docs/action-tracing-guide.md`

### Testing Examples

```bash
# Validate configuration against schema
npm run config:validate config/trace-config.json

# Test specific configuration
cp docs/examples/dev-config.json config/trace-config.json
npm run dev

# Check trace output
ls -la traces/actions/
```

### Related Documentation

- [User Guide](../docs/action-tracing-guide.md) - Basic usage
- [Developer Guide](../docs/action-tracing-development.md) - Implementation details
- [Configuration Schema](../data/schemas/trace-config.schema.json) - Validation rules

---

**Ticket Status**: Ready for Development  
**Priority**: Medium (Phase 5 - Documentation)  
**Labels**: documentation, configuration, examples, phase-5, action-tracing