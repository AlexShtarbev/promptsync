import type { ReactNode } from "react";
import { MonitorStats } from "./MonitorStats";

interface Props {
  children: ReactNode;
  sidebar: ReactNode;
  connected: boolean;
  /** Full-height mode: the view fills the viewport and scrolls internally (doc reader). */
  fill?: boolean;
}

export function Layout({ children, sidebar, connected, fill }: Props) {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <h1>PromptSync</h1>
          <MonitorStats />
        </div>
        <span className={`ws-status ${connected ? "connected" : "disconnected"}`}>
          {connected ? "Live" : "Offline"}
        </span>
      </header>
      <div className="body">
        <aside className="sidebar">{sidebar}</aside>
        <main className={`main ${fill ? "main-fill" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
