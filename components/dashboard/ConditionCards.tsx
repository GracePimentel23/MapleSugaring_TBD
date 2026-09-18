import { CloudIcon, DropletIcon } from "@/components/icons";
import type { DashboardMeta } from "@/lib/types/schema";

export default function ConditionCards({ meta }: { meta: DashboardMeta }) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: "#e7efe2" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <CloudIcon />
            <span className="font-sans text-sm font-medium text-text">
              {meta.weather.label}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-sans text-[32px] leading-none font-semibold tracking-tight">
                {meta.weather.temperatureF}°F
              </div>
              <div className="mt-2 text-sm text-muted">{meta.weather.summary}</div>
            </div>
            <div className="text-right text-xs text-muted">
              <div>L: {meta.weather.lowF}°</div>
              <div>H: {meta.weather.highF}°</div>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: "#f7f0d8" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <DropletIcon fill="#1C1C1E" size={14} />
            <span className="font-sans text-sm font-medium text-text">
              {meta.sapCondition.label}
            </span>
          </div>
          <div className="font-sans text-sm font-medium text-text">
            {meta.sapCondition.headline}
          </div>
          <div className="mt-2 text-sm text-muted">
            Sap Flow: {meta.sapCondition.flow}
          </div>
        </div>
      </div>

      {meta.weatherAlert ? (
        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-alert">
          <span className="h-2 w-2 rounded-full bg-alert" />
          <span>{meta.weatherAlert.message}</span>
        </div>
      ) : null}
    </div>
  );
}
