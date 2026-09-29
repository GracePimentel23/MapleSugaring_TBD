"use client";

import { useState } from "react";
import Analysis from "@/components/data/Analysis";
import Batches from "@/components/data/Batches";
import Collections from "@/components/data/Collections";
import Overview from "@/components/data/Overview";
import LiveRefresh from "@/components/common/LiveRefresh";
import type { DataSource } from "@/lib/data/source";

type DataTab = "overview" | "collections" | "batches" | "analysis";

const tabs: { id: DataTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "collections", label: "Collections" },
  { id: "batches", label: "Batches" },
  { id: "analysis", label: "Analysis" },
];

export default function DataTabs({ source }: { source: DataSource }) {
  const [activeTab, setActiveTab] = useState<DataTab>("overview");

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-sans text-2xl font-semibold md:text-3xl">Data</h1>
          <LiveRefresh source={source} seconds={30} />
        </div>

        <div className="-mx-4 px-4 md:mx-0 md:px-0">
          <div
            className="no-scrollbar flex gap-1 overflow-x-auto"
            style={{ borderBottom: "1.5px solid var(--color-border)" }}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="shrink-0 px-4 py-2.5 font-sans text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--color-accent)" : "var(--color-muted)",
                    background: "transparent",
                    borderBottom: active
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                    marginBottom: "-1.5px",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {activeTab === "overview" ? <Overview /> : null}
        {activeTab === "collections" ? <Collections role="admin" /> : null}
        {activeTab === "batches" ? <Batches role="admin" /> : null}
        {activeTab === "analysis" ? <Analysis /> : null}
      </div>
    </div>
  );
}
