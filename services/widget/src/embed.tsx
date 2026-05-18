import { createRoot, type Root } from "react-dom/client";
import { VerifyWidget } from "./VerifyWidget";
import widgetCss from "./widget.css?inline";

const mounted = new WeakSet<HTMLElement>();
const roots = new Map<HTMLElement, Root>();

function findLoaderScript(): HTMLScriptElement | null {
  return (
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[src*="renis-verify"]')
  );
}

function resolveApiUrl(container: HTMLElement): string {
  const script = findLoaderScript();
  return (
    container.dataset.apiUrl ??
    script?.dataset.apiUrl ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function readInitialCode(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("code") ?? params.get("verify") ?? "";
}

function mount(container: HTMLElement): void {
  if (mounted.has(container)) return;
  mounted.add(container);

  const apiUrl = resolveApiUrl(container);
  const initialCode =
    container.dataset.initialCode ?? readInitialCode();

  const shadow = container.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = widgetCss;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  roots.set(container, root);
  root.render(
    <VerifyWidget apiUrl={apiUrl} initialCode={initialCode} />
  );
}

function unmount(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
  mounted.delete(container);
}

export function init(selector?: string): void {
  if (selector) {
    document.querySelectorAll<HTMLElement>(selector).forEach(mount);
    return;
  }

  document
    .querySelectorAll<HTMLElement>("[data-renis-verify]")
    .forEach(mount);

  const byId = document.getElementById("renis-verify");
  if (byId) mount(byId);
}

function autoInit(): void {
  init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit);
} else {
  autoInit();
}

declare global {
  interface Window {
    RenisVerify?: {
      init: typeof init;
      mount: typeof mount;
      unmount: typeof unmount;
    };
  }
}

window.RenisVerify = { init, mount, unmount };
