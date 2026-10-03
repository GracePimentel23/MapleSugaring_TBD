"use client";

import { useState } from "react";
import { useShows } from "@/components/auth/AccessContext";
import AddCollectionSheet from "@/components/data/collections/AddCollectionSheet";
import EditCollectionSheet from "@/components/data/collections/EditCollectionSheet";
import EditEntryPopup from "@/components/data/collections/EditEntryPopup";
import { useRecords } from "@/components/data/RecordsContext";
import { ChevronIcon, EditIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/dates";

export default function CollectionsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editCollectionId, setEditCollectionId] = useState<string | null>(null);
  const [editRowKey, setEditRowKey] = useState<{
    collectionId: string;
    bucketId: number;
  } | null>(null);

  const { collections } = useRecords();
  // Who sees these buttons: worker/src/rbac.config.js COMPONENTS.
  const canAdd = useShows("data.collections.add");
  const isAdmin = useShows("data.collections.edit");

  const editCollection =
    collections.find((collection) => collection.id === editCollectionId) ?? null;
  const editRowEntry =
    collections
      .find((collection) => collection.id === editRowKey?.collectionId)
      ?.entries.find((entry) => entry.bucketId === editRowKey?.bucketId) ?? null;

  return (
    <div className="max-w-3xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-semibold">Collections</h2>
          <p className="mt-0.5 text-xs text-muted">
            {collections.length} collection
            {collections.length === 1 ? "" : "s"} · most recent first
          </p>
        </div>
        {canAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-base leading-none">+</span> Add Collection
          </button>
        ) : null}
      </div>

      {collections.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <div className="mb-3 text-4xl">🪣</div>
          <p className="text-sm font-medium">No collections logged yet</p>
          <p className="mt-1 text-xs">
            The buckets are still filling - nothing has been emptied into storage.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collections.map((collection) => {
            const isOpen = expanded === collection.id;
            const number = String(collection.collectionNumber).padStart(2, "0");

            return (
              <div
                key={collection.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div className="flex w-full items-center justify-between px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : collection.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-sans text-xs font-bold text-white"
                      style={{ background: "var(--color-accent)" }}
                    >
                      #{number}
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-semibold">
                        {formatDate(collection.date)}
                      </div>
                      <div className="text-xs text-muted">
                        {collection.entries.length} bucket
                        {collection.entries.length === 1 ? "" : "s"} ·{" "}
                        {collection.batchName}
                      </div>
                    </div>
                  </button>

                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="font-sans text-sm font-bold">
                      {collection.totalLbs} lbs
                    </span>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setEditCollectionId(collection.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-gray-100"
                        aria-label={`Edit collection ${number}`}
                      >
                        <EditIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : collection.id)}
                      className="text-muted"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      <ChevronIcon open={isOpen} />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <div
                      className="grid px-4 py-2 text-xs font-medium text-muted"
                      style={{ gridTemplateColumns: "1fr 1fr 80px 32px" }}
                    >
                      <span>Bucket</span>
                      <span>Collected By</span>
                      <span>Weight</span>
                      <span />
                    </div>
                    {collection.entries.map((entry, index) => (
                      <div
                        key={entry.bucketId}
                        className="grid items-center px-4 py-2.5 text-sm"
                        style={{
                          gridTemplateColumns: "1fr 1fr 80px 32px",
                          background: index % 2 === 0 ? "white" : "#F5F5F5",
                          borderTop: "1px solid var(--color-border)",
                        }}
                      >
                        <span className="font-medium">{entry.bucketName}</span>
                        <span className="text-muted">{entry.collectedBy}</span>
                        <span className="text-muted">{entry.lbs} lbs</span>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditRowKey({
                                collectionId: collection.id,
                                bucketId: entry.bucketId,
                              })
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-gray-200"
                            aria-label={`Edit ${entry.bucketName} entry`}
                          >
                            <EditIcon />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    {collection.notes ? (
                      <div
                        className="border-t px-4 py-3 text-xs text-muted"
                        style={{ borderColor: "var(--color-border)", background: "#F5F5F5" }}
                      >
                        📝 {collection.notes}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? <AddCollectionSheet onClose={() => setShowAdd(false)} /> : null}
      {editCollection ? (
        <EditCollectionSheet
          collection={editCollection}
          onClose={() => setEditCollectionId(null)}
        />
      ) : null}
      {editRowEntry ? (
        <EditEntryPopup entry={editRowEntry} onClose={() => setEditRowKey(null)} />
      ) : null}
    </div>
  );
}
