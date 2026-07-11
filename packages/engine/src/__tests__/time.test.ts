import { describe, it, expect } from "vitest";
import type { GameTime, Deadline } from "@mythxengine/types";
import {
  gameTimeToMinutes,
  minutesToGameTime,
  compareGameTime,
  isBefore,
  isAfter,
  isEqual,
  isDeadlineExpired,
  isDeadlineApproaching,
  getTimeUntil,
  addMinutes,
  addHours,
  addDays,
  getActiveDeadlines,
  getApproachingDeadlines,
  sortDeadlinesBySoonest,
  formatTimeRemaining,
  formatGameTime,
} from "../time/expiration.js";

// Test fixtures
const makeDeadline = (overrides: Partial<Deadline> = {}): Deadline => ({
  id: "test-deadline",
  name: "Test Deadline",
  description: "A test deadline",
  expiresAt: { day: 1, hour: 12, minute: 0 },
  warnOnApproach: true,
  ...overrides,
});

// Day numbering is 1-based: { day: 1, hour: 0, minute: 0 } is the epoch and
// converts to 0 minutes (matches createInitialGameTime which starts at day 1).

describe("gameTimeToMinutes", () => {
  it("converts day 1, hour 0, minute 0 (epoch)", () => {
    expect(gameTimeToMinutes({ day: 1, hour: 0, minute: 0 })).toBe(0);
  });

  it("converts minutes correctly", () => {
    expect(gameTimeToMinutes({ day: 1, hour: 0, minute: 30 })).toBe(30);
  });

  it("converts hours correctly", () => {
    expect(gameTimeToMinutes({ day: 1, hour: 2, minute: 0 })).toBe(120);
  });

  it("converts days correctly", () => {
    expect(gameTimeToMinutes({ day: 2, hour: 0, minute: 0 })).toBe(1440);
  });

  it("converts combined time", () => {
    // Day 2, hour 2, minute 30 = 1440 + 120 + 30 = 1590
    expect(gameTimeToMinutes({ day: 2, hour: 2, minute: 30 })).toBe(1590);
  });
});

describe("minutesToGameTime", () => {
  it("converts 0 minutes (epoch)", () => {
    expect(minutesToGameTime(0)).toEqual({ day: 1, hour: 0, minute: 0 });
  });

  it("converts minutes within an hour", () => {
    expect(minutesToGameTime(30)).toEqual({ day: 1, hour: 0, minute: 30 });
  });

  it("converts hours within a day", () => {
    expect(minutesToGameTime(150)).toEqual({ day: 1, hour: 2, minute: 30 });
  });

  it("converts multiple days", () => {
    expect(minutesToGameTime(1590)).toEqual({ day: 2, hour: 2, minute: 30 });
  });

  it("round-trips with gameTimeToMinutes", () => {
    const time: GameTime = { day: 5, hour: 13, minute: 47 };
    expect(minutesToGameTime(gameTimeToMinutes(time))).toEqual(time);
  });
});

describe("compareGameTime", () => {
  it("returns negative when a < b", () => {
    const a: GameTime = { day: 1, hour: 10, minute: 0 };
    const b: GameTime = { day: 1, hour: 12, minute: 0 };
    expect(compareGameTime(a, b)).toBeLessThan(0);
  });

  it("returns positive when a > b", () => {
    const a: GameTime = { day: 2, hour: 10, minute: 0 };
    const b: GameTime = { day: 1, hour: 12, minute: 0 };
    expect(compareGameTime(a, b)).toBeGreaterThan(0);
  });

  it("returns 0 when equal", () => {
    const a: GameTime = { day: 1, hour: 10, minute: 30 };
    const b: GameTime = { day: 1, hour: 10, minute: 30 };
    expect(compareGameTime(a, b)).toBe(0);
  });
});

describe("isBefore/isAfter/isEqual", () => {
  const earlier: GameTime = { day: 1, hour: 10, minute: 0 };
  const later: GameTime = { day: 1, hour: 12, minute: 0 };

  it("isBefore returns true when a < b", () => {
    expect(isBefore(earlier, later)).toBe(true);
    expect(isBefore(later, earlier)).toBe(false);
  });

  it("isAfter returns true when a > b", () => {
    expect(isAfter(later, earlier)).toBe(true);
    expect(isAfter(earlier, later)).toBe(false);
  });

  it("isEqual returns true when equal", () => {
    expect(isEqual(earlier, earlier)).toBe(true);
    expect(isEqual(earlier, later)).toBe(false);
  });
});

describe("isDeadlineExpired", () => {
  const deadline = makeDeadline({ expiresAt: { day: 1, hour: 12, minute: 0 } });

  it("returns false before expiration", () => {
    const before: GameTime = { day: 1, hour: 11, minute: 0 };
    expect(isDeadlineExpired(deadline, before)).toBe(false);
  });

  it("returns true at expiration", () => {
    const at: GameTime = { day: 1, hour: 12, minute: 0 };
    expect(isDeadlineExpired(deadline, at)).toBe(true);
  });

  it("returns true after expiration", () => {
    const after: GameTime = { day: 1, hour: 13, minute: 0 };
    expect(isDeadlineExpired(deadline, after)).toBe(true);
  });
});

describe("isDeadlineApproaching", () => {
  const deadline = makeDeadline({ expiresAt: { day: 1, hour: 12, minute: 0 } });

  it("returns false when far from deadline", () => {
    const far: GameTime = { day: 1, hour: 10, minute: 0 };
    expect(isDeadlineApproaching(deadline, far)).toBe(false);
  });

  it("returns true within threshold", () => {
    const close: GameTime = { day: 1, hour: 11, minute: 30 };
    expect(isDeadlineApproaching(deadline, close)).toBe(true);
  });

  it("returns false after deadline", () => {
    const after: GameTime = { day: 1, hour: 12, minute: 30 };
    expect(isDeadlineApproaching(deadline, after)).toBe(false);
  });

  it("respects custom threshold", () => {
    const current: GameTime = { day: 1, hour: 11, minute: 0 };
    expect(isDeadlineApproaching(deadline, current, 30)).toBe(false);
    expect(isDeadlineApproaching(deadline, current, 90)).toBe(true);
  });
});

describe("getTimeUntil", () => {
  it("calculates remaining time", () => {
    const current: GameTime = { day: 1, hour: 10, minute: 30 };
    const target: GameTime = { day: 1, hour: 12, minute: 0 };

    const result = getTimeUntil(current, target);

    expect(result.expired).toBe(false);
    expect(result.totalMinutes).toBe(90);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(30);
  });

  it("handles multi-day differences", () => {
    const current: GameTime = { day: 1, hour: 10, minute: 0 };
    const target: GameTime = { day: 3, hour: 12, minute: 30 };

    const result = getTimeUntil(current, target);

    expect(result.expired).toBe(false);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
  });

  it("returns expired for past times", () => {
    const current: GameTime = { day: 2, hour: 10, minute: 0 };
    const target: GameTime = { day: 1, hour: 12, minute: 0 };

    const result = getTimeUntil(current, target);

    expect(result.expired).toBe(true);
    expect(result.totalMinutes).toBeLessThan(0);
  });
});

describe("addMinutes/addHours/addDays", () => {
  const base: GameTime = { day: 1, hour: 10, minute: 30 };

  it("addMinutes adds correctly", () => {
    expect(addMinutes(base, 45)).toEqual({ day: 1, hour: 11, minute: 15 });
  });

  it("addMinutes handles day rollover", () => {
    expect(addMinutes(base, 840)).toEqual({ day: 2, hour: 0, minute: 30 });
  });

  it("addMinutes handles negative (clamps to epoch)", () => {
    const result = addMinutes({ day: 1, hour: 0, minute: 10 }, -20);
    expect(result).toEqual({ day: 1, hour: 0, minute: 0 });
  });

  it("addHours adds correctly", () => {
    expect(addHours(base, 3)).toEqual({ day: 1, hour: 13, minute: 30 });
  });

  it("addDays adds correctly", () => {
    expect(addDays(base, 2)).toEqual({ day: 3, hour: 10, minute: 30 });
  });
});

describe("getActiveDeadlines", () => {
  it("filters out expired deadlines", () => {
    const current: GameTime = { day: 1, hour: 12, minute: 0 };
    const expired = makeDeadline({
      id: "expired",
      expiresAt: { day: 1, hour: 10, minute: 0 },
    });
    const active = makeDeadline({
      id: "active",
      expiresAt: { day: 1, hour: 14, minute: 0 },
    });

    const result = getActiveDeadlines([expired, active], current);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("active");
  });
});

describe("getApproachingDeadlines", () => {
  it("returns deadlines within threshold that have warnOnApproach", () => {
    const current: GameTime = { day: 1, hour: 11, minute: 30 };
    const approaching = makeDeadline({
      id: "approaching",
      expiresAt: { day: 1, hour: 12, minute: 0 },
      warnOnApproach: true,
    });
    const noWarn = makeDeadline({
      id: "no-warn",
      expiresAt: { day: 1, hour: 12, minute: 0 },
      warnOnApproach: false,
    });
    const far = makeDeadline({
      id: "far",
      expiresAt: { day: 2, hour: 12, minute: 0 },
      warnOnApproach: true,
    });

    const result = getApproachingDeadlines([approaching, noWarn, far], current);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("approaching");
  });
});

describe("sortDeadlinesBySoonest", () => {
  it("sorts deadlines by expiration time", () => {
    const late = makeDeadline({
      id: "late",
      expiresAt: { day: 3, hour: 12, minute: 0 },
    });
    const soon = makeDeadline({
      id: "soon",
      expiresAt: { day: 1, hour: 12, minute: 0 },
    });
    const middle = makeDeadline({
      id: "middle",
      expiresAt: { day: 2, hour: 12, minute: 0 },
    });

    const result = sortDeadlinesBySoonest([late, soon, middle]);

    expect(result.map((d) => d.id)).toEqual(["soon", "middle", "late"]);
  });

  it("does not mutate original array", () => {
    const deadlines = [
      makeDeadline({ id: "b", expiresAt: { day: 2, hour: 0, minute: 0 } }),
      makeDeadline({ id: "a", expiresAt: { day: 1, hour: 0, minute: 0 } }),
    ];

    sortDeadlinesBySoonest(deadlines);

    expect(deadlines[0].id).toBe("b");
  });
});

describe("formatTimeRemaining", () => {
  it("formats expired", () => {
    expect(
      formatTimeRemaining({ totalMinutes: -10, days: 0, hours: 0, minutes: 0, expired: true })
    ).toBe("expired");
  });

  it("formats minutes only", () => {
    expect(
      formatTimeRemaining({ totalMinutes: 30, days: 0, hours: 0, minutes: 30, expired: false })
    ).toBe("30m");
  });

  it("formats hours and minutes", () => {
    expect(
      formatTimeRemaining({ totalMinutes: 90, days: 0, hours: 1, minutes: 30, expired: false })
    ).toBe("1h 30m");
  });

  it("formats days, hours, and minutes", () => {
    expect(
      formatTimeRemaining({ totalMinutes: 1590, days: 1, hours: 2, minutes: 30, expired: false })
    ).toBe("1d 2h 30m");
  });
});

describe("formatGameTime", () => {
  it("formats short style", () => {
    expect(formatGameTime({ day: 1, hour: 14, minute: 30 })).toBe("Day 1, 2:30 PM");
  });

  it("formats long style", () => {
    expect(formatGameTime({ day: 1, hour: 9, minute: 5 }, "long")).toBe("Day 1 at 9:05 AM");
  });

  it("handles midnight", () => {
    expect(formatGameTime({ day: 2, hour: 0, minute: 0 })).toBe("Day 2, 12:00 AM");
  });

  it("handles noon", () => {
    expect(formatGameTime({ day: 1, hour: 12, minute: 0 })).toBe("Day 1, 12:00 PM");
  });
});
