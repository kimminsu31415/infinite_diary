import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// 날짜, 좌표 유틸
const DAY_MS = 24 * 60 * 60 * 1000; // 날짜 ↔ dayIndex 변환할 때 “며칠 차이냐”를 구하는 기준 단위
const DAY_PX = 120;
const EPOCH = new Date(Date.UTC(2025, 0, 1));

// ===== 날짜, 좌표 표현 기능
function dateToDays(date) {
  // 2025-01-05 → EPOCH=2025-01-01 기준 → (4일 차) → dayIndex=4
  // 날짜가 기준일(EPOCH)로부터 며칠 떨어져 있는지 구하는 함수
  const y = data.getUTCFullYear();
  const m = data.getUTCMonth();
  const d = data.getUTCDate();
  const utc = Date.UTC(y, m, d);
  return Math.floor((utc - EPOCH.getTime()) / DAY_MS);
}

function dayIndexToDate(idx) {
  //dayIndex(정수) → Date 객체
  // 마우스로 화면을 클릭했을 때 world.x → dayIndex 계산 후, 그 dayIndex를 “YYYY-MM-DD” 날짜로 보여주려면 필요.
  return new Date(EPOCH.getTime() + idx * DAY_MS);
}

function ymdUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ===== 좌표 변환 기능
function screenToWorld(sx, sy, { scale, tx, ty }) {
  return { x: (sx - tx) / scale, y: (sy - ty) / scale };
}

function worldToScreen(wx, wy, { scale, tx, ty }) {
  return { x: wx * scale + tx, y: wy * scale + ty };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function zoomAtPoint(sx, sy, nextScale, state) {
  const { x: wx, y: wy } = screenToWorld(sx, sy, state);
  return {
    scale: nextScale,
    tx: sx - wx * nextScale,
    ty: sy - wy * nextScale,
  };
}

function App() {
  const svgRef = useRef(null);
  const viewRef = useRef(null);
  const timelineRef = useRef(null);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });

  //화면에 변환 적용
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.setAttribute(
      'transform',
      `translate(${view.tx},${view.ty}) scale(${view.scale})`
    );
  }, [view]);

  //휠 이벤트 처리
  function handleWheel(e) {
    e.preventDefault();
    const { sx, sy } = screenToWorld(e.clientX, e.clientY, view);
    setView(zoomAtPoint(e.clientX, e.clientY, view.scale * 1.1, view));
  }

  //팬 이벤트 처리
  function handlePan(e) {
    e.preventDefault();
    setView({ ...view, tx: view.tx + e.deltaX, ty: view.ty + e.deltaY });
  }

  //초기 위치: 화면 중앙 y=0 보이게
  function centerToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = dateToDays(today);
    const rect = svgRef.current.getBoundingClientRect();
  }
  //줌
  function handleZoom(e) {
    e.preventDefault();
    setView(zoomAtPoint(e.clientX, e.clientY, view.scale * 1.1, view));
  }

  //내보내기
  function handleExport() {
    const blob = new Blob([JSON.stringify({ version: 1, notes }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-notes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  //가져오기
  function handleImport(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);
    };
    reader.readAsText(file);
  }

  return <div className="w-screen h-screen bg-gray-300">infinite diary</div>;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
