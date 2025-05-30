const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  contacts: [{ username: String }],
  blocked: [{ username: String }],
});

module.exports = mongoose.model('Contact', ContactSchema);
