
const cron = require('node-cron');
const webPush = require('web-push');

const Commitment = require('../models/Commitment');
const Habit = require('../models/Habit');
const ReminderJob = require('../models/ReminderJob');
const PushSubscription = require('../models/PushSubscription');
const sendEmail = require('./sendEmail');
const logger = require('./logger');

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';
const FRONTEND_URL = (
  process.env.FRONTEND_URL || 'https://habitra-abdu2.vercel.app'
).replace(/\/+$/, '');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.SMTP_USER || 'support@habitra.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ------------------------------------------
// TIMEZONE HELPERS
// ------------------------------------------

const getLocalParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  }).formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      result[part.type] = part.value;
    }
  }

  return result;
};

const getLocalDate = (date, timezone) => {
  const p = getLocalParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
};

// Convert a local date and time into an actual UTC Date.
const localTimeToUTC = (dateString, timeString, timezone) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = timeString.split(':').map(Number);

  const targetUTC = Date.UTC(
    year, month - 1, day, hour, minute
  );

  let result = targetUTC;

  for (let i = 0; i < 3; i++) {
    const local = getLocalParts(new Date(result), timezone);

    const representedUTC = Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day),
      Number(local.hour),
      Number(local.minute)
    );

    result += targetUTC - representedUTC;
  }

  return new Date(result);
};

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60000);

const addLocalDays = (dateString, amount) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
};

// ------------------------------------------
// FREQUENCY HELPERS
// ------------------------------------------

const habitRunsToday = (habit, dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (habit.frequency === 'daily') return true;

  if (habit.frequency === 'weekly') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = dayNames[date.getUTCDay()];

    return Array.isArray(habit.days) &&
      habit.days.some(value =>
        value.toLowerCase().startsWith(today.toLowerCase())
      );
  }

  if (habit.frequency === 'monthly') {
    return Number(habit.monthlyDate) === day;
  }

  if (habit.frequency === 'yearly') {
    if (typeof habit.yearlyDate === 'object' && habit.yearlyDate) {
      return (
        Number(habit.yearlyDate.month) === month &&
        Number(habit.yearlyDate.day) === day
      );
    }

    return String(habit.yearlyDate || '')
      .endsWith(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return false;
};

// ------------------------------------------
// CREATE JOBS WITHOUT DUPLICATES
// ------------------------------------------

const createReminderJob = async ({
  owner,
  source,
  type,
  channel,
  scheduledFor,
  date
}) => {
  const sourceType = source.kind;
  const sourceId = source.id;

  const idempotencyKey =
    `${owner}:${sourceType}:${sourceId}:${type}:${channel}:${date}`;

  const fields = {
    owner,
    type,
    channel,
    scheduledFor,
    idempotencyKey
  };

  if (sourceType === 'commitment') {
    fields.commitment = sourceId;
  } else {
    fields.habit = sourceId;
  }

  await ReminderJob.findOneAndUpdate(
    { idempotencyKey },
    { $setOnInsert: fields },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const createJobsForChannels = async ({
  owner,
  source,
  type,
  scheduledFor,
  date,
  emailEnabled,
  pushEnabled
}) => {
  if (emailEnabled) {
    await createReminderJob({
      owner,
      source,
      type,
      channel: 'email',
      scheduledFor,
      date
    });
  }

  if (pushEnabled) {
    await createReminderJob({
      owner,
      source,
      type,
      channel: 'push',
      scheduledFor,
      date
    });
  }
};

// ------------------------------------------
// SCHEDULE COMMITMENTS
// ------------------------------------------

const scheduleCommitments = async (now) => {
  const commitments = await Commitment.find({
    scheduledDate: {
      $gte: addLocalDays(now.toISOString().slice(0, 10), -1),
      $lte: addLocalDays(now.toISOString().slice(0, 10), 1)
    },
    status: 'Scheduled',
    startTime: { $exists: true, $ne: '' }
  }).populate('owner');

  for (const item of commitments) {
    const user = item.owner;
    if (!user) continue;

    const timezone = user.timezone || DEFAULT_TIMEZONE;

    let localDate;

    try {
      localDate = getLocalDate(now, timezone);
    } catch {
      logger.error(`Invalid timezone for user ${user._id}`);
      continue;
    }

    if (item.scheduledDate !== localDate) continue;

    const preference = user.reminderPref || 'both';

    const emailEnabled =
      ['email', 'both'].includes(preference) &&
      user.preferences?.emailReminders !== false &&
      item.reminderPreferences?.email !== false;

    const pushEnabled =
      ['push', 'both'].includes(preference) &&
      user.preferences?.pushReminders !== false &&
      item.reminderPreferences?.push !== false;

    if (!emailEnabled && !pushEnabled) continue;

    const duration = Number(item.durationMinutes) || 30;

    const minutesBefore =
      Number(item.reminderPreferences?.minutesBefore ?? 15);

    const startUTC = localTimeToUTC(
      item.scheduledDate,
      item.startTime,
      timezone
    );

    const startReminder = addMinutes(startUTC, -minutesBefore);
    const endReminder = addMinutes(startUTC, duration);

    const source = {
      kind: 'commitment',
      id: item._id
    };

    await createJobsForChannels({
      owner: user._id,
      source,
      type: 'START',
      scheduledFor: startReminder,
      date: item.scheduledDate,
      emailEnabled,
      pushEnabled
    });

    await createJobsForChannels({
      owner: user._id,
      source,
      type: 'END',
      scheduledFor: endReminder,
      date: item.scheduledDate,
      emailEnabled,
      pushEnabled
    });
  }
};

// ------------------------------------------
// SCHEDULE HABITS
// ------------------------------------------

const scheduleHabits = async (now) => {
  const habits = await Habit.find({
    status: 'active'
  }).populate('user');

  for (const habit of habits) {
    const user = habit.user;

    if (!user || !habit.time || !user.email) continue;

    const timezone = user.timezone || DEFAULT_TIMEZONE;

    let localDate;

    try {
      localDate = getLocalDate(now, timezone);
    } catch {
      logger.error(`Invalid timezone for habit owner ${user._id}`);
      continue;
    }

    if (!habitRunsToday(habit, localDate)) continue;

    const preference = habit.reminderPref || 'both';

    const emailEnabled =
      ['email', 'both'].includes(preference) &&
      user.preferences?.emailReminders !== false;

    const pushEnabled =
      ['push', 'both'].includes(preference) &&
      user.preferences?.pushReminders !== false;

    if (!emailEnabled && !pushEnabled) continue;

    const duration = Number(habit.durationMinutes) || 30;

    const startUTC = localTimeToUTC(
      localDate,
      habit.time,
      timezone
    );

    const endUTC = addMinutes(startUTC, duration);

    const source = {
      kind: 'habit',
      id: habit._id
    };

    await createJobsForChannels({
      owner: user._id,
      source,
      type: 'START',
      scheduledFor: startUTC,
      date: localDate,
      emailEnabled,
      pushEnabled
    });

    await createJobsForChannels({
      owner: user._id,
      source,
      type: 'END',
      scheduledFor: endUTC,
      date: localDate,
      emailEnabled,
      pushEnabled
    });
  }
};

// ------------------------------------------
// SEND REMINDER JOB
// ------------------------------------------

const escapeHTML = (value) =>
  String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

const deliverJob = async (job) => {
  const isCommitment = Boolean(job.commitment);
  const item = isCommitment ? job.commitment : job.habit;

  if (!item) {
    throw new Error('Reminder source no longer exists.');
  }

  const user = job.owner;

  if (!user) {
    throw new Error('Reminder owner no longer exists.');
  }

  const title = item.title;
  const duration = Number(
    isCommitment ? item.durationMinutes : item.durationMinutes
  ) || 30;

  const isStart = job.type === 'START';

  const subject = isStart
    ? `HABITRA: Time to start "${title}"`
    : `HABITRA Check-in: Did you complete "${title}"?`;

  const message = isStart
    ? `Your session for "${title}" ${isCommitment ? 'starts soon' : 'is starting now'}. Duration: ${duration} minutes.`
    : `Your session for "${title}" has ended. Please record your completion status.`;

  const escapedTitle = escapeHTML(title);
  const escapedMessage = escapeHTML(message);

  if (job.channel === 'email') {
    const reportUrl = isCommitment
      ? `${FRONTEND_URL}/reports/daily?commitmentId=${item._id}`
      : `${FRONTEND_URL}/reports/daily?habitId=${item._id}`;

    await sendEmail({
      email: user.email,
      subject,
      message,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:550px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;">
          <h2 style="color:#174C38;">${escapedTitle}</h2>
          <p>${escapedMessage}</p>
          ${!isStart ? `<a href="${reportUrl}" style="display:inline-block;padding:12px 20px;background:#174C38;color:white;text-decoration:none;border-radius:7px;">Open Daily Report</a>` : ''}
        </div>
      `
    });

    return;
  }

  if (job.channel === 'push') {
    const subscriptions = await PushSubscription.find({
      owner: user._id
    });

    const url = isStart
      ? '/dashboard?alarm=1'
      : isCommitment
        ? `/reports/daily?commitmentId=${item._id}&alarm=1`
        : `/reports/daily?habitId=${item._id}&alarm=1`;

    const payload = JSON.stringify({
      title: subject,
      body: message,
      url
    });

    for (const subscription of subscriptions) {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        payload
      );
    }
  }
};

// ------------------------------------------
// PROCESS PENDING JOBS
// ------------------------------------------

const processPendingJobs = async () => {
  for (let i = 0; i < 100; i++) {
    const job = await ReminderJob.findOneAndUpdate(
      {
        state: 'pending',
        scheduledFor: { $lte: new Date() }
      },
      {
        $set: { state: 'processing' }
      },
      {
        new: true,
        sort: { scheduledFor: 1 }
      }
    )
      .populate('owner')
      .populate('commitment')
      .populate('habit');

    if (!job) break;

    try {
      await deliverJob(job);

      job.state = 'sent';
      job.errorLog = undefined;

      await job.save();

      logger.info(`Reminder delivered: ${job.idempotencyKey}`);
    } catch (error) {
      job.state = 'failed';
      job.retryCount += 1;
      job.errorLog = error.message;

      await job.save();

      logger.error(`Reminder delivery failed: ${error.message}`);
    }
  }
};

// ------------------------------------------
// START SHARED ENGINE
// ------------------------------------------

const startReminderEngine = () => {
  let isRunning = false;

  cron.schedule('* * * * *', async () => {
    if (isRunning) return;

    isRunning = true;

    try {
      const now = new Date();

      await scheduleCommitments(now);
      await scheduleHabits(now);
      await processPendingJobs();
    } catch (error) {
      logger.error(`Reminder engine error: ${error.message}`);
    } finally {
      isRunning = false;
    }
  });

  logger.info('[HABITRA] Shared timezone-aware reminder engine started.');
};

module.exports = { startReminderEngine };
