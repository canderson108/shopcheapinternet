// Side effects (emails, conversion pings) that must only run after the database transaction
// commits, so a rolled-back transaction never produces a misleading email.

export class Effects {
  private list: (() => Promise<unknown>)[] = [];

  add(fn: () => Promise<unknown>) {
    this.list.push(fn);
  }

  async run() {
    const fns = this.list;
    this.list = [];
    for (const fn of fns) {
      try {
        await fn();
      } catch (e) {
        console.error("[effects] side effect failed", e);
      }
    }
  }
}
