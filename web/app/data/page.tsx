import DataTabs from "@/components/data/DataTabs";
import { RecordsProvider } from "@/components/data/RecordsContext";
import { loadRecords } from "@/lib/data/source";

export default async function DataPage() {
  const records = await loadRecords();
  return (
    <RecordsProvider value={records}>
      <DataTabs source={records.source} />
    </RecordsProvider>
  );
}
