# Debug Logging Configuration Guide

## Overview

This guide covers the Living Narrative Engine's debug logging configuration system, including the new source-based categorization features. The configuration system supports multiple logging strategies and provides sophisticated routing capabilities for different development scenarios.

## Configuration Structure

The debug logging system uses a JSON configuration file with comprehensive validation through JSON Schema. The main configuration resides in `config/debug-logging-config.json` and follows the schema defined in `data/schemas/debug-logging-config.schema.json`.

### Basic Configuration

```json
{
  "$schema": "../data/schemas/debug-logging-config.schema.json",
  "enabled": true,
  "mode": "development",
  "logLevel": "INFO",
  "fallbackToConsole": true
}
```

## Categorization System

The categorization system enables intelligent log routing based on the source location of log messages. This feature supports three strategies for maximum flexibility.

### Categorization Strategies

#### 1. Source-Based Strategy

Routes logs based on the source file location using stack trace analysis:

```json
{
  "categorization": {
    "strategy": "source-based",
    "enableStackTraceExtraction": true,
    "sourceMappings": {
      "src/actions": "actions",
      "src/logic": "logic",
      "src/entities": "entities",
      "src/ai": "ai",
      "src/domUI": "domUI",
      "src/engine": "engine",
      "src/events": "events",
      "src/loaders": "loaders",
      "src/scopeDsl": "scopeDsl",
      "src/initializers": "initializers",
      "src/dependencyInjection": "dependencyInjection",
      "src/logging": "logging",
      "src/configuration": "configuration",
      "tests": "tests"
    },
    "fallbackCategory": "general"
  }
}
```

#### 2. Pattern-Based Strategy

Traditional pattern matching on log message content:

```json
{
  "categorization": {
    "strategy": "pattern-based"
  }
}
```

#### 3. Hybrid Strategy

Combines source-based and pattern-based categorization:

```json
{
  "categorization": {
    "strategy": "hybrid",
    "enableStackTraceExtraction": true,
    "migration": {
      "mode": "progressive",
      "preserveOldPatterns": true,
      "enableDualCategorization": true
    }
  }
}
```

### Source Mappings

The source mappings define how file paths map to category names. The system includes comprehensive default mappings for all 42+ source directories:

```json
{
  "categorization": {
    "sourceMappings": {
      "src/actions": "actions",
      "src/logic": "logic",
      "src/entities": "entities",
      "src/ai": "ai",
      "src/domUI": "domUI",
      "src/engine": "engine",
      "src/events": "events",
      "src/loaders": "loaders",
      "src/scopeDsl": "scopeDsl",
      "src/initializers": "initializers",
      "src/dependencyInjection": "dependencyInjection",
      "src/logging": "logging",
      "src/configuration": "configuration",
      "src/utils": "utils",
      "src/constants": "constants",
      "src/storage": "storage",
      "src/types": "types",
      "src/alerting": "alerting",
      "src/context": "context",
      "src/turns": "turns",
      "src/adapters": "adapters",
      "src/query": "query",
      "src/characterBuilder": "characterBuilder",
      "src/prompting": "prompting",
      "src/anatomy": "anatomy",
      "src/scheduling": "scheduling",
      "src/errors": "errors",
      "src/interfaces": "interfaces",
      "src/clothing": "clothing",
      "src/input": "input",
      "src/testing": "testing",
      "src/modding": "modding",
      "src/persistence": "persistence",
      "src/data": "data",
      "src/shared": "shared",
      "src/bootstrapper": "bootstrapper",
      "src/commands": "commands",
      "src/thematicDirection": "thematicDirection",
      "src/models": "models",
      "src/llms": "llms",
      "src/validation": "validation",
      "src/pathing": "pathing",
      "src/formatting": "formatting",
      "src/ports": "ports",
      "src/shutdown": "shutdown",
      "src/clichesGenerator": "clichesGenerator",
      "src/coreMotivationsGenerator": "coreMotivationsGenerator",
      "src/thematicDirectionsManager": "thematicDirectionsManager",
      "src/services": "services",
      "tests": "tests",
      "llm-proxy-server": "llm-proxy"
    }
  }
}
```

## Migration Support

The system provides progressive migration capabilities for transitioning between categorization strategies.

### Migration Modes

#### Progressive Migration

Gradual transition with backward compatibility:

```json
{
  "categorization": {
    "migration": {
      "mode": "progressive",
      "preserveOldPatterns": true,
      "enableDualCategorization": false
    }
  }
}
```

#### Immediate Migration

Direct switch to new categorization:

```json
{
  "categorization": {
    "migration": {
      "mode": "immediate",
      "preserveOldPatterns": false,
      "enableDualCategorization": false
    }
  }
}
```

#### Test Migration

Testing mode for validation:

```json
{
  "categorization": {
    "migration": {
      "mode": "test",
      "preserveOldPatterns": true,
      "enableDualCategorization": true
    }
  }
}
```

## Performance Configuration

The categorization system includes extensive performance tuning options for optimal operation.

### Stack Trace Optimization

```json
{
  "categorization": {
    "performance": {
      "stackTrace": {
        "enabled": true,
        "skipFrames": 4,
        "maxDepth": 20,
        "cache": {
          "enabled": true,
          "maxSize": 200,
          "ttl": 300000
        }
      }
    }
  }
}
```

### File Operations Optimization

```json
{
  "categorization": {
    "performance": {
      "fileOperations": {
        "bufferSize": 100,
        "flushInterval": 1000,
        "parallelWrites": true,
        "maxFileHandles": 50
      }
    }
  }
}
```

## Level-Based Routing

Route logs to different outputs based on log level:

```json
{
  "categorization": {
    "levelBasedRouting": {
      "error": "error.jsonl",
      "warn": "warning.jsonl"
    }
  }
}
```

## Category Configuration

Define behavior for specific log categories:

```json
{
  "categories": {
    "actions": {
      "enabled": true,
      "level": "debug"
    },
    "ai": {
      "enabled": true,
      "level": "info"
    },
    "errors": {
      "enabled": true,
      "level": "error"
    }
  }
}
```

## Remote Logging Configuration

Configure remote logging endpoints and behavior:

```json
{
  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log",
    "batchSize": 100,
    "flushInterval": 1000,
    "retryAttempts": 3,
    "retryBaseDelay": 1000,
    "retryMaxDelay": 30000,
    "circuitBreakerThreshold": 5,
    "circuitBreakerTimeout": 60000,
    "requestTimeout": 5000,
    "compression": false
  }
}
```

## Console Configuration

Control console output formatting and behavior:

```json
{
  "console": {
    "enabled": true,
    "useColors": true,
    "showTimestamp": false,
    "showCategory": true,
    "groupSimilar": true
  }
}
```

## Critical Logging

Configure critical log handling for warnings and errors:

```json
{
  "criticalLogging": {
    "alwaysShowInConsole": true,
    "enableVisualNotifications": true,
    "bufferSize": 50,
    "notificationPosition": "top-right",
    "autoDismissAfter": null,
    "soundEnabled": false,
    "minimumLevel": "warn"
  }
}
```

## Performance Monitoring

Enable performance metrics and thresholds:

```json
{
  "performance": {
    "enableMetrics": true,
    "metricsInterval": 60000,
    "memoryWarningThreshold": 100,
    "slowLogThreshold": 1000
  }
}
```

## Data Filtering

Configure sensitive data filtering:

```json
{
  "filtering": {
    "enabled": true,
    "strategy": "mask",
    "patterns": {
      "password": "password|passwd|pwd",
      "email": "[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}"
    },
    "strategies": {
      "mask": "****",
      "partial": "****",
      "hash": "[HASHED]",
      "remove": "[REMOVED]"
    }
  }
}
```

## Complete Configuration Example

Here's a comprehensive configuration example using all features:

```json
{
  "$schema": "../data/schemas/debug-logging-config.schema.json",
  "enabled": true,
  "mode": "hybrid",
  "fallbackToConsole": true,
  "logLevel": "INFO",

  "categorization": {
    "strategy": "hybrid",
    "enableStackTraceExtraction": true,
    "sourceMappings": {
      "src/actions": "actions",
      "src/ai": "ai",
      "src/entities": "entities",
      "src/domUI": "domUI",
      "src/logging": "logging",
      "tests": "tests"
    },
    "fallbackCategory": "general",
    "levelBasedRouting": {
      "error": "error.jsonl",
      "warn": "warning.jsonl"
    },
    "migration": {
      "mode": "progressive",
      "preserveOldPatterns": true,
      "enableDualCategorization": false
    },
    "performance": {
      "stackTrace": {
        "enabled": true,
        "skipFrames": 4,
        "maxDepth": 20,
        "cache": {
          "enabled": true,
          "maxSize": 200,
          "ttl": 300000
        }
      },
      "fileOperations": {
        "bufferSize": 100,
        "flushInterval": 1000,
        "parallelWrites": true,
        "maxFileHandles": 50
      }
    }
  },

  "remote": {
    "endpoint": "http://localhost:3001/api/debug-log",
    "batchSize": 100,
    "flushInterval": 1000,
    "retryAttempts": 3,
    "retryBaseDelay": 1000,
    "retryMaxDelay": 30000,
    "circuitBreakerThreshold": 5,
    "circuitBreakerTimeout": 60000,
    "requestTimeout": 5000,
    "compression": false
  },

  "categories": {
    "actions": {
      "enabled": true,
      "level": "debug"
    },
    "ai": {
      "enabled": true,
      "level": "info"
    },
    "entities": {
      "enabled": true,
      "level": "debug"
    },
    "domUI": {
      "enabled": true,
      "level": "warn"
    },
    "errors": {
      "enabled": true,
      "level": "error"
    }
  },

  "console": {
    "enabled": true,
    "useColors": true,
    "showTimestamp": false,
    "showCategory": true,
    "groupSimilar": true
  },

  "performance": {
    "enableMetrics": true,
    "metricsInterval": 60000,
    "memoryWarningThreshold": 100,
    "slowLogThreshold": 1000
  },

  "filtering": {
    "enabled": true,
    "strategy": "mask"
  },

  "criticalLogging": {
    "alwaysShowInConsole": true,
    "enableVisualNotifications": true,
    "bufferSize": 50,
    "notificationPosition": "top-right",
    "autoDismissAfter": null,
    "soundEnabled": false,
    "minimumLevel": "warn"
  }
}
```

## Usage Examples

### Loading Configuration

The configuration is automatically loaded by the `DebugLogConfigLoader`:

```javascript
import DebugLogConfigLoader from '../src/configuration/debugLogConfigLoader.js';

const loader = new DebugLogConfigLoader({
  logger: consoleLogger,
  validator: configValidator,
});

const config = loader.loadConfig();
```

### Category Detection

Source-based categorization automatically detects categories from stack traces:

```javascript
// This log from src/entities/entityManager.js will be categorized as "entities"
logger.debug('Creating new entity', { entityId: 'test-123' });

// This log from src/ai/memoryManager.js will be categorized as "ai"
logger.info('Processing AI memory', { conversationId: 'conv-456' });
```

### Migration Scenarios

#### Scenario 1: New Project Setup

For new projects, use source-based strategy immediately:

```json
{
  "categorization": {
    "strategy": "source-based",
    "migration": {
      "mode": "immediate"
    }
  }
}
```

#### Scenario 2: Existing Project Migration

For existing projects with pattern-based categorization:

```json
{
  "categorization": {
    "strategy": "hybrid",
    "migration": {
      "mode": "progressive",
      "preserveOldPatterns": true,
      "enableDualCategorization": false
    }
  }
}
```

#### Scenario 3: Testing Migration

For testing the new categorization before full migration:

```json
{
  "categorization": {
    "strategy": "hybrid",
    "migration": {
      "mode": "test",
      "preserveOldPatterns": true,
      "enableDualCategorization": true
    }
  }
}
```

## Validation and Security

The configuration system includes comprehensive validation:

### Schema Validation

All configurations are validated against the JSON Schema:

- **Type validation**: Ensures correct data types for all properties
- **Enum validation**: Validates strategy and mode values against allowed options
- **Range validation**: Ensures numeric values are within acceptable ranges
- **Format validation**: Validates URLs, patterns, and other formatted strings

### Semantic Validation

Additional validation beyond schema requirements:

- **Source mapping validation**: Ensures source paths are secure and valid
- **Performance threshold validation**: Validates performance settings are reasonable
- **Category consistency**: Ensures category definitions are consistent

### Security Validation

Security-focused validation to prevent vulnerabilities:

- **Path traversal prevention**: Validates source mappings don't allow path traversal
- **Input sanitization**: Sanitizes configuration values to prevent injection
- **Resource limits**: Enforces limits on cache sizes, buffer sizes, and timeouts

## Troubleshooting

### Common Configuration Issues

#### Issue: Stack trace extraction not working

**Solution**: Ensure `enableStackTraceExtraction` is set to `true` and performance settings allow adequate depth:

```json
{
  "categorization": {
    "enableStackTraceExtraction": true,
    "performance": {
      "stackTrace": {
        "enabled": true,
        "maxDepth": 20
      }
    }
  }
}
```

#### Issue: Performance degradation with source-based categorization

**Solution**: Optimize stack trace settings and enable caching:

```json
{
  "categorization": {
    "performance": {
      "stackTrace": {
        "skipFrames": 4,
        "maxDepth": 15,
        "cache": {
          "enabled": true,
          "maxSize": 500,
          "ttl": 300000
        }
      }
    }
  }
}
```

#### Issue: Configuration validation errors

**Solution**: Check the schema file and ensure all required properties are present:

```bash
# Validate configuration against schema
npx ajv validate -s data/schemas/debug-logging-config.schema.json -d config/debug-logging-config.json
```

### Performance Optimization

For high-volume logging scenarios:

1. **Enable caching**:

   ```json
   {
     "categorization": {
       "performance": {
         "stackTrace": {
           "cache": {
             "enabled": true,
             "maxSize": 1000
           }
         }
       }
     }
   }
   ```

2. **Reduce stack trace depth**:

   ```json
   {
     "categorization": {
       "performance": {
         "stackTrace": {
           "maxDepth": 10,
           "skipFrames": 6
         }
       }
     }
   }
   ```

3. **Optimize file operations**:
   ```json
   {
     "categorization": {
       "performance": {
         "fileOperations": {
           "bufferSize": 500,
           "parallelWrites": true,
           "maxFileHandles": 100
         }
       }
     }
   }
   ```

## Best Practices

### Configuration Management

1. **Environment-specific configurations**: Use different configurations for development, testing, and production
2. **Version control**: Keep configuration files in version control with appropriate access controls
3. **Validation**: Always validate configurations before deployment
4. **Documentation**: Document custom source mappings and categorization strategies
5. **Performance monitoring**: Monitor categorization performance and adjust settings as needed

### Migration Strategy

1. **Start with hybrid mode**: Use hybrid strategy for gradual migration
2. **Test thoroughly**: Use test migration mode to validate behavior
3. **Monitor performance**: Track performance impact during migration
4. **Rollback plan**: Maintain ability to rollback to pattern-based categorization
5. **Team communication**: Ensure team understands new categorization behavior

### Security Considerations

1. **Validate source mappings**: Ensure source paths don't allow unauthorized access
2. **Sanitize inputs**: Sanitize all configuration inputs to prevent injection attacks
3. **Monitor access**: Monitor configuration file access and modifications
4. **Regular audits**: Regularly audit configuration settings for security issues
5. **Principle of least privilege**: Grant minimal necessary permissions for log access

## Summary

The Living Narrative Engine's debug logging configuration system provides:

- ✅ **Flexible categorization strategies** with source-based, pattern-based, and hybrid options
- ✅ **Progressive migration support** for seamless transitions between strategies
- ✅ **Comprehensive validation** with schema, semantic, and security checks
- ✅ **Performance optimization** with caching, buffering, and tuning options
- ✅ **Backward compatibility** maintaining existing functionality during migration
- ✅ **Enterprise features** including level-based routing, filtering, and monitoring

The system is designed to scale from simple development setups to complex production environments while maintaining high performance and security standards.
