const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 32 },
  passwordHash: { type: String, required: true, select: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);