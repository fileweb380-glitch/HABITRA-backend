const getTodayString = (timezone = 'Africa/Addis_Ababa') => {
  return new Date().toISOString().split('T')[0];
};

module.exports = { getTodayString };