import { notFound } from "next/navigation";
import DataSectionPage from "@/components/data/DataSectionPage";
import { dataSections, isDataSection } from "@/components/data/sections";

export const dynamicParams = false;

export function generateStaticParams() {
  return dataSections.map((section) => ({ section: section.id }));
}

export default async function DataSectionRoute({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isDataSection(section)) notFound();

  return <DataSectionPage section={section} />;
}
