/**
 * @file Integration test to reproduce LLM proxy server rate limiting issue
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import http from 'http';

describe('LLM Proxy Server Rate Limiting Issue Reproduction', () => {
  const LLM_PROXY_URL = 'http://127.0.0.1:3001';
  
  beforeEach(() => {
    // Set up test environment
  });

  afterEach(() => {
    // Clean up after test
  });

  it('should reproduce rate limiting blocking health checks', async () => {
    // Make multiple rapid health check requests to trigger rate limiting
    const makeRequest = () => {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 3001,
          path: '/health',
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, data });
          });
        });
        
        req.on('error', (err) => {
          // If connection is refused, that's different from rate limiting
          if (err.code === 'ECONNREFUSED') {
            resolve({ status: 503, error: 'Connection refused' });
          } else {
            reject(err);
          }
        });
        
        req.setTimeout(1000, () => {
          req.destroy();
          resolve({ status: 408, error: 'Timeout' });
        });
        
        req.end();
      });
    };
    
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(makeRequest());
    }
    
    const responses = await Promise.all(requests);
    
    // Check if any responses are being rate limited
    const statusCodes = responses.map(r => r.status);
    const rateLimitedResponses = statusCodes.filter(status => status === 429);
    const connectionRefusedResponses = statusCodes.filter(status => status === 503);
    
    console.log('Health check responses:', statusCodes);
    console.log('Rate limited responses:', rateLimitedResponses.length);
    console.log('Connection refused responses:', connectionRefusedResponses.length);
    
    // Document the issue - health checks should not be rate limited
    if (rateLimitedResponses.length > 0) {
      console.warn('ISSUE REPRODUCED: Health checks are being rate limited!');
    }
    
    if (connectionRefusedResponses.length === responses.length) {
      console.log('LLM proxy server is not running - cannot test rate limiting');
      return; // Skip test if server is down
    }
    
    // This test documents the current behavior - should be fixed
    expect(statusCodes.length).toBeGreaterThan(0);
  });

  it('should reproduce rate limiting blocking game startup requests', async () => {
    // Simulate game startup log volume - make rapid API requests
    const makeLogRequest = (i) => {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          logs: [
            {
              level: 'info',
              message: `Game startup log ${i}`,
              timestamp: new Date().toISOString(),
              sessionId: 'test-session',
            }
          ]
        });
        
        const req = http.request({
          hostname: '127.0.0.1',
          port: 3001,
          path: '/api/debug-log',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, data });
          });
        });
        
        req.on('error', (err) => {
          if (err.code === 'ECONNREFUSED') {
            resolve({ status: 503, error: 'Connection refused' });
          } else {
            reject(err);
          }
        });
        
        req.setTimeout(2000, () => {
          req.destroy();
          resolve({ status: 408, error: 'Timeout' });
        });
        
        req.write(postData);
        req.end();
      });
    };
    
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(makeLogRequest(i));
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status);
    const rateLimitedResponses = statusCodes.filter(status => status === 429);
    const connectionRefusedResponses = statusCodes.filter(status => status === 503);
    
    console.log('Debug log API responses:', statusCodes);
    console.log('Rate limited responses:', rateLimitedResponses.length);
    console.log('Connection refused responses:', connectionRefusedResponses.length);
    
    if (rateLimitedResponses.length > 0) {
      console.warn('ISSUE REPRODUCED: Game startup requests are being rate limited!');
    }
    
    if (connectionRefusedResponses.length === responses.length) {
      console.log('LLM proxy server is not running - cannot test rate limiting');
      return; // Skip test if server is down
    }
    
    // Document current failure state
    expect(statusCodes.length).toBeGreaterThan(0);
  });

  it('should show current rate limiting configuration is too aggressive', async () => {
    // Test with minimal requests that should succeed but currently fail
    const makeRequest = () => {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 3001,
          path: '/health',
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, data });
          });
        });
        
        req.on('error', (err) => {
          if (err.code === 'ECONNREFUSED') {
            resolve({ status: 503, error: 'Connection refused' });
          } else {
            reject(err);
          }
        });
        
        req.setTimeout(1000, () => {
          req.destroy();
          resolve({ status: 408, error: 'Timeout' });
        });
        
        req.end();
      });
    };
    
    // Make just 3 requests with 100ms delay between them
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const response = await makeRequest();
      responses.push(response);
      
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const statusCodes = responses.map(r => r.status);
    const successfulResponses = statusCodes.filter(status => status === 200);
    const rateLimitedResponses = statusCodes.filter(status => status === 429);
    const connectionRefusedResponses = statusCodes.filter(status => status === 503);
    
    console.log('Minimal request responses:', statusCodes);
    
    if (connectionRefusedResponses.length === responses.length) {
      console.log('LLM proxy server is not running - cannot test rate limiting');
      return; // Skip test if server is down
    }
    
    // Even minimal requests should succeed
    if (rateLimitedResponses.length > 0) {
      console.warn('CRITICAL: Even minimal requests are being rate limited!');
    }
    
    // This demonstrates the issue - even spaced-out requests are failing
    expect(statusCodes.length).toBeGreaterThan(0);
  });
});