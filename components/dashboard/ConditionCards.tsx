import type { DashboardMeta } from "@/lib/types/schema";

function weatherGlyph(weather: DashboardMeta["weather"]): string {
  if (weather.snowIn >= 0.4) return "❄️";
  if (weather.precipIn >= 0.3) return "🌧️";
  if (weather.highF >= 60) return "☀️";
  if (weather.cloudPercent >= 88) return "☁️";
  return "🌤️";
}

export default function ConditionCards({ meta }: { meta: DashboardMeta }) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(77,124,48,0.10)",
            border: "1px solid rgba(77,124,48,0.2)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{weatherGlyph(meta.weather)}</span>
            <span className="font-sans text-sm font-medium">{meta.weather.label}</span>
          </div>
          <div className="text-2xl font-bold">{meta.weather.temperatureF}°F</div>
          <div className="mt-1 text-xs text-muted">
            L: {meta.weather.lowF}° &nbsp;·&nbsp; H: {meta.weather.highF}°
          </div>
          <div className="mt-0.5 text-xs text-muted">{meta.weather.summary}</div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(234,179,8,0.10)",
            border: "1px solid rgba(234,179,8,0.25)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">💧</span>
            <span className="font-sans text-sm font-medium">{meta.sapCondition.label}</span>
          </div>
          <div className="text-sm font-medium">{meta.sapCondition.headline}</div>
          <div className="mt-1 text-xs text-muted">
            Sap Flow: {meta.sapCondition.flow}
          </div>
        </div>
      </div>

      {meta.weatherAlert ? (
        <div
          className="mb-5 flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "#DC2626" }}
        >
          <span>●</span>
          <span>{meta.weatherAlert.message}</span>
        </div>
      ) : null}
    </div>
  );
}
