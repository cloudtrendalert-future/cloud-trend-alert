export class WizardCore {
  constructor({ sessionRepo, handlers = {} }) {
    this.sessionRepo = sessionRepo;
    this.handlers = handlers;
  }

  register(type, handler) {
    this.handlers[type] = handler;
  }

  async getSession(userId) {
    return this.sessionRepo.get(userId);
  }

  async setSession(userId, session) {
    return this.sessionRepo.set(userId, session);
  }

  async clearSession(userId) {
    return this.sessionRepo.clear(userId);
  }

  async handleText(ctx) {
    if (ctx.chat?.type !== 'private') {
      return false;
    }

    const userId = Number(ctx.from?.id);
    const session = await this.sessionRepo.get(userId);
    if (!session) {
      return false;
    }

    const handler = this.handlers[session.type];
    if (!handler?.handleText) {
      return false;
    }

    await handler.handleText(ctx, session);
    return true;
  }

  async handleCallback(ctx, data) {
    const userId = Number(ctx.from?.id);
    const session = await this.sessionRepo.get(userId);
    if (!session) {
      return false;
    }

    const handler = this.handlers[session.type];
    if (!handler?.handleCallback) {
      return false;
    }

    await handler.handleCallback(ctx, session, data);
    return true;
  }
}
