"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext).showToast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(item.id), 200);
    }, 3500);
    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  const colors =
    item.type === "success"
      ? "border-[#c0ebd0] bg-[#f0fff5] text-[#2d8d62]"
      : item.type === "error"
        ? "border-[#f7cfc7] bg-[#fff6f4] text-[#b64031]"
        : "border-[#c9ddf4] bg-[#eef6ff] text-[#285f87]";

  const icon =
    item.type === "success" ? "✓" : item.type === "error" ? "✕" : "ℹ";

  return (
    <div
      className={`flex items-start gap-2 rounded-[1.1rem] border px-4 py-3 text-xs font-black shadow-lg transition-all duration-200 ${colors} ${
        exiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
      role="alert"
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
        {icon}
      </span>
      <span className="mt-0.5 flex-1 leading-4">{item.message}</span>
      <button
        type="button"
        onClick={() => {
          setExiting(true);
          setTimeout(() => onRemove(item.id), 200);
        }}
        className="ml-1 shrink-0 rounded-full p-1 text-[var(--foreground)]/40 transition hover:text-[var(--foreground)]/70"
        aria-label="关闭提示"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="m6.53 5.47 5.47 5.47 5.47-5.47 1.06 1.06L13.06 12l5.47 5.47-1.06 1.06L12 13.06l-5.47 5.47-1.06-1.06L10.94 12 5.47 6.53l1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}
