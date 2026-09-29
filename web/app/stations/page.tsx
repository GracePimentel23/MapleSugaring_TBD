import StationsPage from "@/components/stations/StationsPage";
import { loadStations } from "@/lib/data/source";

export default async function StationsRoute() {
  const { stations, alerts, source } = await loadStations();
  return <StationsPage stations={stations} alerts={alerts} source={source} />;
}
