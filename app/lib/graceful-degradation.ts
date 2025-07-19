// Graceful degradation system for handling API failures and rate limits

interface FallbackResponse {
  entities: Array<{
    name: string;
    description: string;
    category: string;
    source: string;
    confidence: string;
  }>;
  message: string;
  degraded: boolean;
}

interface DegradationConfig {
  enableFallbacks: boolean;
  showPartialResults: boolean;
  maxRetries: number;
  retryDelay: number;
}

class GracefulDegradation {
  private config: DegradationConfig = {
    enableFallbacks: true,
    showPartialResults: true,
    maxRetries: 3,
    retryDelay: 1000,
  };

  // Handle API failures with fallback responses
  async handleApiFailure(
    error: Error,
    query: string,
    fallbackData?: unknown
  ): Promise<FallbackResponse> {
    const errorMessage = error.message.toLowerCase();
    
    // Rate limit handling
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return this.createRateLimitResponse(query);
    }
    
    // Network/connection errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return this.createNetworkErrorResponse(query, fallbackData);
    }
    
    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return this.createAuthErrorResponse(query);
    }
    
    // Generic error with fallback
    return this.createGenericErrorResponse(query, fallbackData);
  }

  // Create response for rate limit errors
  private createRateLimitResponse(query: string): FallbackResponse {
    return {
      entities: [],
      message: `We're experiencing high traffic. Please try again in a few minutes. Your query was: "${query}"`,
      degraded: true,
    };
  }

  // Create response for network errors with cached data
  private createNetworkErrorResponse(query: string, fallbackData?: unknown): FallbackResponse {
    if (fallbackData && this.config.showPartialResults) {
      return {
        entities: (fallbackData as { entities?: Array<{
          name: string;
          description: string;
          category: string;
          source: string;
          confidence: string;
        }> }).entities || [],
        message: `Showing cached results while we reconnect. Some information may be outdated.`,
        degraded: true,
      };
    }
    
    return {
      entities: [],
      message: `Network connection issue. Please check your internet connection and try again.`,
      degraded: true,
    };
  }

  // Create response for authentication errors
  private createAuthErrorResponse(query: string): FallbackResponse {
    return {
      entities: [],
      message: `Service temporarily unavailable. Please try again later.`,
      degraded: true,
    };
  }

  // Create generic error response
  private createGenericErrorResponse(query: string, fallbackData?: unknown): FallbackResponse {
    if (fallbackData && this.config.showPartialResults) {
      return {
        entities: (fallbackData as { entities?: Array<{
          name: string;
          description: string;
          category: string;
          source: string;
          confidence: string;
        }> }).entities || [],
        message: `Showing partial results. Some features may be limited.`,
        degraded: true,
      };
    }
    
    return {
      entities: [],
      message: `Something went wrong. Please try again or contact support if the problem persists.`,
      degraded: true,
    };
  }

  // Retry function with exponential backoff
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.retryWithBackoff(fn, retries - 1);
      }
      throw error;
    }
  }

  // Check if we should show degraded response
  shouldDegrade(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('unauthorized')
    );
  }

  // Get helpful error message for users
  getErrorMessage(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('rate limit')) {
      return 'We\'re experiencing high traffic. Please try again in a few minutes.';
    }
    
    if (errorMessage.includes('network')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    
    if (errorMessage.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    if (errorMessage.includes('unauthorized')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    
    return 'Something went wrong. Please try again.';
  }

  // Update configuration
  updateConfig(newConfig: Partial<DegradationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
export const gracefulDegradation = new GracefulDegradation();

// Utility functions
export const handleApiFailure = (
  error: Error,
  query: string,
  fallbackData?: unknown
) => gracefulDegradation.handleApiFailure(error, query, fallbackData);

export const retryWithBackoff = <T>(fn: () => Promise<T>) => 
  gracefulDegradation.retryWithBackoff(fn);

export const shouldDegrade = (error: Error) => 
  gracefulDegradation.shouldDegrade(error);

export const getErrorMessage = (error: Error) => 
  gracefulDegradation.getErrorMessage(error); 