# DEBUGLOGGING-019: Create Sensitive Data Filtering

**Status**: Not Started  
**Priority**: P0 - Critical  
**Phase**: 3 - Configuration  
**Component**: Security  
**Estimated**: 3 hours

## Description

Implement sensitive data filtering to prevent accidental logging of passwords, API keys, tokens, and other sensitive information. This is critical for security and compliance.

## Technical Requirements

### 1. Sensitive Data Patterns

```javascript
const SENSITIVE_PATTERNS = [
  // Authentication
  /(?:password|passwd|pwd|pass)[\s:=]*["']?([^"'\s]+)/gi,
  /(?:token|jwt|bearer)[\s:=]*["']?([^"'\s]+)/gi,
  /(?:api[_-]?key|apikey)[\s:=]*["']?([^"'\s]+)/gi,
  /(?:secret|private[_-]?key)[\s:=]*["']?([^"'\s]+)/gi,

  // Personal Information
  /(?:ssn|social)[\s:=]*(\d{3}-?\d{2}-?\d{4})/gi,
  /(?:credit[_-]?card|cc)[\s:=]*(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi,

  // Headers
  /authorization:\s*bearer\s+([^\s]+)/gi,
  /x-api-key:\s*([^\s]+)/gi,

  // URLs with credentials
  /(?:https?|ftp):\/\/[^:]+:([^@]+)@/gi,

  // Environment variables
  /process\.env\.([A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z_]*)/gi,
];
```

### 2. Filtering Strategy

```javascript
class SensitiveDataFilter {
  filter(message, metadata) {
    return {
      message: this.#filterString(message),
      metadata: this.#filterObject(metadata),
    };
  }

  #filterString(str) {
    let filtered = str;
    for (const pattern of SENSITIVE_PATTERNS) {
      filtered = filtered.replace(pattern, (match, capture) => {
        return match.replace(capture, '[REDACTED]');
      });
    }
    return filtered;
  }

  #filterObject(obj) {
    // Deep clone and filter recursively
  }
}
```

### 3. Configuration Options

```javascript
{
  "security": {
    "filterSensitiveData": true,
    "customPatterns": [],
    "redactedPlaceholder": "[REDACTED]",
    "whitelist": [],
    "deepScan": true,
    "strictMode": false
  }
}
```

## Implementation Steps

1. **Create SensitiveDataFilter Class**
   - [ ] Create `src/logging/security/sensitiveDataFilter.js`
   - [ ] Implement pattern matching logic
   - [ ] Add configurable patterns
   - [ ] Implement deep object filtering

2. **Pattern Implementation**

   ```javascript
   export class SensitiveDataFilter {
     constructor(config = {}) {
       this.patterns = [...SENSITIVE_PATTERNS];
       if (config.customPatterns) {
         this.patterns.push(
           ...config.customPatterns.map((p) => new RegExp(p, 'gi'))
         );
       }
       this.placeholder = config.redactedPlaceholder || '[REDACTED]';
       this.whitelist = new Set(config.whitelist || []);
       this.deepScan = config.deepScan !== false;
     }

     filter(message, metadata) {
       const filteredMessage = this.#filterString(message);
       const filteredMetadata = this.deepScan
         ? this.#deepFilterObject(metadata)
         : this.#shallowFilterObject(metadata);

       return {
         message: filteredMessage,
         metadata: filteredMetadata,
         wasFiltered:
           filteredMessage !== message ||
           JSON.stringify(filteredMetadata) !== JSON.stringify(metadata),
       };
     }
   }
   ```

3. **Deep Object Filtering**

   ```javascript
   #deepFilterObject(obj, visited = new WeakSet()) {
     if (!obj || typeof obj !== 'object') {
       return typeof obj === 'string' ? this.#filterString(obj) : obj;
     }

     if (visited.has(obj)) {
       return '[Circular]';
     }
     visited.add(obj);

     if (Array.isArray(obj)) {
       return obj.map(item => this.#deepFilterObject(item, visited));
     }

     const filtered = {};
     for (const [key, value] of Object.entries(obj)) {
       // Check if key itself is sensitive
       if (this.#isSensitiveKey(key) && !this.whitelist.has(key)) {
         filtered[key] = this.placeholder;
       } else {
         filtered[key] = this.#deepFilterObject(value, visited);
       }
     }

     return filtered;
   }
   ```

4. **Sensitive Key Detection**

   ```javascript
   #isSensitiveKey(key) {
     const sensitiveKeys = [
       'password', 'passwd', 'pwd', 'pass',
       'token', 'jwt', 'bearer',
       'apiKey', 'api_key', 'apikey',
       'secret', 'privateKey', 'private_key',
       'authorization', 'auth',
       'ssn', 'socialSecurity',
       'creditCard', 'credit_card', 'cc'
     ];

     const lowerKey = key.toLowerCase();
     return sensitiveKeys.some(sensitive =>
       lowerKey.includes(sensitive.toLowerCase())
     );
   }
   ```

5. **Integration with Loggers**

   ```javascript
   // In RemoteLogger, HybridLogger, etc.
   debug(message, metadata) {
     if (this.#securityConfig.filterSensitiveData) {
       const filtered = this.#sensitiveDataFilter.filter(message, metadata);

       if (filtered.wasFiltered && this.#securityConfig.strictMode) {
         this.#reportFilteredData();
       }

       return this.#actualLog('debug', filtered.message, filtered.metadata);
     }

     return this.#actualLog('debug', message, metadata);
   }
   ```

6. **Whitelist Support**
   ```javascript
   // Allow specific keys to pass through
   {
     "security": {
       "whitelist": [
         "userId",  // Safe to log
         "publicKey", // Public keys are safe
         "timestamp"
       ]
     }
   }
   ```

## Acceptance Criteria

- [ ] Sensitive patterns are redacted
- [ ] Deep object scanning works
- [ ] Custom patterns can be added
- [ ] Whitelist exempts specific keys
- [ ] Performance impact minimal
- [ ] No false positives in common cases
- [ ] Configuration can disable filtering
- [ ] Filtered data is marked

## Dependencies

- **Used By**: All logger implementations
- **Critical For**: Security compliance

## Testing Requirements

1. **Unit Tests**
   - [ ] Test each sensitive pattern
   - [ ] Test deep object filtering
   - [ ] Test whitelist functionality
   - [ ] Test custom patterns
   - [ ] Test performance impact

2. **Security Tests**
   - [ ] Test with real credentials (in test env)
   - [ ] Test with various formats
   - [ ] Test edge cases
   - [ ] Test bypass attempts

## Files to Create/Modify

- **Create**: `src/logging/security/sensitiveDataFilter.js`
- **Create**: `src/logging/security/patterns.js`
- **Create**: `tests/unit/logging/security/sensitiveDataFilter.test.js`
- **Modify**: All logger implementations to use filter

## Common Patterns to Filter

```javascript
// API Keys
"apiKey": "sk_test_1234567890"  // → "apiKey": "[REDACTED]"

// Passwords in URLs
"http://user:password@host.com" // → "http://user:[REDACTED]@host.com"

// Environment variables
process.env.DATABASE_PASSWORD   // → process.env.[REDACTED]

// JSON objects
{
  "username": "john",
  "password": "secret123"        // → "password": "[REDACTED]"
}

// Headers
{
  "Authorization": "Bearer eyJ..." // → "Authorization": "[REDACTED]"
}
```

## Performance Optimization

```javascript
class FilterCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getFiltered(input) {
    const hash = this.#hash(input);
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    const filtered = this.#filter(input);
    this.#addToCache(hash, filtered);
    return filtered;
  }
}
```

## Compliance Considerations

- GDPR: Prevent PII logging
- PCI DSS: No credit card data
- HIPAA: No health information
- SOC 2: Audit trail security

## Warning System

```javascript
// Warn when sensitive data is detected
if (filtered.wasFiltered) {
  console.warn('Sensitive data was filtered from logs');

  // In strict mode, throw error
  if (config.strictMode) {
    throw new Error('Attempted to log sensitive data');
  }
}
```

## Notes

- Critical security feature
- Must be enabled by default in production
- Consider rate limiting filter warnings
- Document patterns for developers
- Regular pattern updates needed

## Related Tickets

- **Required By**: All logger tickets
- **Related**: DEBUGLOGGING-003 (security config)
- **Critical For**: Production deployment
