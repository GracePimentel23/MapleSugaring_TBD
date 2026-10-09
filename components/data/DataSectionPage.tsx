"use client";

import Link from "next/link";
import Analysis from "@/components/data/Analysis";
import Batches from "@/components/data/Batches";
import Collections from "@/components/data/Collections";
import Overview from "@/components/data/Overview";
import { dataSections, type DataSectionId } from "@/components/data/sections";
import { useDemo } from "@/components/demo/DemoProvider";

export default function DataSectionPage({ section }: { section: DataSectionId }) {
  const { day } = useDemo();
  const title = dataSections.find((item) => item.id === section)?.label ?? "Data";

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <h1 className="mb-4 font-sans text-2xl font-semibold md:mb-0 md:text-3xl">{title}</h1>

        {/* On web the subsections live in the side nav; mobile keeps the tabs. */}
        <div className="-mx-4 px-4 md:hidden">
          <div
            className="no-scrollbar flex gap-1 overflow-x-auto"
            style={{ borderBottom: "1.5px solid var(--color-border)" }}
          >
            {dataSections.map((tab) => {
              const active = section === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="shrink-0 px-4 py-2.5 font-sans text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--color-accent)" : "var(--color-muted)",
                    borderBottom: active
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                    marginBottom: "-1.5px",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {section === "overview" ? <Overview day={day} /> : null}
        {section === "collections" ? <Collections day={day} role="admin" /> : null}
        {section === "batches" ? <Batches day={day} role="admin" /> : null}
        {section === "analysis" ? <Analysis day={day} /> : null}
      </div>
    </div>
  );
}
