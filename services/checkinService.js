const Checkin = require('../models/Checkin');

const checkinService = {
  recordCheckin: async (data) => {
    return await Checkin.create(data);
  }
};

module.exports = checkinService;