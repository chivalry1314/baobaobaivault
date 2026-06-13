"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ConfirmVariant = "default" | "destructive";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

type ConfirmDialogState = ConfirmOptions & {
  open: boolean;
  resolve?: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
});

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({ open: false, title: "" });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (value: boolean) => {
      setState((current) => {
        current?.resolve?.(value);
        return { ...current, open: false };
      });
      setTimeout(() => {
        setState({ open: false, title: "" });
      }, 200);
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog state={state} onClose={handleClose} />
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmDialogState;
  onClose: (value: boolean) => void;
}) {
  const { open, title, description, confirmText = "确认", cancelText = "取消", variant = "default" } = state;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open && !state.title) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[110] flex items-center justify-center p-4 transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="presentation"
      onClick={() => onClose(false)}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-sm rounded-[1.4rem] border-2 border-[var(--outline)] bg-white p-5 shadow-xl transition-all duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-black text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p id="confirm-dialog-description" className="mt-2 text-xs font-bold leading-5 text-[var(--foreground)]/65">
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex flex-row-reverse flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-full px-4 py-2 text-xs font-black shadow-sm transition ${
              variant === "destructive"
                ? "bg-[#c94c3b] text-white hover:bg-[#b64031]"
                : "bg-[var(--button-primary)] text-[var(--foreground)] hover:bg-[var(--button-primary-hover)]"
            }`}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-full border border-[var(--outline)]/20 bg-white px-4 py-2 text-xs font-black text-[var(--foreground)]/78 shadow-sm transition hover:bg-[var(--surface-container)]"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
