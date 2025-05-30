const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: 'Offline' },
  lastActive: { type: Date, default: Date.now },
  profileImage: { type: String, default: '' },
});

module.exports = mongoose.model('User', UserSchema);