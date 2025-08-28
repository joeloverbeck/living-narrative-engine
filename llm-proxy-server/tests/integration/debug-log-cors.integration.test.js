/**
 * @file debug-log-cors.integration.test.js
 * @description Integration tests specifically for CORS handling on the debug-log endpoint
 * Ensures the debug-log endpoint properly handles CORS requests from all allowed origins
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { getAppConfigService } from '../../src/config/appConfig.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import debugRoutes from '../../src/routes/debugRoutes.js';
import {
  createSecurityMiddleware,
} from '../../src/middleware/security.js';
import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';

describe('Debug Log CORS Integration Tests', () => {
  let app;
  let server;
  let mockLogger;
  let originalEnv;

  beforeEach(async () => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set up CORS configuration to include both localhost and 127.0.0.1 on both ports
    process.env.PROXY_ALLOWED_ORIGIN =
      'http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081';

    // Create mock logger
    mockLogger = new ConsoleLogger();
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'info').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'error').mockImplementation(() => {});

    // Create Express application with proper CORS configuration
    app = express();

    // Apply security middleware
    app.use(createSecurityMiddleware());

    // Get app config and configure CORS
    const appConfigService = getAppConfigService(mockLogger);
    const allowedOriginsArray = appConfigService.getAllowedOriginsArray();

    if (allowedOriginsArray.length > 0) {
      const corsOptions = {
        origin: allowedOriginsArray,
        methods: ['POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Title', 'HTTP-Referer'],
      };
      app.use(cors(corsOptions));
    }

    // Apply other middleware
    app.use(createTimeoutMiddleware(30000));
    app.use(express.json(createSizeLimitConfig()));

    // Register debug routes
    app.use('/api/debug-log', debugRoutes);

    // Start server on random port for testing
    server = app.listen(0);
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    jest.clearAllMocks();
  });

  const validDebugLogRequest = {
    logs: [
      {
        level: 'info',
        message: 'Test CORS log message',
        timestamp: '2024-01-01T12:00:00.000Z',
        category: 'test',
        source: 'cors-test.js:123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { testType: 'cors' },
      },
    ],
  };

  describe('CORS Preflight (OPTIONS) Requests', () => {
    /**
     * Test preflight from localhost:8080
     */
    test('should handle CORS preflight from localhost:8080', async () => {
      const response = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:8080'
      );
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type'
      );
    });

    /**
     * Test preflight from 127.0.0.1:8080 (the origin from the error logs)
     */
    test('should handle CORS preflight from 127.0.0.1:8080', async () => {
      const response = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8080')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8080'
      );
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type'
      );
    });

    /**
     * Test preflight from localhost:8081 (fallback port)
     */
    test('should handle CORS preflight from localhost:8081', async () => {
      const response = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://localhost:8081')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:8081'
      );
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    /**
     * Test preflight from 127.0.0.1:8081 (fallback port)
     */
    test('should handle CORS preflight from 127.0.0.1:8081', async () => {
      const response = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8081')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8081'
      );
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('CORS POST Requests', () => {
    /**
     * Test actual POST request from localhost:8080
     */
    test('should handle POST request from localhost:8080', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://localhost:8080')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:8080'
      );
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
      });
    });

    /**
     * Test actual POST request from 127.0.0.1:8080 (the origin from the error logs)
     */
    test('should handle POST request from 127.0.0.1:8080', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8080')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8080'
      );
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
      });
    });

    /**
     * Test actual POST request from localhost:8081 (fallback port)
     */
    test('should handle POST request from localhost:8081', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://localhost:8081')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:8081'
      );
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
      });
    });

    /**
     * Test actual POST request from 127.0.0.1:8081 (fallback port)
     */
    test('should handle POST request from 127.0.0.1:8081', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8081')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8081'
      );
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
      });
    });
  });

  describe('CORS Security', () => {
    /**
     * Test that unauthorized origins are blocked
     */
    test('should block requests from unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://malicious.example.com')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      // CORS should block this - no Access-Control-Allow-Origin header should be present
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    /**
     * Test that requests without Origin header still work (server-to-server)
     */
    test('should handle requests without Origin header (server-to-server)', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .set('Content-Type', 'application/json')
        .send(validDebugLogRequest);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
      });
    });

    /**
     * Test preflight from unauthorized origin is blocked
     */
    test('should block CORS preflight from unauthorized origins', async () => {
      const response = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://evil.hacker.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      // Should still return 204 but without CORS headers
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CORS Configuration Validation', () => {
    /**
     * Verify that all expected origins are in the configuration
     */
    test('should have all expected origins in CORS configuration', () => {
      const appConfigService = getAppConfigService(mockLogger);
      const allowedOrigins = appConfigService.getAllowedOriginsArray();

      expect(allowedOrigins).toContain('http://localhost:8080');
      expect(allowedOrigins).toContain('http://127.0.0.1:8080');
      expect(allowedOrigins).toContain('http://localhost:8081');
      expect(allowedOrigins).toContain('http://127.0.0.1:8081');
    });

    /**
     * Test with empty PROXY_ALLOWED_ORIGIN (should handle gracefully)
     */
    test('should handle empty PROXY_ALLOWED_ORIGIN gracefully', async () => {
      // Clear the CORS configuration
      process.env.PROXY_ALLOWED_ORIGIN = '';
      
      // Create a new app without CORS configuration
      const noCorsApp = express();
      noCorsApp.use(createSecurityMiddleware());
      
      const noCorsConfigService = getAppConfigService(mockLogger);
      const noCorsOrigins = noCorsConfigService.getAllowedOriginsArray();
      
      // When no origins are configured, CORS middleware is not applied
      if (noCorsOrigins.length === 0) {
        // App should still work but without CORS headers
        noCorsApp.use(express.json());
        noCorsApp.use('/api/debug-log', debugRoutes);
        
        const noCorsServer = noCorsApp.listen(0);
        
        try {
          const response = await request(noCorsApp)
            .post('/api/debug-log')
            .set('Content-Type', 'application/json')
            .send(validDebugLogRequest);
          
          expect(response.status).toBe(200);
          // No CORS headers should be present
          expect(response.headers['access-control-allow-origin']).toBeUndefined();
        } finally {
          await new Promise((resolve) => {
            noCorsServer.close(resolve);
          });
        }
      }
    });
  });

  describe('Cross-Origin Remote Logging Scenario', () => {
    /**
     * Test the exact scenario from the error logs:
     * Game served from 127.0.0.1:8080 sending logs to localhost:3001
     */
    test('should handle remote logging from 127.0.0.1:8080 to localhost:3001', async () => {
      // Simulate multiple log entries like the remote logger would send
      const batchedLogs = {
        logs: [
          {
            level: 'debug',
            message: '[BaseManifestItemLoader] Fetching content from URL',
            timestamp: new Date().toISOString(),
            category: 'loader',
            source: 'baseManifestItemLoader.js:376',
            sessionId: 'cf450268-a70e-425d-b1ac-4a3b455c6d08',
          },
          {
            level: 'info',
            message: '[ActionButtonsRenderer] Item selected',
            timestamp: new Date().toISOString(),
            category: 'ui',
            source: 'actionButtonsRenderer.js:335',
            sessionId: 'cf450268-a70e-425d-b1ac-4a3b455c6d08',
          },
          {
            level: 'warn',
            message: '[RemoteLogger] Failed to send batch to server',
            timestamp: new Date().toISOString(),
            category: 'logging',
            source: 'remoteLogger.js:1114',
            sessionId: 'cf450268-a70e-425d-b1ac-4a3b455c6d08',
            metadata: {
              error: 'Failed to fetch',
              logCount: 1,
              circuitBreakerState: 'closed',
            },
          },
        ],
      };

      // First, test the preflight request
      const preflightResponse = await request(app)
        .options('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8080')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(preflightResponse.status).toBe(204);
      expect(preflightResponse.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8080'
      );

      // Then, test the actual POST request
      const postResponse = await request(app)
        .post('/api/debug-log')
        .set('Origin', 'http://127.0.0.1:8080')
        .set('Content-Type', 'application/json')
        .set('Referer', 'http://127.0.0.1:8080/game.html')
        .send(batchedLogs);

      expect(postResponse.status).toBe(200);
      expect(postResponse.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:8080'
      );
      expect(postResponse.body).toMatchObject({
        success: true,
        processed: 3,
      });
    });
  });
});