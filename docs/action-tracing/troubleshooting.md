# Action Tracing Troubleshooting Guide

Comprehensive troubleshooting guide for resolving common action tracing issues in the Living Narrative Engine.

## Overview

This guide covers common problems with the dual-format action tracing system, including configuration issues, LLM proxy server connectivity problems, file output issues, and performance problems.

## Quick Diagnostics

### Basic System Check

Run these commands to verify your system is properly configured:

```bash
# 1. Check if LLM proxy server is running
curl -s http://localhost:3001/health || echo "LLM Proxy Server not accessible"

# 2. Verify trace configuration file exists
ls -la config/trace-config.json

# 3. Check trace output directory permissions
ls -la traces/ || echo "Traces directory does not exist"

# 4. Test trace endpoint
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{"traceData":"{}","fileName":"test.json"}' || echo "Trace endpoint not working"
```

### Configuration Validation

Validate your configuration against the schema:

```bash
# Using Node.js to validate configuration
node -e "
const Ajv = require('ajv');
const schema = require('./data/schemas/actionTraceConfig.schema.json');
const config = require('./config/trace-config.json');
const ajv = new Ajv();
const valid = ajv.validate(schema.properties.actionTracing, config.actionTracing);
console.log('Valid:', valid);
if (!valid) console.log('Errors:', ajv.errors);
"
```

## Common Configuration Issues

### Issue: "No trace files generated"

**Symptoms**: Actions execute but no trace files appear in output directory

**Possible Causes**:
1. Action tracing disabled
2. Actions not in traced list
3. LLM proxy server not running
4. Permission issues
5. Configuration errors

**Solutions**:

1. **Check configuration**:
   ```json
   {
     "actionTracing": {
       "enabled": true,  // Must be true
       "tracedActions": ["*"]  // Use "*" to trace all actions for testing
     }
   }
   ```

2. **Verify LLM proxy server**:
   ```bash
   # Start proxy server if not running
   cd llm-proxy-server
   npm run dev
   
   # Check server status
   curl http://localhost:3001/health
   ```

3. **Check directory permissions**:
   ```bash
   # Create directory with proper permissions
   mkdir -p traces && chmod 755 traces
   
   # Verify write permissions
   touch traces/test.txt && rm traces/test.txt
   ```

4. **Review server logs**:
   ```bash
   tail -f llm-proxy-server/logs/server.log
   ```

### Issue: "Text files contain garbled characters"

**Symptoms**: Text format files show escape sequences or unreadable characters

**Possible Causes**:
1. Incorrect file encoding
2. Color codes in file output (should be disabled automatically)
3. Terminal encoding issues when viewing

**Solutions**:

1. **Verify text format configuration**:
   ```json
   {
     "textFormatOptions": {
       "enableColors": false  // This should be false for file output
     }
   }
   ```

2. **Check file encoding**:
   ```bash
   # Check file encoding
   file traces/*.txt
   
   # Should show: UTF-8 Unicode text
   ```

3. **View with proper encoding**:
   ```bash
   # Use UTF-8 encoding when viewing
   cat traces/trace_file.txt
   
   # Or specify encoding in your editor
   ```

### Issue: "Configuration validation errors"

**Symptoms**: Error messages about invalid configuration when starting

**Common Errors and Solutions**:

**Invalid line width**:
```
❌ textFormatOptions.lineWidth must be between 80 and 200, got: 300
✅ Solution: Set lineWidth to value between 80-200
```
```json
{
  "textFormatOptions": {
    "lineWidth": 120  // Valid range: 80-200
  }
}
```

**Invalid output formats**:
```
❌ Invalid output formats: [html, unsupported] 
✅ Solution: Use only: json, text (html/markdown planned)
```
```json
{
  "outputFormats": ["json", "text"]  // Only json and text currently supported
}
```

**Invalid section separator**:
```
❌ textFormatOptions.sectionSeparator must be a single character
✅ Solution: Use single character like "=", "-", or "*"
```
```json
{
  "textFormatOptions": {
    "sectionSeparator": "="  // Must be exactly one character
  }
}
```

**Missing required fields**:
```
❌ Missing required property: enabled
✅ Solution: Add enabled property
```
```json
{
  "actionTracing": {
    "enabled": true,  // Required
    "tracedActions": [],  // Required
    "outputDirectory": "./traces"  // Required
  }
}
```

## LLM Proxy Server Issues

### Issue: "Connection refused errors in logs"

**Symptoms**: `ECONNREFUSED` errors, traces not written

**Solutions**:

1. **Start LLM proxy server**:
   ```bash
   # Development mode
   cd llm-proxy-server
   npm run dev
   
   # Production mode
   npm start --prefix llm-proxy-server
   ```

2. **Check port configuration**:
   ```bash
   # Verify server is listening on port 3001
   netstat -tlnp | grep 3001
   
   # Or check with curl
   curl http://localhost:3001/health
   ```

3. **Verify firewall settings**:
   ```bash
   # Check if port 3001 is blocked
   sudo ufw status | grep 3001
   
   # Allow port if needed (be careful with production systems)
   sudo ufw allow 3001
   ```

4. **Check server logs**:
   ```bash
   # View server startup logs
   tail -f llm-proxy-server/logs/server.log
   
   # Check for startup errors
   grep ERROR llm-proxy-server/logs/server.log
   ```

### Issue: "Batch endpoint not working"

**Symptoms**: Batch requests return errors, single writes work fine

**Solutions**:

1. **Verify endpoint availability**:
   ```bash
   # Test batch endpoint
   curl -X POST http://localhost:3001/api/traces/write-batch \
     -H "Content-Type: application/json" \
     -d '{
       "traces": [
         {"traceData": "{}", "fileName": "test1.json"},
         {"traceData": "{}", "fileName": "test2.json"}
       ]
     }'
   ```

2. **Check request format**:
   ```json
   {
     "traces": [  // Must be an array
       {
         "traceData": "...",  // Required
         "fileName": "..."    // Required
       }
     ],
     "outputDirectory": "./traces"  // Optional
   }
   ```

3. **Review server logs for batch processing errors**:
   ```bash
   grep "batch" llm-proxy-server/logs/server.log
   ```

### Issue: "Timeout errors during trace writing"

**Symptoms**: `ETIMEDOUT` errors, incomplete traces

**Solutions**:

1. **Check network connectivity**:
   ```bash
   # Test connection speed
   curl -w "@curl-format.txt" -o /dev/null http://localhost:3001/health
   ```

2. **Monitor server resource usage**:
   ```bash
   # Check CPU and memory usage
   htop
   
   # Check disk I/O
   iotop
   ```

3. **Consider using batch endpoint for better performance**:
   ```json
   {
     "actionTracing": {
       "useBatchEndpoint": true,
       "batchTimeout": 120000  // Increase timeout to 2 minutes
     }
   }
   ```

## File System Issues

### Issue: "Permission denied errors"

**Symptoms**: Cannot write to trace directory

**Solutions**:

1. **Check directory permissions**:
   ```bash
   # Check current permissions
   ls -la traces/
   
   # Set correct permissions
   chmod 755 traces/
   chmod 644 traces/*.json traces/*.txt
   ```

2. **Create directory with proper permissions**:
   ```bash
   # Create directory structure
   mkdir -p traces/dev traces/production traces/test
   chmod -R 755 traces/
   ```

3. **Check disk space**:
   ```bash
   # Check available space
   df -h
   
   # Check inode usage
   df -i
   ```

4. **Verify user permissions**:
   ```bash
   # Check if current user can write to directory
   touch traces/permission-test.tmp && rm traces/permission-test.tmp
   ```

### Issue: "Corrupted or incomplete trace files"

**Symptoms**: Malformed JSON, truncated text files

**Solutions**:

1. **Check available disk space**:
   ```bash
   df -h
   ```

2. **Monitor for concurrent write issues**:
   ```bash
   # Check for file locking issues
   lsof +D traces/
   ```

3. **Verify file integrity**:
   ```bash
   # Check JSON files for validity
   for file in traces/*.json; do
     echo "Checking $file"
     jq empty "$file" 2>/dev/null || echo "❌ Invalid JSON: $file"
   done
   ```

4. **Review server logs for write errors**:
   ```bash
   grep -i "error.*write" llm-proxy-server/logs/server.log
   ```

## Performance Issues

### Issue: "Tracing slows down game significantly"

**Symptoms**: Noticeable game performance degradation with tracing enabled

**Solutions**:

1. **Reduce traced actions**:
   ```json
   {
     "tracedActions": ["specific:action"]  // Instead of ["*"]
   }
   ```

2. **Use JSON-only format**:
   ```json
   {
     "outputFormats": ["json"]  // Remove "text" format
   }
   ```

3. **Decrease verbosity**:
   ```json
   {
     "verbosity": "minimal"  // Instead of "verbose"
   }
   ```

4. **Optimize file rotation**:
   ```json
   {
     "maxTraceFiles": 50,  // Reduce from default 100
     "rotationPolicy": "count"  // More predictable than "age"
   }
   ```

5. **Check system resources**:
   ```bash
   # Monitor during trace generation
   htop
   iotop
   ```

### Issue: "Large trace files consume too much space"

**Symptoms**: Disk space issues, very large trace files

**Solutions**:

1. **Configure aggressive file rotation**:
   ```json
   {
     "maxTraceFiles": 25,
     "rotationPolicy": "count",
     "maxFileAge": 3600  // 1 hour
   }
   ```

2. **Reduce included data**:
   ```json
   {
     "includeComponentData": false,
     "includePrerequisites": false,  
     "includeTargets": false,
     "verbosity": "minimal"
   }
   ```

3. **Use compression** (if implementing):
   ```json
   {
     "compression": {
       "enabled": true,
       "format": "gzip",
       "level": 6
     }
   }
   ```

4. **Implement cleanup automation**:
   ```bash
   # Add to crontab for automatic cleanup
   0 2 * * * find /path/to/traces -name "*.json" -mtime +1 -delete
   ```

## Debugging Steps

### Step 1: Enable Debug Logging

```json
{
  "logging": {
    "level": "debug",
    "enableTraceLogging": true
  }
}
```

### Step 2: Test with Minimal Configuration

Create a minimal test configuration:

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

### Step 3: Validate Server Connectivity

```bash
# Test basic connectivity
curl -v http://localhost:3001/health

# Test trace write endpoint
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{"traceData":"{\"test\":true}","fileName":"test.json","outputDirectory":"./traces"}'
```

### Step 4: Monitor Logs in Real-time

```bash
# Terminal 1: Server logs
tail -f llm-proxy-server/logs/server.log

# Terminal 2: Error logs  
tail -f llm-proxy-server/logs/error.log

# Terminal 3: Execute test actions
```

### Step 5: Incremental Testing

1. Start with JSON-only, single action
2. Add text format
3. Add multiple actions
4. Add batch processing
5. Test with full configuration

## Advanced Troubleshooting

### Custom Debugging Script

Create a debugging script to test your configuration:

```javascript
// debug-tracing.js
const fs = require('fs');
const path = require('path');

async function debugTracing() {
  console.log('🔍 Action Tracing Debug Tool');
  
  // 1. Check configuration file
  try {
    const config = require('./config/trace-config.json');
    console.log('✅ Configuration file loaded');
    console.log('   - Tracing enabled:', config.actionTracing?.enabled);
    console.log('   - Output formats:', config.actionTracing?.outputFormats);
    console.log('   - Output directory:', config.actionTracing?.outputDirectory);
  } catch (error) {
    console.log('❌ Configuration error:', error.message);
    return;
  }
  
  // 2. Test server connectivity
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3001/health');
    console.log('✅ LLM Proxy Server accessible:', response.status);
  } catch (error) {
    console.log('❌ Server connectivity error:', error.message);
    return;
  }
  
  // 3. Test trace writing
  try {
    const fetch = require('node-fetch');
    const testTrace = {
      traceData: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      fileName: 'debug-test.json',
      outputDirectory: './traces'
    };
    
    const response = await fetch('http://localhost:3001/api/traces/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testTrace)
    });
    
    if (response.ok) {
      console.log('✅ Test trace written successfully');
      const result = await response.json();
      console.log('   - File path:', result.path);
      console.log('   - File size:', result.size, 'bytes');
    } else {
      console.log('❌ Trace write failed:', response.status, await response.text());
    }
  } catch (error) {
    console.log('❌ Trace write error:', error.message);
  }
  
  // 4. Check output directory
  const outputDir = './traces';
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    console.log(`✅ Output directory exists with ${files.length} files`);
    if (files.length > 0) {
      console.log('   - Recent files:', files.slice(-3));
    }
  } else {
    console.log('❌ Output directory does not exist');
  }
  
  console.log('🔍 Debug complete');
}

debugTracing().catch(console.error);
```

Run the debug script:

```bash
node debug-tracing.js
```

### Log Analysis

Analyze server logs for patterns:

```bash
# Count error types
grep ERROR llm-proxy-server/logs/server.log | cut -d' ' -f4- | sort | uniq -c | sort -nr

# Find slow operations
grep -E "duration|took" llm-proxy-server/logs/server.log | sort

# Track trace file creation
grep "Trace file written" llm-proxy-server/logs/server.log | tail -10
```

## Getting Help

If issues persist after following this guide:

1. **Collect Information**:
   - Configuration file (`config/trace-config.json`)
   - Server logs (`llm-proxy-server/logs/`)
   - System information (OS, Node.js version, disk space)
   - Minimal reproduction case

2. **Enable Debug Logging**:
   ```json
   {
     "logging": {
       "level": "debug",
       "enableTraceLogging": true
     }
   }
   ```

3. **Create Issue Report**:
   - GitHub issues: [project-url]/issues
   - Include debug script output
   - Provide minimal test case
   - Include relevant log excerpts

4. **Community Support**:
   - Check existing documentation
   - Search for similar issues
   - Provide clear problem description

## Related Documentation

- [Configuration Reference](./configuration.md)
- [API Reference](./api-reference.md)
- [Configuration Examples](./examples/)
- [Main README](../../README.md#action-tracing)