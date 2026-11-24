const ReminderJob = require('../models/ReminderJob');
const User = require('../models/User');
const Habit = require('../models/Habit');
const logger = require('../utils/logger');

// Helper: Get current date/time parts strictly in Africa/Addis_Ababa (UTC+3)
const getAddisNowParts = (dateObj = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(dateObj);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');

  return {
    dateStr: `${year}-${month}-${day}`, // YYYY-MM-DD
    weekdayShort: get('weekday'), // 'Sun', 'Mon', ...
    dayNum: Number(day),
    monthNum: Number(month)
  };
};

// Helper: Resolve ['email'], ['push'], ['email', 'push'], or []
const resolveChannels = (itemPref, userPref) => {
  const pref = itemPref || userPref || 'both';
  if (pref === 'none') return [];
  if (pref === 'both') return ['email', 'push'];
  if (pref === 'email' || pref === 'push') return [pref];
  return ['email', 'push'];
};

// Helper: Evaluate if habit runs today in Addis Ababa time
const shouldHabitRunToday = (habit, addisParts) => {
  if (habit.frequency === 'daily') return true;

  if (habit.frequency === 'weekly') {
    if (!habit.days || habit.days.length === 0) return false;
    return habit.days.some((d) =>
      String(d).toLowerCase().startsWith(addisParts.weekdayShort.toLowerCase())
    );
  }

  if (habit.frequency === 'monthly') {
    if (!habit.monthlyDate) return false;
    return addisParts.dayNum === Number(habit.monthlyDate);
  }

  if (habit.frequency === 'yearly') {
    if (!habit.yearlyDate) return false;
    if (typeof habit.yearlyDate === 'object') {
      return (
        Number(habit.yearlyDate.month) === addisParts.monthNum &&
        Number(habit.yearlyDate.day) === addisParts.dayNum
      );
    }
    const mm = String(addisParts.monthNum).padStart(2, '0');
    const dd = String(addisParts.dayNum).padStart(2, '0');
    return String(habit.yearlyDate).endsWith(`${mm}-${dd}`);
  }

  return false;
};

const schedulerService = {
  // One-off "Plan Tomorrow" commitments
  scheduleCommitmentReminders: async (commitment) => {
    try {
      if (commitment.isFlexible || !commitment.startTime) return;

      const user = await User.findById(commitment.owner);
      if (!user) return;

      // Support either commitment.reminderPref string or commitment.reminderPreferences object
      let channels = [];
      if (commitment.reminderPref) {
        channels = resolveChannels(commitment.reminderPref, user.reminderPref);
      } else if (
        commitment.reminderPreferences &&
        (commitment.reminderPreferences.email !== undefined ||
          commitment.reminderPreferences.push !== undefined)
      ) {
        if (commitment.reminderPreferences.email) channels.push('email');
        if (commitment.reminderPreferences.push) channels.push('push');
      } else {
        channels = resolveChannels(null, user.reminderPref);
      }

      if (channels.length === 0) return;

      const paddedTime = commitment.startTime.padStart(5, '0');
      const startDateTime = new Date(`${commitment.scheduledDate}T${paddedTime}:00+03:00`);

      if (isNaN(startDateTime.getTime()) || startDateTime.getTime() < Date.now() - 60000) {
        return;
      }

      // 1. START Job
      for (const channel of channels) {
        await ReminderJob.findOneAndUpdate(
          { idempotencyKey: `commit_${commitment._id}_START_${channel}` },
          {
            owner: commitment.owner,
            commitment: commitment._id,
            type: 'START',
            channel,
            scheduledFor: startDateTime,
            state: 'pending'
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // 2. END Check-in Job
      if (commitment.durationMinutes && !commitment.isFlexibleDuration) {
        const endDateTime = new Date(
          startDateTime.getTime() + Number(commitment.durationMinutes) * 60000
        );
        for (const channel of channels) {
          await ReminderJob.findOneAndUpdate(
            { idempotencyKey: `commit_${commitment._id}_END_${channel}` },
            {
              owner: commitment.owner,
              commitment: commitment._id,
              type: 'END',
              channel,
              scheduledFor: endDateTime,
              state: 'pending'
            },
            { upsert: true, returnDocument: 'after' }
          );
        }
      }

      logger.info(`[Scheduler] Queued START & END jobs for commitment "${commitment.title}"`);
    } catch (error) {
      logger.error(`Error scheduling commitment reminders: ${error.message}`);
    }
  },

  // Repeating Habits (Daily, Weekly, Monthly, Yearly)
  generateDailyHabitJobs: async () => {
    try {
      const addisNow = getAddisNowParts();
      const todayStr = addisNow.dateStr;

      const habits = await Habit.find({
        $or: [{ status: 'active' }, { isActive: true }]
      }).populate('user');

      for (const habit of habits) {
        if (!shouldHabitRunToday(habit, addisNow)) continue;
        if (habit.isFlexibleTime || !habit.time) continue;

        const user = habit.user;
        if (!user) continue;

        const channels = resolveChannels(habit.reminderPref, user.reminderPref);
        if (channels.length === 0) continue;

        const paddedTime = habit.time.padStart(5, '0');
        const startDateTime = new Date(`${todayStr}T${paddedTime}:00+03:00`);
        if (isNaN(startDateTime.getTime())) continue;

        // 1. Today's START Job
        for (const channel of channels) {
          await ReminderJob.findOneAndUpdate(
            { idempotencyKey: `habit_${habit._id}_${todayStr}_START_${channel}` },
            {
              $setOnInsert: {
                owner: user._id,
                habit: habit._id,
                type: 'START',
                channel,
                scheduledFor: startDateTime,
                state: startDateTime.getTime() < Date.now() - 120000 ? 'cancelled' : 'pending'
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
        }

        // 2. Today's END Check-in Job
        const duration = Number(habit.durationMinutes) || 10;
        if (!habit.isFlexibleDuration && duration > 0) {
          const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
          for (const channel of channels) {
            await ReminderJob.findOneAndUpdate(
              { idempotencyKey: `habit_${habit._id}_${todayStr}_END_${channel}` },
              {
                $setOnInsert: {
                  owner: user._id,
                  habit: habit._id,
                  type: 'END',
                  channel,
                  scheduledFor: endDateTime,
                  state: endDateTime.getTime() < Date.now() - 120000 ? 'cancelled' : 'pending'
                }
              },
              { upsert: true, returnDocument: 'after' }
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error generating daily habit jobs: ${error.message}`);
    }
  }
};

module.exports = schedulerService;