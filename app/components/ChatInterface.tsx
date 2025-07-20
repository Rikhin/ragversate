'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchMode } from '../lib/multi-helixdb';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: SearchMode;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string, mode: SearchMode) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

function FeedbackForm({ query, answer, onSubmitted }: { query: string; answer: string; onSubmitted: () => void }) {
  const [quality, setQuality] = useState('');
  const [speed, setSpeed] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const userId = 'demo_user'; // TODO: Replace with real user/session ID

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, answer, quality, speed, comments, userId })
    });
    setSubmitting(false);
    setSubmitted(true);
    onSubmitted();
  };

  if (submitted) return <div className="text-green-600 text-xs mt-2">Thank you for your feedback!</div>;

  return (
    <form onSubmit={handleSubmit} className="mt-2 bg-gray-50 p-2 rounded">
      <div className="flex gap-2 items-center mb-1">
        <label className="text-xs">Quality:</label>
        <select value={quality} onChange={e => setQuality(e.target.value)} className="text-xs border rounded px-1">
          <option value="">Select</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="poor">Poor</option>
        </select>
        <label className="text-xs ml-2">Speed:</label>
        <select value={speed} onChange={e => setSpeed(e.target.value)} className="text-xs border rounded px-1">
          <option value="">Select</option>
          <option value="fast">Fast</option>
          <option value="ok">OK</option>
          <option value="slow">Slow</option>
        </select>
      </div>
      <input
        type="text"
        value={comments}
        onChange={e => setComments(e.target.value)}
        placeholder="Comments (optional)"
        className="text-xs border rounded px-2 py-1 w-full mb-1"
      />
      <button type="submit" disabled={submitting || !quality || !speed} className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50">
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  );
}

export default function ChatInterface({ onSendMessage, isLoading, error }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you with different types of searches. Choose a mode and ask me anything!",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState<SearchMode>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showFeedback, setShowFeedback] = useState<number | -1>(-1);

  const modes: { value: SearchMode; label: string; description: string; icon: string }[] = [
    {
      value: 'general',
      label: 'General Search',
      description: 'Search across all topics and information',
      icon: '🔍'
    },
    {
      value: 'summer-programs',
      label: 'Summer Programs',
      description: 'Find summer programs and opportunities',
      icon: '☀️'
    },
    {
      value: 'mentors',
      label: 'Mentor Search',
      description: 'Connect with mentors and advisors',
      icon: '👥'
    },
    {
      value: 'scholarships',
      label: 'Scholarships',
      description: 'Discover scholarships and funding',
      icon: '💰'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      mode: selectedMode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      const response = await onSendMessage(inputMessage, selectedMode);
      
      // Add the assistant's response to the chat
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        mode: selectedMode
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            RAGversate Chat
          </h1>
          
          {/* Mode Selection */}
          <div className="flex flex-wrap gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setSelectedMode(mode.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  selectedMode === mode.value
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{mode.icon}</span>
                <div className="text-left">
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-gray-500">{mode.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, i) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {message.type === 'assistant' && (
                    <span className="text-sm font-medium text-gray-500">AI Assistant</span>
                  )}
                  {message.mode && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {modes.find(m => m.value === message.mode)?.label}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
                {message.type === 'assistant' && (
                  <div className="mt-2">
                    <button
                      className="text-xs text-blue-600 underline"
                      onClick={() => setShowFeedback(i)}
                    >
                      Give Feedback
                    </button>
                    {showFeedback === i && (
                      <FeedbackForm
                        query={messages[i - 1]?.content || ''}
                        answer={message.content}
                        onSubmitted={() => setShowFeedback(-1)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask me about ${modes.find(m => m.value === selectedMode)?.label.toLowerCase()}...`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </div>
              ) : (
                <span>Send</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 