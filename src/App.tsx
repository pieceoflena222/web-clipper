import React, { useState, useEffect } from 'react';
import {
  Download,
  FolderArchive,
  CheckCircle2,
  FileCode,
  Play,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Search,
  FileSpreadsheet,
  ShieldCheck,
  RefreshCw,
  FileText,
  Bookmark,
  MousePointerClick,
  Info
} from 'lucide-react';
import {
  EXTENSION_FILES,
  downloadExtensionZip,
  downloadSingleFile,
  ExtensionFile
} from './data/extensionSource';

// Sample Simulated Web Pages for the Live Extension Simulator
const SIMULATED_PAGES = [
  {
    id: 'page1',
    title: 'Google Chrome 개발자: Manifest V3 완전 가이드와 모범 사례',
    url: 'https://developer.chrome.com/docs/extensions/mv3/intro/',
    domain: 'developer.chrome.com',
    sampleSelection: 'Manifest V3는 크롬 확장 프로그램 생태계의 보안성, 개인정보 보호 및 성능을 극적으로 향상시키기 위해 설계되었습니다. 백그라운드 페이지 대신 서비스 워커를 사용하고 선언적 netRequest API를 도입했습니다.',
    body: `Manifest V3는 크롬 확장 프로그램 생태계의 보안성, 개인정보 보호 및 성능을 극적으로 향상시키기 위해 설계되었습니다. 백그라운드 페이지 대신 서비스 워커를 사용하고 선언적 netRequest API를 도입했습니다.

사용자의 시스템 리소스를 절약하고 권한 모델을 세분화하여, 필요한 경우에만 activeTab 권한을 통해 안전하게 탭 정보를 읽을 수 있도록 지원합니다.

WEB CLIPPER는 activeTab과 scripting을 통해 최소 권한 원칙을 철저히 준수하는 모범 사례 확장 프로그램입니다.`
  },
  {
    id: 'page2',
    title: 'MDN Web Docs: Document.execCommand 대신 현대적인 클립보드 API 활용',
    url: 'https://developer.mozilla.org/ko/docs/Web/API/Clipboard_API',
    domain: 'developer.mozilla.org',
    sampleSelection: 'Clipboard API는 시스템 클립보드의 내용에 읽기 및 쓰기 접근을 제공하는 비동기 인터페이스입니다. 이전의 비표준적인 execCommand(copy) 방식을 완전히 대체하며 Promise 기반으로 안전하게 동작합니다.',
    body: `Clipboard API는 시스템 클립보드의 내용에 읽기 및 쓰기 접근을 제공하는 비동기 인터페이스입니다. 이전의 비표준적인 execCommand(copy) 방식을 완전히 대체하며 Promise 기반으로 안전하게 동작합니다.

웹 클리퍼나 생산성 도구에서 사용자가 스크랩한 텍스트와 메타데이터를 클립보드로 전송할 때 매우 유용합니다.`
  },
  {
    id: 'page3',
    title: '테크 블로그: 엑셀에서 한글 CSV가 깨지지 않게 만드는 UTF-8 BOM 원리',
    url: 'https://tech.example.io/excel-korean-csv-bom-encoding',
    domain: 'tech.example.io',
    sampleSelection: '엑셀(Microsoft Excel)은 UTF-8 인코딩 파일에 BOM(Byte Order Mark, \\uFEFF)이 없으면 ANSI/CP949 코드로 잘못 추측하여 한글이 깨지는 현상이 발생합니다. 파일 맨 앞에 \\uFEFF 3바이트를 붙여주면 한글이 완벽하게 열립니다.',
    body: `엑셀(Microsoft Excel)은 UTF-8 인코딩 파일에 BOM(Byte Order Mark, \\uFEFF)이 없으면 ANSI/CP949 코드로 잘못 추측하여 한글이 깨지는 현상이 발생합니다. 파일 맨 앞에 \\uFEFF 3바이트를 붙여주면 한글이 완벽하게 열립니다.

WEB CLIPPER의 CSV 다운로드 엔진은 자동으로 UTF-8 BOM을 삽입하여 다운로드하므로 엑셀에서 바로 열어도 한글이 깨지지 않습니다.`
  }
];

export interface ClipItem {
  id: string;
  title: string;
  url: string;
  text: string;
  note: string;
  tags: string[];
  createdAt: number;
}

function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    console.warn('LocalStorage not accessible in this environment:', e);
  }
  return null;
}

function safeSetStorage(key: string, val: string): void {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(key, val);
    }
  } catch (e) {
    console.warn('LocalStorage not writable in this environment:', e);
  }
}

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<'simulator' | 'guide' | 'code' | 'clips'>('simulator');
  const [isZipping, setIsZipping] = useState(false);
  const [copiedCodeFile, setCopiedCodeFile] = useState<string | null>(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState<ExtensionFile>(EXTENSION_FILES[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // Guide Checklist State
  const [checklist, setChecklist] = useState({
    download: false,
    unzip: false,
    chromeExtensions: false,
    devMode: false,
    loadUnpacked: false,
    pin: false
  });

  // Simulator State
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [currentSelectedText, setCurrentSelectedText] = useState(SIMULATED_PAGES[0].sampleSelection);
  
  // Extension Popup Internal State (Simulated)
  const [simPopupTab, setSimPopupTab] = useState<'clip' | 'list'>('clip');
  const [simFormTitle, setSimFormTitle] = useState(SIMULATED_PAGES[0].title);
  const [simFormUrl, setSimFormUrl] = useState(SIMULATED_PAGES[0].url);
  const [simFormText, setSimFormText] = useState(SIMULATED_PAGES[0].sampleSelection);
  const [simFormNote, setSimFormNote] = useState('');
  const [simFormTags, setSimFormTags] = useState('');
  
  const [savedClips, setSavedClips] = useState<ClipItem[]>(() => {
    try {
      const saved = safeGetStorage('web_clipper_items');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'clip_sample_1',
        title: 'Google Chrome 개발자: Manifest V3 완전 가이드와 모범 사례',
        url: 'https://developer.chrome.com/docs/extensions/mv3/intro/',
        text: 'Manifest V3는 크롬 확장 프로그램 생태계의 보안성, 개인정보 보호 및 성능을 극적으로 향상시키기 위해 설계되었습니다.',
        note: '확장 프로그램 개발 시 권한 설정 참고하기',
        tags: ['개발', '크롬', '레퍼런스'],
        createdAt: Date.now() - 3600000 * 2
      },
      {
        id: 'clip_sample_2',
        title: '테크 블로그: 엑셀에서 한글 CSV가 깨지지 않게 만드는 UTF-8 BOM 원리',
        url: 'https://tech.example.io/excel-korean-csv-bom-encoding',
        text: '파일 맨 앞에 \\uFEFF 3바이트를 붙여주면 한글이 완벽하게 열립니다.',
        note: 'CSV 출력 로직에 꼭 적용할 것',
        tags: ['업무', '꿀팁'],
        createdAt: Date.now() - 3600000 * 24
      }
    ];
  });

  const [simSearchQuery, setSimSearchQuery] = useState('');
  const [simSelectedTagFilter, setSimSelectedTagFilter] = useState('ALL');

  // Sync savedClips to localStorage
  useEffect(() => {
    safeSetStorage('web_clipper_items', JSON.stringify(savedClips));
  }, [savedClips]);

  // When changing simulated page, auto update the simulated popup form fields
  const handleSelectSimulatedPage = (idx: number) => {
    setSelectedPageIndex(idx);
    const p = SIMULATED_PAGES[idx];
    setCurrentSelectedText(p.sampleSelection);
    setSimFormTitle(p.title);
    setSimFormUrl(p.url);
    setSimFormText(p.sampleSelection);
  };

  const showGlobalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      await downloadExtensionZip();
      showGlobalToast('📦 web-clipper-extension.zip 다운로드가 시작되었습니다!');
      setChecklist(prev => ({ ...prev, download: true }));
    } catch (err) {
      console.error(err);
      showGlobalToast('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyCode = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeFile(fileName);
    showGlobalToast(`${fileName} 코드가 클립보드에 복사되었습니다.`);
    setTimeout(() => setCopiedCodeFile(null), 2000);
  };

  // Add quick tag to form
  const handleAddQuickTag = (tag: string) => {
    const trimmed = simFormTags.trim();
    const existing = trimmed ? trimmed.split(',').map(t => t.trim().replace(/^#/, '')) : [];
    if (!existing.includes(tag)) {
      existing.push(tag);
      setSimFormTags(existing.join(', '));
    }
  };

  // Save new clip in simulator
  const handleSimSaveClip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simFormTitle.trim() && !simFormText.trim()) {
      showGlobalToast('제목 또는 수집할 본문 내용을 입력해주세요.');
      return;
    }

    const parsedTags = simFormTags
      .split(/[,\s]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(t => t.length > 0);

    const newClip: ClipItem = {
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: simFormTitle.trim() || '제목 없는 클립',
      url: simFormUrl.trim(),
      text: simFormText.trim(),
      note: simFormNote.trim(),
      tags: parsedTags,
      createdAt: Date.now()
    };

    setSavedClips([newClip, ...savedClips]);
    setSimFormNote('');
    setSimFormTags('');
    showGlobalToast('✓ 클립이 성공적으로 저장되었습니다!');
    setTimeout(() => {
      setSimPopupTab('list');
    }, 300);
  };

  // Export CSV in simulator
  const handleExportCsv = () => {
    if (savedClips.length === 0) {
      showGlobalToast('내보낼 클립 데이터가 없습니다.');
      return;
    }

    const headers = ['ID', '등록일시', '페이지제목', '웹페이지URL', '수집본문내용', '개인메모', '태그목록'];
    const escapeCsv = (val: string | number) => `"${String(val || '').replace(/"/g, '""')}"`;
    
    const rows = [headers.map(escapeCsv).join(',')];
    savedClips.forEach(clip => {
      const d = new Date(clip.createdAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      rows.push([
        escapeCsv(clip.id),
        escapeCsv(dateStr),
        escapeCsv(clip.title),
        escapeCsv(clip.url),
        escapeCsv(clip.text),
        escapeCsv(clip.note),
        escapeCsv(clip.tags.join('; '))
      ].join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-clipper-export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showGlobalToast(`✓ ${savedClips.length}건 CSV 다운로드 완료 (UTF-8 BOM 엑셀 호환)`);
  };

  // Filter clips in simulator
  const filteredClips = savedClips.filter(c => {
    if (simSelectedTagFilter !== 'ALL' && !c.tags.includes(simSelectedTagFilter)) {
      return false;
    }
    if (simSearchQuery) {
      const q = simSearchQuery.toLowerCase();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchText = (c.text || '').toLowerCase().includes(q);
      const matchNote = (c.note || '').toLowerCase().includes(q);
      const matchUrl = (c.url || '').toLowerCase().includes(q);
      const matchTag = c.tags.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchText || matchNote || matchUrl || matchTag;
    }
    return true;
  });

  // Extract unique tags
  const allUniqueTags = Array.from(new Set(savedClips.flatMap(c => c.tags)));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Bookmark className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">WEB CLIPPER</span>
                <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">Manifest V3</span>
                <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  독립 설치 패키지 준비 완료
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                웹페이지 제목·URL·드래그 텍스트·메모 자동 수집 및 엑셀 호환 CSV 내보내기 Chrome 확장 프로그램
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-blue-600/25 flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? '압축 생성 중...' : 'ZIP 패키지 다운로드'}</span>
            </button>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveMainTab('simulator')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeMainTab === 'simulator'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            실시간 팝업 시뮬레이터 (사전 체험)
          </button>
          <button
            onClick={() => setActiveMainTab('guide')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeMainTab === 'guide'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            초보자 Chrome 설치 가이드 (1분 완료)
          </button>
          <button
            onClick={() => setActiveMainTab('code')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeMainTab === 'code'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            독립 패키지 파일 구조 &amp; 소스 코드
          </button>
          <button
            onClick={() => setActiveMainTab('clips')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeMainTab === 'clips'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            수집 데이터 &amp; CSV 내보내기 ({savedClips.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

        {/* TAB 1: LIVE SIMULATOR */}
        {activeMainTab === 'simulator' && (
          <div className="space-y-6">
            {/* Intro banner */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
                    Live Demo
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    크롬 브라우저 환경 실시간 시뮬레이터
                  </h2>
                </div>
                <p className="text-xs text-slate-600">
                  왼쪽의 가상 웹페이지에서 텍스트를 드래그하거나 버튼을 누르면, 오른쪽의 <strong>WEB CLIPPER 확장 프로그램 팝업</strong>에 제목·URL·드래그 텍스트가 즉시 자동 수집됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadZip}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  실제 크롬에 설치하기 (ZIP)
                </button>
              </div>
            </div>

            {/* Split Screen Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Simulated Browser Tab (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Browser Top Bar */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  </div>
                  <div className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1 text-xs text-slate-600 font-mono truncate flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">🔒</span>
                    <span>{SIMULATED_PAGES[selectedPageIndex].url}</span>
                  </div>
                </div>

                {/* Simulated Tab Selector */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">테스트 탭 선택:</span>
                  {SIMULATED_PAGES.map((page, idx) => (
                    <button
                      key={page.id}
                      onClick={() => handleSelectSimulatedPage(idx)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                        selectedPageIndex === idx
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {idx + 1}. {page.domain}
                    </button>
                  ))}
                </div>

                {/* Page Content Body */}
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                      {SIMULATED_PAGES[selectedPageIndex].domain}
                    </span>
                    <h1 className="text-lg font-bold text-slate-900 leading-snug">
                      {SIMULATED_PAGES[selectedPageIndex].title}
                    </h1>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                    <MousePointerClick className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      아래 본문 중 원하는 부분을 <strong>마우스로 직접 드래그</strong>하거나, 오른쪽 확장 프로그램의 <strong>[드래그 텍스트 다시 가져오기]</strong> 버튼을 눌러보세요.
                    </div>
                  </div>

                  <div
                    onMouseUp={() => {
                      const sel = window.getSelection()?.toString().trim();
                      if (sel && sel.length > 0) {
                        setCurrentSelectedText(sel);
                        setSimFormText(sel);
                        showGlobalToast(`"${sel.substring(0, 25)}..." 드래그 감지됨!`);
                      }
                    }}
                    className="prose prose-slate prose-sm text-xs leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 select-text whitespace-pre-wrap cursor-text"
                  >
                    {SIMULATED_PAGES[selectedPageIndex].body}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>현재 선택된 본문 블록: <strong className="text-slate-800">{currentSelectedText.length}자</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        const s = SIMULATED_PAGES[selectedPageIndex].sampleSelection;
                        setCurrentSelectedText(s);
                        setSimFormText(s);
                        showGlobalToast('추천 핵심 문장이 선택되었습니다.');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      핵심 문장 자동 드래그 선택
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Simulated Chrome Extension Popup (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[420px] bg-white rounded-2xl border-2 border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                  
                  {/* Chrome Extension Simulated Window Bar */}
                  <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
                        <Bookmark className="w-3 h-3 text-white fill-white" />
                      </div>
                      <span>Chrome Extension Popup</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">popup.html</span>
                  </div>

                  {/* Extension Header */}
                  <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                        <Bookmark className="w-4 h-4 fill-white" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">WEB CLIPPER</div>
                        <div className="text-[10px] text-slate-500 font-medium">Smart Web Collector</div>
                      </div>
                    </div>
                    
                    {/* View Switcher Tabs */}
                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                      <button
                        onClick={() => setSimPopupTab('clip')}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                          simPopupTab === 'clip' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        수집하기
                      </button>
                      <button
                        onClick={() => setSimPopupTab('list')}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                          simPopupTab === 'list' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        저장함
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                          {savedClips.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Extension Body View 1: New Clip Form */}
                  {simPopupTab === 'clip' && (
                    <form onSubmit={handleSimSaveClip} className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                      {/* Title */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">웹페이지 제목</label>
                          <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                            자동 감지됨
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={simFormTitle}
                            onChange={(e) => setSimFormTitle(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-blue-500 pr-7"
                            placeholder="페이지 제목"
                            required
                          />
                          <button
                            type="button"
                            title="현재 페이지 정보 다시 읽기"
                            onClick={() => {
                              const p = SIMULATED_PAGES[selectedPageIndex];
                              setSimFormTitle(p.title);
                              setSimFormUrl(p.url);
                              showGlobalToast('페이지 정보가 새로고침되었습니다.');
                            }}
                            className="absolute right-1.5 top-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* URL */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">웹페이지 URL</label>
                        <input
                          type="text"
                          value={simFormUrl}
                          readOnly
                          className="w-full text-[11px] font-mono px-2.5 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md truncate cursor-not-allowed"
                        />
                      </div>

                      {/* Selected Text */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700">수집된 본문 텍스트 (드래그)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setSimFormText(currentSelectedText);
                              showGlobalToast(`드래그 텍스트 (${currentSelectedText.length}자)를 가져왔습니다.`);
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            선택 텍스트 다시 가져오기
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={simFormText}
                          onChange={(e) => setSimFormText(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-md focus:outline-blue-500"
                          placeholder="드래그한 텍스트가 자동으로 채워집니다..."
                        />
                        <div className="text-[10px] text-right text-slate-400">
                          {simFormText.length}자
                        </div>
                      </div>

                      {/* Note */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">개인 메모</label>
                        <textarea
                          rows={2}
                          value={simFormNote}
                          onChange={(e) => setSimFormNote(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-md focus:outline-blue-500"
                          placeholder="이 자료에 대한 코멘트나 아이디어를 기록하세요..."
                        />
                      </div>

                      {/* Tags */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">태그 (쉼표로 구분)</label>
                        <input
                          type="text"
                          value={simFormTags}
                          onChange={(e) => setSimFormTags(e.target.value)}
                          placeholder="예: 개발, 업무, 레퍼런스"
                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-blue-500"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold">추천:</span>
                          {['업무', '레퍼런스', '아이디어', '기술', '기사'].map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleAddQuickTag(tag)}
                              className="text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-2 py-0.5 rounded-full transition cursor-pointer"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer mt-2"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        클립 저장하기
                      </button>
                    </form>
                  )}

                  {/* Extension Body View 2: Saved List */}
                  {simPopupTab === 'list' && (
                    <div className="p-3.5 flex flex-col h-[460px] bg-slate-50">
                      {/* Search Bar */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={simSearchQuery}
                          onChange={(e) => setSimSearchQuery(e.target.value)}
                          placeholder="제목, 본문, 메모, 태그 검색..."
                          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-blue-500"
                        />
                      </div>

                      {/* Tag Filter Chips */}
                      {allUniqueTags.length > 0 && (
                        <div className="flex gap-1 overflow-x-auto pb-2 mb-1 scrollbar-none">
                          <button
                            onClick={() => setSimSelectedTagFilter('ALL')}
                            className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium cursor-pointer ${
                              simSelectedTagFilter === 'ALL'
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            전체 ({savedClips.length})
                          </button>
                          {allUniqueTags.map(tag => (
                            <button
                              key={tag}
                              onClick={() => setSimSelectedTagFilter(tag)}
                              className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium cursor-pointer ${
                                simSelectedTagFilter === tag
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-white text-slate-600 border border-slate-200'
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Cards Container */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {filteredClips.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 text-xs">
                            <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                            <div>일치하는 클립이 없습니다.</div>
                          </div>
                        ) : (
                          filteredClips.map(clip => (
                            <div key={clip.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5 hover:border-slate-300 transition">
                              <div className="flex items-start justify-between gap-2">
                                <a
                                  href={clip.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-slate-800 hover:text-blue-600 line-clamp-1"
                                >
                                  {clip.title}
                                </a>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`[${clip.title}]\n${clip.url}\n\n${clip.text}\n\n메모: ${clip.note}`);
                                      showGlobalToast('클립보드에 복사되었습니다.');
                                    }}
                                    title="복사"
                                    className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSavedClips(savedClips.filter(c => c.id !== clip.id));
                                      showGlobalToast('클립이 삭제되었습니다.');
                                    }}
                                    title="삭제"
                                    className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {clip.text && (
                                <div className="text-[11px] text-slate-600 bg-slate-50 border-l-2 border-blue-500 p-1.5 rounded-r line-clamp-3">
                                  {clip.text}
                                </div>
                              )}

                              {clip.note && (
                                <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 p-1 rounded text-xs">
                                  📝 {clip.note}
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                                <div className="flex gap-1 flex-wrap">
                                  {clip.tags.map(t => (
                                    <span key={t} className="bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-medium">
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                                <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          총 <strong>{savedClips.length}</strong>개 항목
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleExportCsv}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            CSV 내보내기
                          </button>
                          <button
                            onClick={() => setShowClearConfirmModal(true)}
                            className="text-[11px] text-red-600 hover:bg-red-50 border border-red-200 px-2 py-1 rounded cursor-pointer"
                          >
                            비우기
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom bar of simulated window */}
                  <div className="bg-slate-100 border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>저장소: <strong>chrome.storage.local</strong></span>
                    <span className="text-emerald-600 font-semibold">100% 로컬 독립 작동</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STEP-BY-STEP INSTALL GUIDE */}
        {activeMainTab === 'guide' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  초보자를 위한 Chrome 확장 프로그램 설치 가이드
                </h2>
                <p className="text-xs text-slate-600">
                  Chrome 웹스토어 심사나 번거로운 빌드 과정 없이, 1분 안에 직접 크롬 브라우저에 바로 탑재하여 사용할 수 있습니다.
                </p>
              </div>
              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{isZipping ? '압축 중...' : '1단계: ZIP 다운로드'}</span>
              </button>
            </div>

            {/* Steps Timeline Cards */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  1
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      ZIP 파일 다운로드 후 압축 풀기
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist.download && checklist.unzip}
                        onChange={(e) => setChecklist({ ...checklist, download: e.target.checked, unzip: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">완료</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    상단의 <strong>[ZIP 패키지 다운로드]</strong> 버튼을 누르면 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono">web-clipper-extension.zip</code> 파일이 내려받아집니다. 원하는 폴더에 압축을 풀어주세요.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700">
                    📂 web-clipper-extension/<br />
                    ├── manifest.json (Manifest V3 설정 파일)<br />
                    ├── popup.html (팝업 화면 레이아웃)<br />
                    ├── popup.css (스타일시트)<br />
                    ├── popup.js (수집 및 CSV 내보내기 자바스크립트)<br />
                    ├── README.md<br />
                    └── 📂 icons/ (icon16.png, icon48.png, icon128.png)
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      크롬 주소창에서 확장 프로그램 관리 페이지 접속
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist.chromeExtensions}
                        onChange={(e) => setChecklist({ ...checklist, chromeExtensions: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">완료</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Chrome 브라우저의 새 탭 주소창에 아래 주소를 입력하고 Enter를 누릅니다:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-800">
                      chrome://extensions
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('chrome://extensions');
                        showGlobalToast('주소가 복사되었습니다! 새 탭에 붙여넣으세요.');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded bg-blue-50 border border-blue-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      주소 복사
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  3
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      우측 상단 [개발자 모드] 토글 켜기
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist.devMode}
                        onChange={(e) => setChecklist({ ...checklist, devMode: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">완료</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    확장 프로그램 화면 우측 상단에 위치한 <strong>[개발자 모드 (Developer mode)]</strong> 스위치를 켜주세요. 스위치를 켜면 상단에 세 가지 메뉴 버튼이 나타납니다.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  4
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      [압축해제된 확장 프로그램을 로드합니다] 클릭 후 폴더 선택
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist.loadUnpacked}
                        onChange={(e) => setChecklist({ ...checklist, loadUnpacked: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">완료</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    좌측 상단 첫 번째 버튼인 <strong>[압축해제된 확장 프로그램을 로드합니다 (Load unpacked)]</strong>를 클릭하고, 1단계에서 압축을 풀었던 <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">web-clipper-extension</code> 폴더를 선택합니다.
                  </p>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 font-medium">
                    ✓ 성공하면 확장 프로그램 목록에 <strong>"WEB CLIPPER 1.0.0"</strong> 카드가 즉시 등록됩니다!
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  5
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">
                      크롬 주소창 우측 퍼즐 아이콘에서 📌 고정
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklist.pin}
                        onChange={(e) => setChecklist({ ...checklist, pin: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium">완료</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    브라우저 우측 상단 퍼즐 모양 아이콘(🧩)을 클릭하고, <strong>WEB CLIPPER</strong> 옆의 📌 핀 고정 아이콘을 누르면 언제든지 툴바에서 1초 만에 실행할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                보안 및 사용 꿀팁
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-5">
                <li>
                  <strong>오프라인 및 100% 로컬 저장:</strong> 수집된 데이터는 크롬 브라우저의 <code className="font-mono text-blue-700">chrome.storage.local</code>에만 안전하게 저장되며 외부 서버로 절대 전송되지 않습니다.
                </li>
                <li>
                  <strong>엑셀 한글 깨짐 방지:</strong> CSV 다운로드 시 UTF-8 BOM(<code className="font-mono text-blue-700">\uFEFF</code>) 헤더를 자동 적용하므로 엑셀에서 바로 열어도 한글이 깨지지 않습니다.
                </li>
                <li>
                  <strong>크롬 시스템 페이지 제한:</strong> <code className="font-mono">chrome://</code>, <code className="font-mono">chrome-extension://</code> 및 웹스토어 페이지는 구글 크롬 보안 정책상 스크립트 주입이 금지되어 있으므로 일반 웹사이트에서 테스트해주세요.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: SOURCE CODE INSPECTOR */}
        {activeMainTab === 'code' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FolderArchive className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    독립 폴더 (/web-clipper-extension/) 소스 코드 뷰어
                  </h2>
                </div>
                <p className="text-xs text-slate-600">
                  AI Studio의 React 빌드 결과물과 완벽히 격리된 순수 HTML, CSS, JavaScript 독립 패키지입니다. 외부 CDN이나 빌드 과정 없이 바로 크롬에서 실행됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSingleFile(selectedCodeFile)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  이 파일만 다운로드
                </button>
                <button
                  onClick={handleDownloadZip}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  전체 ZIP 다운로드
                </button>
              </div>
            </div>

            {/* Split Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* File list sidebar */}
              <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
                  파일 목록 (5개 핵심 파일)
                </div>
                <div className="space-y-1.5">
                  {EXTENSION_FILES.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => setSelectedCodeFile(f)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                        selectedCodeFile.name === f.name
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className={`w-4 h-4 ${selectedCodeFile.name === f.name ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-mono">{f.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal line-clamp-1">{f.description}</div>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono text-slate-400">
                        {f.language}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700">아이콘 에셋:</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    • icons/icon16.png (16x16)<br />
                    • icons/icon48.png (48x48)<br />
                    • icons/icon128.png (128x128)
                  </div>
                </div>
              </div>

              {/* Code viewer */}
              <div className="md:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-mono text-xs text-slate-300 font-bold">
                      {selectedCodeFile.path}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(selectedCodeFile.content, selectedCodeFile.name)}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCodeFile === selectedCodeFile.name ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">복사 완료</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>전체 복사</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 overflow-x-auto max-h-[560px]">
                  <pre className="font-mono text-xs text-slate-200 leading-relaxed whitespace-pre">
                    {selectedCodeFile.content}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLIPS DATA & CSV EXPORT */}
        {activeMainTab === 'clips' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  수집된 데이터 관리 &amp; 엑셀 CSV 내보내기
                </h2>
                <p className="text-xs text-slate-600">
                  확장 프로그램 및 시뮬레이터에서 저장된 데이터 목록을 한눈에 검토하고 CSV 파일로 즉시 다운로드할 수 있습니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>CSV 다운로드 (한글 UTF-8 BOM)</span>
                </button>
              </div>
            </div>

            {/* Table or Empty */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {savedClips.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <div className="font-bold text-sm text-slate-600 mb-1">저장된 데이터가 없습니다</div>
                  <div>시뮬레이터에서 텍스트를 수집하고 저장해보세요!</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-3 px-4">등록일시</th>
                        <th className="py-3 px-4">페이지 제목 &amp; URL</th>
                        <th className="py-3 px-4">수집 내용 (드래그)</th>
                        <th className="py-3 px-4">개인 메모</th>
                        <th className="py-3 px-4">태그</th>
                        <th className="py-3 px-4 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savedClips.map((clip) => (
                        <tr key={clip.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(clip.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-bold text-slate-900 line-clamp-1">{clip.title}</div>
                            <a
                              href={clip.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:underline font-mono truncate block"
                            >
                              {clip.url}
                            </a>
                          </td>
                          <td className="py-3 px-4 max-w-sm text-slate-700">
                            <div className="line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100 font-normal">
                              {clip.text || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs text-amber-900 font-medium">
                            {clip.note || '-'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex gap-1 flex-wrap">
                              {clip.tags.map(t => (
                                <span key={t} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSavedClips(savedClips.filter(c => c.id !== clip.id));
                                showGlobalToast('항목이 삭제되었습니다.');
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">WEB CLIPPER</span>
            <span>• Chrome Extension Manifest V3 Standalone Package</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>최소 권한: activeTab, scripting, storage</span>
            <span>• 100% 로컬 데이터 안전 보관</span>
          </div>
        </div>
      </footer>
      {/* Modal Confirm for Clear All */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">모든 클립 삭제 확인</h3>
            <p className="text-xs text-slate-600">
              저장된 모든 클립 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedClips([]);
                  setShowClearConfirmModal(false);
                  showGlobalToast('모든 클립이 삭제되었습니다.');
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer shadow-sm"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
