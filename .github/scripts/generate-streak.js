const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USER || 'AnshikaM17';
const TOKEN = process.env.GITHUB_TOKEN;

// Query a specific year's contributions
function buildQuery(from, to) {
  return JSON.stringify({
    query: `query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        createdAt
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }`,
    variables: { username: USERNAME, from, to }
  });
}

function graphql(body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'streak-stats-generator',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function calcStreaks(allDays) {
  // Sort ascending
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let longestStreak = 0, longestStart = '', longestEnd = '';
  let tempStreak = 0, tempStart = '';

  for (const day of allDays) {
    if (day.contributionCount > 0) {
      if (tempStreak === 0) tempStart = day.date;
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStart = tempStart;
        longestEnd = day.date;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Current streak: walk backwards from today
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const reversed = [...allDays].reverse();
  let currentStreak = 0;
  const lastActive = reversed.find(d => d.contributionCount > 0);

  if (lastActive && (lastActive.date === todayStr || lastActive.date === yesterdayStr)) {
    for (const day of reversed) {
      if (day.contributionCount > 0) currentStreak++;
      else if (day.date <= lastActive.date) break;
    }
  }

  return { currentStreak, longestStreak, longestStart, longestEnd };
}

function generateSVG({ total, currentStreak, longestStreak, longestStart, longestEnd, firstDate }) {
  const todayFmt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const totalRange = firstDate ? `${formatDate(firstDate)} - Present` : 'All time';
  const longestRange = longestStart
    ? `${formatDate(longestStart)} - ${formatDate(longestEnd)}`
    : 'N/A';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  style="isolation:isolate" viewBox="0 0 495 195" width="495px" height="195px" direction="ltr">
  <style>
    @keyframes currstreak {
      0%   { font-size:3px;  opacity:0.2; }
      80%  { font-size:34px; opacity:1; }
      100% { font-size:28px; opacity:1; }
    }
    @keyframes fadein {
      0%   { opacity:0; }
      100% { opacity:1; }
    }
  </style>
  <defs>
    <clipPath id="cr"><rect width="495" height="195" rx="4.5"/></clipPath>
    <mask id="mf">
      <rect width="495" height="195" fill="white"/>
      <ellipse cx="247.5" cy="32" rx="13" ry="18" fill="black"/>
    </mask>
  </defs>
  <g clip-path="url(#cr)">
    <rect stroke="#444" fill="#151515" rx="4.5" x="0.5" y="0.5" width="494" height="194"/>
    <line x1="165" y1="28" x2="165" y2="170" stroke="#444" stroke-width="1"/>
    <line x1="330" y1="28" x2="330" y2="170" stroke="#444" stroke-width="1"/>

    <!-- Total Contributions -->
    <text x="82.5" y="80" text-anchor="middle" fill="#FEFEFE"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="700" font-size="28"
      style="opacity:0;animation:fadein 0.5s linear forwards 0.6s">${total}</text>
    <text x="82.5" y="116" text-anchor="middle" fill="#FEFEFE"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="400" font-size="14"
      style="opacity:0;animation:fadein 0.5s linear forwards 0.7s">Total Contributions</text>
    <text x="82.5" y="145" text-anchor="middle" fill="#9E9E9E"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="400" font-size="11"
      style="opacity:0;animation:fadein 0.5s linear forwards 0.8s">${totalRange}</text>

    <!-- Current Streak ring + fire -->
    <g mask="url(#mf)">
      <circle cx="247.5" cy="71" r="40" fill="none" stroke="#FB8C00" stroke-width="5"
        style="opacity:0;animation:fadein 0.5s linear forwards 0.4s"/>
    </g>
    <g transform="translate(247.5,19.5)" style="opacity:0;animation:fadein 0.5s linear forwards 0.6s">
      <path d="M1.5.67C1.5.67 2.24 3.32 2.24 5.47c0 2.06-1.35 3.73-3.41 3.73-2.06 0-3.62-1.67-3.62-3.73L-4.76 5.11C-6.78 7.51-8 10.62-8 13.99-8 18.41-4.42 22 0 22c4.42 0 8-3.59 8-8.01 0-5.39-2.59-10.2-6.5-13.32zM-.29 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04C4.51 16.85 2.36 19-.29 19z" fill="#FB8C00"/>
    </g>
    <text x="247.5" y="80" text-anchor="middle" fill="#FEFEFE"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="700" font-size="28"
      style="animation:currstreak 0.6s linear forwards">${currentStreak}</text>
    <text x="247.5" y="140" text-anchor="middle" fill="#FB8C00"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="700" font-size="14"
      style="opacity:0;animation:fadein 0.5s linear forwards 0.9s">Current Streak</text>
    <text x="247.5" y="160" text-anchor="middle" fill="#9E9E9E"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="400" font-size="11"
      style="opacity:0;animation:fadein 0.5s linear forwards 0.9s">${currentStreak > 0 ? todayFmt : ''}</text>

    <!-- Longest Streak -->
    <text x="412.5" y="80" text-anchor="middle" fill="#FEFEFE"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="700" font-size="28"
      style="opacity:0;animation:fadein 0.5s linear forwards 1.2s">${longestStreak}</text>
    <text x="412.5" y="116" text-anchor="middle" fill="#FEFEFE"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="400" font-size="14"
      style="opacity:0;animation:fadein 0.5s linear forwards 1.3s">Longest Streak</text>
    <text x="412.5" y="145" text-anchor="middle" fill="#9E9E9E"
      font-family='"Segoe UI",Ubuntu,sans-serif' font-weight="400" font-size="11"
      style="opacity:0;animation:fadein 0.5s linear forwards 1.4s">${longestRange}</text>
  </g>
</svg>`;
}

async function main() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // First call: get account creation date
  const firstResult = await graphql(buildQuery(
    `${currentYear}-01-01T00:00:00Z`,
    now.toISOString()
  ));

  if (!firstResult.data || !firstResult.data.user) {
    console.error('GraphQL error:', JSON.stringify(firstResult));
    process.exit(1);
  }

  const createdAt = new Date(firstResult.data.user.createdAt);
  const startYear = createdAt.getFullYear();

  console.log(`Account created: ${createdAt.toISOString()}, querying ${startYear}–${currentYear}`);

  let totalContributions = 0;
  let allDays = [];
  let firstContribDate = null;

  // Query each year from creation to now
  for (let y = startYear; y <= currentYear; y++) {
    const from = y === startYear
      ? createdAt.toISOString()
      : `${y}-01-01T00:00:00Z`;
    const to = y === currentYear
      ? now.toISOString()
      : `${y}-12-31T23:59:59Z`;

    const res = await graphql(buildQuery(from, to));
    if (!res.data || !res.data.user) {
      console.warn(`No data for year ${y}`);
      continue;
    }

    const cal = res.data.user.contributionsCollection.contributionCalendar;
    totalContributions += cal.totalContributions;
    console.log(`Year ${y}: ${cal.totalContributions} contributions`);

    const days = cal.weeks.flatMap(w => w.contributionDays);
    allDays = allDays.concat(days);

    if (!firstContribDate) {
      const first = days.find(d => d.contributionCount > 0);
      if (first) firstContribDate = first.date;
    }
  }

  console.log(`TOTAL across all years: ${totalContributions}`);

  const { currentStreak, longestStreak, longestStart, longestEnd } = calcStreaks(allDays);
  console.log(`Current streak: ${currentStreak}, Longest: ${longestStreak}`);

  const svg = generateSVG({
    total: totalContributions,
    currentStreak,
    longestStreak,
    longestStart,
    longestEnd,
    firstDate: firstContribDate || createdAt.toISOString().split('T')[0]
  });

  const outDir = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'streak-stats.svg');
  fs.writeFileSync(outFile, svg, 'utf8');
  console.log(`Written to ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
