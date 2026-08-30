"use client";

import { useId, useState, type ReactNode } from "react";

/** Small shared control kit: consistent sizing, focus states and 44px targets. */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h3>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <section className="border-b border-border-subtle p-3">{children}</section>;
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
  type = "button",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  full?: boolean;
}) {
  const styles: Record<string, string> = {
    default:
      "border border-border-subtle bg-surface-raised text-foreground hover:border-border-strong",
    primary: "border border-accent bg-accent/15 text-accent-strong hover:bg-accent/25",
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    ghost: "border border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        styles[variant]
      } ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * A numeric field that lets you type freely and only commits a valid number,
 * so a half-typed value never snaps the canvas around.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit = "cm",
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(Math.round(value * 10) / 10));

  // Re-sync the draft when the value changes underneath us (undo, agent edit,
  // drag on the canvas) using React's "adjust state during render" pattern.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(Math.round(value * 10) / 10));
  }

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(Math.round(value * 10) / 10));
      return;
    }
    onCommit(parsed);
  };

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="relative flex items-center">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              (event.target as HTMLInputElement).blur();
            }
          }}
          className="h-11 w-full rounded-md border border-border-subtle bg-background pl-2.5 pr-9 font-mono text-sm text-foreground disabled:opacity-50"
        />
        <span className="pointer-events-none absolute right-2.5 text-[11px] text-muted">
          {unit}
        </span>
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 rounded-md border border-border-subtle bg-background px-2 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(draft);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="h-11 w-full rounded-md border border-border-subtle bg-background px-2.5 text-sm text-foreground placeholder:text-muted/70"
      />
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[color:var(--accent)]"
      />
      {label}
    </label>
  );
}
