const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false }
});

const goalSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, required: true, default: 'Personal projects' },
  targetDate: { type: String, required: true }, // YYYY-MM-DD
  milestones: [milestoneSchema],
  status: { type: String, enum: ['Active', 'Completed', 'Archived'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Goal', goalSchema);