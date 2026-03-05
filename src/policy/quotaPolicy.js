function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function checkAndConsumeFreeScanQuota({ quotaRepo, env }, userId, command = 'scan', now = new Date()) {
  const dayUtc = utcDay(now);
  const used = await quotaRepo.getUsage(userId, command, dayUtc);
  const remaining = Math.max(0, env.freeDailyQuota - used);
  if (remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      limit: env.freeDailyQuota,
      used,
      dayUtc
    };
  }

  const after = await quotaRepo.incrementUsage(userId, command, dayUtc);
  return {
    ok: true,
    remaining: Math.max(0, env.freeDailyQuota - after),
    limit: env.freeDailyQuota,
    used: after,
    dayUtc
  };
}
