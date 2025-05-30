import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import getCroppedImg from '../utils/cropImage';

const Sidebar = ({
  users = [],
  currentUser,
  contacts = [],
  onSelectUser,
  token,
  onLogout,
  setContacts
}) => {
  const [username, setUsername] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('blocked');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [cropSrc, setCropSrc] = useState(null);
  const [openCrop, setOpenCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const navigate = useNavigate();

  const handleAddContact = async () => {
    if (!username) return;
    const res = await fetch('http://localhost:5000/contacts/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed to add contact.');
    alert('Contact added!');
    setUsername('');
    const newRes = await fetch('http://localhost:5000/contacts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const contacts = await newRes.json();
    setContacts(Array.isArray(contacts) ? contacts : []);
  };

  const fetchBlocked = async () => {
    const res = await fetch('http://localhost:5000/contacts/blocked', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (Array.isArray(data)) setBlockedUsers(data);
  };

  const handleUnblock = async (username) => {
    await fetch('http://localhost:5000/contacts/unblock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });
    fetchBlocked();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      return alert('Only JPG, PNG, WEBP under 2MB allowed.');
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result);
      setOpenCrop(true);
    };
    reader.readAsDataURL(file);
  };

  const uploadCroppedImage = async () => {
    const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
    const formData = new FormData();
    formData.append('image', blob, 'profile.jpg');
    await fetch('http://localhost:5000/profile/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    setOpenCrop(false);
  };

  const onCropComplete = (_, croppedPixels) => setCroppedAreaPixels(croppedPixels);

  const getStatusColor = (status) => {
    if (status === 'Online') return 'text-green-600';
    if (status === 'Away') return 'text-yellow-500';
    return 'text-gray-400';
  };

  const contactUserData = Array.isArray(contacts)
    ? contacts.map((c) => users.find((u) => u.name === c.username)).filter(Boolean)
    : [];

  return (
    <div className="w-1/4 bg-white border-r p-4 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <div className="flex items-center gap-2">
          <button title="My Profile" onClick={() => navigate('/profile')}>👤</button>
          <button title="Settings" onClick={() => { fetchBlocked(); setShowSettings(true); }}>⚙️</button>
          <button onClick={onLogout} className="text-red-600">Logout</button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Logged in as: <strong>{currentUser?.name}</strong>
      </div>

      {/* Add Contact */}
      <div className="mb-4">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Add username"
          className="w-full border p-2 rounded mb-2 text-sm"
        />
        <button onClick={handleAddContact} className="w-full bg-blue-600 text-white py-1 rounded text-sm">
          Add Contact
        </button>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        {contactUserData.length === 0 ? (
          <div className="text-sm text-gray-500">No contacts yet.</div>
        ) : (
          contactUserData.map((user, idx) => (
            <div
              key={idx}
              className="p-2 rounded hover:bg-gray-100 cursor-pointer flex items-center gap-2 mb-1"
              onClick={() => onSelectUser(user)}
            >
              {user.profileImage ? (
                <img
                  src={`http://localhost:5000/uploads/${user.profileImage}`}
                  className="w-8 h-8 rounded-full object-cover"
                  alt="avatar"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm">
                  {user.name[0]}
                </div>
              )}
              <div>
                <div className="text-sm font-medium">{user.name}</div>
                <div className={`text-xs ${getStatusColor(user.status)}`}>{user.status}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cropper Modal */}
      <Dialog open={openCrop} onClose={() => setOpenCrop(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crop your image</DialogTitle>
        <DialogContent>
          <div className="relative h-64">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCrop(false)}>Cancel</Button>
          <Button onClick={uploadCroppedImage} variant="contained">Upload</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white rounded p-4 w-96 shadow-md">
            <h3 className="text-lg font-semibold mb-2">Blocked Users</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {blockedUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No blocked users</p>
              ) : (
                blockedUsers.map((name, i) => (
                  <div key={i} className="flex justify-between items-center border p-2 rounded">
                    <span className="text-sm">{name}</span>
                    <button
                      onClick={() => handleUnblock(name)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowSettings(false)} className="text-blue-600 text-sm hover:underline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
