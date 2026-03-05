export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDay(dayUtc, deltaDays) {
  const date = new Date(`${dayUtc}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function parseDdMmYyyy(raw) {
  const match = String(raw || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return null;
  }

  const [_, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const check = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(check.getTime())) {
    return null;
  }

  if (check.toISOString().slice(0, 10) !== iso) {
    return null;
  }

  return iso;
}

export function formatDdMmYyyy(isoDay) {
  const [yyyy, mm, dd] = isoDay.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

export function isWithinRetention(dayUtc, retentionDays) {
  const cutoff = shiftDay(todayUtc(), -(retentionDays - 1));
  return dayUtc >= cutoff && dayUtc <= todayUtc();
}
