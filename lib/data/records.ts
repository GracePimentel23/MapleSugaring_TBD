import type { Batch, Collection, SeasonSummary } from "@/lib/types/schema";

/** Static mock records for the Data tab (Overview, Collections, Batches, Analysis). */

export const recordsDate = "2022-03-14";

export const collections: Collection[] = [
  {
    id: "c3",
    collectionNumber: 3,
    date: "2022-03-11",
    entries: [
      {
        bucketId: 1,
        bucketName: "Bucket #01",
        collectedBy: "Sam R.",
        lbs: 7.5
      },
      {
        bucketId: 3,
        bucketName: "Bucket #03",
        collectedBy: "Sam R.",
        lbs: 9.2
      }
    ],
    totalLbs: 16.7,
    batchName: "Batch #03",
    loggedBy: "Sam R.",
    notes: "Collected to feed the evaporator - best freeze-thaw run of the season."
  },
  {
    id: "c2",
    collectionNumber: 2,
    date: "2022-03-08",
    entries: [
      {
        bucketId: 2,
        bucketName: "Bucket #02",
        collectedBy: "Mr. Adams",
        lbs: 10.3
      },
      {
        bucketId: 4,
        bucketName: "Bucket #04",
        collectedBy: "Jordan T.",
        lbs: 9.4
      },
      {
        bucketId: 5,
        bucketName: "Bucket #05",
        collectedBy: "Jordan T.",
        lbs: 7.3
      }
    ],
    totalLbs: 27,
    batchName: "Batch #02",
    loggedBy: "Mr. Adams",
    notes: "Snow moving in - pulled three buckets indoors and emptied them before carrying them in."
  },
  {
    id: "c1",
    collectionNumber: 1,
    date: "2022-03-06",
    entries: [
      {
        bucketId: 1,
        bucketName: "Bucket #01",
        collectedBy: "Chloe M.",
        lbs: 10.1
      },
      {
        bucketId: 3,
        bucketName: "Bucket #03",
        collectedBy: "Chloe M.",
        lbs: 12
      }
    ],
    totalLbs: 22.1,
    batchName: "Batch #01",
    loggedBy: "Chloe M.",
    notes: "Bucket #03 was pegged at capacity overnight - cleared both before the warm front moved in."
  }
];

export const batches: Batch[] = [
  {
    id: "b3",
    batchNumber: "Batch #03",
    date: "2022-03-11",
    status: "active",
    sapInLbs: 16.7,
    syrupOutLbs: 0,
    brix: 0,
    createdBy: "Sam R.",
    notes: "Open batch - new collections are going into this one."
  },
  {
    id: "b2",
    batchNumber: "Batch #02",
    date: "2022-03-08",
    status: "completed",
    sapInLbs: 27,
    syrupOutLbs: 1.1,
    brix: 66.8,
    createdBy: "Mr. Adams",
    notes: "Best clarity of the season."
  },
  {
    id: "b1",
    batchNumber: "Batch #01",
    date: "2022-03-06",
    status: "completed",
    sapInLbs: 22.1,
    syrupOutLbs: 0.9,
    brix: 66.4,
    createdBy: "Mr. Adams"
  }
];

export const seasons: SeasonSummary[] = [
  {
    season: "Season 2022",
    totalSapLbs: 121.7,
    totalSyrupLbs: 2,
    avgBrix: 66.6,
    sapToSyrupRatio: 24.6,
    totalCollections: 3,
    totalBatches: 3,
    avgTempF: 35,
    weeklyFlow: [
      {
        week: "Mar 1",
        lbs: 13.6,
        temp: 35
      },
      {
        week: "Mar 2",
        lbs: 9,
        temp: 34
      },
      {
        week: "Mar 3",
        lbs: 0.9,
        temp: 26
      },
      {
        week: "Mar 4",
        lbs: 1.4,
        temp: 27
      },
      {
        week: "Mar 5",
        lbs: 20.5,
        temp: 37
      },
      {
        week: "Mar 6",
        lbs: 1.8,
        temp: 58
      },
      {
        week: "Mar 7",
        lbs: 5.4,
        temp: 38
      },
      {
        week: "Mar 8",
        lbs: 1.1,
        temp: 33
      },
      {
        week: "Mar 9",
        lbs: 11.8,
        temp: 35
      },
      {
        week: "Mar 10",
        lbs: 12.7,
        temp: 36
      },
      {
        week: "Mar 11",
        lbs: 15.4,
        temp: 39
      },
      {
        week: "Mar 12",
        lbs: 1.4,
        temp: 27
      },
      {
        week: "Mar 13",
        lbs: 0.5,
        temp: 25
      },
      {
        week: "Mar 14",
        lbs: 26.4,
        temp: 41
      }
    ]
  },
  {
    season: "Season 2021",
    totalSapLbs: 109.8,
    totalSyrupLbs: 4.3,
    avgBrix: 66.1,
    sapToSyrupRatio: 25.5,
    totalCollections: 9,
    totalBatches: 7,
    avgTempF: 31,
    weeklyFlow: [
      {
        week: "Mar 1",
        lbs: 6,
        temp: 28
      },
      {
        week: "Mar 2",
        lbs: 8.5,
        temp: 31
      },
      {
        week: "Mar 3",
        lbs: 11.2,
        temp: 34
      },
      {
        week: "Mar 4",
        lbs: 4,
        temp: 26
      },
      {
        week: "Mar 5",
        lbs: 2.2,
        temp: 24
      },
      {
        week: "Mar 6",
        lbs: 9.8,
        temp: 33
      },
      {
        week: "Mar 7",
        lbs: 14.1,
        temp: 37
      },
      {
        week: "Mar 8",
        lbs: 12.6,
        temp: 36
      },
      {
        week: "Mar 9",
        lbs: 3.4,
        temp: 27
      },
      {
        week: "Mar 10",
        lbs: 1.8,
        temp: 25
      },
      {
        week: "Mar 11",
        lbs: 10.2,
        temp: 34
      },
      {
        week: "Mar 12",
        lbs: 13.5,
        temp: 38
      },
      {
        week: "Mar 13",
        lbs: 7.1,
        temp: 30
      },
      {
        week: "Mar 14",
        lbs: 5.4,
        temp: 29
      }
    ]
  },
  {
    season: "Season 2020",
    totalSapLbs: 115.5,
    totalSyrupLbs: 4.6,
    avgBrix: 65.9,
    sapToSyrupRatio: 25.1,
    totalCollections: 8,
    totalBatches: 6,
    avgTempF: 31,
    weeklyFlow: [
      {
        week: "Mar 1",
        lbs: 4.2,
        temp: 26
      },
      {
        week: "Mar 2",
        lbs: 7.1,
        temp: 29
      },
      {
        week: "Mar 3",
        lbs: 9.4,
        temp: 32
      },
      {
        week: "Mar 4",
        lbs: 12.8,
        temp: 35
      },
      {
        week: "Mar 5",
        lbs: 6.3,
        temp: 30
      },
      {
        week: "Mar 6",
        lbs: 2.9,
        temp: 25
      },
      {
        week: "Mar 7",
        lbs: 8.7,
        temp: 31
      },
      {
        week: "Mar 8",
        lbs: 11.5,
        temp: 34
      },
      {
        week: "Mar 9",
        lbs: 13.2,
        temp: 36
      },
      {
        week: "Mar 10",
        lbs: 5.8,
        temp: 29
      },
      {
        week: "Mar 11",
        lbs: 3.1,
        temp: 26
      },
      {
        week: "Mar 12",
        lbs: 9.9,
        temp: 33
      },
      {
        week: "Mar 13",
        lbs: 12.4,
        temp: 35
      },
      {
        week: "Mar 14",
        lbs: 8.2,
        temp: 31
      }
    ]
  }
];
