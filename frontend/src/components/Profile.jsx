import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import getCroppedImg from '../utils/cropImage';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [cropSrc, setCropSrc] = useState(null);
  const [openCrop, setOpenCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setNewName(parsed.name);
      if (parsed.profileImage) {
        setImageUrl(`http://localhost:5000/uploads/${parsed.profileImage}`);
      }
    }
  }, []);

  const onCropComplete = (_, croppedPixels) => setCroppedAreaPixels(croppedPixels);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
    const token = localStorage.getItem('token');

    const res = await fetch('http://localhost:5000/profile/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const newImageUrl = URL.createObjectURL(blob);
      setImageUrl(newImageUrl);
    }
    setOpenCrop(false);
  };

  const handleSave = () => {
    const updated = { ...user, name: newName };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
    setEditMode(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">My Profile</h1>

        {user && (
          <div className="flex flex-col items-center">
            {imageUrl ? (
              <img src={imageUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover mb-4" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center mb-4 text-xl text-white">
                {user.name?.[0] || '?'}
              </div>
            )}

            {editMode ? (
              <>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-center border p-1 rounded w-1/2 mb-2"
                />
                <label className="text-sm text-blue-600 cursor-pointer mb-2">
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </>
            ) : (
              <>
                <div className="text-lg font-medium">{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            onClick={() => navigate('/')}
          >
            Back
          </button>
          {editMode ? (
            <>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                onClick={() => setEditMode(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => setEditMode(true)}
            >
              Edit Profile
            </button>
          )}
        </div>

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
      </div>
    </div>
  );
};

export default Profile;
