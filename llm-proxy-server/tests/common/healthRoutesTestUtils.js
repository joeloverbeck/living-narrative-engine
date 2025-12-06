import express from 'express';

import createHealthRoutes from '../../src/routes/healthRoutes.js';

class InMemoryCacheService {
  constructor() {
    this.#store = new Map();
  }

  #store;

  set(key, value, ttl) {
    const ttlMs = typeof ttl === 'number' ? ttl : 1000;
    this.#store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key) {
    const entry = this.#store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  invalidate(key) {
    this.#store.delete(key);
  }

  getSize() {
    return this.#store.size;
  }

  getMemoryInfo() {
    return {
      keys: this.#store.size,
    };
  }
}

class MinimalHttpAgentService {
  cleanup() {
    // No-op cleanup method to satisfy the interface
  }

  getAgent() {
    return {
      keepAlive: true,
    };
  }

  getStats() {
    return {
      activeAgents: 0,
      totalRequests: 0,
      memoryUsage: null,
    };
  }
}

export const createOperationalLlmConfigService = () => ({
  isOperational: () => true,
  getLlmConfigs: () => ({
    defaultConfigId: 'healthy-config',
    configs: {
      'healthy-config': {
        name: 'Healthy LLM',
      },
    },
  }),
  getInitializationErrorDetails: () => null,
  getResolvedConfigPath: () => '/tmp/healthy-config.json',
});

export const createDegradedLlmConfigService = ({
  message = 'Service not operational',
  stage = 'initialization_failure',
} = {}) => ({
  isOperational: () => false,
  getLlmConfigs: () => ({ configs: {} }),
  getInitializationErrorDetails: () => ({
    message,
    stage,
  }),
  getResolvedConfigPath: () => '/tmp/unhealthy-config.json',
});

export const createExceptionalLlmConfigService = (error) => ({
  isOperational: () => {
    throw error;
  },
  getLlmConfigs: () => ({ configs: {} }),
  getInitializationErrorDetails: () => ({
    message: error.message,
    stage: 'unexpected',
  }),
  getResolvedConfigPath: () => '/tmp/exceptional-config.json',
});

export const createCacheService = () => new InMemoryCacheService();

export const createHttpAgentService = () => new MinimalHttpAgentService();

export const createAppConfigService = ({
  nodeEnv = 'test',
  proxyPort = 4100,
} = {}) => ({
  getNodeEnv: () => nodeEnv,
  getProxyPort: () => proxyPort,
});

export const buildHealthRoutesApp = ({
  llmConfigService = createOperationalLlmConfigService(),
  cacheService = null,
  httpAgentService = null,
  appConfigService = null,
  logger = null,
} = {}) => {
  if (!llmConfigService) {
    throw new Error(
      'llmConfigService is required to build the health routes app'
    );
  }

  const app = express();

  app.use(
    '/health',
    createHealthRoutes({
      llmConfigService,
      cacheService,
      httpAgentService,
      appConfigService,
      logger,
    })
  );

  return {
    app,
    dependencies: {
      llmConfigService,
      cacheService,
      httpAgentService,
      appConfigService,
    },
  };
};
