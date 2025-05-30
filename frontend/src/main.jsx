import './index.css';
import React, { useState, useEffect } from 'react';
import App from './App';
import ReactDOM from 'react-dom/client';
import AppRoutes from './AppRoutes';

const Root = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (token) {
      fetch('http://localhost:5000/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setUsers(data))
        .catch(() => setUsers([]));
    }
  }, [token]);

  return (
    <AppRoutes currentUser={currentUser} users={users} token={token} />
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
