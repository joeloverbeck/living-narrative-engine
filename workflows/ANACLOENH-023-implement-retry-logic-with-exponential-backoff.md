# ANACLOENH-023: Implement Retry Logic with Exponential Backoff

## Overview
Implement intelligent retry mechanisms with exponential backoff to handle transient failures and improve system resilience without overwhelming failing services.

## Objectives
1. Add exponential backoff retry logic
2. Implement intelligent retry decision making
3. Create jitter to prevent thundering herd
4. Add retry circuit breaker integration
5. Achieve 95% success rate for transient failures

## Technical Requirements

### Exponential Backoff Retry System
```javascript
// Location: src/common/resilience/ExponentialBackoffRetry.js
class ExponentialBackoffRetry {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 100;
    this.maxDelay = options.maxDelay || 5000;
    this.backoffFactor = options.backoffFactor || 2;
    this.jitterRange = options.jitterRange || 0.1;
    this.retryableErrors = options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  }
  
  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.calculateDelay(attempt));
        }
        
        return await operation();
        
      } catch (error) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt)) {
          break;
        }
        
        console.warn(`Retry attempt ${attempt + 1}/${this.maxRetries + 1} failed:`, error.message);
      }
    }
    
    throw lastError;
  }
  
  calculateDelay(attempt) {
    const baseDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt - 1);
    const jitter = this.addJitter(baseDelay);
    return Math.min(jitter, this.maxDelay);
  }
  
  addJitter(delay) {
    const jitter = delay * this.jitterRange * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }
  
  shouldRetry(error, attempt) {
    if (attempt >= this.maxRetries) return false;
    
    // Check if error is retryable
    const isRetryable = this.retryableErrors.some(code => 
      error.code === code || error.message.includes(code)
    );
    
    // Check error type
    if (error.name === 'ValidationError' || error.status === 400) {
      return false; // Don't retry client errors
    }
    
    return isRetryable || error.status >= 500;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Smart Retry Strategy
```javascript
// Location: src/common/resilience/SmartRetryStrategy.js
class SmartRetryStrategy {
  constructor() {
    this.strategies = new Map();
    this.setupDefaultStrategies();
  }
  
  setupDefaultStrategies() {
    // Fast operations - quick retries
    this.strategies.set('fast', new ExponentialBackoffRetry({
      maxRetries: 2,
      baseDelay: 50,
      maxDelay: 500
    }));
    
    // Standard operations
    this.strategies.set('standard', new ExponentialBackoffRetry({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 2000
    }));
    
    // Heavy operations - patient retries
    this.strategies.set('heavy', new ExponentialBackoffRetry({
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 5000
    }));
    
    // Critical operations - aggressive retries
    this.strategies.set('critical', new ExponentialBackoffRetry({
      maxRetries: 5,
      baseDelay: 200,
      maxDelay: 10000
    }));
  }
  
  async executeWithStrategy(strategyName, operation, context = {}) {
    const strategy = this.strategies.get(strategyName) || this.strategies.get('standard');
    return await strategy.execute(operation, context);
  }
  
  async executeWithAdaptiveStrategy(operation, context = {}) {
    const operationType = this.detectOperationType(context);
    return await this.executeWithStrategy(operationType, operation, context);
  }
  
  detectOperationType(context) {
    if (context.expectedTime < 100) return 'fast';
    if (context.expectedTime > 2000) return 'heavy';
    if (context.critical) return 'critical';
    return 'standard';
  }
}
```

### Service-Specific Retry Integration
```javascript
// Location: src/clothing/resilience/ClothingRetryService.js
class ClothingRetryService {
  constructor({ retryStrategy, circuitBreaker }) {
    this.retryStrategy = retryStrategy;
    this.circuitBreaker = circuitBreaker;
  }
  
  async executeWithRetry(operation, options = {}) {
    const { 
      strategy = 'standard',
      circuitBreakerEnabled = true,
      fallback = null
    } = options;
    
    const executeOperation = async () => {
      if (circuitBreakerEnabled) {
        return await this.circuitBreaker.execute(operation, fallback);
      } else {
        return await operation();
      }
    };
    
    return await this.retryStrategy.executeWithStrategy(
      strategy,
      executeOperation,
      options
    );
  }
  
  async retryAccessibilityQuery(entityId, mode, options = {}) {
    return await this.executeWithRetry(
      () => this.performAccessibilityQuery(entityId, mode),
      { 
        strategy: 'fast',
        expectedTime: 50,
        fallback: () => []
      }
    );
  }
  
  async retryEquipmentOperation(entityId, operation, options = {}) {
    return await this.executeWithRetry(
      () => this.performEquipmentOperation(entityId, operation),
      { 
        strategy: 'critical',
        critical: true,
        fallback: () => ({ success: false, reason: 'Operation failed after retries' })
      }
    );
  }
}
```

### Retry with Rate Limiting
```javascript
// Location: src/common/resilience/RateLimitedRetry.js
class RateLimitedRetry extends ExponentialBackoffRetry {
  constructor(options = {}) {
    super(options);
    this.rateLimiter = new TokenBucket({
      capacity: options.maxConcurrentRetries || 10,
      fillRate: options.retryRefillRate || 2
    });
  }
  
  async execute(operation, context = {}) {
    // Wait for rate limit token
    await this.rateLimiter.consume();
    
    try {
      return await super.execute(operation, context);
    } finally {
      // Token is automatically replenished by TokenBucket
    }
  }
}

class TokenBucket {
  constructor({ capacity, fillRate }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.fillRate = fillRate;
    this.lastRefill = Date.now();
  }
  
  async consume() {
    this.refill();
    
    if (this.tokens < 1) {
      // Wait for next token
      const waitTime = (1 / this.fillRate) * 1000;
      await this.delay(waitTime);
      return this.consume();
    }
    
    this.tokens--;
  }
  
  refill() {
    const now = Date.now();
    const tokensToAdd = ((now - this.lastRefill) / 1000) * this.fillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Implementation Steps

1. **Core Retry Engine** (Day 1-2)
   - Implement ExponentialBackoffRetry
   - Add jitter and backoff calculations
   - Create retry decision logic

2. **Smart Strategy System** (Day 3)
   - Build SmartRetryStrategy
   - Add adaptive strategy selection
   - Create operation type detection

3. **Service Integration** (Day 4)
   - Integrate with clothing services
   - Integrate with anatomy services
   - Add circuit breaker coordination

4. **Rate Limiting** (Day 5)
   - Implement RateLimitedRetry
   - Add token bucket rate limiter
   - Prevent retry storms

5. **Testing and Monitoring** (Day 6)
   - Test retry scenarios
   - Validate exponential backoff
   - Add retry metrics collection

## File Changes

### New Files
- `src/common/resilience/ExponentialBackoffRetry.js`
- `src/common/resilience/SmartRetryStrategy.js`
- `src/common/resilience/RateLimitedRetry.js`
- `src/clothing/resilience/ClothingRetryService.js`
- `src/anatomy/resilience/AnatomyRetryService.js`

### Modified Files
- `src/clothing/facades/ClothingSystemFacade.js` - Add retry integration
- `src/anatomy/facades/AnatomySystemFacade.js` - Add retry integration
- All service classes - Add retry-aware methods

### Test Files
- `tests/unit/common/resilience/ExponentialBackoffRetry.test.js`
- `tests/unit/common/resilience/SmartRetryStrategy.test.js`
- `tests/integration/resilience/retryIntegration.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-022 (Circuit Breakers)
- **Internal**: Circuit breakers, error handling system

## Acceptance Criteria
1. ✅ Exponential backoff implemented correctly
2. ✅ Jitter prevents thundering herd problems
3. ✅ Smart strategy selection based on operation type
4. ✅ Rate limiting prevents retry storms
5. ✅ 95% success rate for transient failures
6. ✅ Integration with circuit breakers
7. ✅ Comprehensive retry metrics collection

## Estimated Effort: 6 days
## Success Metrics: 95% transient failure recovery, <500ms average retry delay, zero retry storms