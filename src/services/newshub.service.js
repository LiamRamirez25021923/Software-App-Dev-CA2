const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../../config/db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'newshubArticles.json');
const REFRESH_MINUTES = Number(process.env.NEWSHUB_REFRESH_MINUTES || 30);
const CACHE_TTL_MS = Math.max(0, REFRESH_MINUTES) * 60 * 1000;
const SOURCE_TIMEOUT_MS = Number(process.env.NEWSHUB_SOURCE_TIMEOUT_MS || 8000);
const MAX_CACHE_ARTICLES = 240;

const NEWS_TYPES = [
  'Game Releases & Launches',
  'Patches & Updates',
  'Company & Business News',
  'Events & Esports',
  'Community & Dev Blogs'
];

const TRUSTED_SOURCES = [
  { name: 'Nintendo Official News', feedUrl: 'https://www.nintendo.co.jp/news/whatsnew.xml', sourceUrl: 'https://www.nintendo.co.jp/news/', language: 'Japanese', platform: 'Nintendo', official: true },
  { name: 'SEGA Official News', feedUrl: 'https://www.sega.jp/news.rdf', sourceUrl: 'https://www.sega.jp/news/', language: 'Japanese', platform: 'SEGA', official: true },
  { name: 'SEGA Games', feedUrl: 'https://www.sega.jp/soft/soft.rdf', sourceUrl: 'https://www.sega.jp/soft/', language: 'Japanese', platform: 'SEGA', official: true },
  { name: 'PlayStation Blog', feedUrl: 'https://blog.playstation.com/feed/', sourceUrl: 'https://blog.playstation.com/', language: 'English', platform: 'PlayStation', official: true },
  { name: 'Xbox Wire', feedUrl: 'https://news.xbox.com/en-us/feed/', sourceUrl: 'https://news.xbox.com/en-us/', language: 'English', platform: 'Xbox', official: true },
  { name: 'Nintendo Life', feedUrl: 'https://www.nintendolife.com/feeds/latest', sourceUrl: 'https://www.nintendolife.com/', language: 'English', platform: 'Nintendo', official: false },
  { name: 'Push Square', feedUrl: 'https://www.pushsquare.com/feeds/latest', sourceUrl: 'https://www.pushsquare.com/', language: 'English', platform: 'PlayStation', official: false },
  { name: 'Pure Xbox', feedUrl: 'https://www.purexbox.com/feeds/latest', sourceUrl: 'https://www.purexbox.com/', language: 'English', platform: 'Xbox', official: false },
  { name: 'Time Extension', feedUrl: 'https://www.timeextension.com/feeds/latest', sourceUrl: 'https://www.timeextension.com/', language: 'English', platform: 'Retro', official: false },
  { name: 'RetroRGB', feedUrl: 'https://www.retrorgb.com/feed', sourceUrl: 'https://www.retrorgb.com/', language: 'English', platform: 'Retro Hardware', official: false },
  { name: 'PC Gamer', feedUrl: 'https://www.pcgamer.com/rss/', sourceUrl: 'https://www.pcgamer.com/', language: 'English', platform: 'PC', official: false },
  { name: 'Rock Paper Shotgun', feedUrl: 'https://www.rockpapershotgun.com/feed', sourceUrl: 'https://www.rockpapershotgun.com/', language: 'English', platform: 'PC', official: false },
  { name: 'GamingOnLinux', feedUrl: 'https://www.gamingonlinux.com/article_rss.php', sourceUrl: 'https://www.gamingonlinux.com/', language: 'English', platform: 'Linux / Steam Deck', official: false },
  { name: 'Eurogamer', feedUrl: 'https://www.eurogamer.net/feed', sourceUrl: 'https://www.eurogamer.net/', language: 'English', platform: 'Multi-platform', official: false },
  { name: 'GameSpot', feedUrl: 'https://www.gamespot.com/feeds/mashup/', sourceUrl: 'https://www.gamespot.com/', language: 'English', platform: 'Multi-platform', official: false },
  { name: 'Polygon', feedUrl: 'https://www.polygon.com/rss/index.xml', sourceUrl: 'https://www.polygon.com/', language: 'English', platform: 'Multi-platform', official: false },
  { name: 'The Verge Gaming', feedUrl: 'https://www.theverge.com/rss/games/index.xml', sourceUrl: 'https://www.theverge.com/games', language: 'English', platform: 'Multi-platform', official: false },
  { name: 'Ars Technica Gaming', feedUrl: 'https://feeds.arstechnica.com/arstechnica/gaming', sourceUrl: 'https://arstechnica.com/gaming/', language: 'English', platform: 'Multi-platform', official: false },
  { name: 'Gematsu', feedUrl: 'https://www.gematsu.com/feed', sourceUrl: 'https://www.gematsu.com/', language: 'English', platform: 'Japanese / Console', official: false },
  { name: 'Siliconera', feedUrl: 'https://www.siliconera.com/feed/', sourceUrl: 'https://www.siliconera.com/', language: 'English', platform: 'Japanese Games', official: false }
];

const KEYWORDS_BY_TYPE = {
  'Game Releases & Launches': ['release', 'launch', 'announced', 'announcement', 'coming', 'date', 'pre-order', 'port', 'remaster', 'remake', 'collection', 'physical edition', '予約', '発売', '新作'],
  'Patches & Updates': ['patch', 'update', 'hotfix', 'version', 'dlc', 'expansion', 'season', 'maintenance', 'balance', 'firmware', 'アップデート', '更新'],
  'Company & Business News': ['acquisition', 'acquire', 'earnings', 'financial', 'revenue', 'layoff', 'workforce', 'ceo', 'president', 'studio', 'publisher', 'business', 'sales', 'merger', '買収', '決算'],
  'Events & Esports': ['event', 'showcase', 'direct', 'state of play', 'tournament', 'esports', 'championship', 'convention', 'expo', 'livestream', 'stream', 'competition', 'イベント', '大会'],
  'Community & Dev Blogs': ['developer', 'dev diary', 'behind the scenes', 'interview', 'community', 'contest', 'fan', 'mod', 'preservation', 'history', 'retro', 'blog', 'feature', '開発', 'インタビュー']
};

let refreshInFlight = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyCache() {
  return { articles: [], lastFetchedAt: null, sourceRuns: [], mode: 'empty', note: 'No RSS refresh has completed yet.' };
}

function ensureCacheFile() {
  ensureDataDirectory();
  if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, JSON.stringify(emptyCache(), null, 2));
}

function readCache() {
  ensureCacheFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return { ...emptyCache(), ...parsed, articles: Array.isArray(parsed.articles) ? parsed.articles : [] };
  } catch {
    return emptyCache();
  }
}

function writeCache(cache) {
  ensureDataDirectory();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function decodeEntities(text = '') {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => map[name] || `&${name};`);
}

function stripTags(text = '') {
  return decodeEntities(text)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, names) {
  for (const name of names) {
    const direct = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (direct) return stripTags(direct[1]);
    const href = block.match(new RegExp(`<${name}[^>]*href=["']([^"']+)["'][^>]*>`, 'i'));
    if (href) return decodeEntities(href[1]).trim();
  }
  return '';
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function classifyArticle(title, summary) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const types = NEWS_TYPES.filter((type) => KEYWORDS_BY_TYPE[type].some((keyword) => haystack.includes(keyword.toLowerCase())));
  return types.length ? types : ['Community & Dev Blogs'];
}

function normaliseArticle(raw, source) {
  const published = parseDate(raw.publishedAt);
  const link = raw.link || source.sourceUrl;
  const title = raw.title || 'Untitled gaming article';
  const summary = raw.summary || 'No summary was provided by this RSS feed.';
  return {
    id: hashId(`${source.name}|${link}|${title}`),
    title,
    summary: summary.slice(0, 900),
    link,
    sourceName: source.name,
    sourceUrl: source.sourceUrl,
    language: source.language,
    platform: source.platform,
    official: source.official,
    publishedAt: published.toISOString(),
    fetchedAt: new Date().toISOString(),
    newsTypes: classifyArticle(title, summary)
  };
}

function parseFeed(xml, source) {
  const blocks = [
    ...xml.matchAll(/<item[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)
  ].map((match) => match[0]);

  return blocks.map((block) => normaliseArticle({
    title: extractTag(block, ['title']),
    link: extractTag(block, ['link', 'guid']),
    summary: extractTag(block, ['description', 'summary', 'content', 'content:encoded']),
    publishedAt: extractTag(block, ['pubDate', 'published', 'updated', 'dc:date'])
  }, source));
}

async function fetchTextWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SavePointStudentProject/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(source) {
  try {
    const xml = await fetchTextWithTimeout(source.feedUrl);
    const articles = parseFeed(xml, source).slice(0, 30);
    return { source: source.name, ok: true, articleCount: articles.length, articles };
  } catch (error) {
    return { source: source.name, ok: false, articleCount: 0, reason: error.name === 'AbortError' ? 'Timed out' : error.message, articles: [] };
  }
}

function dedupeArticles(articles) {
  const seen = new Set();
  return articles
    .filter((article) => {
      const key = article.link || article.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function cacheIsFresh(cache) {
  if (!cache.lastFetchedAt || CACHE_TTL_MS === 0) return false;
  return Date.now() - new Date(cache.lastFetchedAt).getTime() < CACHE_TTL_MS;
}

async function ensureNewsHubStorage() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS savepoint_news_articles (
      id VARCHAR(40) PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      summary TEXT NULL,
      article_url VARCHAR(1000) NOT NULL,
      source_name VARCHAR(150) NOT NULL,
      source_url VARCHAR(1000) NULL,
      language VARCHAR(40) NULL,
      platform VARCHAR(100) NULL,
      is_official BOOLEAN NOT NULL DEFAULT FALSE,
      news_types JSON NULL,
      published_at DATETIME NOT NULL,
      fetched_at DATETIME NOT NULL,
      INDEX idx_sp_news_published (published_at),
      INDEX idx_sp_news_source (source_name)
    )
  `);
}

async function persistArticles(articles) {
  if (!articles.length) return;
  const sql = `
    INSERT INTO savepoint_news_articles
      (id, title, summary, article_url, source_name, source_url, language, platform, is_official, news_types, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title), summary = VALUES(summary), source_name = VALUES(source_name),
      source_url = VALUES(source_url), language = VALUES(language), platform = VALUES(platform),
      is_official = VALUES(is_official), news_types = VALUES(news_types),
      published_at = VALUES(published_at), fetched_at = VALUES(fetched_at)
  `;
  for (const article of articles) {
    await pool.execute(sql, [
      article.id, article.title, article.summary, article.link, article.sourceName,
      article.sourceUrl, article.language, article.platform, article.official ? 1 : 0,
      JSON.stringify(article.newsTypes), new Date(article.publishedAt), new Date(article.fetchedAt)
    ]);
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

async function hydrateCacheFromDatabase() {
  const cache = readCache();
  if (cache.articles.length) return cache;
  try {
    const [rows] = await pool.query(`
      SELECT id, title, summary, article_url, source_name, source_url, language,
             platform, is_official, news_types, published_at, fetched_at
      FROM savepoint_news_articles ORDER BY published_at DESC LIMIT ?
    `, [MAX_CACHE_ARTICLES]);
    if (!rows.length) return cache;
    const articles = rows.map((row) => ({
      id: row.id, title: row.title, summary: row.summary || '', link: row.article_url,
      sourceName: row.source_name, sourceUrl: row.source_url, language: row.language,
      platform: row.platform, official: Boolean(row.is_official),
      newsTypes: parseJsonArray(row.news_types),
      publishedAt: new Date(row.published_at).toISOString(), fetchedAt: new Date(row.fetched_at).toISOString()
    }));
    const next = { ...cache, articles, mode: 'database-cache', note: 'Loaded cached RSS articles from MySQL.' };
    writeCache(next);
    return next;
  } catch (error) {
    return cache;
  }
}

async function refreshArticles({ force = false } = {}) {
  const cache = readCache();
  if (!force && cacheIsFresh(cache)) return { ...cache, refreshed: false };
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const sourceRuns = await Promise.all(TRUSTED_SOURCES.map(fetchSource));
    const liveArticles = dedupeArticles(sourceRuns.flatMap((run) => run.articles || []));
    const combined = dedupeArticles([...liveArticles, ...(cache.articles || [])]).slice(0, MAX_CACHE_ARTICLES);
    const successfulSources = sourceRuns.filter((run) => run.ok).length;
    const nextCache = {
      articles: combined,
      lastFetchedAt: new Date().toISOString(),
      sourceRuns: sourceRuns.map(({ articles, ...run }) => run),
      mode: liveArticles.length ? 'live+cache' : 'cache/fallback',
      note: liveArticles.length
        ? `Fetched ${liveArticles.length} articles from ${successfulSources} trusted RSS sources.`
        : 'No live feed returned articles; showing the most recent cached trusted articles.'
    };
    writeCache(nextCache);
    if (liveArticles.length) await persistArticles(liveArticles).catch((error) => console.error('NewsHub DB cache warning:', error.message));
    refreshInFlight = null;
    return { ...nextCache, refreshed: true };
  })().catch((error) => {
    refreshInFlight = null;
    return { ...readCache(), refreshed: false, mode: 'cache/error', note: `Live RSS refresh failed; showing cache. ${error.message}` };
  });

  return refreshInFlight;
}

function startBackgroundRefresh() {
  refreshArticles().catch(() => {});
}

function withinHours(article, hours, now = new Date()) {
  const published = new Date(article.publishedAt);
  return !Number.isNaN(published.getTime()) && now - published <= hours * 60 * 60 * 1000;
}

function withinCurrentMonth(article, now = new Date()) {
  const published = new Date(article.publishedAt);
  return !Number.isNaN(published.getTime()) && published.getFullYear() === now.getFullYear() && published.getMonth() === now.getMonth();
}

function decorateArticle(article, now = new Date()) {
  const fresh = withinHours(article, 24, now);
  return { ...article, isFresh24h: fresh, freshnessLabel: fresh ? 'Last 24h' : 'Trusted recent fallback' };
}

function getNewsPage({ page = 1, limit = 6, type = 'all', source = 'all' } = {}) {
  const cache = readCache();
  let articles = dedupeArticles(cache.articles || []);
  if (type !== 'all') articles = articles.filter((article) => article.newsTypes.includes(type));
  if (source !== 'all') articles = articles.filter((article) => article.sourceName === source);
  const now = new Date();
  const fresh = articles.filter((article) => withinHours(article, 24, now));
  const older = articles.filter((article) => !withinHours(article, 24, now));
  const ordered = [...fresh, ...older];
  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.max(1, Math.min(24, Number(limit)));
  const start = (safePage - 1) * safeLimit;
  const pageArticles = ordered.slice(start, start + safeLimit).map((article) => decorateArticle(article, now));
  return {
    articles: pageArticles,
    page: safePage,
    limit: safeLimit,
    total: ordered.length,
    hasMore: start + safeLimit < ordered.length,
    recent24hCount: fresh.length,
    backfilledCount: pageArticles.filter((article) => !article.isFresh24h).length,
    cacheMeta: { lastFetchedAt: cache.lastFetchedAt, mode: cache.mode, note: cache.note, sourceRuns: cache.sourceRuns || [] }
  };
}

function chooseReportArticles(kind, articles, now = new Date()) {
  const sorted = dedupeArticles(articles);
  const steps = kind === 'monthly'
    ? [
        { label: 'Current calendar month', predicate: (a) => withinCurrentMonth(a, now), reason: 'Using trusted articles published during the current calendar month.' },
        { label: 'Last 30 days', predicate: (a) => withinHours(a, 24 * 30, now), reason: 'The current month had limited data, so the report uses the latest 30 days.' },
        { label: 'Last 90 days', predicate: (a) => withinHours(a, 24 * 90, now), reason: 'Limited recent data was available, so the report widened to 90 days.' }
      ]
    : [
        { label: 'Last 24 hours', predicate: (a) => withinHours(a, 24, now), reason: 'Using trusted articles published in the last 24 hours.' },
        { label: 'Last 7 days', predicate: (a) => withinHours(a, 24 * 7, now), reason: 'No trusted articles were available in the last 24 hours, so the Daily Report widened to 7 days.' },
        { label: 'Last 30 days', predicate: (a) => withinHours(a, 24 * 30, now), reason: 'Limited weekly data was available, so the Daily Report widened to 30 days.' }
      ];
  for (const step of steps) {
    const picked = sorted.filter(step.predicate).slice(0, kind === 'monthly' ? 40 : 18);
    if (picked.length) return { articles: picked, windowLabel: step.label, fallbackReason: step.reason };
  }
  return {
    articles: sorted.slice(0, kind === 'monthly' ? 40 : 18),
    windowLabel: 'Latest trusted cached articles',
    fallbackReason: sorted.length ? 'No articles matched the preferred time windows, so the report uses the newest cached trusted items.' : 'No trusted articles are cached yet. Refresh the RSS feeds to create this report.'
  };
}

function buildReport(kind = 'daily') {
  const cache = readCache();
  const chosen = chooseReportArticles(kind, cache.articles || []);
  const typeMap = new Map();
  const sourceMap = new Map();
  for (const article of chosen.articles) {
    sourceMap.set(article.sourceName, (sourceMap.get(article.sourceName) || 0) + 1);
    for (const type of article.newsTypes) typeMap.set(type, (typeMap.get(type) || 0) + 1);
  }
  const typeCounts = [...typeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const sourceCounts = [...sourceMap.entries()].map(([sourceName, count]) => ({ sourceName, count })).sort((a, b) => b.count - a.count || a.sourceName.localeCompare(b.sourceName));
  return {
    reportKind: kind,
    generatedAt: new Date().toISOString(),
    windowLabel: chosen.windowLabel,
    fallbackReason: chosen.fallbackReason,
    totalArticles: chosen.articles.length,
    leadingType: typeCounts[0] || { type: 'No strong signal', count: 0 },
    leadingSource: sourceCounts[0] || { sourceName: 'No source signal', count: 0 },
    typeCounts,
    sourceCounts,
    articlesUsed: chosen.articles.map((article) => decorateArticle(article)),
    cacheMeta: { lastFetchedAt: cache.lastFetchedAt, mode: cache.mode, note: cache.note }
  };
}

module.exports = {
  NEWS_TYPES,
  TRUSTED_SOURCES,
  ensureNewsHubStorage,
  hydrateCacheFromDatabase,
  refreshArticles,
  startBackgroundRefresh,
  getNewsPage,
  buildDailyReport: () => buildReport('daily'),
  buildMonthlyReport: () => buildReport('monthly')
};
