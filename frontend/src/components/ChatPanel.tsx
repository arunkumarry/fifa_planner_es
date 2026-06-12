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
              <div 
                className={`message-bubble ${msg.sender}`} 
                dangerouslySetInnerHTML={{ 
                  __html: msg.text
                    .replace(/\n/g, '<br/>')
                    .replace(/\[(.*?)\]\((https:\/\/www\.google\.com\/maps\/.*?)\)/g, '<br/><a href="$2" target="_blank" class="glow-btn" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.85rem; text-decoration: none; margin-top: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg> $1</a>')
                    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--color-primary); text-decoration: underline;">$1</a>')
                }} 
              />
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
