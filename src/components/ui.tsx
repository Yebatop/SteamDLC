"use client";

import type { ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: "bg-raised hover:bg-line text-slate-200 border border-line",
    primary: "bg-steam-dim hover:bg-steam hover:text-ink text-white border border-steam-dim",
    ghost: "bg-transparent hover:bg-raised text-muted hover:text-slate-200 border border-transparent",
    danger: "bg-transparent hover:bg-danger/20 text-danger border border-danger/40",
  };

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
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
      className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 select-none"
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
      className={`w-full rounded border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-muted/60 focus:border-steam ${
        mono ? "font-mono" : ""
      }`}
    />
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[6vh]"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-lg border border-line bg-panel shadow-2xl ${wide ? "max-w-3xl" : "max-w-xl"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-xl leading-none text-muted hover:text-slate-100"
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
    neutral: "bg-line/60 text-slate-300",
    sale: "bg-sale-bg text-sale",
    warn: "bg-warn/20 text-warn",
    info: "bg-steam-dim/30 text-steam",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
