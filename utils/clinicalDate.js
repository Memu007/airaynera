const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function clinicalDateKey(date = new Date(), timeZone = process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

module.exports = {
  DEFAULT_TIME_ZONE,
  clinicalDateKey,
};
