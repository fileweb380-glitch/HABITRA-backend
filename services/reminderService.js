const ReminderJob = require('../models/ReminderJob');
const Commitment = require('../models/Commitment');
const { sendPushNotification } = require('./pushService');
const logger = require('../utils/logger');

const processPendingReminders = async () => {
  const now = new Date();
  const jobs = await ReminderJob.find({ state: 'pending', scheduledFor: { $lte: now } }).limit(50);

  for (const job of jobs) {
    const lockedJob = await ReminderJob.findOneAndUpdate(
      { _id: job._id, state: 'pending' },
      { state: 'processing' },
      { new: true }
    );
    if (!lockedJob) continue;

    try {
      const commitment = await Commitment.findById(job.commitment);
      if (!commitment || ['Completed', 'Cancelled', 'Rescheduled'].includes(commitment.status)) {
        lockedJob.state = 'cancelled';
        await lockedJob.save();
        continue;
      }

      if (job.channel === 'push') {
        await sendPushNotification(job.owner, {
          title: 'HABITRA Reminder',
          body: `Upcoming commitment: ${commitment.title}`,
          url: '/'
        });
      }

      lockedJob.state = 'sent';
      await lockedJob.save();
    } catch (error) {
      logger.error(`Reminder job ${job._id} failed: ${error.message}`);
      lockedJob.state = 'failed';
      lockedJob.retryCount += 1;
      lockedJob.errorLog = error.message;
      await lockedJob.save();
    }
  }
};

module.exports = { processPendingReminders };