const Checkin = require('../models/Checkin');
const asyncHandler = require('../utils/asyncHandler');

const getCheckins = asyncHandler(async (req, res) => {
  const checkins = await Checkin.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(checkins);
});

module.exports = { getCheckins };