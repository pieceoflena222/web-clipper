import JSZip from 'jszip';
import { iconsData } from './iconsBase64';

export interface ExtensionFile {
  name: string;
  path: string;
  content: string;
  language: string;
  description: string;
}

export const EXTENSION_MANIFEST = `{
  "manifest_version": 3,
  "name": "WEB CLIPPER",
  "version": "1.0.0",
  "description": "웹페이지의 제목, URL, 드래그한 본문 텍스트와 메모/태그를 손쉽게 수집하고 CSV로 내보내는 크롬 확장 프로그램",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "WEB CLIPPER 열기",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}`;

export const EXTENSION_POPUP_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WEB CLIPPER</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </div>
        <div>
          <h1 class="brand-title">WEB CLIPPER</h1>
          <span class="brand-subtitle">Smart Web Collector</span>
        </div>
      </div>
      <div class="nav-tabs">
        <button id="tab-btn-clip" class="nav-btn active" title="새 클립 추가">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          수집하기
        </button>
        <button id="tab-btn-list" class="nav-btn" title="저장된 목록 보기">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          저장함 <span id="badge-count" class="badge">0</span>
        </button>
      </div>
    </header>

    <!-- Toast Notification -->
    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <!-- MAIN VIEW 1: CLIP FORM -->
    <main id="view-clip" class="view-panel active">
      <form id="clip-form">
        <!-- Page Title & URL Section -->
        <div class="field-group">
          <div class="field-label-row">
            <label for="clip-title" class="field-label">웹페이지 제목</label>
            <span class="badge-auto">자동 감지</span>
          </div>
          <div class="input-with-action">
            <input type="text" id="clip-title" class="input-text" placeholder="페이지 제목을 불러오는 중..." required />
            <button type="button" id="btn-refresh-info" class="btn-icon-refresh" title="페이지 정보 다시 읽기">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
          </div>
        </div>

        <div class="field-group">
          <label for="clip-url" class="field-label">웹페이지 URL</label>
          <input type="url" id="clip-url" class="input-text input-readonly" readonly placeholder="https://..." />
        </div>

        <!-- Selected Text Section -->
        <div class="field-group">
          <div class="field-label-row">
            <label for="clip-text" class="field-label">수집된 본문 텍스트 (드래그)</label>
            <button type="button" id="btn-regrab-text" class="btn-text-action">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              드래그 텍스트 다시 가져오기
            </button>
          </div>
          <textarea id="clip-text" class="input-textarea" rows="4" placeholder="웹페이지에서 마우스로 드래그한 텍스트가 자동으로 채워집니다. 필요한 경우 직접 편집하거나 붙여넣을 수도 있습니다."></textarea>
          <div class="char-helper"><span id="text-char-count">0</span>자</div>
        </div>

        <!-- Personal Notes Section -->
        <div class="field-group">
          <label for="clip-note" class="field-label">개인 메모</label>
          <textarea id="clip-note" class="input-textarea" rows="2" placeholder="이 자료에 대한 생각, 기억할 점, 활용 아이디어를 적어보세요..."></textarea>
        </div>

        <!-- Tags Section -->
        <div class="field-group">
          <label for="clip-tags" class="field-label">태그 (쉼표 또는 엔터로 구분)</label>
          <input type="text" id="clip-tags" class="input-text" placeholder="예: 개발, 업무, 아이디어, 기사" />
          <div class="quick-tags-container">
            <span class="quick-tag-label">추천:</span>
            <button type="button" class="chip-quick-tag" data-tag="업무">#업무</button>
            <button type="button" class="chip-quick-tag" data-tag="레퍼런스">#레퍼런스</button>
            <button type="button" class="chip-quick-tag" data-tag="아이디어">#아이디어</button>
            <button type="button" class="chip-quick-tag" data-tag="할일">#할일</button>
            <button type="button" class="chip-quick-tag" data-tag="기사">#기사</button>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button type="submit" id="btn-save-clip" class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            클립 저장하기
          </button>
        </div>
      </form>
    </main>

    <!-- MAIN VIEW 2: SAVED LIST -->
    <section id="view-list" class="view-panel">
      <!-- Search & Tag Filter Bar -->
      <div class="filter-toolbar">
        <div class="search-box">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="search-input" class="search-input" placeholder="제목, 본문, 메모, 태그 검색..." />
          <button type="button" id="btn-clear-search" class="btn-clear-search" title="검색어 지우기">&times;</button>
        </div>
        <div id="tag-filter-list" class="tag-filter-list">
          <!-- Dynamic tags will be rendered here -->
        </div>
      </div>

      <!-- Clips Cards Container -->
      <div id="clips-container" class="clips-container">
        <!-- Rendered items or empty state -->
      </div>

      <!-- Bottom Action Bar (Export CSV, JSON, Delete All) -->
      <footer class="list-footer">
        <div class="footer-stats">
          총 <strong id="footer-count">0</strong>개 항목
        </div>
        <div class="footer-buttons">
          <button type="button" id="btn-export-csv" class="btn-export" title="엑셀 호환 UTF-8 BOM CSV 파일 다운로드">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV 내보내기
          </button>
          <button type="button" id="btn-clear-all" class="btn-danger-outline" title="저장된 자료 모두 삭제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            전체 비우기
          </button>
        </div>
      </footer>
    </section>

    <!-- Confirm Modal -->
    <div id="modal-confirm" class="modal-backdrop hidden">
      <div class="modal-dialog">
        <h3 id="modal-title" class="modal-title">확인</h3>
        <p id="modal-message" class="modal-desc">정말 삭제하시겠습니까?</p>
        <div class="modal-actions">
          <button type="button" id="modal-btn-cancel" class="btn-secondary">취소</button>
          <button type="button" id="modal-btn-confirm" class="btn-danger">삭제</button>
        </div>
      </div>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

export const EXTENSION_POPUP_CSS = `/* WEB CLIPPER - Chrome Extension Popup Stylesheet */
:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;
  --primary-border: #bfdbfe;
  
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  
  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;
  
  --border: #e2e8f0;
  --border-focus: #3b82f6;
  
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --danger-light: #fef2f2;
  
  --success: #10b981;
  --success-light: #ecfdf5;
  
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 400px;
  min-height: 520px;
  max-height: 580px;
  background-color: var(--bg-app);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", "Noto Sans KR", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  user-select: none;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 560px;
  position: relative;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(37, 99, 235, 0.3);
}

.brand-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #0f172a;
}

.brand-subtitle {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  display: block;
}

.nav-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: var(--radius-md);
  gap: 2px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover {
  color: var(--text-main);
}

.nav-btn.active {
  background: #ffffff;
  color: var(--primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: 9999px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
}

/* Toast */
.toast {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background: #0f172a;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* View Panels */
.view-panel {
  display: none;
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.view-panel.active {
  display: flex;
  flex-direction: column;
}

/* Form Styles */
.field-group {
  margin-bottom: 12px;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  display: block;
}

.badge-auto {
  font-size: 9px;
  color: #0284c7;
  background: #e0f2fe;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.btn-text-action {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.btn-text-action:hover {
  text-decoration: underline;
}

.input-with-action {
  position: relative;
  display: flex;
  align-items: center;
}

.input-text, .input-textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-main);
  font-size: 12px;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-text:focus, .input-textarea:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.input-readonly {
  background: #f1f5f9;
  color: #64748b;
  cursor: default;
  font-family: monospace;
  font-size: 11px;
}

.btn-icon-refresh {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon-refresh:hover {
  color: var(--primary);
  background: #e2e8f0;
}

.input-textarea {
  resize: vertical;
  min-height: 50px;
  line-height: 1.5;
}

.char-helper {
  text-align: right;
  font-size: 10px;
  color: var(--text-subtle);
  margin-top: 2px;
}

/* Quick Tags */
.quick-tags-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.quick-tag-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
}

.chip-quick-tag {
  background: #e2e8f0;
  border: none;
  border-radius: 9999px;
  padding: 2px 8px;
  font-size: 10px;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.chip-quick-tag:hover {
  background: var(--primary-light);
  color: var(--primary);
}

/* Buttons */
.btn-primary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--primary);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow: 0 3px 6px rgba(37, 99, 235, 0.35);
}

.btn-primary:active {
  transform: translateY(1px);
}

/* LIST VIEW */
.filter-toolbar {
  margin-bottom: 10px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-subtle);
}

.search-input {
  width: 100%;
  padding: 7px 28px 7px 30px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: var(--border-focus);
}

.btn-clear-search {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-subtle);
  cursor: pointer;
  display: none;
}

.btn-clear-search.visible {
  display: block;
}

.tag-filter-list {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 6px 0 2px 0;
  scrollbar-width: none;
}

.tag-filter-list::-webkit-scrollbar {
  display: none;
}

.tag-filter-chip {
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
}

.tag-filter-chip.active {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
  font-weight: 600;
}

/* Cards Container */
.clips-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.clip-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
  position: relative;
}

.clip-card:hover {
  border-color: #cbd5e1;
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.card-title-link {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.card-title-link:hover {
  color: var(--primary);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.btn-card-action {
  background: none;
  border: none;
  color: var(--text-subtle);
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-card-action:hover {
  color: var(--text-main);
  background: #f1f5f9;
}

.btn-card-action.delete:hover {
  color: var(--danger);
  background: var(--danger-light);
}

.card-snippet {
  font-size: 11px;
  color: #475569;
  background: #f8fafc;
  border-left: 3px solid var(--primary);
  padding: 6px 8px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin-bottom: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 90px;
  overflow-y: auto;
}

.card-note {
  font-size: 11px;
  color: #78350f;
  background: #fffbeb;
  border: 1px dashed #fcd34d;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}

.card-note-label {
  font-weight: 700;
  font-size: 10px;
  margin-right: 4px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-subtle);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.card-tag {
  background: #eff6ff;
  color: #2563eb;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.card-date {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 12px;
  max-width: 260px;
}

/* Footer of List */
.list-footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-stats {
  font-size: 11px;
  color: var(--text-muted);
}

.footer-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #10b981;
  color: #ffffff;
  border: none;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-export:hover {
  background: #059669;
}

.btn-danger-outline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: #ef4444;
  border: 1px solid #fca5a5;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger-outline:hover {
  background: var(--danger-light);
  border-color: var(--danger);
}

/* Modal */
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 200;
}

.modal-backdrop.hidden {
  display: none;
}

.modal-dialog {
  background: #ffffff;
  border-radius: var(--radius-lg);
  padding: 16px;
  width: 100%;
  max-width: 300px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
}

.modal-desc {
  font-size: 12px;
  color: #475569;
  margin-bottom: 16px;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-secondary {
  background: #f1f5f9;
  border: 1px solid var(--border);
  color: #475569;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger {
  background: var(--danger);
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
`;

export const EXTENSION_POPUP_JS = `/**
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
      \`저장된 \${allClips.length}개의 클립을 모두 영구 삭제하시겠습니까?\`,
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
          showToast(\`드래그 텍스트 (\${grabbed.length}자)를 수집했습니다!\`);
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

  // Automatically show list after 400ms
  setTimeout(() => {
    switchTab('list');
  }, 400);
}

// --- Render Saved List & Filters ---
function renderTagFilters() {
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
  let html = \`
    <button class="tag-filter-chip \${currentFilterTag === 'ALL' ? 'active' : ''}" data-filter="ALL">전체</button>
  \`;

  uniqueTags.forEach(tag => {
    const isActive = currentFilterTag === tag ? 'active' : '';
    html += \`<button class="tag-filter-chip \${isActive}" data-filter="\${escapeHtml(tag)}">#\${escapeHtml(tag)}</button>\`;
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

  if (currentFilterTag !== 'ALL') {
    filtered = filtered.filter(c => (c.tags || []).includes(currentFilterTag));
  }

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
      clipsContainer.innerHTML = \`
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </div>
          <div class="empty-title">저장된 클립이 없습니다</div>
          <div class="empty-desc">웹 서핑 중 유용한 본문을 드래그하고 '수집하기' 탭에서 저장해보세요!</div>
        </div>
      \`;
    } else {
      clipsContainer.innerHTML = \`
        <div class="empty-state">
          <div class="empty-title">일치하는 항목이 없습니다</div>
          <div class="empty-desc">다른 검색어나 태그 필터를 선택해보세요.</div>
        </div>
      \`;
    }
    return;
  }

  clipsContainer.innerHTML = filtered.map(clip => {
    const formattedDate = formatDate(clip.createdAt);
    const domain = getDomain(clip.url);
    const hasNote = clip.note && clip.note.trim().length > 0;
    const hasText = clip.text && clip.text.trim().length > 0;
    const hasTags = clip.tags && clip.tags.length > 0;

    return \`
      <div class="clip-card" data-id="\${clip.id}">
        <div class="card-header">
          <a href="\${escapeHtml(clip.url || '#')}" target="_blank" rel="noopener noreferrer" class="card-title-link" title="\${escapeHtml(clip.title)}">
            \${escapeHtml(clip.title)}
          </a>
          <div class="card-actions">
            <button class="btn-card-action btn-copy-card" title="클립 내용 복사" data-id="\${clip.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-card-action delete btn-delete-card" title="삭제" data-id="\${clip.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        \${hasText ? \`<div class="card-snippet">\${escapeHtml(clip.text)}</div>\` : ''}

        \${hasNote ? \`
          <div class="card-note">
            <span class="card-note-label">📝 메모:</span>\${escapeHtml(clip.note)}
          </div>
        \` : ''}

        <div class="card-footer">
          <div class="card-tags">
            \${domain ? \`<span class="card-tag" style="background:#f1f5f9;color:#475569;">\${escapeHtml(domain)}</span>\` : ''}
            \${hasTags ? clip.tags.map(t => \`<span class="card-tag">#\${escapeHtml(t)}</span>\`).join('') : ''}
          </div>
          <span class="card-date">\${formattedDate}</span>
        </div>
      </div>
    \`;
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
        openConfirmModal('클립 삭제', \`"\${clip.title.substring(0, 25)}..." 항목을 삭제하시겠습니까?\`, async () => {
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

function copyClipToClipboard(clip) {
  let content = \`[\${clip.title}]\nURL: \${clip.url}\n\`;
  if (clip.text) content += \`\n[수집 내용]\n\${clip.text}\n\`;
  if (clip.note) content += \`\n[개인 메모]\n\${clip.note}\n\`;
  if (clip.tags && clip.tags.length > 0) content += \`\n태그: \${clip.tags.map(t => '#' + t).join(' ')}\n\`;

  navigator.clipboard.writeText(content).then(() => {
    showToast('클립보드에 복사되었습니다!');
  }).catch(() => {
    showToast('복사에 실패했습니다.');
  });
}

function exportToCsv() {
  if (allClips.length === 0) {
    showToast('내보낼 클립 데이터가 없습니다.');
    return;
  }

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

  const csvString = '\\uFEFF' + csvRows.join('\\r\\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const now = new Date();
  const dateStr = \`\${now.getFullYear()}\${pad(now.getMonth()+1)}\${pad(now.getDate())}_\${pad(now.getHours())}\${pad(now.getMinutes())}\`;
  const filename = \`web-clipper-data_\${dateStr}.csv\`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  showToast(\`CSV 다운로드 완료 (\${allClips.length}건)\`);
}

function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return \`"\${str}"\`;
}

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
    return \`\${y}-\${m}-\${day} \${hh}:\${mm}:\${ss}\`;
  }
  return \`\${m}.\${day} \${hh}:\${mm}\`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
`;

export const EXTENSION_README = `# WEB CLIPPER (Chrome Extension Manifest V3)

> 웹 서핑 중 발견한 유용한 웹페이지의 제목, URL, 드래그한 텍스트 및 개인 메모를 1초 만에 스크랩하고, CSV 파일로 한 번에 내보내는 Chrome 확장 프로그램입니다.

---

## 📁 폴더 구성
이 폴더(\`web-clipper-extension\`)는 Chrome에 바로 설치할 수 있는 독립형 확장 프로그램 패키지입니다:
- \`manifest.json\`: Chrome Manifest V3 설정 파일
- \`popup.html\`: 확장 프로그램 팝업 UI 레이아웃
- \`popup.css\`: 세련되고 직관적인 독립형 스타일시트
- \`popup.js\`: 웹페이지 정보/드래그 텍스트 자동 수집, 스토리지 저장, 검색 및 엑셀 호환 CSV 내보내기 엔진
- \`icons/\`: 확장 프로그램 아이콘 (16px, 48px, 128px)

---

## 🚀 Chrome에 바로 설치하는 초간단 방법 (1분 완료)

1. **폴더 준비**:
   - 다운로드한 \`web-clipper-extension.zip\`의 압축을 풉니다.
   - 압축 해제된 \`web-clipper-extension\` 폴더 위치를 확인합니다.

2. **크롬 확장 프로그램 관리 페이지 접속**:
   - 크롬 브라우저를 열고 주소창에 \`chrome://extensions\` 를 입력 후 Enter를 누릅니다.
   - 또는 크롬 우측 상단 \`⋮\` (메뉴) > **확장 프로그램** > **확장 프로그램 관리**를 클릭합니다.

3. **개발자 모드 켜기**:
   - 화면 우측 상단의 **[개발자 모드 (Developer mode)]** 토글 스위치를 켭니다.

4. **확장 프로그램 로드**:
   - 화면 좌측 상단에 나타난 **[압축해제된 확장 프로그램을 로드합니다]** (Load unpacked) 버튼을 클릭합니다.
   - 방금 압축 해제한 \`web-clipper-extension\` 폴더를 선택합니다.

5. **완료 및 상단 핀 고정**:
   - 크롬 주소창 우측 퍼즐 모양 아이콘(🧩)을 클릭하고, **WEB CLIPPER** 옆의 📌 핀 아이콘을 클릭하여 고정합니다.

---

## 🧪 테스트 및 사용 방법

1. **텍스트 드래그 및 수집**:
   - 아무 웹사이트(예: 뉴스 기사, 블로그, 기술 문서 등)에 접속합니다.
   - 마우스로 스크랩하고 싶은 본문 텍스트를 드래그하여 블록을 지정합니다.
   - 크롬 툴바의 **WEB CLIPPER 아이콘**을 클릭합니다.
   - **페이지 제목**, **URL**, **드래그한 텍스트**가 자동으로 채워져 있는 것을 확인할 수 있습니다!

2. **메모와 태그 추가**:
   - 개인 메모란에 생각이나 해야 할 일을 적습니다.
   - 태그 입력란에 \`#업무\`, \`#기사\` 등을 입력하거나 추천 태그를 클릭합니다.
   - **[클립 저장하기]** 버튼을 누르면 즉시 저장됩니다.

3. **저장함 확인 및 검색**:
   - 상단 **[저장함]** 탭을 클릭하여 저장된 클립 카드를 확인합니다.
   - 상단 검색창에 키워드를 입력해 실시간 검색하거나, 태그 칩을 눌러 필터링합니다.

4. **CSV 엑셀 다운로드**:
   - 하단의 **[CSV 내보내기]** 버튼을 클릭하면 UTF-8 BOM(한글 깨짐 방지)이 적용된 엑셀 호환 \`.csv\` 파일이 즉시 다운로드됩니다!

---

## 🔒 보안 및 권한 안내
- \`activeTab\`: 현재 보고 있는 탭의 제목 및 URL 확인
- \`scripting\`: 사용자가 드래그한 본문 텍스트 읽기
- \`storage\`: 브라우저 내부(\`chrome.storage.local\`)에 데이터 안전 보관 (외부 전송 없음)
- 외부 서버 통신이나 개인정보 수집이 전혀 없는 100% 로컬 독립형 확장 프로그램입니다.
`;

export const EXTENSION_FILES: ExtensionFile[] = [
  {
    name: 'manifest.json',
    path: 'web-clipper-extension/manifest.json',
    content: EXTENSION_MANIFEST,
    language: 'json',
    description: 'Manifest V3 명세서 (최소 권한: activeTab, scripting, storage)'
  },
  {
    name: 'popup.html',
    path: 'web-clipper-extension/popup.html',
    content: EXTENSION_POPUP_HTML,
    language: 'html',
    description: '팝업 UI 뷰 (수집 양식, 저장함 카드 리스트, 태그 필터, 모달)'
  },
  {
    name: 'popup.css',
    path: 'web-clipper-extension/popup.css',
    content: EXTENSION_POPUP_CSS,
    language: 'css',
    description: '독립형 순수 CSS 스타일시트 (외부 CDN/빌드 없이 작동)'
  },
  {
    name: 'popup.js',
    path: 'web-clipper-extension/popup.js',
    content: EXTENSION_POPUP_JS,
    language: 'javascript',
    description: '크롬 API 연동, 드래그 텍스트 추출, 로컬 스토리지, UTF-8 BOM CSV 내보내기'
  },
  {
    name: 'README.md',
    path: 'web-clipper-extension/README.md',
    content: EXTENSION_README,
    language: 'markdown',
    description: '초보자를 위한 크롬 설치 및 실전 테스트 가이드북'
  }
];

/**
 * Packs the standalone web-clipper-extension directory into a ZIP and triggers download
 */
export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('web-clipper-extension');
  if (!folder) throw new Error('ZIP folder creation failed');

  // Add source files
  folder.file('manifest.json', EXTENSION_MANIFEST);
  folder.file('popup.html', EXTENSION_POPUP_HTML);
  folder.file('popup.css', EXTENSION_POPUP_CSS);
  folder.file('popup.js', EXTENSION_POPUP_JS);
  folder.file('README.md', EXTENSION_README);

  // Add icons
  const iconsFolder = folder.folder('icons');
  if (iconsFolder && iconsData) {
    const b64toBlob = (b64Data: string) => {
      const sliceSize = 512;
      const byteCharacters = atob(b64Data);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, { type: 'image/png' });
    };

    iconsFolder.file('icon16.png', b64toBlob(iconsData.icon16));
    iconsFolder.file('icon48.png', b64toBlob(iconsData.icon48));
    iconsFolder.file('icon128.png', b64toBlob(iconsData.icon128));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'web-clipper-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Single file download helper
 */
export function downloadSingleFile(file: ExtensionFile): void {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
