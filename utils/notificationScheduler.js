const cron = require('node-cron');
const webPush = require('web-push');
const Commitment = require('../models/Commitment');
const sendEmail = require('./sendEmail');
const PushSubscription = require('../models/PushSubscription');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.SMTP_USER || 'support@habitra.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const initNotificationScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      const commitments = await Commitment.find({
        scheduledDate: todayStr,
        status: 'Scheduled',
        startTime: { $exists: true, $ne: '' }
      }).populate('owner');

      for (const item of commitments) {
        const user = item.owner;
        if (!user) continue;

        const pref = user.reminderPref || user.notificationPreference || 'both';
        if (pref === 'none') continue;

        const [startH, startM] = item.startTime.split(':').map(Number);
        const startTimeInMinutes = startH * 60 + startM;
        const durationMinutes = item.duration || item.durationMinutes || 30; 
        
        // --- 1. START TIME REMINDER (e.g. 11:00 AM) ---
        const graceMinutes = user.preferences?.gracePeriodMinutes || 0;
        const alertTimeInMinutes = startTimeInMinutes - graceMinutes;
        
        if (alertTimeInMinutes >= 0) {
          const alertHours = String(Math.floor(alertTimeInMinutes / 60)).padStart(2, '0');
          const alertMins = String(alertTimeInMinutes % 60).padStart(2, '0');
          const alertTimeStr = `${alertHours}:${alertMins}`;

          if (currentTimeStr === alertTimeStr) {
            const title = `HABITRA: Time to Start "${item.title}"`;
            const message = `Your planned commitment "${item.title}" is starting now (${durationMinutes} mins).`;

            // Email Channel
            if (pref === 'email' || pref === 'both') {
              sendEmail({
                email: user.email,
                subject: title,
                message,
                html: `<div style="font-family: sans-serif; padding: 1.5rem; border: 1px solid #e5e5e5; border-radius: 8px;"><h2 style="color: #171717;">${title}</h2><p style="color: #525252;">${message}</p></div>`
              }).catch(err => console.error(`Failed to send start email to ${user.email}:`, err.message));
            }

            // Web Push & Loud Alarm Channel
            if (pref === 'push' || pref === 'both') {
              const subscriptions = await PushSubscription.find({ owner: user._id });
              const payload = JSON.stringify({ 
                title, 
                body: message, 
                url: '/dashboard?alarm=1' 
              });
              for (const sub of subscriptions) {
                webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
                  .catch(err => console.error(`Failed to send start Web Push:`, err.message));
              }
            }
          }
        }

        // --- 2. END TIME CHECK-IN REMINDER (e.g. 11:10 AM) ---
        const endTimeInMinutes = startTimeInMinutes + durationMinutes;
        const endHours = String(Math.floor(endTimeInMinutes / 60)).padStart(2, '0');
        const endMins = String(endTimeInMinutes % 60).padStart(2, '0');
        const endTimeStr = `${endHours}:${endMins}`;

        if (currentTimeStr === endTimeStr) {
          const checkinTitle = `HABITRA Check-in: Did you complete "${item.title}"?`;
          const checkinBody = `Your duration for "${item.title}" has ended. Please log your completion status.`;
          const yesUrl = `https://habitra-jmujqypdt-abdu2.vercel.app/reports/daily?status=Completed&id=${item._id}`;
          const noUrl = `https://habitra-jmujqypdt-abdu2.vercel.app/reports/daily?status=Missed&id=${item._id}`;

          // Email Channel
          if (pref === 'email' || pref === 'both') {
            sendEmail({
              email: user.email,
              subject: checkinTitle,
              message: checkinBody,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem; border: 1px solid #e5e5e5; border-radius: 12px; background: #fafafa;">
                  <h2 style="color: #171717; margin-top: 0;">${checkinTitle}</h2>
                  <p style="color: #525252; font-size: 1rem; line-height: 1.5;">Your session has concluded. Take a second to log your status:</p>
                  <div style="margin: 2rem 0; display: flex; gap: 1rem;">
                    <a href="${yesUrl}" style="flex: 1; text-align: center; background: #8CCF35; color: #171717; padding: 0.85rem 1rem; border-radius: 6px; text-decoration: none; font-weight: bold;">Yes, Completed</a>
                    <a href="${noUrl}" style="flex: 1; text-align: center; background: #fee2e2; color: #991b1b; padding: 0.85rem 1rem; border-radius: 6px; text-decoration: none; font-weight: bold;">No, Record Reason</a>
                  </div>
                </div>
              `
            }).catch(err => console.error(`Failed to send check-in email to ${user.email}:`, err.message));
          }

          // Web Push & Loud Alarm Channel
          if (pref === 'push' || pref === 'both') {
            const subscriptions = await PushSubscription.find({ owner: user._id });
            const payload = JSON.stringify({ 
              title: checkinTitle, 
              body: checkinBody, 
              url: `/reports/daily?commitmentId=${item._id}&alarm=1` 
            });
            for (const sub of subscriptions) {
              webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
                .catch(err => console.error(`Failed to send check-in Web Push:`, err.message));
            }
          }
        }
      }
    } catch (err) {
      console.error('Error running notification scheduler cron:', err.message);
    }
  });
};

module.exports = initNotificationScheduler;
