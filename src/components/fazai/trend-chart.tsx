'use client';

import React from 'react';
import { formatNumber } from '@/lib/format';

interface Props {
  data: number[];
  labels: string[];
  height?: number;
}

interface MultiSeries {
  name: string;
  color: string;
  data: number[];
  axis: 'left' | 'right';
}

interface MultiProps {
  series: MultiSeries[];
  labels: string[];
  height?: number;
}

function scaleFor(values: number[]): { min: number; max: number } {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const pad = span * 0.1;
  return { min: min - pad, max: max + pad };
}

// Multi-series trend chart with dual Y axis.
// Left axis scales Income/Asset, right axis scales Net Profit.
export function MultiTrendChart({ series, labels, height = 180 }: MultiProps) {
  if (series.length === 0 || labels.length === 0) return null;
  const w = 640;
  const h = height;
  const padL = 46, padR = 46, padT = 10, padB = 18;
  const leftVals = series.filter(s => s.axis === 'left').flatMap(s => s.data);
  const rightVals = series.filter(s => s.axis === 'right').flatMap(s => s.data);
  const left = scaleFor(leftVals.length ? leftVals : [0]);
  const right = scaleFor(rightVals.length ? rightVals : [0]);
  const n = labels.length;
  const stepX = n > 1 ? (w - padL - padR) / (n - 1) : 0;
  const xAt = (i: number) => padL + i * stepX;
  const yLeft = (v: number) => padT + (1 - (v - left.min) / (left.max - left.min)) * (h - padT - padB);
  const yRight = (v: number) => padT + (1 - (v - right.min) / (right.max - right.min)) * (h - padT - padB);
  const ticks = [0, 0.5, 1];
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-3 flex-wrap mb-1">
        {series.map(s => (
          <span key={s.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="inline-block w-3 h-[3px] rounded" style={{ background: s.color }} />
            {s.name}{s.axis === 'right' ? ' (R)' : ''}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px]" style={{ height }}>
        {ticks.map((f, i) => {
          const y = padT + f * (h - padT - padB);
          const lv = left.max - f * (left.max - left.min);
          const rv = right.max - f * (right.max - right.min);
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e5e5e5" strokeWidth={1} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#888">{shortNum(lv)}</text>
              <text x={w - padR + 4} y={y + 3} textAnchor="start" fontSize={9} fill="#888">{shortNum(rv)}</text>
            </g>
          );
        })}
        {series.map(s => {
          const pts = s.data.map((v, i) => {
            const x = xAt(i);
            const y = s.axis === 'left' ? yLeft(v) : yRight(v);
            return { x, y };
          });
          const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={s.color} />
              ))}
            </g>
          );
        })}
        {labels.map((lb, i) => (
          <text key={i} x={xAt(i)} y={h - 4} textAnchor="middle" fontSize={8.5} fill="#888">
            {i % 2 === 0 || n <= 6 ? lb : ''}
          </text>
        ))}
      </svg>
    </div>
  );
}

function shortNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

// Lightweight SVG trend chart, no dependency
export function TrendChart({ data, labels, height = 120 }: Props) {
  if (data.length === 0) return null;
  const w = 560;
  const h = height;
  const pad = 8;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = max - min || 1;
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return { x, y, v };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pad + (data.length - 1) * stepX).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? '#16a34a' : '#dc2626';
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[420px]" style={{ height }}>
        <path d={area} fill={stroke} opacity={0.12} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={stroke} />
            <text x={p.x} y={h - 1} textAnchor="middle" fontSize={9} fill="#888">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1 -mt-1">
        <span>Min {formatNumber(min)}</span>
        <span>Max {formatNumber(max)}</span>
      </div>
    </div>
  );
}
