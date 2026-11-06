const PushSubscription = require('../models/PushSubscription');
const asyncHandler = require('../utils/asyncHandler');

const savePushSubscription = asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) {
    res.status(400);
    throw new Error('Invalid push subscription payload');
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { owner: req.user._id, endpoint, keys },
    { upsert: true, new: true }
  );
  res.status(201).json({ message: 'Push subscription saved successfully' });
});

module.exports = { savePushSubscription };