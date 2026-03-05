import { PLAN } from '../config/constants.js';

export function isPremiumUser(env, user) {
  if (!user) {
    return false;
  }
  if (user.plan === PLAN.PREMIUM) {
    return true;
  }
  return env.premiumUserIds.includes(Number(user.userId));
}

export async function getUserPlan({ env, userRepo }, userId) {
  const existing = await userRepo.getUser(userId);
  if (!existing) {
    const plan = env.premiumUserIds.includes(Number(userId)) ? PLAN.PREMIUM : PLAN.FREE;
    return userRepo.upsertUser(userId, { plan });
  }

  if (env.premiumUserIds.includes(Number(userId)) && existing.plan !== PLAN.PREMIUM) {
    return userRepo.setPlan(userId, PLAN.PREMIUM);
  }

  return existing;
}
