"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, LogOut, LayoutDashboard, Users, BarChart3, ScrollText, Settings as SettingsIcon } from "lucide-react";
import { getStoredSession, clearStoredSession } from "@/lib/apiClient";
import OverviewTab from "@/components/admin/OverviewTab";
import PartnersTab from "@/components/admin/PartnersTab";
import ReportsTab from "@/components/admin/ReportsTab";
import SyncLogsTab from "@/components/admin/SyncLogsTab";
import SettingsTab from "@/components/admin/SettingsTab";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, Component: OverviewTab },
  { key: "partners", label: "Partners", icon: Users, Component: PartnersTab },
  { key: "reports", label: "Reports", icon: BarChart3, Component: ReportsTab },
  { key: "logs", label: "Sync Logs", icon: ScrollText, Component: SyncLogsTab },
  { key: "settings", label: "Settings", icon: SettingsIcon, Component: SettingsTab },
];

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const session = getStoredSession();
    if (!session || session.type !== "admin") {
      router.push("/");
      return;
    }
    setReady(true);
  }, [router]);

  const logout = () => {
    clearStoredSession();
    router.push("/");
  };

  if (!ready) return null;

  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.Component || OverviewTab;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="stream-pulse"><div className="stream-pulse-dot" /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid #1E2430" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Radio size={18} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16 }}>AdStreamHQ</span>
          <span style={{ color: "#5B6272", fontSize: 13 }}>Admin Panel</span>
        </div>
        <button className="btn btn-ghost" onClick={logout}><LogOut size={14} /> Log out</button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: "1px solid #1E2430" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: "8px 8px 0 0",
                border: "none", cursor: "pointer", fontFamily: "Inter", fontWeight: 600, fontSize: 13,
                background: active ? "#12161F" : "transparent",
                color: active ? "#2DE1C2" : "#8B93A7",
                borderBottom: active ? "2px solid #2DE1C2" : "2px solid transparent",
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
        <ActiveComponent />
      </div>
    </div>
  );
}
