import React, { useRef, useEffect, useState } from 'react';
import { Video } from 'lucide-react';

const ChatWindow = ({
  selectedUser,
  messages,
  onSendMessage,
  onStartCall,
  currentUser,
  typingUser,
  setTyping
}) => {
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Emit typing event with debounce
  useEffect(() => {
    if (isTyping && selectedUser) {
      setTyping(true);
      const timeout = setTimeout(() => {
        setTyping(false);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isTyping, selectedUser, setTyping]);

  const handleSend = () => {
    const value = inputRef.current.value.trim();
    if (value) {
      onSendMessage(value);
      inputRef.current.value = '';
    }
  };

  if (!selectedUser) {
    return (
      <div className="w-3/4 flex items-center justify-center text-gray-500 bg-white">
        Select a contact to start chatting
      </div>
    );
  }

  return (
    <div className="w-3/4 flex flex-col relative bg-white border-l">
      {/* Header */}
      <div className="border-b p-4 text-lg font-medium bg-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{selectedUser.name}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              selectedUser.status === 'Online'
                ? 'bg-green-500'
                : selectedUser.status === 'Away'
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}
            title={selectedUser.status}
          />
        </div>
        <button
          onClick={() => onStartCall(selectedUser)}
          title="Start Video Call"
          className="p-1 hover:bg-blue-100 rounded"
        >
          <Video className="w-5 h-5 text-blue-600 hover:text-blue-800" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => {
          const isMe = msg.sender === currentUser?.name;
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-sm px-4 py-2 rounded-lg shadow text-sm ${
                  isMe ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                }`}
              >
                <div className="text-xs font-semibold mb-1">{msg.sender}</div>
                <div>{msg.content}</div>
              </div>
            </div>
          );
        })}

        {typingUser && typingUser !== currentUser?.name && (
          <div className="text-xs italic text-gray-500 px-3">{typingUser} is typing...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t flex gap-2 bg-white">
        <input
          ref={inputRef}
          onChange={() => setIsTyping(true)}
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
