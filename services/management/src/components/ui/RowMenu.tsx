"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/LocaleProvider";

export type RowMenuItem = {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
};

/** Approximate width / spacing of the dropdown panel; used for flip-positioning. */
const MENU_MIN_WIDTH = 176; // matches min-w-[11rem]
const VIEWPORT_MARGIN = 8;

type Position = { top: number; left: number };

export function RowMenu({
  items,
  label,
}: {
  items: RowMenuItem[];
  label?: string;
}) {
  const t = useT();
  const resolvedLabel = label ?? t("common.actions");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? MENU_MIN_WIDTH;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right - menuWidth;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left + menuWidth > viewportWidth - VIEWPORT_MARGIN) {
      left = viewportWidth - VIEWPORT_MARGIN - menuWidth;
    }

    let top = rect.bottom + 4;
    if (menuHeight > 0 && top + menuHeight > viewportHeight - VIEWPORT_MARGIN) {
      const flipped = rect.top - menuHeight - 4;
      top = flipped >= VIEWPORT_MARGIN ? flipped : VIEWPORT_MARGIN;
    }

    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => computePosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <span
      className="inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={resolvedLabel}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        </svg>
      </button>
      {mounted && open
        ? createPortal(
            <ul
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? "visible" : "hidden",
              }}
              className="z-50 min-w-[11rem] origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 list-none m-0 p-0"
            >
              {items.map((item) => (
                <li key={item.label} role="none" className="list-none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      item.variant === "danger"
                        ? "text-red-700 hover:bg-red-50"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </span>
  );
}
