const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    galleons: { type: Number, default: 0 },
    lastAbsen: { type: Date, default: null },
    houseVault: { type: Number, default: 0 } // <-- Tambahan untuk Pundi-pundi Asrama
});

module.exports = mongoose.model('User', userSchema);