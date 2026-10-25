"use client";

import Link from "next/link";
import Analysis from "@/components/data/Analysis";
import Batches from "@/components/data/Batches";
import Collections from "@/components/data/Collections";
import Overview from "@/components/data/Overview";
import { dataSections, type DataSectionId } from "@/components/data/sections";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import { cx } from "@/components/ui/ui";

export default function DataSectionPage({ section }: { section: DataSectionId }) {
  const { day } = useLive();
  const { shows } = useSession();

  return (
    <div className="flex min-h-full w-full flex-col">
      {/* On web the subsections live in the side nav; phones keep the tabs. */}
      <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-border px-4 pt-2 md:hidden">
        {dataSections
          .filter((tab) => shows(`data.${tab.id}`))
          .map((tab) => {
            const active = section === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cx(
                  "-mb-px shrink-0 border-b-[3px] py-2.5 font-sans text-body",
                  active ? "border-accent font-bold text-accent" : "border-transparent font-normal text-muted",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
      </div>

      <div className="flex-1 md:pt-0">
        {section === "overview" ? <Overview day={day} /> : null}
        {section === "collections" ? <Collections day={day} /> : null}
        {section === "batches" ? <Batches day={day} /> : null}
        {section === "analysis" ? <Analysis day={day} /> : null}
      </div>
    </div>
  );
}
