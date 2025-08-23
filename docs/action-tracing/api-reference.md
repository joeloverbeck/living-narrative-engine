# Action Tracing API Reference

Complete API reference for the Living Narrative Engine action tracing endpoints provided by the LLM Proxy Server.

## Overview

The LLM Proxy Server (running on port 3001) provides three REST API endpoints for action tracing file management:

- `/api/traces/write` - Write a single trace file
- `/api/traces/write-batch` - Write multiple trace files in batch
- `/api/traces/list` - List existing trace files in a directory

All endpoints require the LLM Proxy Server to be running and accessible.

## Base URL

```
http://localhost:3001
```

Default port is 3001. Verify with your LLM proxy server configuration.

## Authentication

Currently no authentication is required for trace endpoints. The server relies on network-level security (localhost access only by default).

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `403` - Forbidden (security violations)
- `500` - Internal Server Error

## Endpoints

### Write Single Trace

Write a single trace file to the filesystem.

#### Request

**Method**: `POST`  
**URL**: `/api/traces/write`  
**Content-Type**: `application/json`

#### Request Body

```json
{
  "traceData": "string | object",
  "fileName": "string",
  "outputDirectory": "string (optional)"
}
```

**Parameters**:

- `traceData` (required): The trace data to write. Can be a JSON string or object.
- `fileName` (required): Name of the file to create (will be sanitized)
- `outputDirectory` (optional): Target directory relative to project root (defaults to `"./traces"`)

#### Request Examples

**JSON String Data**:
```bash
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{
    "traceData": "{\"actionId\":\"core:move\",\"timestamp\":\"2025-08-23T10:30:00Z\",\"actor\":\"player\"}",
    "fileName": "trace_move_player_20250823.json",
    "outputDirectory": "./traces/movement"
  }'
```

**JSON Object Data**:
```bash
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{
    "traceData": {
      "actionId": "core:attack",
      "timestamp": "2025-08-23T10:30:00Z",
      "actor": "player",
      "target": "enemy_goblin"
    },
    "fileName": "trace_attack_goblin.json",
    "outputDirectory": "./traces/combat"
  }'
```

**Text Format Data**:
```bash
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{
    "traceData": "=== Action Trace Report ===\nTimestamp: 2025-08-23T10:30:00Z\nAction: core:move\nActor: player",
    "fileName": "trace_move_player.txt",
    "outputDirectory": "./traces"
  }'
```

#### Response

**Success Response** (200):
```json
{
  "success": true,
  "message": "Trace file written successfully",
  "path": "traces/trace_move_player_20250823.json",
  "fileName": "trace_move_player_20250823.json", 
  "size": 156
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Missing required fields: traceData and fileName"
}
```

**Error Response** (403):
```json
{
  "success": false,
  "error": "Invalid output path"
}
```

### Write Batch Traces

Write multiple trace files in a single request for improved performance.

#### Request

**Method**: `POST`  
**URL**: `/api/traces/write-batch`  
**Content-Type**: `application/json`

#### Request Body

```json
{
  "traces": [
    {
      "traceData": "string | object",
      "fileName": "string"
    }
  ],
  "outputDirectory": "string (optional)"
}
```

**Parameters**:

- `traces` (required): Array of trace objects, each containing `traceData` and `fileName`
- `outputDirectory` (optional): Target directory for all traces (defaults to `"./traces"`)

#### Request Examples

**Multiple JSON Traces**:
```bash
curl -X POST http://localhost:3001/api/traces/write-batch \
  -H "Content-Type: application/json" \
  -d '{
    "traces": [
      {
        "traceData": "{\"actionId\":\"core:move\",\"actor\":\"player\"}",
        "fileName": "trace_move_001.json"
      },
      {
        "traceData": "{\"actionId\":\"core:attack\",\"actor\":\"player\"}",
        "fileName": "trace_attack_001.json"
      },
      {
        "traceData": "=== Text Trace ===\nAction: core:rest",
        "fileName": "trace_rest_001.txt"
      }
    ],
    "outputDirectory": "./traces/batch-session"
  }'
```

**Mixed Format Traces**:
```bash
curl -X POST http://localhost:3001/api/traces/write-batch \
  -H "Content-Type: application/json" \
  -d '{
    "traces": [
      {
        "traceData": {
          "actionId": "intimacy:fondle_ass",
          "actor": "player",
          "target": "silvia",
          "timestamp": "2025-08-23T10:30:00Z"
        },
        "fileName": "trace_fondle_ass_silvia.json"
      },
      {
        "traceData": "=== Action Trace Report ===\nTimestamp: 2025-08-23T10:30:00Z\nAction: intimacy:fondle_ass\nActor: player\nTarget: silvia\n\n=== End of Trace ===",
        "fileName": "trace_fondle_ass_silvia.txt"
      }
    ],
    "outputDirectory": "./traces/intimacy"
  }'
```

#### Response

**Success Response** (200):
```json
{
  "success": true,
  "message": "Batch write completed",
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "totalBytes": 1245
  },
  "results": [
    {
      "index": 0,
      "fileName": "trace_move_001.json",
      "success": true,
      "filePath": "traces/batch-session/trace_move_001.json",
      "size": 156,
      "bytesWritten": 156
    },
    {
      "index": 1,
      "fileName": "trace_attack_001.json", 
      "success": true,
      "filePath": "traces/batch-session/trace_attack_001.json",
      "size": 198,
      "bytesWritten": 198
    },
    {
      "index": 2,
      "fileName": "trace_rest_001.txt",
      "success": true,
      "filePath": "traces/batch-session/trace_rest_001.txt",
      "size": 45,
      "bytesWritten": 45
    }
  ]
}
```

**Partial Success Response** (200):
```json
{
  "success": true,
  "message": "Batch write completed with some failures",
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "totalBytes": 354
  },
  "results": [
    {
      "index": 0,
      "fileName": "trace_valid.json",
      "success": true,
      "filePath": "traces/trace_valid.json",
      "size": 156,
      "bytesWritten": 156
    },
    {
      "index": 1,
      "fileName": "trace_invalid.json",
      "success": false,
      "error": "Permission denied"
    },
    {
      "index": 2,
      "fileName": "trace_another.json",
      "success": true,
      "filePath": "traces/trace_another.json", 
      "size": 198,
      "bytesWritten": 198
    }
  ]
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Missing or empty traces array",
  "details": "Request body must contain a non-empty array of traces"
}
```

**Validation Error Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "Trace 0: missing required fields (traceData, fileName)",
    "Trace 2: missing required fields (traceData, fileName)"
  ]
}
```

### List Trace Files

List trace files in a specified directory with metadata.

#### Request

**Method**: `GET`  
**URL**: `/api/traces/list`  
**Query Parameters**:
- `directory` (optional): Directory to list, relative to project root (defaults to `"./traces"`)

#### Request Examples

**Default Directory**:
```bash
curl "http://localhost:3001/api/traces/list"
```

**Specific Directory**:
```bash
curl "http://localhost:3001/api/traces/list?directory=./traces/combat"
```

**URL Encoded Directory**:
```bash
curl "http://localhost:3001/api/traces/list?directory=./traces/fondle-ass"
```

#### Response

**Success Response** (200):
```json
{
  "success": true,
  "directory": "./traces/combat",
  "count": 3,
  "files": [
    {
      "name": "trace_attack_player_20250823_143045.json",
      "size": 2458,
      "modified": "2025-08-23T14:30:45.123Z",
      "created": "2025-08-23T14:30:45.123Z"
    },
    {
      "name": "trace_attack_player_20250823_143045.txt",
      "size": 1856,
      "modified": "2025-08-23T14:30:45.127Z",
      "created": "2025-08-23T14:30:45.127Z"
    },
    {
      "name": "trace_defend_player_20250823_142030.json",
      "size": 1987,
      "modified": "2025-08-23T14:20:30.456Z",
      "created": "2025-08-23T14:20:30.456Z"
    }
  ]
}
```

**Empty Directory Response** (200):
```json
{
  "success": true,
  "directory": "./traces/empty",
  "count": 0,
  "files": [],
  "message": "Directory does not exist"
}
```

**Error Response** (403):
```json
{
  "success": false,
  "error": "Invalid directory path"
}
```

## Security Considerations

### Path Traversal Protection

All endpoints include security checks to prevent path traversal attacks:

- File names are sanitized using `path.basename()`
- Output paths are validated to stay within the project root
- Attempts to write outside the project directory return 403 Forbidden

### Examples of Blocked Requests

**Path Traversal Attempt**:
```bash
# This will fail with 403 Forbidden
curl -X POST http://localhost:3001/api/traces/write \
  -H "Content-Type: application/json" \
  -d '{
    "traceData": "{}",
    "fileName": "../../../etc/passwd",
    "outputDirectory": "/"
  }'
```

**Directory Traversal**:
```bash
# This will fail with 403 Forbidden  
curl "http://localhost:3001/api/traces/list?directory=../../../etc"
```

## Performance Characteristics

### Write Performance

| Operation | Typical Time | Factors |
|-----------|-------------|---------|
| Single Write | 5-15ms | File size, disk I/O |
| Batch Write (10 files) | 20-50ms | Parallel processing |
| Batch Write (100 files) | 100-300ms | System resources |

### Best Practices

1. **Use Batch Writes**: For multiple files, batch operations are more efficient
2. **Reasonable Batch Sizes**: Keep batches under 50-100 files for optimal performance  
3. **Monitor Disk Space**: Trace files can accumulate quickly
4. **Network Considerations**: Large traces may take longer over slow connections

## Error Recovery

### Retry Logic

For production usage, implement retry logic for transient failures:

```javascript
async function writeTraceWithRetry(traceData, fileName, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:3001/api/traces/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceData, fileName })
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      if (response.status === 403 || response.status === 400) {
        // Don't retry client errors
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Batch Error Handling

Process batch responses to handle partial failures:

```javascript
function processBatchResponse(response) {
  const { results } = response;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (failed.length > 0) {
    console.warn(`${failed.length} traces failed to write:`, failed);
    // Implement retry logic for failed traces
  }
  
  console.log(`Successfully wrote ${successful.length} trace files`);
  return { successful, failed };
}
```

## Integration Examples

### Node.js Client

```javascript
class TraceClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }
  
  async writeSingle(traceData, fileName, outputDirectory = './traces') {
    const response = await fetch(`${this.baseUrl}/api/traces/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceData, fileName, outputDirectory })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }
  
  async writeBatch(traces, outputDirectory = './traces') {
    const response = await fetch(`${this.baseUrl}/api/traces/write-batch`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traces, outputDirectory })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }
  
  async listFiles(directory = './traces') {
    const response = await fetch(
      `${this.baseUrl}/api/traces/list?directory=${encodeURIComponent(directory)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }
}
```

### Python Client

```python
import requests
import json
from typing import List, Dict, Any, Optional

class TraceClient:
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
    
    def write_single(self, trace_data: Any, file_name: str, 
                    output_directory: str = "./traces") -> Dict[str, Any]:
        """Write a single trace file."""
        data = {
            "traceData": trace_data,
            "fileName": file_name,
            "outputDirectory": output_directory
        }
        
        response = requests.post(
            f"{self.base_url}/api/traces/write",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()
    
    def write_batch(self, traces: List[Dict[str, Any]], 
                   output_directory: str = "./traces") -> Dict[str, Any]:
        """Write multiple trace files in batch."""
        data = {
            "traces": traces,
            "outputDirectory": output_directory
        }
        
        response = requests.post(
            f"{self.base_url}/api/traces/write-batch",
            json=data,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()
    
    def list_files(self, directory: str = "./traces") -> Dict[str, Any]:
        """List trace files in directory."""
        response = requests.get(
            f"{self.base_url}/api/traces/list",
            params={"directory": directory}
        )
        response.raise_for_status()
        return response.json()
```

## Monitoring and Logging

The LLM Proxy Server logs all trace operations. Monitor logs at:

```bash
# Server logs
tail -f llm-proxy-server/logs/server.log

# Error logs  
tail -f llm-proxy-server/logs/error.log
```

### Log Entry Examples

**Successful Write**:
```
[INFO] Trace file written successfully {"fileName":"trace_move.json","directory":"./traces","size":156}
```

**Security Violation**:
```
[ERROR] Attempted to write trace file outside project directory {"attemptedPath":"/etc/passwd","projectRoot":"/home/user/project"}
```

**Batch Processing**:
```
[INFO] Batch trace write completed {"total":10,"successful":9,"failed":1,"totalBytes":15420}
```

## Related Documentation

- [Configuration Reference](./configuration.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Configuration Examples](./examples/)
- [Main README](../../README.md#action-tracing)