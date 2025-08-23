# Action Tracing Configuration Reference

Complete reference for configuring the dual-format action tracing system in the Living Narrative Engine.

## Overview

Action tracing provides comprehensive debugging and analysis capabilities for understanding gameplay logic, entity interactions, and system behavior. The system supports multiple output formats with configurable options for different use cases.

## Configuration File

Action tracing is configured through the `actionTracing` section of `config/trace-config.json`.

## Core Configuration Properties

### enabled

- **Type**: `boolean`
- **Default**: `false`
- **Required**: Yes
- **Description**: Enable or disable action tracing globally

```json
{
  "actionTracing": {
    "enabled": true
  }
}
```

### tracedActions

- **Type**: `string[]`
- **Default**: `[]`
- **Required**: Yes
- **Description**: Array of action IDs to trace. Supports wildcards.

**Wildcard Patterns**:
- `"*"` - Trace all actions
- `"mod:*"` - Trace all actions from a specific mod
- `"core:move"` - Trace specific action

**Examples**:
```json
{
  "tracedActions": ["core:move", "core:attack"]
}
```

```json
{
  "tracedActions": ["intimacy:*", "combat:*"]
}
```

```json
{
  "tracedActions": ["*"]
}
```

### outputDirectory

- **Type**: `string`
- **Default**: `"./traces/actions"`
- **Required**: Yes
- **Description**: Directory for trace output files (relative to project root)

```json
{
  "outputDirectory": "./traces/combat-actions"
}
```

### outputFormats

- **Type**: `string[]`
- **Default**: `["json"]`
- **Required**: No
- **Description**: Array of output formats to generate
- **Supported Values**: `"json"`, `"text"`, `"html"`, `"markdown"`

**Single Format**:
```json
{
  "outputFormats": ["json"]
}
```

**Dual Format**:
```json
{
  "outputFormats": ["json", "text"]
}
```

**Multiple Formats**:
```json
{
  "outputFormats": ["json", "text", "html", "markdown"]
}
```

### verbosity

- **Type**: `string`
- **Default**: `"standard"`
- **Required**: No
- **Description**: Level of detail included in traces

**Values**:
- `"minimal"` - Basic action information only
- `"standard"` - Standard detail level with key information
- `"detailed"` - Extended information with additional context
- `"verbose"` - Complete information including all available data

```json
{
  "verbosity": "verbose"
}
```

### includeComponentData

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No
- **Description**: Include entity component data in traces

```json
{
  "includeComponentData": true
}
```

### includePrerequisites

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No
- **Description**: Include prerequisite evaluation details in traces

```json
{
  "includePrerequisites": true
}
```

### includeTargets

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No
- **Description**: Include target resolution information in traces

```json
{
  "includeTargets": true
}
```

## File Management Configuration

### maxTraceFiles

- **Type**: `integer`
- **Range**: `1-1000`
- **Default**: `100`
- **Required**: No
- **Description**: Maximum number of trace files to keep

```json
{
  "maxTraceFiles": 500
}
```

### rotationPolicy

- **Type**: `string`
- **Default**: `"age"`
- **Required**: No
- **Description**: How to rotate old trace files

**Values**:
- `"age"` - Remove files older than `maxFileAge`
- `"count"` - Keep only the most recent `maxTraceFiles` files

```json
{
  "rotationPolicy": "count"
}
```

### maxFileAge

- **Type**: `integer`
- **Minimum**: `3600` (1 hour)
- **Default**: `86400` (24 hours)
- **Required**: No (when using `"age"` rotation policy)
- **Description**: Maximum age of trace files in seconds

```json
{
  "maxFileAge": 259200
}
```

## Text Format Configuration

### textFormatOptions

- **Type**: `object`
- **Default**: `{}`
- **Required**: No (when using `"text"` output format)
- **Description**: Configuration options for text format output

#### enableColors

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable ANSI color codes in text output
- **Note**: Automatically forced to `false` for file output

```json
{
  "textFormatOptions": {
    "enableColors": false
  }
}
```

#### lineWidth

- **Type**: `integer`
- **Range**: `80-200`
- **Default**: `120`
- **Description**: Maximum line width for text formatting

```json
{
  "textFormatOptions": {
    "lineWidth": 100
  }
}
```

#### indentSize

- **Type**: `integer`
- **Range**: `0-8`
- **Default**: `2`
- **Description**: Number of spaces for indentation

```json
{
  "textFormatOptions": {
    "indentSize": 4
  }
}
```

#### sectionSeparator

- **Type**: `string`
- **Length**: 1 character
- **Default**: `"="`
- **Description**: Character used for section separators

```json
{
  "textFormatOptions": {
    "sectionSeparator": "-"
  }
}
```

#### includeTimestamps

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include timing information in output

```json
{
  "textFormatOptions": {
    "includeTimestamps": true
  }
}
```

#### performanceSummary

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Add performance summary section at the end

```json
{
  "textFormatOptions": {
    "performanceSummary": true
  }
}
```

## Complete Configuration Examples

### Development Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["*"],
    "outputDirectory": "./traces/dev",
    "verbosity": "verbose",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 50,
    "rotationPolicy": "age",
    "maxFileAge": 3600,
    "outputFormats": ["json", "text"],
    "textFormatOptions": {
      "enableColors": false,
      "lineWidth": 100,
      "indentSize": 2,
      "sectionSeparator": "=",
      "includeTimestamps": true,
      "performanceSummary": true
    }
  }
}
```

### Production Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:critical_action"],
    "outputDirectory": "./logs/traces",
    "verbosity": "standard",
    "includeComponentData": false,
    "includePrerequisites": true,
    "includeTargets": false,
    "maxTraceFiles": 1000,
    "rotationPolicy": "count",
    "maxFileAge": 86400,
    "outputFormats": ["json"],
    "textFormatOptions": {
      "enableColors": false,
      "lineWidth": 120,
      "indentSize": 2,
      "sectionSeparator": "=",
      "includeTimestamps": true,
      "performanceSummary": false
    }
  }
}
```

### Testing Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["test:*"],
    "outputDirectory": "./test-output/traces",
    "verbosity": "minimal",
    "includeComponentData": true,
    "includePrerequisites": false,
    "includeTargets": false,
    "maxTraceFiles": 25,
    "rotationPolicy": "age",
    "maxFileAge": 1800,
    "outputFormats": ["text"],
    "textFormatOptions": {
      "enableColors": false,
      "lineWidth": 80,
      "indentSize": 1,
      "sectionSeparator": "-",
      "includeTimestamps": false,
      "performanceSummary": false
    }
  }
}
```

## Schema Validation

All configuration is validated against the JSON schema defined in:
`data/schemas/actionTraceConfig.schema.json`

### Common Validation Errors

**Invalid line width**:
```
❌ textFormatOptions.lineWidth must be between 80 and 200, got: 300
✅ Set lineWidth to value between 80-200
```

**Invalid output format**:
```
❌ Invalid output formats: [html, unsupported]
✅ Use only: json, text (html/markdown planned)
```

**Invalid section separator**:
```
❌ textFormatOptions.sectionSeparator must be a single character
✅ Use single character like "=", "-", or "*"
```

## Performance Considerations

### Format Performance Impact

| Format | Generation Time | File Size | Use Case |
|--------|----------------|-----------|----------|
| JSON | ~1-2ms | 100% | Programmatic analysis |
| Text | ~2-3ms | 150% | Human review |
| Both | ~3-4ms | 250% | Development |

### Optimization Tips

1. **Selective Tracing**: Only trace actions you're actively debugging
2. **Format Selection**: Use JSON-only for high-frequency actions
3. **Directory Management**: Use organized directory structure
4. **File Rotation**: Configure appropriate rotation policies
5. **Verbosity Control**: Use minimal verbosity for production

## Migration Guide

### From JSON-only to Dual-format

1. **Backup Configuration**: Save current `trace-config.json`
2. **Add Output Formats**:
   ```json
   {
     "outputFormats": ["json", "text"]
   }
   ```
3. **Add Text Options** (optional):
   ```json
   {
     "textFormatOptions": {
       "lineWidth": 120,
       "indentSize": 2
     }
   }
   ```
4. **Update Tooling**: Modify scripts expecting only JSON files
5. **Test Configuration**: Validate against schema

### Backward Compatibility

- Existing JSON-only configurations continue to work unchanged
- `outputFormats` defaults to `["json"]` if not specified  
- Text format options are ignored if text format not enabled
- All existing trace analysis tools remain compatible

## Integration with Development Workflow

### Quick Commands

```bash
# View latest text traces
tail -f traces/trace_*_$(date +%Y%m%d)*.txt

# Analyze JSON traces
node tools/analyze-traces.js traces/*.json

# Compare trace outputs
diff traces/before/trace_action_*.txt traces/after/trace_action_*.txt
```

### CI/CD Integration

```yaml
# Example GitHub Actions step
- name: Analyze Action Traces
  run: |
    npm run traces:analyze
    npm run traces:validate-schema
```

## Troubleshooting

For detailed troubleshooting information, see:
- [Troubleshooting Guide](./troubleshooting.md)
- [API Reference](./api-reference.md)
- [Examples](./examples/)

## Related Documentation

- [Action Tracing API Reference](./api-reference.md)
- [Configuration Examples](./examples/)
- [Troubleshooting Guide](./troubleshooting.md)
- [Main README](../../README.md#action-tracing)