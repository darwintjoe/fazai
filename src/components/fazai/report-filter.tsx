'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MONTH_LABELS, isCurrentMonth } from '@/lib/format';
import type { Granularity } from '@/lib/report-period';

export type RangePreset = 'this-month' | 'last-month' | 'this-quarter' | 'ytd' | 'custom';
export type AsofPreset = 'this-month' | 'last-month' | 'quarter-end' | 'year-end';

interface BaseProps {
  lang: string;
}

interface AsofProps extends BaseProps {
  mode: 'asof';
  month: number;
  year: number;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
  onPreset: (p: AsofPreset) => void;
  activePreset: AsofPreset | 'custom';
}

interface RangeProps extends BaseProps {
  mode: 'range';
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  onFromMonth: (m: number) => void;
  onFromYear: (y: number) => void;
  onToMonth: (m: number) => void;
  onToYear: (y: number) => void;
  onPreset: (p: RangePreset) => void;
  activePreset: RangePreset;
  granularity?: Granularity;
  onGranularity?: (g: Granularity) => void;
  showGranularity?: boolean;
}

type Props = AsofProps | RangeProps;

function yearOptions(): number[] {
  const now = new Date();
  const out: number[] = [];
  for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) out.push(y);
  return out;
}

const pillCls = (active: boolean) =>
  `h-7 text-[11px] px-2.5 rounded-full border transition-colors ${
    active
      ? 'bg-red-600 text-white border-red-600'
      : 'bg-background text-muted-foreground border-border hover:text-foreground'
  }`;

export function ReportFilterBar(props: Props) {
  const years = yearOptions();
  const monthYear = (mVal: number, yVal: number, onM: (m: number) => void, onY: (y: number) => void) => (
    <>
      <Select value={String(mVal)} onValueChange={(v) => onM(Number(v))}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(yVal)} onValueChange={(v) => onY(Number(v))}>
        <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  if (props.mode === 'asof') {
    const pills: { id: AsofPreset; label: string }[] = [
      { id: 'this-month', label: 'This month' },
      { id: 'last-month', label: 'Last month' },
      { id: 'quarter-end', label: 'Q-end' },
      { id: 'year-end', label: 'Year-end' },
    ];
    return (
      <div className="flex flex-col gap-2 p-3 rounded-xl border bg-card">
        <div className="flex gap-1.5 flex-wrap">
          {pills.map(p => (
            <button key={p.id} className={pillCls(props.activePreset === p.id)} onClick={() => props.onPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium w-8">As of</span>
          {monthYear(props.month, props.year, props.onMonth, props.onYear)}
          {isCurrentMonth(props.year, props.month) && (
            <span className="text-[11px] text-amber-600 font-semibold">MTD</span>
          )}
        </div>
      </div>
    );
  }

  const pills: { id: RangePreset; label: string }[] = [
    { id: 'this-month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
    { id: 'this-quarter', label: 'Quarter' },
    { id: 'ytd', label: 'YTD' },
    { id: 'custom', label: 'Custom' },
  ];
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border bg-card">
      <div className="flex gap-1.5 flex-wrap">
        {pills.map(p => (
          <button key={p.id} className={pillCls(props.activePreset === p.id)} onClick={() => props.onPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium w-8">From</span>
        {monthYear(props.fromMonth, props.fromYear, props.onFromMonth, props.onFromYear)}
        <span className="text-[11px] text-muted-foreground font-medium">To</span>
        {monthYear(props.toMonth, props.toYear, props.onToMonth, props.onToYear)}
        {isCurrentMonth(props.toYear, props.toMonth) && (
          <span className="text-[11px] text-amber-600 font-semibold">MTD</span>
        )}
      </div>
      {props.showGranularity && props.granularity && props.onGranularity && (
        <div className="flex gap-1.5 items-center flex-wrap pt-1 border-t">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">View</span>
          {(['monthly', 'quarterly', 'yearly'] as const).map(g => (
            <Button
              key={g} size="sm"
              variant={props.granularity === g ? 'default' : 'outline'}
              className="h-7 text-[11px] px-2.5 rounded-full capitalize"
              onClick={() => props.onGranularity!(g)}
            >
              {g}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
