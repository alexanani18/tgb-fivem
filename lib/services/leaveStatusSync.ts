import { syncEmployeeLeaveStatuses } from "../database/leaveStatus";

let midnightTimeout: NodeJS.Timeout | null = null;

export async function runLeaveStatusSync(): Promise<void> {
  try {
    const result = await syncEmployeeLeaveStatuses();

    if (result.activated > 0 || result.finished > 0) {
      console.log(
        `🏖️ Leave status sync: ${result.activated} activated, ${result.finished} finished.`,
      );
    }
  } catch (error) {
    console.error("❌ Leave status sync failed.");
    console.error(error);
  }
}

function millisecondsUntilNextMidnight(): number {
  const now = new Date();

  const nextMidnight = new Date(now);

  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  return nextMidnight.getTime() - now.getTime();
}

function scheduleNextMidnightSync(): void {
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
  }

  const delay = millisecondsUntilNextMidnight();

  midnightTimeout = setTimeout(() => {
    void runLeaveStatusSync();

    scheduleNextMidnightSync();
  }, delay);
}

export async function startLeaveStatusSync(): Promise<void> {
  await runLeaveStatusSync();

  scheduleNextMidnightSync();
}

export function stopLeaveStatusSync(): void {
  if (!midnightTimeout) {
    return;
  }

  clearTimeout(midnightTimeout);
  midnightTimeout = null;
}
