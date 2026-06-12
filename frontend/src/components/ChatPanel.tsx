import React from 'react';
import { Send, Bot, User, X } from 'lucide-react';
import type { Message } from '../types';

interface Props {
  chatMessages: Message[];
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  chatMessagesRef: React.RefObject<HTMLDivElement | null>;
  onClose?: () => void;
}

export const ChatPanel: React.FC<Props> = ({ chatMessages, chatInput, setChatInput, handleSendMessage, chatMessagesRef, onClose }) => {
  return (
    <div className="chat-panel">
      <div className="chat-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Agent Chat</h2>
          <p>Ask anything about the match day!</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="chat-close-btn" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        )}
      </div>

      <div ref={chatMessagesRef} className="chat-messages">
        {chatMessages.map((msg, i) => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';
          return (
            <div 
              key={i} 
              className={`message ${isUser ? 'message-user' : isSystem ? 'message-system' : 'message-agent'}`} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isUser ? 'flex-end' : isSystem ? 'center' : 'flex-start',
                width: '100%'
              }}
            >
              {!isSystem && (
                <div className={`message-sender-${msg.sender}`}>
                  {isUser ? <><User size={14} /> You</> : <><Bot size={14} /> AI Assistant</>}
                </div>
              )}
              <div className={`message-bubble ${msg.sender}`} dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask about accommodations, weather, seats..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
        />
        <button type="submit" className="send-btn">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
