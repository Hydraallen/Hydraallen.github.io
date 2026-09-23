"use strict";

// Content checks for data/movies/<year>.json (the real published data).
// 校验 data/movies 下每年的观影数据：结构、日期可解析、与 index.json 一致。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { parseMovieDate } = require("../js/i18n.js");

const MOVIES_DIR = path.resolve(__dirname, "..", "data", "movies");
const YEAR_FILE_RE = /^\d{4}\.json$/;

const yearFiles = fs.readdirSync(MOVIES_DIR).filter((f) => YEAR_FILE_RE.test(f)).sort();
const loadYear = (file) => JSON.parse(fs.readFileSync(path.join(MOVIES_DIR, file), "utf8"));

test("data/movies: at least one year file exists", () => {
  assert.ok(yearFiles.length > 0);
});

test("data/movies: index.json lists exactly the year files", () => {
  const index = JSON.parse(fs.readFileSync(path.join(MOVIES_DIR, "index.json"), "utf8"));
  const expected = yearFiles.map((f) => f.replace(/\.json$/, ""));
  assert.deepStrictEqual([...index].sort(), expected);
});

for (const file of yearFiles) {
  test(`data/movies/${file}: matches {year,total_count,favorite,movies[{title,title_zh,date}]}`, () => {
    const data = loadYear(file);
    assert.strictEqual(Number(data.year), Number(file.slice(0, 4)), "year matches file name");
    assert.ok(Number.isInteger(data.total_count) && data.total_count >= 0, "total_count is an int");
    assert.strictEqual(typeof data.favorite, "string", "favorite is a string");
    assert.ok(Array.isArray(data.movies), "movies is an array");
    assert.strictEqual(data.total_count, data.movies.length, "total_count equals movies.length");
    if (data.favorite) {
      assert.ok(data.movies.some((m) => m.title === data.favorite), "favorite is one of the movies");
    }
    data.movies.forEach((m, i) => {
      assert.ok(typeof m.title === "string" && m.title.trim(), `movies[${i}].title non-empty`);
      assert.ok(
        typeof m.title_zh === "string" && m.title_zh.trim(),
        `movies[${i}] "${m.title}" needs a non-empty title_zh (Chinese title)`
      );
      assert.strictEqual(typeof m.date, "string", `movies[${i}].date is a string`);
      if (m.poster !== undefined) assert.strictEqual(typeof m.poster, "string", `movies[${i}].poster`);
    });
  });

  test(`data/movies/${file}: every date parses via parseMovieDate within its year`, () => {
    const data = loadYear(file);
    const bad = data.movies
      .map((m) => ({ title: m.title, date: m.date, iso: parseMovieDate(m.date) }))
      .filter((r) => !r.iso || r.iso.slice(0, 4) !== String(data.year))
      .map((r) => `${r.title}: "${r.date}"`);
    assert.deepStrictEqual(bad, []);
  });
}
