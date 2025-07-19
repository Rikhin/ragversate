// Logging and metrics system for performance monitoring

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  duration?: number;
}

interface Metrics {
  apiCalls: { [endpoint: string]: { count: number; avgDuration: number; errors: number } };
  cacheHits: { [cacheType: string]: { hits: number; misses: number } };
  errors: { [errorType: string]: number };
}

class Logger {
  private logs: LogEntry[] = [];
  private metrics: Metrics = {
    apiCalls: {},
    cacheHits: {},
    errors: {},
  };

  // Log API call with timing
  logApiCall(endpoint: string, duration: number, success: boolean = true) {
    if (!this.metrics.apiCalls[endpoint]) {
      this.metrics.apiCalls[endpoint] = { count: 0, avgDuration: 0, errors: 0 };
    }
    
    const call = this.metrics.apiCalls[endpoint];
    call.count++;
    call.avgDuration = (call.avgDuration * (call.count - 1) + duration) / call.count;
    
    if (!success) {
      call.errors++;
    }

    this.log('info', `API Call: ${endpoint}`, { duration, success });
  }

  // Log cache hit/miss
  logCacheHit(cacheType: string, hit: boolean) {
    if (!this.metrics.cacheHits[cacheType]) {
      this.metrics.cacheHits[cacheType] = { hits: 0, misses: 0 };
    }
    
    if (hit) {
      this.metrics.cacheHits[cacheType].hits++;
    } else {
      this.metrics.cacheHits[cacheType].misses++;
    }

    this.log('info', `Cache ${hit ? 'Hit' : 'Miss'}: ${cacheType}`);
  }

  // Log error
  logError(errorType: string, error: Error, context?: any) {
    if (!this.metrics.errors[errorType]) {
      this.metrics.errors[errorType] = 0;
    }
    this.metrics.errors[errorType]++;

    this.log('error', `Error: ${errorType}`, { error: error.message, stack: error.stack, context });
  }

  // General logging
  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}]`;
      console.log(prefix, message, data || '');
    }
  }

  // Get performance metrics
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  // Get recent logs
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  // Get cache hit rate for a specific cache
  getCacheHitRate(cacheType: string): number {
    const cache = this.metrics.cacheHits[cacheType];
    if (!cache || (cache.hits + cache.misses) === 0) return 0;
    return cache.hits / (cache.hits + cache.misses);
  }

  // Get average API response time for an endpoint
  getAvgApiResponseTime(endpoint: string): number {
    const call = this.metrics.apiCalls[endpoint];
    return call ? call.avgDuration : 0;
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    this.metrics = {
      apiCalls: {},
      cacheHits: {},
      errors: {},
    };
  }
}

// Singleton instance
export const logger = new Logger();

// Utility functions for common logging patterns
export const logApiCall = (endpoint: string, duration: number, success: boolean = true) => {
  logger.logApiCall(endpoint, duration, success);
};

export const logCacheHit = (cacheType: string, hit: boolean) => {
  logger.logCacheHit(cacheType, hit);
};

export const logError = (errorType: string, error: Error, context?: any) => {
  logger.logError(errorType, error, context);
};

export const logInfo = (message: string, data?: any) => {
  logger.log('info', message, data);
};

export const logWarn = (message: string, data?: any) => {
  logger.log('warn', message, data);
}; 