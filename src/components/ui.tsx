"use client";

import type { ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  type = "button",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: "bg-raised text-slate-200 ring-1 ring-line hover:bg-line hover:ring-steam-dim",
    primary:
      "bg-steam text-ink font-semibold shadow-lg shadow-steam/20 hover:brightness-110 ring-1 ring-steam",
    ghost: "text-muted hover:bg-raised hover:text-slate-100 ring-1 ring-transparent",
    danger: "text-danger ring-1 ring-danger/40 hover:bg-danger/15",
  };
  const sizes: Record<string, string> = {
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-2.5 text-[15px]",
  };

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-steam disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      title={hint}
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors select-none ${
        checked ? "bg-steam-dim/20 text-steam" : "text-slate-300 hover:bg-raised"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer accent-steam"
      />
      {label}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      {children}
      {hint ? <div className="text-xs leading-relaxed text-muted">{hint}</div> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border border-line bg-ink/80 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-muted/60 focus:border-steam focus:ring-2 focus:ring-steam/25 ${
        mono ? "font-mono" : ""
      }`}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-line bg-ink/80 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-steam"
    >
      {children}
    </select>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 pt-[6vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl border border-line bg-panel shadow-2xl shadow-black/60 ${wide ? "max-w-3xl" : "max-w-xl"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 text-xl leading-none text-muted transition-colors hover:bg-raised hover:text-slate-100"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "sale" | "warn" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-line/70 text-slate-300",
    sale: "bg-sale-bg text-sale",
    warn: "bg-warn/20 text-warn",
    info: "bg-steam-dim/30 text-steam",
  };
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
