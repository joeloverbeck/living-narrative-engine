# ANACLOENH-022: Add Circuit Breakers to All Services

## Overview
Implement comprehensive circuit breaker pattern across all clothing and anatomy services to prevent cascading failures and provide graceful degradation under system stress.

## Objectives
1. Add circuit breakers to all service calls
2. Implement adaptive failure thresholds
3. Create service health monitoring
4. Add automatic recovery mechanisms
5. Achieve 99.9% system availability under failure conditions

## Technical Requirements

### Universal Circuit Breaker
```javascript
// Location: src/common/resilience/UniversalCircuitBreaker.js
class UniversalCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000;
    this.monitoringWindow = options.monitoringWindow || 60000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.recentResults = [];
  }
  
  async execute(operation, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        return this.handleOpenCircuit(fallback);
      }
    }
    
    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess(result);
      return result;
    } catch (error) {
      this.onFailure(error);
      
      if (fallback) {
        return await fallback(error);
      }
      
      throw error;
    }
  }
  
  onSuccess(result) {
    this.recordResult(true);
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }
  
  onFailure(error) {
    this.recordResult(false);
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.shouldTrip()) {
      this.trip();
    }
  }
  
  shouldTrip() {
    if (this.state === 'OPEN') return false;
    
    // Check recent failure rate
    const recentFailures = this.getRecentFailureRate();
    return this.failureCount >= this.failureThreshold || recentFailures > 0.5;
  }
  
  trip() {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.timeout;
    console.warn(`Circuit breaker tripped: ${this.failureCount} failures`);
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    console.info('Circuit breaker reset to CLOSED state');
  }
}
```

### Service-Specific Circuit Breakers
```javascript
// Location: src/clothing/resilience/ClothingCircuitBreakers.js
class ClothingCircuitBreakers {
  constructor() {
    this.breakers = {
      accessibility: new UniversalCircuitBreaker({
        failureThreshold: 3,
        timeout: 15000
      }),
      
      equipment: new UniversalCircuitBreaker({
        failureThreshold: 5,
        timeout: 20000
      }),
      
      validation: new UniversalCircuitBreaker({
        failureThreshold: 2,
        timeout: 10000
      })
    };
  }
  
  async executeAccessibilityQuery(operation) {
    return await this.breakers.accessibility.execute(
      operation,
      () => [] // Return empty array as fallback
    );
  }
  
  async executeEquipmentOperation(operation) {
    return await this.breakers.equipment.execute(
      operation,
      () => ({ success: false, cached: true })
    );
  }
  
  getHealthStatus() {
    return Object.entries(this.breakers).map(([name, breaker]) => ({
      service: name,
      state: breaker.state,
      failureCount: breaker.failureCount,
      healthy: breaker.state === 'CLOSED'
    }));
  }
}
```

### Anatomy Circuit Breakers
```javascript
// Location: src/anatomy/resilience/AnatomyCircuitBreakers.js
class AnatomyCircuitBreakers {
  constructor() {
    this.breakers = {
      graphBuilder: new UniversalCircuitBreaker({
        failureThreshold: 2,
        timeout: 30000 // Longer timeout for complex operations
      }),
      
      validator: new UniversalCircuitBreaker({
        failureThreshold: 3,
        timeout: 15000
      }),
      
      descriptionComposer: new UniversalCircuitBreaker({
        failureThreshold: 4,
        timeout: 10000
      })
    };
  }
  
  async executeGraphOperation(operation) {
    return await this.breakers.graphBuilder.execute(
      operation,
      () => ({ nodes: [], edges: [], cached: true })
    );
  }
  
  async executeValidation(operation) {
    return await this.breakers.validator.execute(
      operation,
      () => ({ valid: true, warnings: ['Validation skipped - circuit open'] })
    );
  }
}
```

### Circuit Breaker Middleware
```javascript
// Location: src/common/middleware/CircuitBreakerMiddleware.js
class CircuitBreakerMiddleware {
  constructor(circuitBreaker) {
    this.circuitBreaker = circuitBreaker;
  }
  
  wrapService(service, methods = []) {
    const wrappedService = {};
    
    const methodsToWrap = methods.length > 0 ? methods : 
      Object.getOwnPropertyNames(Object.getPrototypeOf(service))
        .filter(name => typeof service[name] === 'function' && name !== 'constructor');
    
    for (const methodName of methodsToWrap) {
      wrappedService[methodName] = async (...args) => {
        return await this.circuitBreaker.execute(
          () => service[methodName](...args)
        );
      };
    }
    
    return wrappedService;
  }
}
```

## Implementation Steps

1. **Core Circuit Breaker Implementation** (Day 1-2)
   - Build UniversalCircuitBreaker
   - Add state management logic
   - Create timeout and recovery mechanisms

2. **Service-Specific Breakers** (Day 3)
   - Implement ClothingCircuitBreakers
   - Implement AnatomyCircuitBreakers
   - Add service-specific fallbacks

3. **Middleware Integration** (Day 4)
   - Create circuit breaker middleware
   - Add automatic service wrapping
   - Integrate with facades

4. **Health Monitoring** (Day 5)
   - Add circuit breaker health endpoints
   - Create monitoring dashboard
   - Implement alert integration

5. **Testing and Validation** (Day 6)
   - Test failure scenarios
   - Validate recovery mechanisms
   - Performance impact testing

## File Changes

### New Files
- `src/common/resilience/UniversalCircuitBreaker.js`
- `src/clothing/resilience/ClothingCircuitBreakers.js`
- `src/anatomy/resilience/AnatomyCircuitBreakers.js`
- `src/common/middleware/CircuitBreakerMiddleware.js`

### Modified Files
- `src/clothing/facades/ClothingSystemFacade.js` - Add circuit breaker integration
- `src/anatomy/facades/AnatomySystemFacade.js` - Add circuit breaker integration
- `src/dependencyInjection/registrations/resilienceRegistrations.js`

### Test Files
- `tests/unit/common/resilience/UniversalCircuitBreaker.test.js`
- `tests/integration/resilience/circuitBreakerIntegration.test.js`
- `tests/resilience/failureRecovery.test.js`

## Dependencies
- **Prerequisites**: ANACLOENH-004 (Error Handling Framework)
- **Internal**: All service facades, error handling system

## Acceptance Criteria
1. ✅ All services protected by circuit breakers
2. ✅ Automatic failure detection and recovery
3. ✅ Graceful degradation under failure conditions
4. ✅ 99.9% system availability maintained
5. ✅ Circuit breaker states monitored and logged
6. ✅ Performance overhead <2%
7. ✅ Fallback mechanisms provide meaningful responses

## Estimated Effort: 6 days
## Success Metrics: 99.9% availability, <2% performance overhead, 100% service coverage