# DEBUGLOGGING-022: Optimize Batch Sizes and Compression

**Status**: Not Started  
**Priority**: P2 - Medium  
**Phase**: 4 - Monitoring  
**Component**: Performance Optimization  
**Estimated**: 4 hours

## Description

Implement dynamic batch size optimization and compression to minimize network usage and improve transmission efficiency. This includes adaptive batching based on network conditions and content compression.

## Technical Requirements

### 1. Dynamic Batch Sizing

```javascript
class AdaptiveBatchSizer {
  constructor(config) {
    this.minBatchSize = config.minBatchSize || 10;
    this.maxBatchSize = config.maxBatchSize || 1000;
    this.targetLatency = config.targetLatency || 100; // ms
    this.currentBatchSize = config.initialBatchSize || 100;
    this.adjustmentFactor = config.adjustmentFactor || 0.1;
  }

  adjustBatchSize(metrics) {
    const avgLatency = metrics.getAverageLatency();
    const networkQuality = this.assessNetworkQuality(metrics);

    if (avgLatency > this.targetLatency) {
      // Decrease batch size to reduce latency
      this.currentBatchSize = Math.max(
        this.minBatchSize,
        this.currentBatchSize * (1 - this.adjustmentFactor)
      );
    } else if (avgLatency < this.targetLatency * 0.5) {
      // Increase batch size for efficiency
      this.currentBatchSize = Math.min(
        this.maxBatchSize,
        this.currentBatchSize * (1 + this.adjustmentFactor)
      );
    }

    return Math.round(this.currentBatchSize);
  }
}
```

### 2. Compression Strategy

```javascript
class CompressionManager {
  constructor(config) {
    this.enabled = config.enabled || false;
    this.threshold = config.threshold || 1024; // bytes
    this.algorithm = config.algorithm || 'gzip';
    this.level = config.level || 6; // 1-9
  }

  async compress(data) {
    const jsonString = JSON.stringify(data);

    // Skip compression for small payloads
    if (jsonString.length < this.threshold) {
      return { data: jsonString, compressed: false };
    }

    const compressed = await this.compressData(jsonString);

    // Only use compression if it provides significant savings
    if (compressed.length < jsonString.length * 0.8) {
      return { data: compressed, compressed: true };
    }

    return { data: jsonString, compressed: false };
  }
}
```

### 3. Batch Optimization Metrics

```javascript
const BATCH_METRICS = {
  // Size metrics
  averageBatchSize: 0,
  averagePayloadSize: 0,
  compressionRatio: 0,

  // Performance metrics
  batchProcessingTime: [],
  transmissionTime: [],
  endToEndLatency: [],

  // Network metrics
  bandwidth: 0,
  packetLoss: 0,
  networkLatency: 0,

  // Efficiency metrics
  bytesPerSecond: 0,
  logsPerSecond: 0,
  networkUtilization: 0,
};
```

## Implementation Steps

1. **Create Adaptive Batch Sizer**
   - [ ] Create `src/logging/optimization/adaptiveBatchSizer.js`
   - [ ] Implement batch size adjustment algorithm
   - [ ] Add network quality assessment
   - [ ] Implement performance tracking

2. **Batch Size Optimization**

   ```javascript
   export class AdaptiveBatchSizer {
     adjustBatchSize(metrics) {
       const networkConditions = this.analyzeNetwork(metrics);
       const performanceMetrics = this.analyzePerformance(metrics);

       // Calculate optimal batch size based on conditions
       const optimal = this.calculateOptimalSize(
         networkConditions,
         performanceMetrics
       );

       // Apply gradual adjustment
       const adjusted = this.gradualAdjustment(this.currentBatchSize, optimal);

       this.currentBatchSize = Math.round(adjusted);
       return this.currentBatchSize;
     }

     analyzeNetwork(metrics) {
       return {
         bandwidth: this.estimateBandwidth(metrics.transmissionTimes),
         latency: this.calculateAverageLatency(metrics.transmissionTimes),
         reliability: this.calculateReliability(metrics.successRate),
         congestion: this.detectCongestion(metrics.retryRate),
       };
     }

     calculateOptimalSize(network, performance) {
       // Start with current size
       let optimal = this.currentBatchSize;

       // Adjust based on network bandwidth
       if (network.bandwidth > 1000000) {
         // > 1Mbps
         optimal *= 1.5;
       } else if (network.bandwidth < 100000) {
         // < 100Kbps
         optimal *= 0.7;
       }

       // Adjust based on latency
       if (network.latency > 200) {
         // High latency
         optimal *= 1.2; // Larger batches
       } else if (network.latency < 50) {
         // Low latency
         optimal *= 0.9; // Smaller batches OK
       }

       // Constrain to limits
       return Math.max(this.minBatchSize, Math.min(this.maxBatchSize, optimal));
     }
   }
   ```

3. **Create Compression Manager**
   - [ ] Create `src/logging/optimization/compressionManager.js`
   - [ ] Implement compression algorithms
   - [ ] Add compression threshold logic
   - [ ] Implement efficiency checking

4. **Compression Implementation**

   ```javascript
   export class CompressionManager {
     async compressPayload(logs) {
       const originalSize = JSON.stringify(logs).length;

       // Try different compression approaches
       const strategies = [
         () => this.compressJSON(logs),
         () => this.compressWithDictionary(logs),
         () => this.deltCompression(logs),
       ];

       let bestResult = { data: logs, compressed: false, ratio: 1.0 };

       for (const strategy of strategies) {
         try {
           const result = await strategy();
           if (result.size < bestResult.size) {
             bestResult = result;
           }
         } catch (error) {
           // Strategy failed, continue with others
         }
       }

       // Only use compression if significant improvement
       if (bestResult.ratio < 0.8) {
         return bestResult;
       }

       return { data: logs, compressed: false, ratio: 1.0 };
     }

     compressJSON(logs) {
       // Standard gzip compression
       const jsonString = JSON.stringify(logs);
       const compressed = pako.gzip(jsonString);

       return {
         data: compressed,
         compressed: true,
         algorithm: 'gzip',
         originalSize: jsonString.length,
         compressedSize: compressed.length,
         ratio: compressed.length / jsonString.length,
       };
     }

     compressWithDictionary(logs) {
       // Use common log patterns as dictionary
       const dictionary = this.buildDictionary(logs);
       const compressed = this.compressWithDict(logs, dictionary);

       return {
         data: compressed,
         dictionary: dictionary,
         compressed: true,
         algorithm: 'dictionary',
       };
     }
   }
   ```

5. **Create Network Quality Analyzer**

   ```javascript
   class NetworkQualityAnalyzer {
     analyze(metrics) {
       const bandwidth = this.estimateBandwidth(metrics);
       const latency = this.measureLatency(metrics);
       const stability = this.assessStability(metrics);

       return {
         quality: this.calculateOverallQuality(bandwidth, latency, stability),
         recommendations: this.generateRecommendations(
           bandwidth,
           latency,
           stability
         ),
       };
     }

     generateRecommendations(bandwidth, latency, stability) {
       const recommendations = [];

       if (bandwidth < 100000) {
         // < 100Kbps
         recommendations.push({
           type: 'batch_size',
           action: 'decrease',
           reason: 'Low bandwidth detected',
         });
         recommendations.push({
           type: 'compression',
           action: 'enable',
           reason: 'Compression beneficial for low bandwidth',
         });
       }

       if (latency > 500) {
         // > 500ms
         recommendations.push({
           type: 'batch_size',
           action: 'increase',
           reason: 'High latency - batch more efficiently',
         });
       }

       return recommendations;
     }
   }
   ```

6. **Integration with RemoteLogger**

   ```javascript
   // Enhanced RemoteLogger with optimization
   class OptimizedRemoteLogger extends RemoteLogger {
     constructor(config) {
       super(config);
       this.batchSizer = new AdaptiveBatchSizer(config.batching);
       this.compressor = new CompressionManager(config.compression);
       this.optimizer = new BatchOptimizer(config.optimization);
     }

     async flush() {
       if (this.buffer.length === 0) return;

       // Optimize batch size
       const optimalSize = this.batchSizer.getCurrentBatchSize();
       const batches = this.createOptimalBatches(this.buffer, optimalSize);

       for (const batch of batches) {
         await this.sendOptimizedBatch(batch);
       }
     }

     async sendOptimizedBatch(logs) {
       // Compress if beneficial
       const compressed = await this.compressor.compress(logs);

       // Send with optimization headers
       const headers = {
         'Content-Type': 'application/json',
         'X-Batch-Size': logs.length,
         'X-Original-Size': JSON.stringify(logs).length,
       };

       if (compressed.compressed) {
         headers['Content-Encoding'] = compressed.algorithm;
         headers['X-Compression-Ratio'] = compressed.ratio;
       }

       return this.sendBatch(compressed.data, headers);
     }
   }
   ```

## Acceptance Criteria

- [ ] Batch size adapts to network conditions
- [ ] Compression reduces payload size by >20%
- [ ] Network quality assessment works
- [ ] Optimization doesn't increase latency
- [ ] Memory usage remains reasonable
- [ ] Configuration allows tuning
- [ ] Metrics track optimization effectiveness
- [ ] Fallback to uncompressed works

## Dependencies

- **Enhances**: DEBUGLOGGING-006 (RemoteLogger)
- **Uses**: DEBUGLOGGING-020 (metrics)
- **May Require**: pako library for compression

## Testing Requirements

1. **Unit Tests**
   - [ ] Test batch size calculations
   - [ ] Test compression algorithms
   - [ ] Test network analysis
   - [ ] Test optimization logic

2. **Performance Tests**
   - [ ] Test with various network conditions
   - [ ] Test compression effectiveness
   - [ ] Test memory usage
   - [ ] Test optimization overhead

3. **Integration Tests**
   - [ ] Test with real network conditions
   - [ ] Test end-to-end optimization
   - [ ] Test fallback scenarios

## Files to Create/Modify

- **Create**: `src/logging/optimization/adaptiveBatchSizer.js`
- **Create**: `src/logging/optimization/compressionManager.js`
- **Create**: `src/logging/optimization/networkAnalyzer.js`
- **Create**: `src/logging/optimization/batchOptimizer.js`
- **Modify**: `src/logging/remoteLogger.js`
- **Create**: `tests/unit/logging/optimization/`

## Compression Algorithms

```javascript
const COMPRESSION_OPTIONS = {
  gzip: {
    algorithm: 'gzip',
    level: 6,
    threshold: 1024,
    effectiveness: 0.6, // 60% size reduction typical
  },

  lz4: {
    algorithm: 'lz4',
    level: 1,
    threshold: 512,
    effectiveness: 0.8, // Less compression, faster
    speed: 'fast',
  },

  dictionary: {
    algorithm: 'dictionary',
    buildTime: 'startup',
    effectiveness: 0.4, // 60% reduction for repetitive logs
    updateInterval: 3600000, // 1 hour
  },
};
```

## Performance Monitoring

```javascript
// Track optimization metrics
{
  "optimization": {
    "batchSizeChanges": 15,
    "averageBatchSize": 85,
    "compressionEnabled": true,
    "averageCompressionRatio": 0.65,
    "bytesSaved": 245760,
    "networkUtilization": 0.75
  },
  "recommendations": [
    {
      "type": "batch_size",
      "current": 85,
      "suggested": 120,
      "reason": "Network can handle larger batches"
    }
  ]
}
```

## Notes

- Consider implementing brotli compression
- May need different strategies for different log types
- Think about client-side vs server-side compression
- Consider batch deduplcation
- Monitor CPU impact of compression

## Related Tickets

- **Enhances**: DEBUGLOGGING-006
- **Uses**: DEBUGLOGGING-020
- **Related**: DEBUGLOGGING-021 (reliability)
