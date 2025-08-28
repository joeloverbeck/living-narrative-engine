# TRAREW-016: Deployment Preparation and Configuration

## Priority: 🟢 LOW

**Phase**: 3 - Testing & Validation  
**Story Points**: 2  
**Estimated Time**: 2-3 hours

## Problem Statement

The TraitsRewriter feature needs proper deployment preparation including build configuration, production optimizations, environment setup, monitoring configuration, and deployment validation procedures. This ensures smooth production deployment and reliable operation.

## Requirements

1. Configure build process for TraitsRewriter assets
2. Set up production environment configurations
3. Configure monitoring and logging for production
4. Prepare deployment validation procedures
5. Document deployment requirements and procedures
6. Set up error tracking and performance monitoring
7. Ensure security considerations are addressed

## Acceptance Criteria

- [ ] **Build Configuration**: TraitsRewriter assets properly bundled and optimized
- [ ] **Environment Config**: Production environment variables and settings configured
- [ ] **Monitoring Setup**: Logging, error tracking, and performance monitoring configured
- [ ] **Deployment Validation**: Automated checks for successful deployment
- [ ] **Security Review**: Security considerations addressed and validated
- [ ] **Documentation**: Complete deployment guide with procedures
- [ ] **Rollback Plan**: Deployment rollback procedures documented

## Implementation Details

### Build Configuration

#### Build Process Updates

Update build configuration to include TraitsRewriter:

**File**: `esbuild.config.js`

```javascript
// Add TraitsRewriter entry point
const buildConfigs = [
  // ... existing configs
  {
    entryPoints: ['src/traits-rewriter-main.js'],
    bundle: true,
    outfile: 'dist/traits-rewriter.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development'
      ),
      'process.env.TRAITS_REWRITER_VERSION': JSON.stringify(
        require('./package.json').version
      ),
    },
    plugins: [
      // ... existing plugins
    ],
  },
];
```

#### Asset Optimization

**File**: `build-scripts/optimize-traits-rewriter.js`

```javascript
/**
 * @file Optimize TraitsRewriter assets for production
 */

import { minify } from 'terser';
import { promises as fs } from 'fs';
import path from 'path';

export async function optimizeTraitsRewriterAssets() {
  const distPath = path.join(process.cwd(), 'dist');
  const traitsRewriterPath = path.join(distPath, 'traits-rewriter.js');

  if (process.env.NODE_ENV === 'production') {
    // Minify JavaScript
    const code = await fs.readFile(traitsRewriterPath, 'utf8');
    const minified = await minify(code, {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      mangle: true,
      format: {
        comments: false,
      },
    });

    await fs.writeFile(traitsRewriterPath, minified.code);
    console.log('TraitsRewriter assets optimized for production');
  }
}
```

### Environment Configuration

#### Environment Variables

**File**: `.env.example`

```bash
# TraitsRewriter Configuration
TRAITS_REWRITER_ENABLED=true
TRAITS_REWRITER_MAX_CONCURRENT_REQUESTS=5
TRAITS_REWRITER_GENERATION_TIMEOUT=30000
TRAITS_REWRITER_MAX_CHARACTER_SIZE=10000

# LLM Service Configuration for TraitsRewriter
LLM_PROXY_SERVER_URL=http://localhost:3001
LLM_DEFAULT_MODEL=gpt-3.5-turbo
LLM_MAX_TOKENS=1000
LLM_TEMPERATURE=0.7

# Performance and Monitoring
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_ERROR_TRACKING=true
TRAITS_REWRITER_METRICS_ENABLED=true

# Security Configuration
CONTENT_SECURITY_POLICY_ENABLED=true
XSS_PROTECTION_ENABLED=true
CORS_ORIGINS=https://yourdomain.com
```

#### Production Configuration

**File**: `src/config/traitsRewriterConfig.js`

```javascript
/**
 * @file TraitsRewriter production configuration
 */

export const TraitsRewriterConfig = {
  // Feature flags
  enabled: process.env.TRAITS_REWRITER_ENABLED === 'true',

  // Performance settings
  maxConcurrentRequests:
    parseInt(process.env.TRAITS_REWRITER_MAX_CONCURRENT_REQUESTS) || 3,
  generationTimeout:
    parseInt(process.env.TRAITS_REWRITER_GENERATION_TIMEOUT) || 30000,
  maxCharacterSize:
    parseInt(process.env.TRAITS_REWRITER_MAX_CHARACTER_SIZE) || 10000,

  // LLM configuration
  llmConfig: {
    serverUrl: process.env.LLM_PROXY_SERVER_URL || 'http://localhost:3001',
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
  },

  // Security settings
  security: {
    enableCSP: process.env.CONTENT_SECURITY_POLICY_ENABLED === 'true',
    enableXSSProtection: process.env.XSS_PROTECTION_ENABLED === 'true',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
  },

  // Monitoring configuration
  monitoring: {
    enablePerformanceMonitoring:
      process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
    enableErrorTracking: process.env.ENABLE_ERROR_TRACKING === 'true',
    enableMetrics: process.env.TRAITS_REWRITER_METRICS_ENABLED === 'true',
  },
};
```

### Monitoring and Logging

#### Production Logging Configuration

**File**: `src/config/loggingConfig.js`

```javascript
/**
 * @file Production logging configuration for TraitsRewriter
 */

export const LoggingConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  // TraitsRewriter specific logging
  traitsRewriter: {
    enableGenerationMetrics: true,
    enablePerformanceLogging: true,
    enableErrorTracking: true,

    // Log levels for different operations
    levels: {
      generation: 'info',
      validation: 'debug',
      export: 'info',
      errors: 'error',
    },
  },

  // Performance monitoring
  performance: {
    trackGenerationTime: true,
    trackMemoryUsage: process.env.NODE_ENV === 'production',
    trackTokenUsage: true,
  },
};
```

#### Error Tracking Setup

**File**: `src/monitoring/errorTracking.js`

```javascript
/**
 * @file Error tracking for TraitsRewriter in production
 */

export class TraitsRewriterErrorTracker {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    this.errorCounts = new Map();
  }

  trackError(error, context = {}) {
    if (!this.config.monitoring.enableErrorTracking) {
      return;
    }

    const errorKey = `${error.name}:${error.code}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    this.logger.error('TraitsRewriter Error', {
      error: error.message,
      code: error.code,
      context,
      count: count + 1,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Alert on high error rates
    if (count + 1 > 10) {
      this.logger.warn('High TraitsRewriter error rate', {
        errorType: errorKey,
        count: count + 1,
      });
    }
  }

  getErrorStats() {
    return Object.fromEntries(this.errorCounts);
  }
}
```

#### Performance Monitoring

**File**: `src/monitoring/performanceMonitor.js`

```javascript
/**
 * @file Performance monitoring for TraitsRewriter
 */

export class TraitsRewriterPerformanceMonitor {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    this.metrics = {
      generationTimes: [],
      tokenUsage: [],
      memoryUsage: [],
    };
  }

  recordGeneration(duration, tokenCount, memoryUsed) {
    if (!this.config.monitoring.enablePerformanceMonitoring) {
      return;
    }

    this.metrics.generationTimes.push(duration);
    this.metrics.tokenUsage.push(tokenCount);
    this.metrics.memoryUsage.push(memoryUsed);

    // Log performance metrics
    this.logger.info('TraitsRewriter Generation Metrics', {
      duration,
      tokenCount,
      memoryUsed,
      timestamp: new Date().toISOString(),
    });

    // Alert on poor performance
    if (duration > 10000) {
      // 10 seconds
      this.logger.warn('Slow TraitsRewriter generation', {
        duration,
        tokenCount,
      });
    }
  }

  getPerformanceStats() {
    const generationTimes = this.metrics.generationTimes;
    const average =
      generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length;

    return {
      averageGenerationTime: average,
      totalGenerations: generationTimes.length,
      totalTokensUsed: this.metrics.tokenUsage.reduce((a, b) => a + b, 0),
      averageMemoryUsage:
        this.metrics.memoryUsage.reduce((a, b) => a + b, 0) /
        this.metrics.memoryUsage.length,
    };
  }
}
```

### Security Configuration

#### Content Security Policy

**File**: `src/security/cspConfig.js`

```javascript
/**
 * @file Content Security Policy for TraitsRewriter
 */

export const TraitsRewriterCSP = {
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"], // Needed for dynamic content
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", process.env.LLM_PROXY_SERVER_URL],
    'worker-src': ["'none'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },
};
```

#### XSS Protection

**File**: `src/security/xssProtection.js`

```javascript
/**
 * @file XSS protection for TraitsRewriter content
 */

export class TraitsRewriterXSSProtection {
  static sanitizeContent(content) {
    if (typeof content !== 'string') {
      return '';
    }

    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/&/g, '&amp;');
  }

  static validateCharacterDefinition(definition) {
    // Validate character definition for potential security issues
    const maxFieldLength = 10000;
    const maxFields = 20;

    if (typeof definition !== 'object' || definition === null) {
      throw new Error('Invalid character definition format');
    }

    const fields = Object.keys(definition);
    if (fields.length > maxFields) {
      throw new Error('Character definition has too many fields');
    }

    for (const [key, value] of Object.entries(definition)) {
      if (
        typeof value.text === 'string' &&
        value.text.length > maxFieldLength
      ) {
        throw new Error(`Field ${key} exceeds maximum length`);
      }
    }

    return true;
  }
}
```

### Deployment Validation

#### Health Check Endpoint

**File**: `src/health/traitsRewriterHealth.js`

```javascript
/**
 * @file Health check for TraitsRewriter services
 */

export class TraitsRewriterHealthCheck {
  constructor({ container, logger }) {
    this.container = container;
    this.logger = logger;
  }

  async checkHealth() {
    const checks = {
      services: await this.checkServices(),
      llmConnection: await this.checkLLMConnection(),
      dependencies: await this.checkDependencies(),
    };

    const allHealthy = Object.values(checks).every((check) => check.healthy);

    return {
      healthy: allHealthy,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkServices() {
    try {
      const generator = this.container.resolve('ITraitsRewriterGenerator');
      const processor = this.container.resolve(
        'ITraitsRewriterResponseProcessor'
      );
      const enhancer = this.container.resolve('ITraitsRewriterDisplayEnhancer');
      const controller = this.container.resolve('ITraitsRewriterController');

      return {
        healthy: true,
        services: ['generator', 'processor', 'enhancer', 'controller'],
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async checkLLMConnection() {
    try {
      const llmService = this.container.resolve('ILlmJsonService');
      // Simple connection test (implementation depends on LLM service)
      return {
        healthy: true,
        connected: true,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async checkDependencies() {
    try {
      // Check critical dependencies
      const logger = this.container.resolve('ILogger');
      const eventBus = this.container.resolve('IEventBus');

      return {
        healthy: true,
        dependencies: ['logger', 'eventBus'],
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}
```

#### Deployment Validation Script

**File**: `scripts/validate-traits-rewriter-deployment.js`

```javascript
#!/usr/bin/env node
/**
 * @file Validate TraitsRewriter deployment
 */

import { TraitsRewriterHealthCheck } from '../src/health/traitsRewriterHealth.js';
import { createContainer } from '../src/dependencyInjection/containerBuilder.js';

async function validateDeployment() {
  console.log('🔍 Validating TraitsRewriter deployment...');

  try {
    // Initialize container
    const container = createContainer();
    const logger = container.resolve('ILogger');

    // Run health checks
    const healthCheck = new TraitsRewriterHealthCheck({ container, logger });
    const health = await healthCheck.checkHealth();

    if (health.healthy) {
      console.log('✅ TraitsRewriter deployment validation passed');
      console.log('📊 Health check results:', JSON.stringify(health, null, 2));
    } else {
      console.error('❌ TraitsRewriter deployment validation failed');
      console.error(
        '🚨 Health check failures:',
        JSON.stringify(health, null, 2)
      );
      process.exit(1);
    }

    // Test basic functionality
    console.log('🧪 Testing basic functionality...');
    await testBasicFunctionality(container);

    console.log('🎉 TraitsRewriter deployment validation complete');
  } catch (error) {
    console.error('💥 Deployment validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testBasicFunctionality(container) {
  const generator = container.resolve('ITraitsRewriterGenerator');

  const testCharacter = {
    'core:name': { text: 'Test Character' },
    'core:personality': { text: 'Friendly and helpful' },
  };

  const result = await generator.generateRewrittenTraits(testCharacter);

  if (!result || !result.rewrittenTraits) {
    throw new Error('Basic functionality test failed');
  }

  console.log('✅ Basic functionality test passed');
}

// Run validation
validateDeployment().catch(console.error);
```

### Rollback Plan

#### Rollback Procedures

**File**: `docs/deployment/rollback-procedures.md`

````markdown
# TraitsRewriter Rollback Procedures

## Rollback Triggers

- Health check failures
- High error rates (>5% of requests)
- Performance degradation (>10s average response time)
- User-reported issues affecting core functionality

## Rollback Steps

### 1. Immediate Rollback

```bash
# Disable TraitsRewriter feature
export TRAITS_REWRITER_ENABLED=false

# Restart application
npm run restart:production

# Verify rollback
curl -f http://localhost/health/traits-rewriter
```
````

### 2. Full Rollback

```bash
# Checkout previous working version
git checkout <previous-working-commit>

# Rebuild and deploy
npm run build
npm run deploy:production

# Validate rollback
npm run validate:deployment
```

### 3. Partial Rollback

```bash
# Disable specific problematic features
export TRAITS_REWRITER_GENERATION_ENABLED=false
export TRAITS_REWRITER_EXPORT_ENABLED=true

# Restart with partial functionality
npm run restart:production
```

## Post-Rollback Actions

1. Investigate root cause of issues
2. Fix issues in development environment
3. Run comprehensive testing
4. Plan redeployment strategy
5. Communicate with stakeholders

```

## Dependencies

**Blocking**:
- All TraitsRewriter service implementations (TRAREW-005 through TRAREW-009)
- Testing infrastructure validation (TRAREW-010 through TRAREW-013)

**External Dependencies**:
- Production environment access
- Monitoring and logging infrastructure
- LLM proxy server configuration
- Security review and approval

## Deployment Checklist

### Pre-Deployment
- [ ] Code review and approval completed
- [ ] All tests passing (unit, integration, e2e, performance)
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Monitoring and logging configured
- [ ] Environment variables configured
- [ ] Health checks implemented

### Deployment
- [ ] Build artifacts generated and validated
- [ ] Feature flags configured appropriately
- [ ] Database migrations applied (if needed)
- [ ] Environment configuration deployed
- [ ] Application deployed
- [ ] Health checks passing
- [ ] Monitoring alerts configured

### Post-Deployment
- [ ] Deployment validation tests passed
- [ ] Performance monitoring active
- [ ] Error tracking functional
- [ ] User acceptance validation
- [ ] Rollback procedures tested
- [ ] Documentation updated with any changes

## Success Metrics

- **Deployment Success**: Automated validation passes without errors
- **Service Health**: All health checks pass consistently
- **Performance**: Response times meet production requirements
- **Error Rates**: Error rates below acceptable thresholds
- **Security**: All security measures active and validated
- **Monitoring**: Full observability of system behavior

## Next Steps

After completion:
- **TRAREW-017**: Final validation and release preparation

## Implementation Checklist

- [ ] Configure build process for production optimization
- [ ] Set up environment variables and configuration
- [ ] Implement production logging and monitoring
- [ ] Configure error tracking and alerting
- [ ] Implement security measures (CSP, XSS protection)
- [ ] Create health check endpoints and validation
- [ ] Create deployment validation scripts
- [ ] Document rollback procedures and triggers
- [ ] Test deployment process in staging environment
- [ ] Validate monitoring and alerting functionality
- [ ] Review and approve security configuration
- [ ] Create deployment runbook and procedures
```
