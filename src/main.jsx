import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// 날짜, 좌표 유틸
const DAY_MS = 24 * 60 * 60 * 1000; // 날짜 ↔ dayIndex 변환할 때 “며칠 차이냐”를 구하는 기준 단위
const DAY_PX = 120;
const EPOCH = new Date(Date.UTC(2025, 0, 1));

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

function App() {
  return <div className="w-screen h-screen bg-gray-300">infinite diary</div>;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
