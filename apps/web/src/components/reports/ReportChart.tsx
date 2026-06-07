'use client';

import { useState } from 'react';

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface Props {
  rows: Record<string, any>[];
  labelKey: string;
  series: Series[];
  /** 'bar' = grouped bars (categorical), 'line' = trend (time-series). */
  type: 'bar' | 'line';
  /** Cap rendered categories (rows assumed pre-sorted). */
  max?: number;
}

const W = 900;
const H = 260;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 56;

export function ReportChart({ rows, labelKey, series, type, max = 24 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const data = rows.slice(0, max);
  if (data.length === 0 || series.length === 0) return null;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
  );
  const y = (v: number) => PAD_T + innerH - (v / maxVal) * innerH;
  const label = (d: any) => String(d[labelKey] ?? '—');

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxVal * p));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
        {/* gridlines + y labels */}
        {gridVals.map((gv, i) => {
          const gy = y(gv);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.4)">
                {gv}
              </text>
            </g>
          );
        })}

        {type === 'bar'
          ? data.map((d, i) => {
              const groupW = innerW / data.length;
              const barGap = Math.min(6, groupW * 0.1);
              const barW = (groupW - barGap) / series.length;
              const x0 = PAD_L + groupW * i + barGap / 2;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {hover === i && (
                    <rect x={PAD_L + groupW * i} y={PAD_T} width={groupW} height={innerH} fill="rgba(255,255,255,0.04)" />
                  )}
                  {series.map((s, si) => {
                    const v = Number(d[s.key]) || 0;
                    const bx = x0 + barW * si;
                    const by = y(v);
                    return (
                      <rect
                        key={s.key}
                        x={bx}
                        y={by}
                        width={Math.max(1, barW - 1)}
                        height={PAD_T + innerH - by}
                        fill={s.color}
                        rx={2}
                      >
                        <title>{`${label(d)} · ${s.label}: ${v}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })
          : series.map((s) => {
              const step = data.length > 1 ? innerW / (data.length - 1) : 0;
              const pts = data.map((d, i) => `${PAD_L + step * i},${y(Number(d[s.key]) || 0)}`);
              return (
                <g key={s.key}>
                  <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2} />
                  {data.map((d, i) => (
                    <circle key={i} cx={PAD_L + step * i} cy={y(Number(d[s.key]) || 0)} r={2.5} fill={s.color}>
                      <title>{`${label(d)} · ${s.label}: ${Number(d[s.key]) || 0}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}

        {/* x labels */}
        {data.map((d, i) => {
          const cx =
            type === 'bar'
              ? PAD_L + (innerW / data.length) * (i + 0.5)
              : PAD_L + (data.length > 1 ? (innerW / (data.length - 1)) * i : 0);
          const txt = label(d);
          const short = txt.length > 12 ? `${txt.slice(0, 11)}…` : txt;
          return (
            <text
              key={i}
              x={cx}
              y={H - PAD_B + 16}
              textAnchor="end"
              fontSize={10}
              fill="rgba(255,255,255,0.5)"
              transform={`rotate(-35 ${cx} ${H - PAD_B + 16})`}
            >
              {short}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-1 flex-wrap">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
        {rows.length > max && <span className="text-xs text-zinc-600">showing top {max} of {rows.length}</span>}
      </div>
    </div>
  );
}
