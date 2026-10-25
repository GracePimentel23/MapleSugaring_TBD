import DemoPage from "@/components/demo/DemoPage";
import type { DemoState } from "@/components/demo/types";
import { fetchWorker } from "@/lib/api/server";

/** Temporary Demo tab for the sponsor video: live weight, modes, tare, reset, alerts, calibration. */
export default async function DemoRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { bucket } = await searchParams;
  const query = typeof bucket === "string" && /^\d+$/.test(bucket) ? `?bucket=${bucket}` : "";
  const demo = await fetchWorker<DemoState>(`/demo${query}`);
  return <DemoPage demo={demo} />;
}
