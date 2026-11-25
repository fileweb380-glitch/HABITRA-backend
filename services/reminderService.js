const ReminderJob = require('../models/ReminderJob');
const Commitment = require('../models/Commitment');
const Habit = require('../models/Habit');
const User = require('../models/User');
const { sendPushNotification } = require('./pushService');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');

const API_BASE_URL = (process.env.BACKEND_URL || 'https://habitra-backend-1.onrender.com').replace(/\/$/, '');
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'https://habitra-jmujqypdt-abdu2.vercel.app').replace(/\/$/, '');

const getAddisDateString = (dateObj = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(dateObj);

  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

const buildCheckinEmailHtml = ({ titleText, bodyText, yesUrl, noUrl }) => `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background: #ffffff;">
    <span style="display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4f46e5; margin-bottom: 8px;">SESSION ENDED</span>
    <h2 style="color: #171717; margin: 0 0 12px 0; font-size: 20px;">Did you complete "${titleText}"?</h2>
    <p style="color: #525252; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${bodyText}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding-right: 8px;" width="50%">
          <a href="${yesUrl}" style="display: block; text-align: center; background: #16a34a; color: #ffffff; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Yes, Completed
          </a>
        </td>
        <td style="padding-left: 8px;" width="50%">
          <a href="${noUrl}" style="display: block; text-align: center; background: #dc2626; color: #ffffff; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Not Completed
          </a>
        </td>
      </tr>
    </table>
    <p style="color: #737373; font-size: 12px; margin-top: 20px; margin-bottom: 0;">
      Selecting "Not Completed" lets you choose a reason (Urgent happened, Forgot, or custom note) to store in your Daily Report.
    </p>
  </div>
`;

const processPendingReminders = async () => {
  const now = new Date();
  const jobs = await ReminderJob.find({ state: 'pending', scheduledFor: { $lte: now } }).limit(50);

  for (const job of jobs) {
    const lockedJob = await ReminderJob.findOneAndUpdate(
      { _id: job._id, state: 'pending' },
      { state: 'processing' },
      { returnDocument: 'after' }
    );
    if (!lockedJob) continue;

    try {
      const user = await User.findById(job.owner);
      if (!user) {
        lockedJob.state = 'cancelled';
        await lockedJob.save();
        continue;
      }

      let titleText = '';
      let duration = 30;
      let targetType = ''; // 'habit' or 'commitment'
      let targetId = '';
      let dateStr = getAddisDateString(job.scheduledFor);

      if (job.commitment) {
        const commitment = await Commitment.findById(job.commitment);
        if (!commitment || ['Completed', 'Missed', 'Cancelled'].includes(commitment.status)) {
          lockedJob.state = 'cancelled';
          await lockedJob.save();
          continue;
        }
        titleText = commitment.title;
        duration = commitment.durationMinutes || 30;
        targetType = 'commitment';
        targetId = commitment._id;
        dateStr = commitment.scheduledDate || dateStr;
      } else if (job.habit) {
        const habit = await Habit.findById(job.habit);
        if (!habit || habit.status !== 'active') {
          lockedJob.state = 'cancelled';
          await lockedJob.save();
          continue;
        }
        titleText = habit.title;
        duration = habit.durationMinutes || 10;
        targetType = 'habit';
        targetId = habit._id;
      } else {
        lockedJob.state = 'cancelled';
        await lockedJob.save();
        continue;
      }

      const channel = job.channel;
      if (!channel || channel === 'none') {
        lockedJob.state = 'cancelled';
        await lockedJob.save();
        continue;
      }

      const isStart = job.type === 'START';

      const title = isStart
        ? `HABITRA: Time to Start "${titleText}"`
        : `HABITRA Check-in: Did you complete "${titleText}"?`;

      const body = isStart
        ? `Your scheduled ${targetType} "${titleText}" is starting now (${duration} mins).`
        : `Your ${duration}-minute session for "${titleText}" has ended. Please confirm whether you completed it or record why you missed it.`;

      // Build target URLs for Habit vs Plan Tomorrow Commitment
      const yesUrl =
        targetType === 'habit'
          ? `${API_BASE_URL}/api/habits/checkin-response?habitId=${targetId}&status=Completed&date=${dateStr}`
          : `${API_BASE_URL}/api/commitments/checkin-response?commitmentId=${targetId}&status=Completed&date=${dateStr}`;

      const noUrl =
        targetType === 'habit'
          ? `${FRONTEND_BASE_URL}/reports/daily?habitId=${targetId}&date=${dateStr}&action=record-reason&title=${encodeURIComponent(titleText)}`
          : `${FRONTEND_BASE_URL}/reports/daily?commitmentId=${targetId}&date=${dateStr}&action=record-reason&title=${encodeURIComponent(titleText)}`;

      const pushUrl = isStart ? '/dashboard?alarm=1' : `${noUrl.replace(FRONTEND_BASE_URL, '')}&alarm=1`;

      // 1. Web Push + Loud Alarm Channel
      if (channel === 'push') {
        await sendPushNotification(user._id, {
          title,
          body,
          type: job.type,
          tag: `${targetType}_${targetId}_${dateStr}_${job.type}`,
          url: pushUrl
        });
      }

      // 2. Email Channel
      if (channel === 'email') {
        const emailHtml = isStart
          ? `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border-radius: 12px; background: #fafafa; border: 1px solid #e5e5e5;">
              <h2 style="color: #171717; margin-top: 0;">${title}</h2>
              <p style="color: #525252; font-size: 15px; line-height: 1.5;">${body}</p>
            </div>`
          : buildCheckinEmailHtml({ titleText, bodyText: body, yesUrl, noUrl });

        const sent = await sendEmail({
          to: user.email,
          subject: title,
          text: body,
          html: emailHtml
        });

        if (!sent) {
          throw new Error('Email delivery returned false');
        }
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
