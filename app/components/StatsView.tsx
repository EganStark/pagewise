"use client";

import {
  BarChart3,
  BookCheck,
  BookOpen,
  Download,
  Flame,
  Star,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Book } from "../lib/books";
import { safeCsvCell } from "../lib/csv";
import type { ReadingAttempt } from "../lib/reading-attempts";
import type { ReadingLog } from "../lib/reading-logs";
import { buildReadingStats } from "../lib/reading-stats";

type Props = {
  books: Book[];
  logs: ReadingLog[];
  attempts: ReadingAttempt[];
  freezeDates: string[];
  freezeAvailable: boolean;
};

export function StatsView({
  books,
  logs,
  attempts,
  freezeDates,
  freezeAvailable,
}: Props) {
  const availableYears = useMemo(() => {
    const values = new Set<number>([new Date().getFullYear()]);
    for (const log of logs) values.add(Number(log.log_date.slice(0, 4)));
    for (const attempt of attempts) {
      if (attempt.completed_at)
        values.add(Number(attempt.completed_at.slice(0, 4)));
    }
    return [...values].filter(Number.isFinite).sort((a, b) => b - a);
  }, [attempts, logs]);
  const [selectedYear, setSelectedYear] = useState(() => availableYears[0]);
  const stats = buildReadingStats(
    books,
    logs,
    new Date(),
    freezeDates,
    attempts,
    selectedYear,
  );
  const monthMax = Math.max(
    1,
    ...stats.monthlyPages.map((month) => month.pages),
  );
  const genreMax = Math.max(
    1,
    ...stats.genreBreakdown.map((entry) => entry[1]),
  );
  const ratingMax = Math.max(
    1,
    ...stats.ratingDistribution.map((entry) => entry.count),
  );
  const pagesDelta = stats.yearPages - stats.previousYearPages;
  const booksDelta = stats.completedThisYear - stats.previousYearCompleted;

  function exportStats() {
    const rows: Array<[string, string | number]> = [
      ["Year", stats.year],
      ["Pages read", stats.yearPages],
      ["Books finished", stats.completedThisYear],
      [
        "Average rating",
        stats.averageRating ? stats.averageRating.toFixed(2) : "",
      ],
      ["Reading days", stats.readingDays],
      ["Average pages per session", stats.averageSession],
      ["Most-read author", stats.mostReadAuthor],
      ["Most-read genre", stats.mostReadGenre],
      ["Average book length", stats.averageBookLength],
      ["Best reading day", stats.bestDay.date],
      ["Best reading day pages", stats.bestDay.pages],
      ["Best month", stats.bestMonth.label],
      ["Best month pages", stats.bestMonth.pages],
      ...stats.monthlyPages.map(
        (month) => [`Pages in ${month.label}`, month.pages] as [string, number],
      ),
      ...stats.authorBreakdown
        .slice(0, 10)
        .map(
          ([author, count]) => [`Author: ${author}`, count] as [string, number],
        ),
      ...stats.genreBreakdown
        .slice(0, 10)
        .map(
          ([genre, count]) => [`Genre: ${genre}`, count] as [string, number],
        ),
    ];
    const csv = [["Metric", "Value"], ...rows]
      .map((row) => row.map((value) => safeCsvCell(value, true)).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pagewise-statistics-${stats.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="stats-view">
      <div className="library-title-row">
        <div>
          <p className="eyebrow">Your reading in numbers</p>
          <h1>Statistics</h1>
          <p className="lead">
            Patterns drawn privately from your books and diary.
          </p>
        </div>
        <div className="stats-title-actions">
          <label className="stats-year-picker">
            Year
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            type="button"
            onClick={exportStats}
          >
            <Download size={15} /> Export report
          </button>
        </div>
      </div>
      <div className="stats-kpis">
        <article>
          <Flame />
          <span>Current streak</span>
          <strong>{stats.streak.current}</strong>
          <small>days · best {stats.streak.best}</small>
        </article>
        <article>
          <BookOpen />
          <span>Pages in {stats.year}</span>
          <strong>{stats.yearPages.toLocaleString()}</strong>
          <small>
            {pagesDelta === 0
              ? "Same as previous year"
              : `${pagesDelta > 0 ? "+" : ""}${pagesDelta.toLocaleString()} vs ${stats.year - 1}`}
          </small>
        </article>
        <article>
          <BookCheck />
          <span>Books finished in {stats.year}</span>
          <strong>{stats.completedThisYear}</strong>
          <small>
            {booksDelta === 0
              ? "Same as previous year"
              : `${booksDelta > 0 ? "+" : ""}${booksDelta} vs ${stats.year - 1}`}{" "}
            · {stats.completed} unique overall
          </small>
        </article>
        <article>
          <Star />
          <span>Average rating</span>
          <strong>
            {stats.averageRating ? stats.averageRating.toFixed(1) : "—"}
          </strong>
          <small>
            {stats.averageRating ? "out of 5 stars" : "No rated reads yet"}
          </small>
        </article>
      </div>
      <div className="stats-records">
        <article>
          <Trophy />
          <span>
            <small>Best reading day</small>
            <strong>
              {stats.bestDay.pages ? `${stats.bestDay.pages} pages` : "—"}
            </strong>
            <b>{stats.bestDay.date || "No dated sessions"}</b>
          </span>
        </article>
        <article>
          <Trophy />
          <span>
            <small>Best month</small>
            <strong>
              {stats.bestMonth.pages ? `${stats.bestMonth.pages} pages` : "—"}
            </strong>
            <b>
              {stats.bestMonth.pages ? stats.bestMonth.label : "No activity"}
            </b>
          </span>
        </article>
        <article>
          <Trophy />
          <span>
            <small>Longest completed book</small>
            <strong>{stats.longestBook?.title ?? "—"}</strong>
            <b>
              {stats.longestBook?.total_pages
                ? `${stats.longestBook.total_pages} pages`
                : "No page count"}
            </b>
          </span>
        </article>
      </div>
      <div className="stats-secondary-kpis">
        <article>
          <span>Most-read author</span>
          <strong>{stats.mostReadAuthor}</strong>
        </article>
        <article>
          <span>Most-read genre</span>
          <strong>{stats.mostReadGenre}</strong>
        </article>
        <article>
          <span>Average book length</span>
          <strong>
            {stats.averageBookLength ? `${stats.averageBookLength} pages` : "—"}
          </strong>
        </article>
        <article>
          <span>Reading days</span>
          <strong>{stats.readingDays}</strong>
          <small>{stats.averageSession} pages per session</small>
        </article>
      </div>
      <div className="stats-panels">
        <article className="stats-panel annual-chart">
          <header>
            <div>
              <p className="eyebrow">Page rhythm</p>
              <h2>Pages by month</h2>
            </div>
            <BarChart3 />
          </header>
          <div className="month-bars" aria-label="Pages read by month">
            {stats.monthlyPages.map((month) => (
              <div key={month.label}>
                <div>
                  <i
                    style={{
                      height: `${Math.max(month.pages ? 8 : 1, (month.pages / monthMax) * 100)}%`,
                    }}
                  />
                  <span>{month.pages || ""}</span>
                </div>
                <small>{month.label}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="stats-panel genre-panel">
          <header>
            <div>
              <p className="eyebrow">Completed reads</p>
              <h2>Genre mix</h2>
            </div>
          </header>
          {stats.genreBreakdown.length ? (
            <div className="genre-bars">
              {stats.genreBreakdown.slice(0, 7).map(([genre, count]) => (
                <div key={genre}>
                  <span>
                    <strong>{genre}</strong>
                    <small>
                      {count} {count === 1 ? "read" : "reads"}
                    </small>
                  </span>
                  <div>
                    <i style={{ width: `${(count / genreMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="stats-empty">
              Finish books with genres to see your reading mix.
            </p>
          )}
        </article>
      </div>
      <article className="stats-panel rating-panel">
        <header>
          <div>
            <p className="eyebrow">Reading verdicts</p>
            <h2>Rating distribution</h2>
          </div>
          <Star />
        </header>
        <div
          className="rating-distribution"
          aria-label="Completed reads by rating"
        >
          {stats.ratingDistribution.map(({ rating, count }) => (
            <div key={rating}>
              <span>{rating}</span>
              <div>
                <i style={{ height: `${(count / ratingMax) * 100}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </article>
      <div className="stats-rankings">
        <article className="stats-panel">
          <header>
            <div>
              <p className="eyebrow">Repeat favorites</p>
              <h2>Top authors</h2>
            </div>
          </header>
          {stats.authorBreakdown.length ? (
            <ol>
              {stats.authorBreakdown.slice(0, 5).map(([author, count]) => (
                <li key={author}>
                  <strong>{author}</strong>
                  <span>
                    {count} {count === 1 ? "read" : "reads"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="stats-empty">
              Completed reads with authors will appear here.
            </p>
          )}
        </article>
        <article className="stats-panel">
          <header>
            <div>
              <p className="eyebrow">Shelf patterns</p>
              <h2>Top genres</h2>
            </div>
          </header>
          {stats.genreBreakdown.length ? (
            <ol>
              {stats.genreBreakdown.slice(0, 5).map(([genre, count]) => (
                <li key={genre}>
                  <strong>{genre}</strong>
                  <span>
                    {count} {count === 1 ? "read" : "reads"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="stats-empty">
              Completed reads with genres will appear here.
            </p>
          )}
        </article>
      </div>
      <article className="stats-insight">
        <span>Pagewise insight</span>
        <p>
          {stats.totalPages
            ? `Your typical diary entry is ${stats.averageSession} pages. ${stats.streak.current ? `You are on a ${stats.streak.current}-day reading streak—keep the shelf warm.` : "Log a reading session today to begin a new streak."} ${freezeAvailable ? "One streak freeze is ready." : freezeDates[0] ? `Your freeze protected ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${freezeDates[0]}T12:00:00`))}.` : "No freeze is currently available."}`
            : "Your patterns will appear here after your first reading log."}
        </p>
      </article>
    </section>
  );
}
