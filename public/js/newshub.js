(function () {
  const daily = reportConfig('daily');
  const monthly = reportConfig('monthly');
  const newsList = document.getElementById('nh-news-list');
  const newsStatus = document.getElementById('nh-news-status');
  const emptyBox = document.getElementById('nh-empty');
  const loadMoreButton = document.getElementById('nh-load-more');
  const refreshAllButton = document.getElementById('nh-refresh-all');
  const typeFilter = document.getElementById('nh-type-filter');
  const sourceFilter = document.getElementById('nh-source-filter');
  const cacheNote = document.getElementById('nh-cache-note');

  function reportConfig(prefix) {
    return {
      prefix,
      loading: document.getElementById(`nh-${prefix}-loading`),
      content: document.getElementById(`nh-${prefix}-content`),
      refresh: document.getElementById(`nh-refresh-${prefix}`)
    };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
  }

  function setReportLoading(config, loading) {
    config.loading?.classList.toggle('nh-hidden', !loading);
    config.content?.classList.toggle('nh-hidden', loading);
    if (config.refresh) config.refresh.disabled = loading;
  }

  function barRow(label, count, max) {
    const width = max ? Math.max(7, Math.round((count / max) * 100)) : 0;
    return `<div class="newshub-bar"><div><span>${escapeHtml(label)}</span><strong>${count}</strong></div><div class="newshub-bar-track"><span style="width:${width}%"></span></div></div>`;
  }

  function renderUsedArticles(target, articles) {
    target.innerHTML = articles.length ? articles.map((article) => `
      <article class="newshub-used-article">
        <strong><a href="${safeUrl(article.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></strong>
        <p>${escapeHtml(article.sourceName)} · ${formatDate(article.publishedAt)} · ${escapeHtml(article.freshnessLabel)}</p>
        <div class="newshub-chip-row">${article.newsTypes.map((type) => `<span>${escapeHtml(type)}</span>`).join('')}</div>
      </article>`).join('') : '<p>No articles were available for this report.</p>';
  }

  function renderReport(config, report) {
    const prefix = config.prefix;
    document.getElementById(`nh-${prefix}-total`).textContent = report.totalArticles || 0;
    document.getElementById(`nh-${prefix}-leading`).textContent = report.leadingType?.type || 'No strong signal';
    document.getElementById(`nh-${prefix}-source`).textContent = report.leadingSource?.sourceName || 'No source signal';
    document.getElementById(`nh-${prefix}-window`).textContent = `${report.windowLabel} · generated ${formatDate(report.generatedAt)}`;
    document.getElementById(`nh-${prefix}-fallback`).textContent = report.fallbackReason || '';
    const maxType = Math.max(1, ...report.typeCounts.map((item) => item.count));
    const maxSource = Math.max(1, ...report.sourceCounts.map((item) => item.count));
    document.getElementById(`nh-${prefix}-type-bars`).innerHTML = report.typeCounts.length ? report.typeCounts.map((item) => barRow(item.type, item.count, maxType)).join('') : '<p>No category signal yet.</p>';
    document.getElementById(`nh-${prefix}-source-bars`).innerHTML = report.sourceCounts.length ? report.sourceCounts.map((item) => barRow(item.sourceName, item.count, maxSource)).join('') : '<p>No source signal yet.</p>';
    renderUsedArticles(document.getElementById(`nh-${prefix}-articles`), report.articlesUsed || []);
    setReportLoading(config, false);
  }

  async function loadReport(config, force = false) {
    setReportLoading(config, true);
    try {
      const response = await fetch(`/api/newshub/${config.prefix}-report${force ? '?force=1' : ''}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderReport(config, data.report);
      if (data.report.cacheMeta?.note && cacheNote) cacheNote.textContent = data.report.cacheMeta.note;
    } catch (error) {
      config.loading.innerHTML = `<strong>Report unavailable.</strong><p>The cached Game News section can still be used. ${escapeHtml(error.message)}</p>`;
    }
  }

  function articleCard(article) {
    return `<article class="newshub-article pixel-panel">
      <div class="newshub-article-meta"><span>${escapeHtml(article.sourceName)}</span><span>${escapeHtml(article.freshnessLabel)}</span><span>${formatDate(article.publishedAt)}</span></div>
      <h3><a href="${safeUrl(article.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h3>
      <p>${escapeHtml(article.summary)}</p>
      <div class="newshub-chip-row">${article.newsTypes.map((type) => `<span>${escapeHtml(type)}</span>`).join('')}</div>
    </article>`;
  }

  async function loadNews({ page = 1, replace = false, force = false } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: '6', type: typeFilter.value, source: sourceFilter.value });
    if (force) params.set('force', '1');
    if (newsStatus) newsStatus.textContent = force ? 'Refreshing trusted RSS feeds…' : 'Loading articles…';
    if (loadMoreButton) loadMoreButton.disabled = true;
    try {
      const response = await fetch(`/api/newshub/news?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (replace) newsList.innerHTML = '';
      if (data.articles.length) newsList.insertAdjacentHTML('beforeend', data.articles.map(articleCard).join(''));
      emptyBox?.classList.toggle('nh-hidden', data.total > 0);
      if (loadMoreButton) {
        loadMoreButton.dataset.nextPage = String(page + 1);
        loadMoreButton.dataset.hasMore = String(data.hasMore);
        loadMoreButton.classList.toggle('nh-hidden', !data.hasMore);
        loadMoreButton.disabled = false;
      }
      if (newsStatus) newsStatus.textContent = `${data.recent24hCount} article(s) from the last 24 hours · ${data.total} trusted cached article(s) available.`;
      if (data.cacheMeta?.note && cacheNote) cacheNote.textContent = data.cacheMeta.note;
      return data;
    } catch (error) {
      if (newsStatus) newsStatus.textContent = `Could not load Game News: ${error.message}`;
      if (loadMoreButton) loadMoreButton.disabled = false;
      return null;
    }
  }

  async function refreshEverything() {
    refreshAllButton.disabled = true;
    refreshAllButton.textContent = 'Refreshing feeds…';
    await loadNews({ page: 1, replace: true, force: true });
    await Promise.all([loadReport(daily, false), loadReport(monthly, false)]);
    refreshAllButton.disabled = false;
    refreshAllButton.textContent = 'Refresh trusted feeds';
  }

  daily.refresh?.addEventListener('click', () => loadReport(daily, true));
  monthly.refresh?.addEventListener('click', () => loadReport(monthly, true));
  refreshAllButton?.addEventListener('click', refreshEverything);
  loadMoreButton?.addEventListener('click', () => loadNews({ page: Number(loadMoreButton.dataset.nextPage || 2) }));
  typeFilter?.addEventListener('change', () => loadNews({ page: 1, replace: true }));
  sourceFilter?.addEventListener('change', () => loadNews({ page: 1, replace: true }));

  if (loadMoreButton) loadMoreButton.classList.toggle('nh-hidden', loadMoreButton.dataset.hasMore !== 'true');
  loadReport(daily, false);
  loadReport(monthly, false);
  if (!newsList.children.length) loadNews({ page: 1, replace: true, force: true });
})();
