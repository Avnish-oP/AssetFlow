"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ToastMessage = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

type ToastContextType = {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const toastStyles: Record<ToastMessage["type"], string> = {
  success: "border-brand/25 bg-brand-bg text-brand",
  error: "border-red/25 bg-red-bg text-red",
  info: "border-line bg-surface text-primary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-pin)] backdrop-blur-md ${toastStyles[t.type]}`}
            style={{ animation: "toast-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
