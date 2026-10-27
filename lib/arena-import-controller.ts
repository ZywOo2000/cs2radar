/** Coordinates all asynchronous Local Arena imports. Newer work owns the UI. */
export function createArenaImportController<T>(handlers: {
  busy: (value: boolean) => void;
  message: (value: string) => void;
  commit: (value: T) => void;
}) {
  let generation = 0;
  let active = true;

  const current = (ticket: number) => active && ticket === generation;

  async function run(read: () => Promise<T>, afterCommit?: () => void) {
    if (!active) return;
    const ticket = ++generation;
    handlers.busy(true);
    handlers.message('');
    try {
      const value = await read();
      if (!current(ticket)) return;
      handlers.commit(value);
      if (!current(ticket)) return;
      afterCommit?.();
      if (current(ticket)) handlers.message('本场全员已导入。');
    } catch (error) {
      if (current(ticket)) handlers.message(error instanceof Error ? error.message : '导入失败，原有数据已保留。');
    } finally {
      if (current(ticket)) handlers.busy(false);
    }
  }

  function cancel() {
    if (!active) return;
    generation++;
    handlers.busy(false);
  }

  function dispose() {
    active = false;
    generation++;
  }

  return { run, cancel, dispose };
}
