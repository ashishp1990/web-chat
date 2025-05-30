import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Route, Routes, useNavigate } from 'react-router-dom';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import Login from './Login';
import Profile from './components/Profile';
import VideoCall from './components/VideoCall';

const socket = io('http://localhost:5000');

function App() {
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageRequest, setMessageRequest] = useState(null);
  const [typingStatus, setTypingStatus] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [videoCallData, setVideoCallData] = useState(null);
  const [callRequest, setCallRequest] = useState(null);

  const navigate = useNavigate();

  // Initial setup & socket listeners
  useEffect(() => {
    if (!currentUser || !token) return;

    socket.emit('user_online', { name: currentUser.name });

    fetch('http://localhost:5000/users', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject('Unauthorized'))
      .then(setUsers)
      .catch(err => console.warn('User fetch failed:', err));

    fetch('http://localhost:5000/contacts', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject('Unauthorized'))
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(err => console.warn('Contact fetch failed:', err));

    socket.on('update_users', setUsers);

    socket.on('receive_message', (data) => {
      if (selectedUser && (data.sender === selectedUser.name || data.receiver === selectedUser.name)) {
        setMessages(prev => [...prev, data]);
      }
    });

    socket.on('typing', ({ from }) => {
      setTypingStatus(from);
      setTimeout(() => setTypingStatus(null), 2000);
    });

    socket.on('message_request', (payload) => setMessageRequest(payload));

    socket.on('incoming_call', (data) => setCallRequest(data));

    socket.on('call_accepted', (data) => setVideoCallData(data));

    socket.on('end_call', () => {
      setVideoCallData(null);
    });

    return () => {
      socket.off('update_users');
      socket.off('receive_message');
      socket.off('typing');
      socket.off('message_request');
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('end_call');
    };
  }, [currentUser, token, selectedUser]);

  // User active status heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUser) {
        socket.emit('user_active', { name: currentUser.name });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Typing indicator
  useEffect(() => {
    if (isTyping && selectedUser) {
      socket.emit('typing', {
        from: currentUser.name,
        to: selectedUser.name,
      });
    }
  }, [isTyping, selectedUser]);

  // Contact selection
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    const res = await fetch(`http://localhost:5000/messages/${currentUser.name}/${user.name}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMessages(data);
  };

  const handleSendMessage = (content) => {
    const message = {
      sender: currentUser.name,
      receiver: selectedUser.name,
      content,
    };
    socket.emit('send_message', message);
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
  };

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setToken('');
    window.location.reload();
  };

  const handleAccept = async () => {
    const res = await fetch('http://localhost:5000/contacts/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: messageRequest.from }),
    });
    if (res.ok) {
      const updated = await fetch('http://localhost:5000/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      setContacts(Array.isArray(updated) ? updated : []);
      alert(`${messageRequest.from} added to contacts.`);
    }
    setMessageRequest(null);
  };

  const handleBlock = () => {
    alert(`Blocked messages from ${messageRequest.from}`);
    setMessageRequest(null);
  };

  // Initiating video call
  const handleVideoCall = () => {
    const payload = {
      from: currentUser.name,
      to: selectedUser.name,
      isCaller: true,
    };
    socket.emit('start_call', payload);
    setVideoCallData(payload);
  };

  // Accept incoming call
  const handleAcceptCall = () => {
    socket.emit('accept_call', {
      from: currentUser.name,
      to: callRequest.from,
    });
    setVideoCallData({
      from: callRequest.from,
      to: currentUser.name,
      isCaller: false,
    });
    setCallRequest(null);
  };

  const handleRejectCall = () => {
    socket.emit('reject_call', { to: callRequest.from });
    setCallRequest(null);
  };

  if (!currentUser) {
    return <Login onLogin={(user, tok) => {
      setCurrentUser(user);
      setToken(tok);
    }} />;
  }

  return (
    <>
      {/* Message Request Popup */}
      {messageRequest && (
        <div className="fixed top-4 right-4 bg-white shadow-lg p-4 rounded border z-50">
          <p className="mb-2 text-sm font-semibold">{messageRequest.from} wants to chat:</p>
          <p className="mb-3 text-sm italic">"{messageRequest.content}"</p>
          <div className="flex gap-2">
            <button onClick={handleAccept} className="bg-green-500 text-white px-3 py-1 rounded">Accept</button>
            <button onClick={handleBlock} className="bg-red-500 text-white px-3 py-1 rounded">Block</button>
          </div>
        </div>
      )}

      {/* Incoming Call Popup */}
      {callRequest && (
        <div className="fixed top-4 right-4 bg-white shadow-lg p-4 rounded border z-50">
          <p className="mb-2 font-semibold">{callRequest.from} is calling you...</p>
          <div className="flex gap-2">
            <button onClick={handleAcceptCall} className="bg-green-600 text-white px-4 py-1 rounded">Accept</button>
            <button onClick={handleRejectCall} className="bg-red-600 text-white px-4 py-1 rounded">Reject</button>
          </div>
        </div>
      )}

      {/* Video Call Modal */}
      {videoCallData && (
        <VideoCall
          data={videoCallData}
          socket={socket}
          currentUser={currentUser}
          selectedUser={selectedUser}
          onClose={() => setVideoCallData(null)}
        />
      )}

      {/* Main App Layout */}
      <Routes>
        <Route path="/profile" element={<Profile currentUser={currentUser} token={token} />} />
        <Route path="*" element={
          <div className="flex h-screen">
            <Sidebar
              users={users}
              currentUser={currentUser}
              contacts={contacts}
              onSelectUser={handleSelectUser}
              token={token}
              onLogout={handleLogout}
              setContacts={setContacts}
            />
            <ChatWindow
              selectedUser={selectedUser}
              messages={messages}
              onSendMessage={handleSendMessage}
              typingUser={typingStatus}
              setTyping={setIsTyping}
              onStartCall={handleVideoCall}
              currentUser={currentUser}
            />
          </div>
        } />
      </Routes>
    </>
  );
}

export default App;
