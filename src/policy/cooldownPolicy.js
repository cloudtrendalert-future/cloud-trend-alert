export async function checkAndTouchCooldown({ cooldownRepo }, scopeKey, action, cooldownSeconds, nowMs = Date.now()) {
  const remainingSeconds = await cooldownRepo.getRemainingSeconds(scopeKey, action, cooldownSeconds, nowMs);
  if (remainingSeconds > 0) {
    return {
      ok: false,
      remainingSeconds,
      cooldownSeconds
    };
  }

  await cooldownRepo.touch(scopeKey, action, nowMs);
  return {
    ok: true,
    remainingSeconds: 0,
    cooldownSeconds
  };
}
