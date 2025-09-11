import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const DAY_MS = 86400000;
const DAY_PX = 120;
const EPOCH = new Date('2025-01-01T00:00:00Z');
const STORE_KEY = 'infiniteTimeline.notes.v1';

function dateToDays(d) {
  return Math.floor((d - EPOCH) / DAY_MS);
}
function daysToDate(n) {
  return new Date(EPOCH.getTime() + n * DAY_MS);
}
function ymd(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}
function saveNotes(notes) {
  localStorage.setItem(STORE_KEY, JSON.stringify(notes));
}

function App() {
  const svgRef = useRef(null);
  const viewRef = useRef(null);
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const [notes, setNotes] = useState(() => loadNotes());

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const applyTransform = useCallback((t) => {
    const v = viewRef.current;
    if (!v) return;
    v.setAttribute('transform', `translate(${t.tx},${t.ty}) scale(${t.scale})`);
  }, []);
  useEffect(() => {
    applyTransform(transform);
  }, [transform, applyTransform]);

  const centerToday = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = dateToDays(today);
    const rect = svg.getBoundingClientRect();
    const next = {
      scale: 1,
      tx: rect.width / 2 - d * DAY_PX,
      ty: rect.height / 2,
    };
    setTransform(next);
  }, []);

  const screenToWorld = useCallback(
    (sx, sy) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      sx -= rect.left;
      sy -= rect.top;
      return {
        x: (sx - transform.tx) / transform.scale,
        y: (sy - transform.ty) / transform.scale,
      };
    },
    [transform]
  );

  const getViewportWorldCenter = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const wx = (rect.width / 2 - transform.tx) / transform.scale;
    const wy = (rect.height / 2 - transform.ty) / transform.scale;
    return { x: wx, y: wy };
  }, [transform]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const minScale = 0.25,
        maxScale = 4;
      const delta = -Math.sign(e.deltaY) * 0.1;
      const newScale = Math.min(
        maxScale,
        Math.max(minScale, transform.scale * (1 + delta))
      );
      const pt = { x: e.clientX, y: e.clientY };
      const world = screenToWorld(pt.x, pt.y);
      const tx = pt.x - world.x * newScale;
      const ty = pt.y - world.y * newScale;
      const next = { scale: newScale, tx, ty };
      setTransform(next);
      applyTransform(next);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel, { passive: false });
  }, [transform, screenToWorld, applyTransform]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('foreignObject')) return;
      dragging = true;
      last.x = e.clientX;
      last.y = e.clientY;
      svg.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!dragging) return;
      const tx = transform.tx + (e.clientX - last.x);
      const ty = transform.ty + (e.clientY - last.y);
      last.x = e.clientX;
      last.y = e.clientY;
      const next = { ...transform, tx, ty };
      setTransform(next);
      applyTransform(next);
    };
    const onUp = () => {
      dragging = false;
      svg.style.cursor = 'default';
    };
    svg.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      svg.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [transform, applyTransform]);

  const addNoteAt = useCallback((wx, wy, day, extra = {}) => {
    const newNote = {
      x: wx - 110,
      y: wy - 80,
      w: 220,
      h: 160,
      day,
      title: '새 노트',
      text: '',
      ...extra,
    };
    setNotes((prev) => [...prev, newNote]);
  }, []);

  const onDblClick = useCallback(
    (e) => {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const d = Math.round(x / DAY_PX);
      addNoteAt(x, y, d);
    },
    [screenToWorld, addNoteAt]
  );

  const createImageNoteAtCenter = useCallback(
    (dataUrl) => {
      const c = getViewportWorldCenter();
      const d = Math.round(c.x / DAY_PX);
      addNoteAt(c.x, c.y, d, { title: '이미지', imageData: dataUrl });
    },
    [getViewportWorldCenter, addNoteAt]
  );

  const pasteImageFromClipboardAtCenter = useCallback(async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      throw new Error('클립보드 이미지 읽기를 지원하지 않습니다.');
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
          createImageNoteAtCenter(String(dataUrl));
          return true;
        }
      }
    }
    return false;
  }, [createImageNoteAtCenter]);

  useEffect(() => {
    const onKey = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        try {
          const pasted = await pasteImageFromClipboardAtCenter();
          if (!pasted) saveNotes(notes);
        } catch (_) {
          saveNotes(notes);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, pasteImageFromClipboardAtCenter]);

  useEffect(() => {
    const onPaste = async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items || !items.length) return;
      for (const item of items) {
        const type = item.type || '';
        if (type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const dataUrl = await new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result);
              r.onerror = rej;
              r.readAsDataURL(file);
            });
            createImageNoteAtCenter(String(dataUrl));
            e.preventDefault();
          }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [createImageNoteAtCenter]);

  const [, forceRerender] = useState(0);
  useEffect(() => {
    const onResize = () => forceRerender((x) => x + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    centerToday();
  }, [centerToday]);

  const timelineElements = useMemo(() => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const leftW = (0 - transform.tx) / transform.scale;
    const rightW = (rect.width - transform.tx) / transform.scale;
    const children = [];
    children.push(
      <line
        key="baseline"
        x1={leftW - 10000}
        x2={rightW + 10000}
        y1={0}
        y2={0}
        stroke="#3a4150"
        strokeWidth={2}
      />
    );
    const dayStart = Math.floor(leftW / DAY_PX) - 2;
    const dayEnd = Math.ceil(rightW / DAY_PX) + 2;
    for (let d = dayStart; d <= dayEnd; d++) {
      const x = d * DAY_PX;
      const isMonthStart = daysToDate(d).getDate() === 1;
      children.push(
        <circle
          key={`dot-${d}`}
          cx={x}
          cy={0}
          r={isMonthStart ? 5 : 3}
          fill={
            isMonthStart ? 'rgba(122,162,255,0.95)' : 'rgba(122,162,255,0.5)'
          }
        />
      );
      if (isMonthStart && transform.scale >= 0.5) {
        const dt = daysToDate(d);
        children.push(
          <text
            key={`lbl-${d}`}
            x={x + 8}
            y={-10}
            fill="#cfd7e3"
            fontSize={12}
          >{`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
            2,
            '0'
          )}`}</text>
        );
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const td = dateToDays(today),
      tx = td * DAY_PX;
    children.push(
      <line
        key="today-line"
        x1={tx}
        x2={tx}
        y1={-2000}
        y2={2000}
        stroke="rgba(163,255,181,0.35)"
        strokeDasharray="6 6"
      />
    );
    children.push(
      <circle
        key="today-dot"
        cx={tx}
        cy={0}
        r={7}
        fill="rgba(163,255,181,0.95)"
        stroke="#0b0d10"
        strokeWidth={2}
      />
    );
    return children;
  }, [transform]);

  const linkElements = useMemo(() => {
    return notes.map((n, i) => {
      const xDot = n.day * DAY_PX;
      const xNote = n.x + n.w / 2;
      const yNote = n.y + n.h;
      const midY = yNote / 2;
      const d = `M ${xNote} ${yNote} C ${xNote} ${midY}, ${xDot} ${midY}, ${xDot} 0`;
      return (
        <path
          key={`ln-${i}`}
          d={d}
          fill="none"
          stroke="rgba(163,255,181,0.7)"
          strokeWidth={1.5}
        />
      );
    });
  }, [notes]);

  const noteElements = useMemo(() => {
    return notes.map((n, idx) => {
      return (
        <foreignObject
          key={`fo-${idx}`}
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          data-id={idx}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="note"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))',
              border: '1px solid #2a3240',
              borderRadius: 14,
              color: '#e6edf3',
              boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              className="handle"
              style={{
                height: 34,
                background: '#10151d',
                borderBottom: '1px solid #223046',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                cursor: 'grab',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const start = { x: e.clientX, y: e.clientY };
                const startN = { x: n.x, y: n.y };
                const onMove = (ev) => {
                  const dx = (ev.clientX - start.x) / transform.scale;
                  const dy = (ev.clientY - start.y) / transform.scale;
                  setNotes((prev) => {
                    const arr = [...prev];
                    const cur = { ...arr[idx] };
                    cur.x = startN.x + dx;
                    cur.y = startN.y + dy;
                    arr[idx] = cur;
                    return arr;
                  });
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div
                className="dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#7aa2ff',
                }}
              />
              <div
                className="title"
                style={{ fontWeight: 600, fontSize: 13, opacity: 0.9 }}
              >
                {n.title || '제목 없음'}
              </div>
            </div>
            <div
              className="body"
              style={{
                flex: 1,
                padding: 10,
                outline: 'none',
                fontSize: 14,
                lineHeight: 1.35,
              }}
              contentEditable={!n.imageData}
              onInput={(e) => {
                const text = e.currentTarget.innerText;
                setNotes((prev) => {
                  const arr = [...prev];
                  arr[idx] = { ...arr[idx], text };
                  return arr;
                });
              }}
              suppressContentEditableWarning
            >
              {!n.imageData ? (
                n.text || ''
              ) : (
                <img
                  src={n.imageData}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    width: '100%',
                    height: '100%',
                  }}
                  onDoubleClick={(e) => {
                    const el = e.currentTarget.parentElement;
                    if (el) {
                      el.setAttribute('contenteditable', 'true');
                      el.focus();
                    }
                  }}
                />
              )}
            </div>
            <div
              className="footer"
              style={{
                height: 30,
                borderTop: '1px solid #223046',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px',
                fontSize: 12,
                opacity: 0.8,
              }}
            >
              <span>{ymd(daysToDate(n.day))}</span>
              <button
                style={{
                  background: '#121923',
                  border: '1px solid #283348',
                  color: '#cfd7e3',
                  borderRadius: 8,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setNotes((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                삭제
              </button>
            </div>
          </div>
        </foreignObject>
      );
    });
  }, [notes, transform.scale]);

  const onJump = useCallback(() => {
    const inp = document.getElementById('jumpDate');
    if (!inp || !inp.value) return;
    const dt = new Date(inp.value + 'T00:00:00');
    const d = dateToDays(dt);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTransform((t) => ({ ...t, tx: rect.width / 2 - d * DAY_PX * t.scale }));
  }, []);

  return (
    <div
      className="w-screen h-screen"
      style={{ background: '#0b0d10', color: '#cdd6df' }}
    >
      <div
        style={{
          position: 'fixed',
          left: 16,
          top: 16,
          zIndex: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid #202734',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              padding: '4px 8px',
              border: '1px solid #2b3342',
              borderRadius: 999,
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            무한 타임라인
          </span>
          <button
            onClick={centerToday}
            style={{
              background: '#1d2430',
              border: '1px solid #2b3342',
              borderRadius: 9,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            오늘로
          </button>
          <label>
            날짜로 점프:{' '}
            <input
              type="date"
              id="jumpDate"
              style={{
                background: '#0e131a',
                border: '1px solid #2b3342',
                borderRadius: 9,
                padding: '8px 10px',
              }}
            />
          </label>
          <button
            onClick={onJump}
            style={{
              background: '#1d2430',
              border: '1px solid #2b3342',
              borderRadius: 9,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            이동
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify({ version: 1, notes }, null, 2)],
                { type: 'application/json' }
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `timeline-notes-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              background: '#1d2430',
              border: '1px solid #2b3342',
              borderRadius: 9,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            내보내기(JSON)
          </button>
          <button
            onClick={() => document.getElementById('fileImport').click()}
            style={{
              background: '#1d2430',
              border: '1px solid #2b3342',
              borderRadius: 9,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            가져오기
          </button>
          <input
            id="fileImport"
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              const text = await file.text();
              try {
                const data = JSON.parse(text);
                if (Array.isArray(data.notes)) setNotes(data.notes);
                else if (Array.isArray(data)) setNotes(data);
                else alert('형식이 올바르지 않습니다.');
              } catch (err) {
                alert('가져오기 실패: ' + err.message);
              }
              e.target.value = '';
            }}
          />
          <span style={{ opacity: 0.7 }}>
            • 더블클릭: 노트 추가 • 드래그: 이동 • 스크롤: 줌
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        onDoubleClick={onDblClick}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          background:
            'linear-gradient(180deg, transparent 49.5%, rgba(122,162,255,0.06) 49.5%, rgba(122,162,255,0.06) 50.5%, transparent 50.5%)',
        }}
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="rgba(163,255,181,0.9)" />
          </marker>
        </defs>
        <g ref={viewRef}>
          <g>{timelineElements}</g>
          <g>{linkElements}</g>
          <g>{noteElements}</g>
        </g>
      </svg>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
