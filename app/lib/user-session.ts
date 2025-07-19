// Hybrid user session management for personalization
// Supports both anonymous sessions and Clerk authentication

export interface UserSession {
  userId: string;
  createdAt: number;
  lastActive: number;
  sessionId: string;
  isAuthenticated: boolean;
  clerkUserId?: string; // Only set when user is logged in
}

class UserSessionManager {
  private readonly SESSION_KEY = 'ragversate_user_session';
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Get or create user session
  getCurrentUser(): UserSession {
    if (typeof window === 'undefined') {
      // Server-side: generate a temporary session
      return this.generateNewSession();
    }

    try {
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const session: UserSession = JSON.parse(stored);
        
        // Check if session is still valid
        if (Date.now() - session.lastActive < this.SESSION_DURATION) {
          // Update last active time
          session.lastActive = Date.now();
          this.saveSession(session);
          return session;
        }
      }
    } catch (error) {
      console.warn('Failed to load user session:', error);
    }

    // Create new session
    const newSession = this.generateNewSession();
    this.saveSession(newSession);
    return newSession;
  }

  // Generate a new user session
  private generateNewSession(): UserSession {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    
    return {
      userId: `user_${timestamp}_${randomId}`,
      createdAt: timestamp,
      lastActive: timestamp,
      sessionId: `session_${timestamp}_${randomId}`,
      isAuthenticated: false
    };
  }

  // Link anonymous session to Clerk user (when they sign up/login)
  linkToClerkUser(clerkUserId: string): void {
    const session = this.getCurrentUser();
    session.clerkUserId = clerkUserId;
    session.isAuthenticated = true;
    this.saveSession(session);
    console.log(`Linked anonymous session to Clerk user: ${clerkUserId}`);
  }

  // Get the appropriate user ID for Supermemory
  // Uses Clerk ID if authenticated, otherwise uses anonymous ID
  getUserIdForMemory(): string {
    const session = this.getCurrentUser();
    return session.isAuthenticated && session.clerkUserId 
      ? `clerk_${session.clerkUserId}` 
      : session.userId;
  }

  // Save session to localStorage
  private saveSession(session: UserSession): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save user session:', error);
    }
  }

  // Clear user session
  clearSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch (error) {
      console.warn('Failed to clear user session:', error);
    }
  }

  // Get user ID for API calls (backward compatibility)
  getUserId(): string {
    return this.getUserIdForMemory();
  }

  // Check if user has an active session
  hasActiveSession(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const session: UserSession = JSON.parse(stored);
        return Date.now() - session.lastActive < this.SESSION_DURATION;
      }
    } catch (error) {
      console.warn('Failed to check user session:', error);
    }
    
    return false;
  }

  // Check if user is authenticated with Clerk
  isAuthenticated(): boolean {
    const session = this.getCurrentUser();
    return session.isAuthenticated;
  }

  // Update last active time
  updateLastActive(): void {
    const session = this.getCurrentUser();
    session.lastActive = Date.now();
    this.saveSession(session);
  }
}

// Export singleton instance
export const userSessionManager = new UserSessionManager(); 