const cron = require('node-cron');
const webPush = require('web-push');
const Habit = require('../models/Habit');
const PushSubscription = require('../models/PushSubscription');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.EMAIL_USER || 'support@habitra.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const API_BASE_URL = (process.env.BACKEND_URL || 'https://habitra-backend-1.onrender.com').replace(/\/$/, '');
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'https://habitra-black.vercel.app').replace(/\/$/, '');

// Helper: Get YYYY-MM-DD in Africa/Addis_Ababa
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

// Helper: Evaluate if habit runs today based on frequency
const shouldHabitRunToday = (habit, now) => {
  if (habit.frequency === 'daily') return true;

  if (habit.frequency === 'weekly') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayShort = dayNames[now.getDay()];
    if (!habit.days || habit.days.length === 0) return false;
    return habit.days.some((d) => d.toLowerCase().startsWith(todayShort.toLowerCase()));
  }

  if (habit.frequency === 'monthly') {
    if (!habit.monthlyDate) return false;
    return now.getDate() === Number(habit.monthlyDate);
  }

  if (habit.frequency === 'yearly') {
    if (!habit.yearlyDate) return false;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    if (typeof habit.yearlyDate === 'object') {
      return (
        Number(habit.yearlyDate.month) === now.getMonth() + 1 &&
        Number(habit.yearlyDate.day) === now.getDate()
      );
    }
    return String(habit.yearlyDate).endsWith(`${month}-${day}`);
  }

  return false;
};

const startHabitScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
      const now = new Date(nowStr);
      const todayDateStr = getAddisDateString();

      const habits = await Habit.find({ status: 'active' }).populate('user');

      for (const habit of habits) {
        const user = habit.user;
        if (!user || !user.email) continue;
        if (!habit.time) continue;
        if (!shouldHabitRunToday(habit, now)) continue;

        const pref = habit.reminderPref || 'both';
        if (pref === 'none') continue;

        const duration = Number(habit.durationMinutes) || 10;
        const [startH, startM] = habit.time.split(':').map(Number);
        const startTimeMins = startH * 60 + startM;
        const currentMins = now.getHours() * 60 + now.getMinutes();

        // --- 1. START TIME NOTIFICATION ---
        if (currentMins === startTimeMins) {
          const title = `HABITRA: Time to start "${habit.title}"`;
          const body = `Your habit session for "${habit.title}" is starting now (${duration} mins).`;

          if (pref === 'email' || pref === 'both') {
            await sendEmail({
              email: user.email,
              subject: title,
              message: body,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border-radius: 12px; background: #fafafa; border: 1px solid #e5e5e5;">
                  <h2 style="color: #171717; margin-top: 0;">${title}</h2>
                  <p style="color: #525252; font-size: 15px; line-height: 1.5;">${body}</p>
                </div>
              `
            }).catch((err) => logger.error(`Habit start email failed: ${err.message}`));
          }

          if (pref === 'push' || pref === 'both') {
            const subs = await PushSubscription.find({ owner: user._id });
            const payload = JSON.stringify({ title, body, url: '/dashboard?alarm=1' });
            for (const sub of subs) {
              webPush
                .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
                .catch((err) => logger.error(`Habit push failed: ${err.message}`));
            }
          }
        }

        // --- 2. END TIME CHECK-IN EMAIL & PUSH ---
        const endTimeMins = (startTimeMins + duration) % 1440;
        if (currentMins === endTimeMins) {
          const checkinTitle = `HABITRA Check-in: Did you complete "${habit.title}"?`;
          const checkinBody = `Your ${duration}-minute session for "${habit.title}" has ended. Please confirm whether you completed it or record why you missed it.`;

          // Clicking "Yes" hits backend directly and saves immediately
          const yesUrl = `${API_BASE_URL}/api/habits/checkin-response?habitId=${habit._id}&status=Completed&date=${todayDateStr}`;
          // Clicking "No" opens the reason selection & custom message form in Daily Reports
          const noUrl = `${FRONTEND_BASE_URL}/reports/daily?habitId=${habit._id}&date=${todayDateStr}&action=record-reason&title=${encodeURIComponent(habit.title)}`;

          if (pref === 'email' || pref === 'both') {
            await sendEmail({
              email: user.email,
              subject: checkinTitle,
              message: checkinBody,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background: #ffffff;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4f46e5; margin-bottom: 8px;">SESSION ENDED</span>
                  <h2 style="color: #171717; margin: 0 0 12px 0; font-size: 20px;">Did you complete "${habit.title}"?</h2>
                  <p style="color: #525252; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${checkinBody}</p>
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
              `
            }).catch((err) => logger.error(`Habit check-in email failed: ${err.message}`));
          }

          if (pref === 'push' || pref === 'both') {
            const subs = await PushSubscription.find({ owner: user._id });
            const payload = JSON.stringify({
              title: checkinTitle,
              body: checkinBody,
              url: `/reports/daily?habitId=${habit._id}&date=${todayDateStr}&action=record-reason&title=${encodeURIComponent(habit.title)}&alarm=1`
            });
            for (const sub of subs) {
              webPush
                .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
                .catch((err) => logger.error(`Habit end push failed: ${err.message}`));
            }
          }
        }
      }
    } catch (err) {
      logger.error(`Habit Scheduler Error: ${err.message}`);
    }
  });

  logger.info('[Habit Scheduler] Running with Africa/Addis_Ababa timezone and start/end check-ins.');
};

module.exports = { startHabitScheduler };