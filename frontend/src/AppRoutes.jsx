// ✅ /frontend/src/AppRoutes.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Login from './Login';
import Profile from './components/Profile';

const AppRoutes = ({ currentUser, users, token }) => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile currentUser={currentUser} token={token} users={users} />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
