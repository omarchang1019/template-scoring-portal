/**
 * Aggregates GitHub Issue scores into data/summary.json
 * - Source: open issues with label "template-idea"
 * - Scores: issue comments containing "Score: X" (0-5)
 * - If a user scores multiple times, keep the latest comment
 * - Priority rule A:
 *    P0 >= 4.0
 *    P1 3.5-3.9
 *    P2 3.0-3.4
 *    P3 < 3.0
 */

const fs = require("fs");
const https = require("https");

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("Missing GITHUB_TOKEN");

const repo = process.env.GITHUB_REPOSITORY; // owner/repo
if (!repo) throw new Error("Missing GITHUB_REPOSITORY");
const [owner, name] = repo.split("/");

function gh(path) {
  const options = {
    hostname: "api.github.com",
    path,
    method: "GET",
    headers: {
      "User-Agent": "template-score-aggregator",
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
        }
        resolve(JSON.parse(data));
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function parseMeta(body="") {
  // Parses "Key: Value" lines
  const meta = {};
  for (const line of body.split("\n").map(x => x.trim())) {
    const m = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (m) meta[m[1].toLowerCase().replace(/\s+/g, "_")] = m[2];
  }
  return meta;
}

function extractReviewers(body="") {
  // Prefer reviewers under the "Reviewers" section; fallback to all @mentions
  const reviewers = [];
  const lines = body.split("\n");

  let inReviewers = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^###\s*Reviewers/i.test(line)) { inReviewers = true; continue; }
    if (/^###\s*/.test(line) && inReviewers) { inReviewers = false; }
    if (inReviewers) {
      const m = line.match(/@([A-Za-z0-9-]+)/);
      if (m) reviewers.push(m[1]);
    }
  }

  // fallback: all mentions in body
  if (reviewers.length === 0) {
    for (const m of body.matchAll(/@([A-Za-z0-9-]+)/g)) reviewers.push(m[1]);
  }

  return Array.from(new Set(reviewers));
}

function extractScores(comments=[]) {
  const byUser = new Map();
  for (const c of comments) {
    const m = (c.body || "").match(/score\s*[:\-]\s*([0-5])\b/i);
    if (!m) continue;
    const user = c.user?.login || "unknown";
    const score = Number(m[1]);
    const created = new Date(c.created_at).getTime();
    const prev = byUser.get(user);
    if (!prev || created > prev.created) {
      byUser.set(user, { user, score, created_at: c.created_at, created });
    }
  }
  return Array.from(byUser.values())
    .map(({ created, ...rest }) => rest)
    .sort((a,b)=>a.user.localeCompare(b.user));
}

function priorityA(avg) {
  if (avg >= 4.0) return "P0";
  if (avg >= 3.5) return "P1";
  if (avg >= 3.0) return "P2";
  return "P3";
}

(async () => {
  // Fetch open issues with label "template-idea"
  const issues = await gh(`/repos/${owner}/${name}/issues?state=open&labels=template-idea&per_page=100&sort=created&direction=desc`);

  const items = [];
  for (const it of issues) {
    const meta = parseMeta(it.body || "");
    const reviewers = extractReviewers(it.body || "");

    const comments = await gh(`/repos/${owner}/${name}/issues/${it.number}/comments?per_page=100`);
    const scores = extractScores(comments);

    const sum = scores.reduce((a,b)=>a+b.score,0);
    const avg = scores.length ? (sum / scores.length) : null;

    const p = avg === null ? null : priorityA(avg);

    items.push({
      number: it.number,
      title: it.title,
      html_url: it.html_url,
      created_at: it.created_at,
      meta: {
        date: meta.date || null,
        platform: meta.platform || null,
        reference_link: meta.reference_link || meta.reference || meta.link || null,
        screenshot_url: meta.screenshot_url || meta.screenshot || null,
      },
      reviewers,
      scores,
      score_count: scores.length,
      missing_count: reviewers.length ? Math.max(reviewers.length - scores.length, 0) : null,
      avg,
      priority: p
    });
  }

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(
    "data/summary.json",
    JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2)
  );

  console.log(`Wrote data/summary.json with ${items.length} item(s).`);
})();
