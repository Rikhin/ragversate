'use client';

import { useState, useEffect } from 'react';
import { userSessionManager } from '@/app/lib/user-session';

type Message = {
  text: string;
  sender: 'user' | 'system';
  metadata?: {
    source?: string;
    confidence?: string;
    tools_used?: string[];
    followUpSuggestions?: string[];
  };
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'paid'>('free');
  const [userId, setUserId] = useState<string>('');
  const [querySuggestions, setQuerySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);

  // Initialize user session on component mount
  useEffect(() => {
    const session = userSessionManager.getCurrentUser();
    setUserId(session.userId);
  }, []);

  // Get query suggestions when user types
  useEffect(() => {
    if (query.length > 2 && userId) {
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch('/api/query-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, userId, limit: 3 })
          });
          
          if (response.ok) {
            const data = await response.json();
            const suggestions = data.suggestions.map((s: { query: string }) => s.query);
            setQuerySuggestions(suggestions);
            setShowSuggestions(suggestions.length > 0);
          }
        } catch (error) {
          console.warn('Failed to get query suggestions:', error);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setShowSuggestions(false);
    }
  }, [query, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || isLoading) return;

    const userMessage: Message = { text: query, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setShowSuggestions(false); // Hide suggestions when submitting
    setFollowUpSuggestions([]); // Clear previous follow-up suggestions

    // Add a placeholder system message for streaming
    const placeholderMessage: Message = {
      text: '',
      sender: 'system',
      metadata: {
        source: 'agent',
        confidence: 'high',
        tools_used: []
      }
    };
    
    setMessages((prev) => [...prev, placeholderMessage]);

    // Track accumulated content for streaming
    let accumulatedContent = '';

    try {
      const response = await fetch('/api/get-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, userId }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'metadata') {
                  // Update metadata
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.sender === 'system') {
                      lastMessage.metadata = data.data;
                    }
                    return newMessages;
                  });
                } else if (data.type === 'content') {
                  // Accumulate content properly
                  accumulatedContent += data.data;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.sender === 'system') {
                      lastMessage.text = accumulatedContent;
                    }
                    return newMessages;
                  });
                } else if (data.type === 'followUpSuggestions') {
                  // Handle follow-up suggestions
                  setFollowUpSuggestions(data.suggestions || []);
                } else if (data.type === 'done') {
                  // Streaming complete
                  break;
                } else if (data.type === 'error') {
                  // Handle error
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.sender === 'system') {
                      lastMessage.text = `Error: ${data.data}`;
                    }
                    return newMessages;
                  });
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError);
              }
            }
          }
        }
      } else {
        const errorData = await response.json();
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.sender === 'system') {
            lastMessage.text = `Error: ${errorData.error || 'Something went wrong'}`;
          }
          return newMessages;
        });
      }
    } catch (error) {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'system') {
          lastMessage.text = 'Sorry, there was an error processing your request. Please try again.';
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  const handleFollowUpClick = (suggestion: string) => {
    setQuery(suggestion);
    setFollowUpSuggestions([]);
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Plan Selector - Top Left */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10
      }}>
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value as 'free' | 'paid')}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '2px solid #e0e0e0',
            backgroundColor: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.3s, box-shadow 0.3s',
            minWidth: '120px'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#007AFF';
            e.target.style.boxShadow = '0 0 0 3px rgba(0, 122, 255, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e0e0e0';
            e.target.style.boxShadow = 'none';
          }}
        >
          <option value="free">🆓 Free Plan</option>
          <option value="paid">💎 Paid Plan</option>
        </select>
        
        {/* Plan Info Tooltip */}
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          marginTop: '8px',
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '12px',
          maxWidth: '200px',
          zIndex: 20,
          display: selectedPlan === 'paid' ? 'block' : 'none'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#007AFF' }}>
            💎 Paid Plan Features:
          </div>
          <ul style={{ margin: '0', paddingLeft: '16px', lineHeight: '1.4' }}>
            <li>Unlimited searches</li>
            <li>Priority processing</li>
            <li>Advanced analytics</li>
            <li>API access</li>
          </ul>
        </div>
      </div>

      <h1 style={{
        textAlign: 'center',
        color: '#333',
        marginBottom: '30px',
        fontSize: '2.5rem',
        fontWeight: 'bold',
        marginTop: '20px'
      }}>
        Search
      </h1>
      
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        marginBottom: '20px',
        overflowY: 'auto',
        maxHeight: '60vh'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '10px'
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '15px 20px',
                borderRadius: '20px',
                backgroundColor: msg.sender === 'user' ? '#007AFF' : '#f0f0f0',
                color: msg.sender === 'user' ? 'white' : '#333',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                wordWrap: 'break-word'
              }}>
                {msg.sender === 'system' && msg.metadata?.source && (
                  <div style={{
                    fontSize: '0.8rem',
                    marginBottom: '8px',
                    opacity: 0.7,
                    fontWeight: '500'
                  }}>
                    {msg.metadata.source === 'agent' ? '🤖 AI Agent' :
                     msg.metadata.source === 'helixdb' ? '📊 Knowledge Base' :
                     msg.metadata.source === 'live_search' ? '🌐 Web Search' :
                     msg.metadata.source === 'no_results' ? '❌ No Results' :
                     msg.metadata.source === 'no_entity_found' ? '❓ Unclear Query' :
                     msg.metadata.source}
                    {msg.metadata.confidence && (
                      <span style={{ marginLeft: '8px' }}>
                        ({msg.metadata.confidence === 'high' ? 'high confidence' :
                          msg.metadata.confidence === 'medium' ? 'medium confidence' :
                          'low confidence'})
                      </span>
                    )}
                    {msg.metadata.tools_used && msg.metadata.tools_used.length > 0 && (
                      <div style={{
                        fontSize: '0.7rem',
                        marginTop: '4px',
                        opacity: 0.6
                      }}>
                        Tools: {msg.metadata.tools_used.join(', ')}
                      </div>
                    )}
                  </div>
                )}
                <div style={{
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text || (isLoading && msg.sender === 'system' ? (
                    <span style={{ opacity: 0.6 }}>Agent thinking...</span>
                  ) : '')}
                </div>
              </div>
            </div>
            
            {/* Follow-up suggestions for system messages */}
            {msg.sender === 'system' && msg.metadata?.followUpSuggestions && msg.metadata.followUpSuggestions.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: '8px',
                flexWrap: 'wrap',
                marginLeft: '10px'
              }}>
                {msg.metadata.followUpSuggestions.map((suggestion, suggestionIndex) => (
                  <button
                    key={suggestionIndex}
                    onClick={() => handleFollowUpClick(suggestion)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e0e0e0',
                      color: '#333',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                      e.currentTarget.style.borderColor = '#007AFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.borderColor = '#e0e0e0';
                    }}
                    title={suggestion}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '10px'
          }}>
            <div style={{
              padding: '15px 20px',
              borderRadius: '20px',
              backgroundColor: '#f0f0f0',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ccc',
                borderTop: '2px solid #007AFF',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>Agent thinking...</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Plan Status Indicator */}
      <div style={{
        textAlign: 'center',
        marginBottom: '15px',
        fontSize: '14px',
        color: selectedPlan === 'paid' ? '#007AFF' : '#666',
        fontWeight: selectedPlan === 'paid' ? '600' : '400'
      }}>
        {selectedPlan === 'free' ? (
          <span>🆓 Using Free Plan - Limited searches per day</span>
        ) : (
          <span>💎 Using Paid Plan - Unlimited searches</span>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        gap: '10px',
        marginTop: 'auto'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: '25px',
              border: `2px solid ${selectedPlan === 'paid' ? '#007AFF' : '#e0e0e0'}`,
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.3s',
              backgroundColor: selectedPlan === 'paid' ? '#f8f9ff' : 'white'
            }}
            placeholder={selectedPlan === 'paid' ? 
              "Ask anything with premium processing..." : 
              "Ask about a person, organization, or entity..."
            }
            disabled={isLoading}
            onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = '#007AFF'}
            onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = selectedPlan === 'paid' ? '#007AFF' : '#e0e0e0'}
          />
          
          {/* Query Suggestions */}
          {showSuggestions && querySuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 10,
              marginTop: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '8px 16px',
                fontSize: '12px',
                color: '#666',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0',
                fontWeight: '500'
              }}>
                💡 Based on your history
              </div>
              {querySuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setQuery(suggestion);
                    setShowSuggestions(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: index < querySuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    fontSize: '14px',
                    color: '#333',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          style={{
            padding: '15px 30px',
            borderRadius: '25px',
            backgroundColor: selectedPlan === 'paid' ? '#007AFF' : '#666',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.3s',
            whiteSpace: 'nowrap',
            position: 'relative'
          }}
          disabled={isLoading}
          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = selectedPlan === 'paid' ? '#0056CC' : '#555'}
          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = selectedPlan === 'paid' ? '#007AFF' : '#666'}
        >
          {selectedPlan === 'paid' && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              backgroundColor: '#FFD700',
              color: '#333',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              PRO
            </span>
          )}
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
