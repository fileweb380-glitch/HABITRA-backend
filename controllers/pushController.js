const PushSubscription = require('../models/PushSubscription');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Save or update browser push subscription
// @route   POST /api/push/subscribe
// @access  Private
const saveSubscription = asyncHandler(async (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    res.status(400);
    throw new Error('Invalid subscription object');
  }

  // Upsert subscription based on endpoint to avoid duplicates
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      owner: req.user._id,
      endpoint: subscription.endpoint,
      keys: subscription.keys
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ message: 'Push subscription saved successfully' });
});

// @desc    Remove push subscription on logout/disable
// @route   POST /api/push/unsubscribe
// @access  Private
const removeSubscription = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await PushSubscription.findOneAndDelete({ endpoint, owner: req.user._id });
  }
  res.json({ message: 'Push subscription removed' });
});

module.exports = {
  saveSubscription,
  removeSubscription
};