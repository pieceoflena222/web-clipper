/**
 * WEB CLIPPER - Chrome Extension Popup Script (Manifest V3)
 * Pure vanilla JavaScript - no external dependencies
 */

const STORAGE_KEY = 'web_clipper_items';

// State
let allClips = [];
let currentFilterTag = 'ALL';
let searchQuery = '';
let clipToDeleteId = null;

// DOM Elements
const tabBtnClip = document.getElementById('tab-btn-clip');
const tabBtnList = document.getElementById('tab-btn-list');
const viewClip = document.getElementById('view-clip');
const viewList = document.getElementById('view-list');
const badgeCount = document.getElementById('badge-count');
const footerCount = document.getElementById('footer-count');
const toastEl = document.getElementById('toast');

// Form Elements
const clipForm = document.getElementById('clip-form');
const inputTitle = document.getElementById('clip-title');
const inputUrl = document.getElementById('clip-url');
const inputText = document.getElementById('clip-text');
const inputNote = document.getElementById('clip-note');
const inputTags = document.getElementById('clip-tags');
const textCharCount = document.getElementById('text-char-count');
const btnRefreshInfo = document.getElementById('btn-refresh-info');
const btnRegrabText = document.getElementById('btn-regrab-text');

// List & Filter Elements
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const tagFilterList = document.getElementById('tag-filter-list');
const clipsContainer = document.getElementById('clips-container');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnClearAll = document.getElementById('btn-clear-all');

// Modal Elements
const modalConfirm = document.getElementById('modal-confirm');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadClipsFromStorage();
  await autoFetchActiveTabInfo();
});

// Setup event listeners
function setupEventListeners() {
  // Tabs
  tabBtnClip.addEventListener('click', () => switchTab('clip'));
  tabBtnList.addEventListener('click', () => switchTab('list'));

  // Form submit
  clipForm.addEventListener('submit', handleSaveClip);

  // Text character count listener
  inputText.addEventListener('input', () => {
    textCharCount.textContent = inputText.value.length;
  });

  // Re-fetch buttons
  btnRefreshInfo.addEventListener('click', () => autoFetchActiveTabInfo(true));
  btnRegrabText.addEventListener('click', () => fetchDraggedTextFromTab(true));

  // Quick tag chips
  document.querySelectorAll('.chip-quick-tag').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.getAttribute('data-tag');
      appendTag(tag);
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    btnClearSearch.classList.toggle('visible', searchQuery.length > 0);
    renderClipsList();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    btnClearSearch.classList.remove('visible');
    renderClipsList();
  });

  // Export
  btnExportCsv.addEventListener('click', exportToCsv);

  // Clear all
  btnClearAll.addEventListener('click', () => {
    if (allClips.length === 0) {
      showToast('삭제할 항목이 없습니다.');
      return;
    }
    openConfirmModal(
      '모든 클립 삭제',
      `저장된 ${allClips.length}개의 클립을 모두 영구 삭제하시겠습니까?`,
      async () => {
        allClips = [];
        await saveClipsToStorage();
        renderClipsList();
        renderTagFilters();
        updateCountBadges();
        showToast('모든 클립이 삭제되었습니다.');
      }
    );
  });

  // Modal Cancel
  modalBtnCancel.addEventListener('click', closeConfirmModal);
  modalConfirm.addEventListener('click', (e) => {
    if (e.target === modalConfirm) closeConfirmModal();
  });
}

// Switch between New Clip and Saved List tabs
function switchTab(tabName) {
  if (tabName === 'clip') {
    tabBtnClip.classList.add('active');
    tabBtnList.classList.remove('active');
    viewClip.classList.add('active');
    viewList.classList.remove('active');
  } else {
    tabBtnClip.classList.remove('active');
    tabBtnList.classList.add('active');
    viewClip.classList.remove('active');
    viewList.classList.add('active');
    renderTagFilters();
    renderClipsList();
  }
}

// Show toast message
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

// Add tag to the tag input
function appendTag(tag) {
  const current = inputTags.value.trim();
  const existingTags = current ? current.split(',').map(t => t.trim().replace(/^#/, '')) : [];
  if (!existingTags.includes(tag)) {
    existingTags.push(tag);
    inputTags.value = existingTags.join(', ');
  }
  inputTags.focus();
}

// --- Chrome Active Tab Information Retrieval ---
async function autoFetchActiveTabInfo(isManual = false) {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    // In standard browser environment or test mock
    inputTitle.value = document.title || '웹 클리퍼 예시 페이지';
    inputUrl.value = window.location.href || 'https://example.com';
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const currentTab = tabs[0];
    inputTitle.value = currentTab.title || '제목 없음';
    inputUrl.value = currentTab.url || '';

    // Automatically retrieve dragged text
    await fetchDraggedTextFromTab(false, currentTab);

    if (isManual) {
      showToast('페이지 정보를 새로고침했습니다.');
    }
  } catch (err) {
    console.warn('Tab info retrieval note:', err);
  }
}

// Grab selected text using scripting API
async function fetchDraggedTextFromTab(isManual = false, tab = null) {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    return;
  }

  try {
    if (!tab) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) return;
      tab = tabs[0];
    }

    // Check if URL is special (chrome://, edge://, file:, webstore etc.)
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
      if (isManual) {
        showToast('크롬 시스템 페이지에서는 텍스트를 읽을 수 없습니다.');
      }
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        return selection ? selection.toString().trim() : '';
      }
    });

    if (results && results[0] && results[0].result) {
      const grabbed = results[0].result;
      if (grabbed) {
        inputText.value = grabbed;
        textCharCount.textContent = grabbed.length;
        if (isManual) {
          showToast(`드래그 텍스트 (${grabbed.length}자)를 수집했습니다!`);
        }
      } else if (isManual) {
        showToast('웹페이지에서 드래그하여 선택한 텍스트가 없습니다.');
      }
    } else if (isManual) {
      showToast('선택된 텍스트가 없습니다.');
    }
  } catch (err) {
    console.warn('Script execution notice:', err);
    if (isManual) {
      showToast('페이지 보안 정책으로 인해 직접 복사해 붙여넣어 주세요.');
    }
  }
}

// --- Storage & Save Handlers ---
async function loadClipsFromStorage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([STORAGE_KEY]);
      allClips = data[STORAGE_KEY] || [];
    } else {
      // LocalStorage fallback for non-extension preview
      const localData = localStorage.getItem(STORAGE_KEY);
      allClips = localData ? JSON.parse(localData) : [];
    }
  } catch (err) {
    console.error('Storage read error:', err);
    allClips = [];
  }
  updateCountBadges();
}

async function saveClipsToStorage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: allClips });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allClips));
    }
  } catch (err) {
    console.error('Storage write error:', err);
  }
}

function updateCountBadges() {
  const count = allClips.length;
  badgeCount.textContent = count;
  footerCount.textContent = count;
}

// Save Clip
async function handleSaveClip(e) {
  e.preventDefault();

  const title = inputTitle.value.trim();
  const url = inputUrl.value.trim();
  const text = inputText.value.trim();
  const note = inputNote.value.trim();
  const rawTags = inputTags.value.trim();

  if (!title && !text) {
    showToast('제목 또는 수집할 본문 내용을 입력해주세요.');
    return;
  }

  // Parse tags
  const tags = rawTags
    ? rawTags
        .split(/[,\s]+/)
        .map(t => t.replace(/^#/, '').trim())
        .filter(t => t.length > 0)
    : [];

  const newClip = {
    id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: title || '제목 없는 클립',
    url: url || '',
    text: text,
    note: note,
    tags: tags,
    createdAt: Date.now()
  };

  // Add to the front of list
  allClips.unshift(newClip);
  await saveClipsToStorage();
  updateCountBadges();

  showToast('✓ 클립이 저장되었습니다!');

  // Clear inputs (except title and url)
  inputText.value = '';
  inputNote.value = '';
  inputTags.value = '';
  textCharCount.textContent = '0';

  // Automatically show list after 500ms
  setTimeout(() => {
    switchTab('list');
  }, 400);
}

// --- Render Saved List & Filters ---
function renderTagFilters() {
  // Collect all unique tags
  const tagSet = new Set();
  allClips.forEach(c => {
    (c.tags || []).forEach(t => tagSet.add(t));
  });

  const uniqueTags = Array.from(tagSet);

  if (uniqueTags.length === 0) {
    tagFilterList.innerHTML = '';
    tagFilterList.style.display = 'none';
    currentFilterTag = 'ALL';
    return;
  }

  tagFilterList.style.display = 'flex';
  let html = `
    <button class="tag-filter-chip ${currentFilterTag === 'ALL' ? 'active' : ''}" data-filter="ALL">전체</button>
  `;

  uniqueTags.forEach(tag => {
    const isActive = currentFilterTag === tag ? 'active' : '';
    html += `<button class="tag-filter-chip ${isActive}" data-filter="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
  });

  tagFilterList.innerHTML = html;

  tagFilterList.querySelectorAll('.tag-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilterTag = btn.getAttribute('data-filter');
      renderTagFilters();
      renderClipsList();
    });
  });
}

function renderClipsList() {
  let filtered = allClips;

  // Filter by Tag
  if (currentFilterTag !== 'ALL') {
    filtered = filtered.filter(c => (c.tags || []).includes(currentFilterTag));
  }

  // Filter by Search Query
  if (searchQuery) {
    filtered = filtered.filter(c => {
      const matchTitle = (c.title || '').toLowerCase().includes(searchQuery);
      const matchText = (c.text || '').toLowerCase().includes(searchQuery);
      const matchNote = (c.note || '').toLowerCase().includes(searchQuery);
      const matchUrl = (c.url || '').toLowerCase().includes(searchQuery);
      const matchTag = (c.tags || []).some(t => t.toLowerCase().includes(searchQuery));
      return matchTitle || matchText || matchNote || matchUrl || matchTag;
    });
  }

  if (filtered.length === 0) {
    if (allClips.length === 0) {
      clipsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </div>
          <div class="empty-title">저장된 클립이 없습니다</div>
          <div class="empty-desc">웹 서핑 중 유용한 본문을 드래그하고 '수집하기' 탭에서 저장해보세요!</div>
        </div>
      `;
    } else {
      clipsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">일치하는 항목이 없습니다</div>
          <div class="empty-desc">다른 검색어나 태그 필터를 선택해보세요.</div>
        </div>
      `;
    }
    return;
  }

  clipsContainer.innerHTML = filtered.map(clip => {
    const formattedDate = formatDate(clip.createdAt);
    const domain = getDomain(clip.url);
    const hasNote = clip.note && clip.note.trim().length > 0;
    const hasText = clip.text && clip.text.trim().length > 0;
    const hasTags = clip.tags && clip.tags.length > 0;

    return `
      <div class="clip-card" data-id="${clip.id}">
        <div class="card-header">
          <a href="${escapeHtml(clip.url || '#')}" target="_blank" rel="noopener noreferrer" class="card-title-link" title="${escapeHtml(clip.title)}">
            ${escapeHtml(clip.title)}
          </a>
          <div class="card-actions">
            <button class="btn-card-action btn-copy-card" title="클립 내용 복사" data-id="${clip.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-card-action delete btn-delete-card" title="삭제" data-id="${clip.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        ${hasText ? `<div class="card-snippet">${escapeHtml(clip.text)}</div>` : ''}

        ${hasNote ? `
          <div class="card-note">
            <span class="card-note-label">📝 메모:</span>${escapeHtml(clip.note)}
          </div>
        ` : ''}

        <div class="card-footer">
          <div class="card-tags">
            ${domain ? `<span class="card-tag" style="background:#f1f5f9;color:#475569;">${escapeHtml(domain)}</span>` : ''}
            ${hasTags ? clip.tags.map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('') : ''}
          </div>
          <span class="card-date">${formattedDate}</span>
        </div>
      </div>
    `;
  }).join('');

  // Attach card action listeners
  clipsContainer.querySelectorAll('.btn-copy-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const clip = allClips.find(c => c.id === id);
      if (clip) {
        copyClipToClipboard(clip);
      }
    });
  });

  clipsContainer.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const clip = allClips.find(c => c.id === id);
      if (clip) {
        openConfirmModal('클립 삭제', `"${clip.title.substring(0, 25)}..." 항목을 삭제하시겠습니까?`, async () => {
          allClips = allClips.filter(c => c.id !== id);
          await saveClipsToStorage();
          renderTagFilters();
          renderClipsList();
          updateCountBadges();
          showToast('삭제되었습니다.');
        });
      }
    });
  });
}

// Copy clip details to clipboard
function copyClipToClipboard(clip) {
  let content = `[${clip.title}]\nURL: ${clip.url}\n`;
  if (clip.text) content += `\n[수집 내용]\n${clip.text}\n`;
  if (clip.note) content += `\n[개인 메모]\n${clip.note}\n`;
  if (clip.tags && clip.tags.length > 0) content += `\n태그: ${clip.tags.map(t => '#' + t).join(' ')}\n`;

  navigator.clipboard.writeText(content).then(() => {
    showToast('클립보드에 복사되었습니다!');
  }).catch(() => {
    showToast('복사에 실패했습니다.');
  });
}

// --- CSV Export ---
function exportToCsv() {
  if (allClips.length === 0) {
    showToast('내보낼 클립 데이터가 없습니다.');
    return;
  }

  // Header row
  const headers = ['ID', '등록일시', '페이지제목', '웹페이지URL', '수집본문내용', '개인메모', '태그목록'];
  
  const csvRows = [headers.map(escapeCsvValue).join(',')];

  allClips.forEach(clip => {
    const row = [
      clip.id,
      formatDate(clip.createdAt, true),
      clip.title || '',
      clip.url || '',
      clip.text || '',
      clip.note || '',
      (clip.tags || []).join('; ')
    ];
    csvRows.push(row.map(escapeCsvValue).join(','));
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel in Windows/Mac automatically opens in UTF-8 without garbled Korean
  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const now = new Date();
  const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = `web-clipper-data_${dateStr}.csv`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  showToast(`CSV 다운로드 완료 (${allClips.length}건)`);
}

function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// --- Modal Confirm Helper ---
let modalConfirmCallback = null;

function openConfirmModal(title, message, callback) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalConfirmCallback = callback;
  modalConfirm.classList.remove('hidden');

  modalBtnConfirm.onclick = () => {
    if (modalConfirmCallback) {
      modalConfirmCallback();
      modalConfirmCallback = null;
    }
    closeConfirmModal();
  };
}

function closeConfirmModal() {
  modalConfirm.classList.add('hidden');
  modalConfirmCallback = null;
}

// --- Utility Functions ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDomain(url) {
  try {
    if (!url) return '';
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function formatDate(timestamp, full = false) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());

  if (full) {
    const ss = pad(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }
  return `${m}.${day} ${hh}:${mm}`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
