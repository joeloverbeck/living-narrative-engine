# DUALFORMACT-008: Documentation Updates

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 4 - Documentation & Migration  
**Component**: Documentation  
**Estimated**: 5 hours

## Description

Update project documentation to reflect the new dual-format action tracing capabilities. This includes README updates, configuration examples, troubleshooting guides, and migration instructions for existing users.

## Technical Requirements

### 1. README.md Updates

Add comprehensive section for dual-format action tracing:

````markdown
## Action Tracing

The Living Narrative Engine provides comprehensive action tracing capabilities to help developers debug gameplay logic, understand entity interactions, and analyze system behavior.

### Configuration

Action tracing is configured via `config/trace-config.json`:

#### Basic Configuration (JSON-only)

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:move", "intimacy:fondle_ass"],
    "outputDirectory": "./traces",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true
  }
}
```
````

#### Dual-Format Configuration (JSON + Human-Readable Text)

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:move", "intimacy:fondle_ass"],
    "outputDirectory": "./traces",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "outputFormats": ["json", "text"],
    "textFormatOptions": {
      "enableColors": false,
      "lineWidth": 120,
      "indentSize": 2,
      "sectionSeparator": "=",
      "includeTimestamps": true,
      "performanceSummary": true
    }
  }
}
```

### Output Formats

#### JSON Format

Perfect for programmatic analysis, tool integration, and detailed debugging:

- Machine-readable structured data
- Complete component state information
- Prerequisite and target analysis
- Performance timing data

#### Text Format (Human-Readable)

Optimized for quick debugging and human review:

- Formatted for readability
- Configurable line width and indentation
- Optional performance summaries
- No ANSI color codes in file output

### File Output

When `outputFormats` includes multiple formats, files are generated with appropriate extensions:

```
traces/
├── trace_move_player_20250822_143022.json
├── trace_move_player_20250822_143022.txt
├── trace_fondle_ass_player_20250822_143045.json
└── trace_fondle_ass_player_20250822_143045.txt
```

### Text Format Options

| Option               | Type    | Default | Description                               |
| -------------------- | ------- | ------- | ----------------------------------------- |
| `enableColors`       | boolean | `false` | ANSI color codes (forced false for files) |
| `lineWidth`          | number  | `120`   | Maximum line width (80-200)               |
| `indentSize`         | number  | `2`     | Indentation spaces (0-8)                  |
| `sectionSeparator`   | string  | `"="`   | Character for section headers             |
| `includeTimestamps`  | boolean | `true`  | Include timing information                |
| `performanceSummary` | boolean | `true`  | Add performance summary                   |

### Performance Impact

Dual-format tracing has minimal performance overhead:

- JSON generation: ~1-2ms per trace
- Text generation: ~2-3ms per trace
- File writing: ~5-10ms per file (network dependent)
- Total overhead: <10ms additional per trace

### Migration from JSON-only

Existing configurations continue to work unchanged. To enable dual-format:

1. **Add output formats**: Include `"outputFormats": ["json", "text"]`
2. **Configure text options**: Add `textFormatOptions` object (optional)
3. **Update tooling**: Modify any scripts that expect only JSON files

### Troubleshooting

#### Common Issues

**Q: Text files contain ANSI color codes**
A: `enableColors` is automatically forced to `false` for file output, regardless of configuration.

**Q: Files not being generated**
A: Check server logs, verify output directory permissions, and ensure LLM proxy server is running.

**Q: Performance degradation**
A: Dual-format adds <10ms per trace. Consider using JSON-only for high-frequency actions if needed.

**Q: Invalid configuration**
A: Run configuration validation: `npm run validate-config config/trace-config.json`

````

### 2. Configuration Schema Documentation

Add detailed schema documentation:

```markdown
## Action Trace Configuration Schema

### Core Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `enabled` | boolean | Yes | `false` | Enable/disable action tracing |
| `tracedActions` | string[] | Yes | `[]` | Actions to trace (e.g., `["core:move"]`) |
| `outputDirectory` | string | Yes | `"./traces"` | Directory for trace files |
| `outputFormats` | string[] | No | `["json"]` | Output formats to generate |
| `textFormatOptions` | object | No | `{}` | Text formatting configuration |

### Output Formats

Supported values for `outputFormats` array:
- `"json"` - Structured JSON format
- `"text"` - Human-readable text format
- `"html"` - HTML format (planned)
- `"markdown"` - Markdown format (planned)

### Text Format Options Schema

| Property | Type | Range | Default | Description |
|----------|------|-------|---------|-------------|
| `enableColors` | boolean | - | `false` | ANSI colors (forced false for files) |
| `lineWidth` | number | 80-200 | `120` | Maximum line width |
| `indentSize` | number | 0-8 | `2` | Indentation spaces |
| `sectionSeparator` | string | 1 char | `"="` | Section header character |
| `includeTimestamps` | boolean | - | `true` | Include timing info |
| `performanceSummary` | boolean | - | `true` | Add performance section |

### Example Configurations

#### Development (Dual-Format with Verbose Text)
```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/dev",
    "outputFormats": ["json", "text"],
    "textFormatOptions": {
      "lineWidth": 100,
      "includeTimestamps": true,
      "performanceSummary": true
    }
  }
}
````

#### Production (JSON-Only, Selective)

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:critical_action"],
    "outputDirectory": "./logs/traces",
    "outputFormats": ["json"],
    "maxTraceFiles": 1000,
    "rotationPolicy": "size"
  }
}
```

#### Testing (Text-Only, Compact)

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["test:*"],
    "outputDirectory": "./test-output",
    "outputFormats": ["text"],
    "textFormatOptions": {
      "lineWidth": 80,
      "indentSize": 1,
      "performanceSummary": false
    }
  }
}
```

````

### 3. Developer Guide Section

Add comprehensive developer guide:

```markdown
## Developer Guide: Action Tracing

### Understanding Trace Output

#### JSON Format Structure
```json
{
  "actionId": "core:move",
  "actorId": "player_character",
  "timestamp": "2025-08-22T14:30:22.123Z",
  "components": {
    "position": { "x": 10, "y": 20, "z": 0 },
    "velocity": { "x": 1.5, "y": 0, "z": 0 }
  },
  "prerequisites": [
    {
      "type": "component",
      "id": "core:position",
      "satisfied": true,
      "evaluation": "Component exists and valid"
    }
  ],
  "targets": [
    {
      "entityId": "target_location",
      "components": ["core:position"],
      "relationship": "spatial_proximity"
    }
  ],
  "performance": {
    "totalTime": 12.5,
    "componentLookup": 2.1,
    "prerequisiteCheck": 3.2,
    "execution": 7.2
  }
}
````

#### Text Format Structure

```
=== Action Trace Report ===
Timestamp: 2025-08-22T14:30:22.123Z
Action: core:move
Actor: player_character

Prerequisites:
  ✓ Component: core:position - Component exists and valid
  ✓ State: movement_allowed - Movement is currently allowed

Components:
  position: { x: 10, y: 20, z: 0 }
  velocity: { x: 1.5, y: 0, z: 0 }

Targets:
  target_location (spatial_proximity)
    - core:position

Performance Summary:
  Total Time: 12.5ms
  Component Lookup: 2.1ms
  Prerequisite Check: 3.2ms
  Execution: 7.2ms

=== End of Trace ===
```

### Best Practices

#### Choosing Output Formats

**Use JSON when:**

- Building automated analysis tools
- Integrating with CI/CD pipelines
- Need complete data structure preservation
- Processing traces programmatically

**Use Text when:**

- Quick debugging sessions
- Manual trace review
- Sharing traces in documentation
- Need human-readable output

**Use Both when:**

- Development environment
- Need flexibility for different use cases
- Want immediate readability + tool integration

#### Performance Optimization

1. **Selective Tracing**: Only trace actions you're actively debugging
2. **Format Selection**: Use JSON-only for high-frequency actions
3. **Directory Management**: Use organized directory structure
4. **File Rotation**: Configure appropriate rotation policies

#### Integration with Development Workflow

```bash
# Quick trace review during development
tail -f traces/trace_move_player_*.txt

# Automated trace analysis
node tools/analyze-traces.js traces/*.json

# Diff traces between versions
diff traces/before/trace_action_*.txt traces/after/trace_action_*.txt
```

````

### 4. Troubleshooting Guide

Create comprehensive troubleshooting documentation:

```markdown
## Troubleshooting Action Tracing

### Common Configuration Issues

#### Issue: "No trace files generated"
**Symptoms**: Actions execute but no files appear in output directory

**Solutions**:
1. Check LLM proxy server is running: `npm run start:proxy`
2. Verify output directory permissions: `ls -la traces/`
3. Check server logs: `tail -f llm-proxy-server/logs/server.log`
4. Validate configuration: `npm run validate-config`

#### Issue: "Text files contain garbled characters"
**Symptoms**: Text files have escape sequences or color codes

**Solutions**:
1. `enableColors` is forced to `false` for files - this shouldn't occur
2. Check file encoding: `file traces/*.txt`
3. Verify text editor supports UTF-8

#### Issue: "Configuration validation errors"
**Symptoms**: Error messages about invalid configuration

**Common Errors**:
````

❌ textFormatOptions.lineWidth must be between 80 and 200, got: 300
✅ Set lineWidth to value between 80-200

❌ Invalid output formats: [html, unsupported]
✅ Use only: json, text (html/markdown planned)

❌ textFormatOptions.sectionSeparator must be a single character
✅ Use single character like "=", "-", or "\*"

````

### Performance Issues

#### Issue: "Tracing slows down game significantly"
**Symptoms**: Noticeable game performance degradation

**Solutions**:
1. Reduce traced actions: `"tracedActions": ["specific:action"]`
2. Use JSON-only format: `"outputFormats": ["json"]`
3. Increase trace rotation: `"maxTraceFiles": 50`
4. Check disk space and I/O

#### Issue: "Large trace files consume too much space"
**Symptoms**: Disk space issues, large trace files

**Solutions**:
1. Configure file rotation: `"rotationPolicy": "size"`
2. Reduce verbosity: `"verbosity": "minimal"`
3. Exclude component data: `"includeComponentData": false`
4. Use compression: Enable gzip in server configuration

### Server Connection Issues

#### Issue: "Connection refused errors in logs"
**Symptoms**: `ECONNREFUSED` errors, traces not written

**Solutions**:
1. Start proxy server: `npm run start:proxy`
2. Check port configuration: Default is `http://localhost:3000`
3. Verify firewall settings
4. Check server health: `curl http://localhost:3000/health`

#### Issue: "Timeout errors during trace writing"
**Symptoms**: `ETIMEDOUT` errors, incomplete traces

**Solutions**:
1. Increase timeout: `"batchTimeout": 120000`
2. Check network connectivity
3. Monitor server resource usage
4. Consider batch endpoint: `"useBatchEndpoint": true`

### File System Issues

#### Issue: "Permission denied errors"
**Symptoms**: Cannot write to trace directory

**Solutions**:
1. Check directory permissions: `ls -la traces/`
2. Create directory: `mkdir -p traces && chmod 755 traces`
3. Check disk space: `df -h`
4. Verify user permissions

#### Issue: "Corrupted or incomplete trace files"
**Symptoms**: Malformed JSON, truncated text files

**Solutions**:
1. Check available disk space
2. Monitor server logs for errors
3. Verify file locking issues
4. Check for concurrent writes

### Debugging Steps

1. **Enable Debug Logging**
   ```json
   {
     "logging": {
       "level": "debug",
       "enableTraceLogging": true
     }
   }
````

2. **Test with Minimal Configuration**

   ```json
   {
     "actionTracing": {
       "enabled": true,
       "tracedActions": ["core:test"],
       "outputDirectory": "./test-traces",
       "outputFormats": ["json"]
     }
   }
   ```

3. **Validate Server Connectivity**

   ```bash
   curl -X POST http://localhost:3000/api/traces/write \
     -H "Content-Type: application/json" \
     -d '{"traceData":"{\"test\":true}","fileName":"test.json","outputDirectory":"./traces"}'
   ```

4. **Check Configuration Schema**
   ```bash
   npm run validate-config config/trace-config.json
   ```

### Getting Help

If issues persist:

1. Check GitHub issues: [project-url]/issues
2. Enable debug logging and collect logs
3. Provide minimal reproduction case
4. Include system information (OS, Node version, disk space)

```

## Implementation Steps

1. **Update README.md**
   - [ ] Add dual-format action tracing section
   - [ ] Include configuration examples
   - [ ] Add output format descriptions
   - [ ] Include performance information
   - [ ] Add migration guidance

2. **Create Configuration Documentation**
   - [ ] Document all new configuration properties
   - [ ] Add schema reference tables
   - [ ] Provide example configurations for different use cases
   - [ ] Document validation rules and constraints

3. **Create Developer Guide**
   - [ ] Add section explaining trace output structure
   - [ ] Include best practices for format selection
   - [ ] Add development workflow integration examples
   - [ ] Document performance optimization strategies

4. **Create Troubleshooting Guide**
   - [ ] Document common configuration issues
   - [ ] Add solutions for performance problems
   - [ ] Include server connectivity troubleshooting
   - [ ] Add file system issue resolution steps

5. **Update API Documentation**
   - [ ] Document new batch endpoint (if implemented)
   - [ ] Update existing endpoint documentation
   - [ ] Add error response examples
   - [ ] Document rate limiting and timeout behavior

6. **Add Migration Examples**
   - [ ] Show before/after configuration examples
   - [ ] Document breaking changes (none expected)
   - [ ] Provide upgrade path guidance
   - [ ] Add rollback instructions

## Acceptance Criteria

- [ ] README.md includes comprehensive dual-format section
- [ ] Configuration options are fully documented with examples
- [ ] Text format structure and options are explained clearly
- [ ] Performance impact is documented with specific metrics
- [ ] Migration path from JSON-only is clearly explained
- [ ] Troubleshooting guide covers common issues and solutions
- [ ] Developer guide includes best practices and integration examples
- [ ] All new configuration properties are documented in schema reference
- [ ] Examples cover different use cases (development, production, testing)
- [ ] Documentation is accessible to both technical and non-technical users

## Dependencies

- **Can Start Early**: Documentation can be written based on specification
- **Updated After**: Implementation tickets may reveal additional details
- **Coordinated With**: All other DUALFORMACT tickets for accuracy

## Testing Requirements

1. **Documentation Validation**
   - [ ] All code examples are syntactically correct
   - [ ] Configuration examples validate against schema
   - [ ] Links to files and sections are accurate
   - [ ] Troubleshooting steps actually resolve issues

2. **User Experience Testing**
   - [ ] New users can follow setup instructions successfully
   - [ ] Migration instructions work for existing users
   - [ ] Troubleshooting guide helps resolve actual problems
   - [ ] Examples are clear and practical

## Files to Create/Modify

- **Modify**: `README.md` (add dual-format section)
- **New**: `docs/action-tracing.md` (detailed guide)
- **New**: `docs/troubleshooting.md` (troubleshooting guide)
- **Modify**: `docs/configuration.md` (schema documentation)
- **New**: `docs/examples/trace-configs/` (example configurations)
- **Modify**: Any existing API documentation

## Documentation Structure

```

docs/
├── action-tracing.md # Comprehensive guide
├── troubleshooting.md # Issue resolution
├── configuration.md # Updated with new schema
├── examples/
│ ├── trace-configs/
│ │ ├── development.json
│ │ ├── production.json
│ │ └── testing.json
│ └── trace-outputs/
│ ├── example.json
│ └── example.txt
└── migration/
└── dual-format-upgrade.md

```

## Content Quality Standards

1. **Clarity**: Use clear, concise language accessible to all skill levels
2. **Completeness**: Cover all features and edge cases thoroughly
3. **Accuracy**: Ensure all examples and instructions are correct
4. **Consistency**: Maintain consistent terminology and formatting
5. **Practicality**: Focus on real-world usage scenarios
6. **Maintainability**: Structure for easy updates as features evolve

## Risk Mitigation

1. **Accuracy Validation**
   - Test all configuration examples
   - Validate troubleshooting steps
   - Review with implementation team

2. **User Experience**
   - Focus on common use cases first
   - Provide clear migration path
   - Include practical examples

3. **Maintenance**
   - Structure documentation for easy updates
   - Use version-controlled examples
   - Plan for feature evolution

## Notes

- Documentation can start early based on specification
- Should be updated throughout implementation process
- Critical for user adoption and support
- Foundation for training and onboarding materials
- Essential for troubleshooting and support

## Related Tickets

- **References**: All DUALFORMACT implementation tickets
- **Updated By**: Implementation discoveries and changes
- **Enables**: User adoption and successful migration
- **Supports**: DUALFORMACT-010 (Migration and Backward Compatibility Validation)
```
