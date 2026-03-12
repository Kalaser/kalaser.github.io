(function () {
  const DEFAULT_USERNAME = 'kalaser';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toISOString().slice(0, 10);
  }

  function getCategories(repo) {
    const categories = [];
    if (repo.language) categories.push(repo.language);
    (repo.topics || []).forEach((t) => categories.push(t));
    return categories;
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return res.json();
  }

  async function loadRepos(username) {
    return fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
  }

  async function loadUser(username) {
    return fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
  }

  function renderHome(user, repos) {
    const root = document.getElementById('gh-home');
    if (!root) return;

    root.innerHTML = `
      <div class="d-flex flex-column flex-md-row align-items-md-center gap-3">
        <img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.login)} avatar" width="92" height="92" style="border-radius: 50%; object-fit: cover;" />
        <div>
          <h2 class="mb-1">${escapeHtml(user.login)}</h2>
          <p class="mb-2">GitHub 主页与项目导航</p>
          <p class="mb-2 text-muted">${escapeHtml(user.bio || '专注于持续迭代与项目交付。')}</p>
          <p class="mb-0">
            <a href="${escapeHtml(user.html_url)}" target="_blank" rel="noopener">GitHub 主页</a> ·
            <a href="${escapeHtml(user.html_url)}?tab=repositories" target="_blank" rel="noopener">仓库列表</a>
          </p>
        </div>
      </div>
      <hr />
      <p class="mb-0">公开仓库：<strong>${repos.length}</strong> · Followers：<strong>${user.followers}</strong> · Following：<strong>${user.following}</strong></p>
    `;
  }

  function renderCloud(repos, username) {
    const root = document.getElementById('gh-categories-cloud');
    if (!root) return;

    const weight = new Map();
    repos.forEach((repo) => {
      getCategories(repo).forEach((name) => {
        if (!name) return;
        weight.set(name, (weight.get(name) || 0) + 1);
      });
    });

    const items = Array.from(weight.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30);
    if (items.length === 0) {
      root.innerHTML = '<p>暂无可展示的分类词云。</p>';
      return;
    }

    const max = items[0][1];
    const min = items[items.length - 1][1];
    const spread = max - min || 1;

    root.innerHTML = items
      .map(([name, count]) => {
        const size = 14 + ((count - min) / spread) * 18;
        const query = encodeURIComponent(`user:${username} ${name}`);
        return `<a href="https://github.com/search?q=${query}&type=repositories" target="_blank" rel="noopener" style="display:inline-block;margin:6px 8px;font-size:${size.toFixed(1)}px;">${escapeHtml(name)}</a>`;
      })
      .join('');
  }

  function renderTags(repos, username) {
    const root = document.getElementById('gh-tags');
    if (!root) return;

    const tags = new Map();
    repos.forEach((repo) => {
      (repo.topics || []).forEach((topic) => tags.set(topic, (tags.get(topic) || 0) + 1));
    });

    const items = Array.from(tags.entries()).sort((a, b) => b[1] - a[1]);
    if (items.length === 0) {
      root.innerHTML = '<p>暂无 topic 标签；可在 GitHub 仓库设置 Topics 后自动显示。</p>';
      return;
    }

    root.innerHTML = items
      .map(([tag, count]) => {
        const q = encodeURIComponent(`user:${username} topic:${tag}`);
        return `<a href="https://github.com/search?q=${q}&type=repositories" target="_blank" rel="noopener" style="display:inline-block;margin:6px 8px;padding:4px 12px;border:1px solid var(--main-border-color,#d0d7de);border-radius:999px;">#${escapeHtml(tag)} (${count})</a>`;
      })
      .join('');
  }

  function renderArchives(repos) {
    const root = document.getElementById('gh-archives');
    if (!root) return;

    const sorted = [...repos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    root.innerHTML = sorted
      .map((repo) => `
        <li>
          <strong>${escapeHtml(repo.name)}</strong> · ${formatDate(repo.created_at)}
          <br />
          ${escapeHtml(repo.description || '暂无描述')}
          <br />
          技术栈：${escapeHtml([repo.language, ...(repo.topics || [])].filter(Boolean).join(', ') || '未标注')}
          <br />
          <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">查看项目</a>
        </li>
      `)
      .join('');
  }

  function renderProjects(repos) {
    const root = document.getElementById('gh-projects');
    if (!root) return;

    const sorted = [...repos].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    root.innerHTML = sorted
      .map((repo) => `
        <li>
          <strong>${escapeHtml(repo.name)}</strong>
          <br />
          ${escapeHtml(repo.description || '暂无描述')}
          <br />
          标签：${escapeHtml([repo.language, ...(repo.topics || [])].filter(Boolean).join(', ') || '未标注')}
          <br />
          <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">查看仓库</a>
        </li>
      `)
      .join('');
  }

  async function boot() {
    const username = document.body.dataset.ghUser || DEFAULT_USERNAME;
    const status = document.getElementById('gh-load-status');
    try {
      const [user, repos] = await Promise.all([loadUser(username), loadRepos(username)]);
      renderHome(user, repos);
      renderCloud(repos, username);
      renderTags(repos, username);
      renderArchives(repos);
      renderProjects(repos);
      if (status) status.textContent = `已加载 ${repos.length} 个仓库。`;
    } catch (err) {
      if (status) status.textContent = `加载失败：${err.message}`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
