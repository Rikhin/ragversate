// Simple user session management without Clerk
// This provides consistent user IDs for Supermemory integration

class UserSessionManager {
  private sessions: Map<string, { userId: string; lastActivity: number }> = new Map();
  private readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Generate or retrieve a user ID for a session
  getUserId(sessionId: string): string {
    const now = Date.now();
    
    // Check if session exists and is still valid
    const existing = this.sessions.get(sessionId);
    if (existing && (now - existing.lastActivity) < this.SESSION_TTL) {
      existing.lastActivity = now;
      return existing.userId;
    }
    
    // Create new session
    const userId = `user_${sessionId}_${now}`;
    this.sessions.set(sessionId, { userId, lastActivity: now });
    
    // Clean up old sessions
    this.cleanup();
    
    return userId;
  }

  // Get user ID from request (simplified version)
  getUserIdFromRequest(request: Request): string {
    // Try to get session ID from headers or cookies
    const sessionId = request.headers.get('x-session-id') || 
                     request.headers.get('x-user-id') ||
                     Math.random().toString(36).substring(2, 15);
    
    return this.getUserId(sessionId);
  }

  // Clean up expired sessions
  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TTL) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get session info for debugging
  getSessionInfo(sessionId: string): { userId: string; lastActivity: number } | null {
    return this.sessions.get(sessionId) || null;
  }
}

export const userSessionManager = new UserSessionManager(); 