import DataPage from "@/components/data/DataPage";
import { RecordsProvider } from "@/components/data/RecordsContext";
import { loadRecords } from "@/lib/data/source";

export default async function DataRoute() {
  const records = await loadRecords();
  return (
    <RecordsProvider value={records}>
      <DataPage source={records.source} />
    </RecordsProvider>
  );
}
