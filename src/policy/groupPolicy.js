export async function ensureGroupAllowance({ env, groupRepo }, groupId, title = '') {
  await groupRepo.touchSeen(groupId, { title });

  if (env.allowedGroupIds.includes(Number(groupId))) {
    await groupRepo.setAllowed(groupId, true, { title });
    return { allowed: true };
  }

  const existing = await groupRepo.getGroup(groupId);
  if (existing?.allowed) {
    return { allowed: true };
  }

  return { allowed: false };
}
