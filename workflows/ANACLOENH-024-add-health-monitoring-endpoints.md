# ANACLOENH-024: Add Health Monitoring Endpoints

## Overview
Implement comprehensive health monitoring endpoints for all clothing and anatomy services to enable proactive monitoring, alerting, and system observability.

## Objectives
1. Create health check endpoints for all services
2. Implement service dependency health monitoring
3. Add detailed health metrics and status reporting
4. Create health aggregation and reporting dashboard
5. Enable proactive system health monitoring

## Technical Requirements

### Health Check Framework
```javascript
// Location: src/common/health/HealthCheckFramework.js
class HealthCheckFramework {
  constructor() {
    this.checks = new Map();
    this.aggregator = new HealthAggregator();
    this.reporter = new HealthReporter();
  }
  
  registerHealthCheck(name, healthCheck) {
    this.checks.set(name, {
      check: healthCheck,
      lastResult: null,
      lastCheck: null
    });
  }
  
  async runHealthChecks() {
    const results = new Map();
    
    for (const [name, checkInfo] of this.checks.entries()) {
      try {
        const startTime = Date.now();
        const result = await checkInfo.check.execute();
        const endTime = Date.now();
        
        const healthResult = {
          name,
          status: result.healthy ? 'healthy' : 'unhealthy',
          message: result.message || '',
          details: result.details || {},
          responseTime: endTime - startTime,
          timestamp: new Date().toISOString(),
          dependencies: result.dependencies || []
        };
        
        results.set(name, healthResult);
        checkInfo.lastResult = healthResult;
        checkInfo.lastCheck = endTime;
        
      } catch (error) {
        results.set(name, {
          name,
          status: 'error',
          message: error.message,
          responseTime: -1,
          timestamp: new Date().toISOString(),
          error: true
        });
      }
    }
    
    return this.aggregator.aggregate(results);
  }
  
  async getHealthStatus() {
    const results = await this.runHealthChecks();
    
    return {
      status: results.overallStatus,
      timestamp: new Date().toISOString(),
      services: Array.from(results.serviceResults.values()),
      summary: results.summary
    };
  }
}
```

### Service Health Checks
```javascript
// Location: src/clothing/health/ClothingHealthChecks.js
class ClothingHealthChecks {
  constructor({ facade, cache, logger }) {
    this.facade = facade;
    this.cache = cache;
    this.logger = logger;
  }
  
  createAccessibilityHealthCheck() {
    return {
      name: 'clothing-accessibility',
      async execute() {
        try {
          // Test basic accessibility query
          const testEntityId = 'health-check-entity';
          const startTime = Date.now();
          
          // Mock a simple accessibility check
          const result = await this.facade.checkHealthQuery(testEntityId);
          const responseTime = Date.now() - startTime;
          
          return {
            healthy: true,
            message: 'Accessibility service operational',
            details: {
              responseTime: `${responseTime}ms`,
              cacheStatus: this.cache.getStats().healthy,
              lastQuery: new Date().toISOString()
            },
            dependencies: ['entity-manager', 'unified-cache']
          };
          
        } catch (error) {
          return {
            healthy: false,
            message: `Accessibility service error: ${error.message}`,
            details: { error: error.stack }
          };
        }
      }
    };
  }
  
  createEquipmentHealthCheck() {
    return {
      name: 'clothing-equipment',
      async execute() {
        try {
          const stats = await this.facade.getSystemStats();
          
          return {
            healthy: stats.operational,
            message: stats.operational ? 'Equipment service healthy' : 'Equipment service degraded',
            details: {
              activeOperations: stats.activeOperations,
              cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
              errorRate: `${(stats.errorRate * 100).toFixed(2)}%`
            },
            dependencies: ['clothing-accessibility', 'clothing-validation']
          };
          
        } catch (error) {
          return {
            healthy: false,
            message: `Equipment service error: ${error.message}`,
            details: { error: error.message }
          };
        }
      }
    };
  }
  
  createValidationHealthCheck() {
    return {
      name: 'clothing-validation',
      async execute() {
        // Test validation functionality
        const testValidation = {
          entityId: 'test',
          itemId: 'test-item',
          slot: 'torso'
        };
        
        try {
          const validationResult = await this.facade.checkItemCompatibility(
            testValidation.entityId,
            testValidation.itemId,
            testValidation.slot
          );
          
          return {
            healthy: true,
            message: 'Validation service operational',
            details: {
              validationResponse: validationResult?.isCompatible !== undefined,
              validationTime: '<50ms'
            }
          };
          
        } catch (error) {
          return {
            healthy: false,
            message: `Validation error: ${error.message}`
          };
        }
      }
    };
  }
}
```

### Anatomy Health Checks
```javascript
// Location: src/anatomy/health/AnatomyHealthChecks.js
class AnatomyHealthChecks {
  constructor({ facade, graphValidator, cache }) {
    this.facade = facade;
    this.graphValidator = graphValidator;
    this.cache = cache;
  }
  
  createGraphHealthCheck() {
    return {
      name: 'anatomy-graph',
      async execute() {
        try {
          // Test graph operations
          const testGraph = { nodes: [], edges: [] };
          const validation = await this.graphValidator.validate(testGraph);
          
          return {
            healthy: validation.valid,
            message: validation.valid ? 'Graph service healthy' : 'Graph validation issues',
            details: {
              validationTime: validation.responseTime || '<100ms',
              graphComplexity: 'minimal',
              cacheStats: this.cache.getStats()
            },
            dependencies: ['anatomy-validation', 'unified-cache']
          };
          
        } catch (error) {
          return {
            healthy: false,
            message: `Graph service error: ${error.message}`
          };
        }
      }
    };
  }
  
  createDescriptionHealthCheck() {
    return {
      name: 'anatomy-description',
      async execute() {
        try {
          const testDescription = await this.facade.generateDescription(
            'health-test-entity',
            { level: 'summary', format: 'text' }
          );
          
          return {
            healthy: testDescription !== null,
            message: 'Description service operational',
            details: {
              descriptionLength: testDescription?.length || 0,
              generationTime: '<200ms'
            }
          };
          
        } catch (error) {
          return {
            healthy: false,
            message: `Description service error: ${error.message}`
          };
        }
      }
    };
  }
}
```

### Health Monitoring Dashboard
```javascript
// Location: src/domUI/health/HealthMonitoringDashboard.js
class HealthMonitoringDashboard {
  constructor(container, healthFramework) {
    this.container = container;
    this.healthFramework = healthFramework;
    this.updateInterval = null;
  }
  
  initialize() {
    this.createDashboard();
    this.startRealTimeUpdates();
  }
  
  createDashboard() {
    this.container.innerHTML = `
      <div class="health-dashboard">
        <div class="dashboard-header">
          <h2>System Health Monitoring</h2>
          <div class="overall-status" id="overall-status">
            <span class="status-indicator" id="status-indicator"></span>
            <span class="status-text" id="status-text">Checking...</span>
          </div>
        </div>
        
        <div class="health-grid" id="health-grid">
          <!-- Health check cards will be populated here -->
        </div>
        
        <div class="health-details">
          <div class="dependency-graph" id="dependency-graph">
            <h3>Service Dependencies</h3>
            <div id="dependency-visualization"></div>
          </div>
          
          <div class="health-metrics" id="health-metrics">
            <h3>Health Metrics</h3>
            <div id="metrics-display"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  async updateHealthDisplay() {
    try {
      const healthStatus = await this.healthFramework.getHealthStatus();
      
      this.updateOverallStatus(healthStatus);
      this.updateServiceCards(healthStatus.services);
      this.updateDependencyGraph(healthStatus.services);
      this.updateMetrics(healthStatus.summary);
      
    } catch (error) {
      console.error('Health dashboard update error:', error);
      this.showError('Failed to update health status');
    }
  }
  
  updateOverallStatus(healthStatus) {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    const statusClass = healthStatus.status === 'healthy' ? 'healthy' : 
                       healthStatus.status === 'degraded' ? 'warning' : 'error';
    
    indicator.className = `status-indicator ${statusClass}`;
    statusText.textContent = healthStatus.status.toUpperCase();
  }
  
  startRealTimeUpdates() {
    this.updateHealthDisplay(); // Initial update
    
    this.updateInterval = setInterval(() => {
      this.updateHealthDisplay();
    }, 30000); // Update every 30 seconds
  }
}
```

### Health API Endpoints
```javascript
// Location: src/api/health/HealthEndpoints.js
class HealthEndpoints {
  constructor(healthFramework) {
    this.healthFramework = healthFramework;
  }
  
  setupRoutes(app) {
    // Overall health status
    app.get('/health', async (req, res) => {
      try {
        const health = await this.healthFramework.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Individual service health
    app.get('/health/:service', async (req, res) => {
      try {
        const serviceName = req.params.service;
        const health = await this.healthFramework.getServiceHealth(serviceName);
        
        if (!health) {
          return res.status(404).json({
            error: 'Service not found',
            service: serviceName
          });
        }
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
        
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Health metrics
    app.get('/health/metrics', async (req, res) => {
      try {
        const metrics = await this.healthFramework.getHealthMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}
```

## Implementation Steps

1. **Core Health Framework** (Day 1-2)
   - Build HealthCheckFramework
   - Create health check base classes
   - Add result aggregation logic

2. **Service Health Checks** (Day 3)
   - Implement clothing service health checks
   - Implement anatomy service health checks
   - Add dependency health monitoring

3. **Health Dashboard** (Day 4)
   - Create health monitoring dashboard
   - Add real-time status updates
   - Implement dependency visualization

4. **API Endpoints** (Day 5)
   - Create health check REST endpoints
   - Add service-specific health routes
   - Implement health metrics API

5. **Integration and Testing** (Day 6)
   - Integrate with main application
   - Test health check accuracy
   - Validate monitoring capabilities

## File Changes

### New Files
- `src/common/health/HealthCheckFramework.js`
- `src/clothing/health/ClothingHealthChecks.js`
- `src/anatomy/health/AnatomyHealthChecks.js`
- `src/domUI/health/HealthMonitoringDashboard.js`
- `src/api/health/HealthEndpoints.js`

### Modified Files
- `src/main.js` - Initialize health monitoring
- `src/clothing/facades/ClothingSystemFacade.js` - Add health methods
- `src/anatomy/facades/AnatomySystemFacade.js` - Add health methods

### Test Files
- `tests/unit/common/health/HealthCheckFramework.test.js`
- `tests/integration/health/healthMonitoring.test.js`
- `tests/api/health/healthEndpoints.test.js`

## Dependencies
- **Prerequisites**: All facade implementations, monitoring infrastructure
- **Internal**: All services and facades

## Acceptance Criteria
1. ✅ Health checks for all critical services
2. ✅ Real-time health monitoring dashboard
3. ✅ REST API endpoints for health status
4. ✅ Service dependency health tracking
5. ✅ Health check response time <500ms
6. ✅ Comprehensive health metrics collection
7. ✅ Automatic health status alerting

## Estimated Effort: 6 days
## Success Metrics: 100% service coverage, <500ms health check response, 99% health check accuracy