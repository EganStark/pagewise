import type { Book } from "./books";
import type { ReadingLog } from "./reading-logs";
import type { ReadingAttempt } from "./reading-attempts";

const DAY_MS = 86_400_000;
function dateKey(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function calculateStreak(
  logs: ReadingLog[],
  today = new Date(),
  freezeDates: string[] = [],
) {
  const days = new Set([
    ...logs.filter((log) => log.pages_read > 0).map((log) => log.log_date),
    ...freezeDates,
  ]);
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dateKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let current = 0;
  while (days.has(dateKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const day of sorted) {
    run =
      previous &&
      new Date(`${day}T12:00:00`).getTime() -
        new Date(`${previous}T12:00:00`).getTime() ===
        DAY_MS
        ? run + 1
        : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best };
}

export function estimateBookFinish(
  book: Book,
  logs: ReadingLog[],
  now = new Date(),
) {
  if (!book.total_pages || book.current_page >= book.total_pages) return null;
  const bookLogs = logs
    .filter((log) => log.book_id === book.id && log.pages_read > 0)
    .sort((a, b) => a.log_date.localeCompare(b.log_date));
  if (bookLogs.length < 2) return null;
  const latest = new Date(`${bookLogs.at(-1)!.log_date}T12:00:00`);
  const referenceDate =
    latest.getTime() > now.getTime()
      ? latest
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const windowStart = new Date(referenceDate.getTime() - 13 * DAY_MS);
  const recent = bookLogs.filter(
    (log) => new Date(`${log.log_date}T12:00:00`) >= windowStart,
  );
  if (recent.length < 2) return null;
  const earliest = new Date(`${recent[0].log_date}T12:00:00`);
  const elapsedDays = Math.max(
    1,
    Math.round((referenceDate.getTime() - earliest.getTime()) / DAY_MS) + 1,
  );
  const averagePagesPerDay =
    recent.reduce((sum, log) => sum + log.pages_read, 0) / elapsedDays;
  if (averagePagesPerDay < 0.5) return null;
  const daysRemaining = Math.max(
    1,
    Math.ceil((book.total_pages - book.current_page) / averagePagesPerDay),
  );
  const estimatedDate = new Date(
    referenceDate.getTime() + daysRemaining * DAY_MS,
  );
  return {
    averagePagesPerDay,
    daysRemaining,
    estimatedDate,
    sessionCount: recent.length,
  };
}

export function buildReadingStats(
  books: Book[],
  logs: ReadingLog[],
  now = new Date(),
  freezeDates: string[] = [],
  attempts: ReadingAttempt[] = [],
  selectedYear?: number,
) {
  const latestLogDate = logs.reduce(
    (latest, log) => (log.log_date > latest ? log.log_date : latest),
    "",
  );
  const latestDataDate = latestLogDate
    ? new Date(`${latestLogDate}T12:00:00`)
    : now;
  const referenceDate =
    latestDataDate.getTime() > now.getTime() ? latestDataDate : now;
  const year = selectedYear ?? referenceDate.getFullYear();
  const monthKey = `${year}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
  const totalPages = logs.reduce((sum, log) => sum + log.pages_read, 0);
  const yearLogs = logs.filter((log) => log.log_date.startsWith(String(year)));
  const yearPages = yearLogs.reduce((sum, log) => sum + log.pages_read, 0);
  const previousYearPages = logs
    .filter((log) => log.log_date.startsWith(String(year - 1)))
    .reduce((sum, log) => sum + log.pages_read, 0);
  const monthLogs = logs.filter((log) => log.log_date.startsWith(monthKey));
  const monthPages = monthLogs.reduce((sum, log) => sum + log.pages_read, 0);
  const completed = books.filter((book) => book.status === "completed");
  const readingDays = new Set(yearLogs.map((log) => log.log_date)).size;
  const averageSession = yearLogs.length
    ? Math.round(yearPages / yearLogs.length)
    : 0;
  const monthlyPages = Array.from({ length: 12 }, (_, month) => ({
    label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(
      new Date(year, month, 1),
    ),
    pages: logs
      .filter((log) =>
        log.log_date.startsWith(
          `${year}-${String(month + 1).padStart(2, "0")}`,
        ),
      )
      .reduce((sum, log) => sum + log.pages_read, 0),
  }));
  const weekStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 6,
  );
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * DAY_MS);
    const key = dateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
        date,
      ),
      pages: logs
        .filter((log) => log.log_date === key)
        .reduce((sum, log) => sum + log.pages_read, 0),
    };
  });
  const completedAttempts = attempts.filter((attempt) => attempt.completed_at);
  const completedThisYear = completedAttempts.filter((attempt) =>
    attempt.completed_at!.startsWith(String(year)),
  ).length;
  const previousYearCompleted = completedAttempts.filter((attempt) =>
    attempt.completed_at!.startsWith(String(year - 1)),
  ).length;
  const completedThisMonth = completedAttempts.filter((attempt) =>
    attempt.completed_at!.startsWith(monthKey),
  ).length;
  const yearAttempts = completedAttempts.filter((attempt) =>
    attempt.completed_at!.startsWith(String(year)),
  );
  const ratedAttempts = yearAttempts.filter(
    (attempt) => attempt.rating_numeric !== null,
  );
  const averageRating = ratedAttempts.length
    ? ratedAttempts.reduce((sum, attempt) => sum + attempt.rating_numeric!, 0) /
      ratedAttempts.length
    : 0;
  const completedLengths = completed.flatMap((book) =>
    book.total_pages ? [book.total_pages] : [],
  );
  const averageBookLength = completedLengths.length
    ? Math.round(
        completedLengths.reduce((sum, pages) => sum + pages, 0) /
          completedLengths.length,
      )
    : 0;
  const bookById = new Map(books.map((book) => [book.id, book]));
  const readBooks = yearAttempts.length
    ? yearAttempts.flatMap((attempt) => bookById.get(attempt.book_id) ?? [])
    : [];
  const countValues = (values: string[]) =>
    [
      ...values.reduce(
        (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
        new Map<string, number>(),
      ),
    ].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const authorCounts = countValues(
    readBooks.map((book) => book.author || "Unknown author"),
  );
  const completedGenreCounts = countValues(
    readBooks.map((book) => book.genre || "Uncategorized"),
  );
  const ratingDistribution = Array.from({ length: 10 }, (_, index) => {
    const rating = (index + 1) / 2;
    return {
      rating,
      count: ratedAttempts.filter(
        (attempt) => attempt.rating_numeric === rating,
      ).length,
    };
  });
  const pagesByDay = yearLogs.reduce(
    (days, log) =>
      days.set(log.log_date, (days.get(log.log_date) ?? 0) + log.pages_read),
    new Map<string, number>(),
  );
  const bestDay = [...pagesByDay].reduce(
    (best, [date, pages]) => (pages > best.pages ? { date, pages } : best),
    { date: "", pages: 0 },
  );
  const bestMonth = monthlyPages.reduce(
    (best, month) => (month.pages > best.pages ? month : best),
    { label: "—", pages: 0 },
  );
  const longestBook = readBooks.reduce<Book | null>(
    (longest, book) =>
      (book.total_pages ?? 0) > (longest?.total_pages ?? 0) ? book : longest,
    null,
  );
  return {
    year,
    totalPages,
    yearPages,
    previousYearPages,
    monthPages,
    completed: completed.length,
    completedThisYear,
    previousYearCompleted,
    completedThisMonth,
    averageRating,
    mostReadAuthor: authorCounts[0]?.[0] ?? "—",
    mostReadGenre: completedGenreCounts[0]?.[0] ?? "—",
    authorBreakdown: authorCounts,
    averageBookLength,
    ratingDistribution,
    bestDay,
    bestMonth,
    longestBook,
    active: books.filter((book) => book.status === "reading").length,
    readingDays,
    averageSession,
    genreBreakdown: completedGenreCounts,
    monthlyPages,
    week,
    streak: calculateStreak(logs, referenceDate, freezeDates),
  };
}
