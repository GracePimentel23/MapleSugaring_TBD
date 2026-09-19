import type { BatchStatus } from "@/lib/types/schema";

/**
 * The narration script for the 14-day walkthrough.
 *
 * `baseYieldLbs` is the sap a 1.0-factor bucket gains that day; each bucket
 * scales it by its own yieldFactor (see ./profiles.ts). Collections are applied
 * at the start of a day, before that day's yield is added, so a bucket that was
 * full yesterday reads near-empty today.
 */

export interface DemoCollectionEvent {
  bucketIds: number[];
  loggedBy: string;
  collectedBy: Record<number, string>;
  notes: string;
}

export interface DemoNarration {
  title: string;
  script: string;
  beats: string[];
}

export interface DemoDayScript {
  baseYieldLbs: number;
  flowLabel: string;
  sapHeadline: string;
  weatherAlert: string | null;
  collection?: DemoCollectionEvent;
  /** Buckets whose node stops reporting for this day */
  offlineBucketIds?: number[];
  narration: DemoNarration;
}

export const demoScript: DemoDayScript[] = [
  {
    baseYieldLbs: 3,
    flowLabel: "Moderate",
    sapHeadline: "Strong freeze-thaw swing overnight",
    weatherAlert: null,
    narration: {
      title: "Season opener - textbook freeze-thaw",
      script:
        "This is March 1st in Rochester. It dropped to 17 overnight and climbed to 47 in the afternoon. That 30 degree swing is the freeze-thaw cycle that actually drives sap through the tree. All five buckets are online and reporting, and this is the first real run of the season.",
      beats: [
        "All 5 stations online, no alerts anywhere",
        "13.6 lbs measured across the grove today",
        "Bucket #03 on South Ridge is already out front - it gets the best sun",
      ],
    },
  },
  {
    baseYieldLbs: 2,
    flowLabel: "Moderate",
    sapHeadline: "Freeze-thaw continues, milder afternoon",
    weatherAlert: null,
    narration: {
      title: "Steady, milder thaw",
      script:
        "Still a freeze-thaw day, but the thaw only reached 39 instead of 47, so the run is about a third smaller. Nothing is wrong here - this is just the normal rhythm of a season, and it is the kind of variation the club currently has no way to see.",
      beats: [
        "9 lbs today against 13.6 yesterday",
        "Every bucket still climbing, none near capacity",
        "The weekly chart is starting to show the shape of the season",
      ],
    },
  },
  {
    baseYieldLbs: 0.2,
    flowLabel: "None",
    sapHeadline: "Stayed below freezing all day",
    weatherAlert: null,
    narration: {
      title: "It never thaws - flow stops",
      script:
        "Here is the flip side. It only got to 31 today, so the tree never thawed and almost nothing moves. If the club were checking buckets by hand they would have walked the entire grove for nothing. The sensors just told them not to bother.",
      beats: [
        "Under a pound across all five buckets",
        "Sap Flow reads None",
        "Nobody needs to go out today - that is the labor saving",
      ],
    },
  },
  {
    baseYieldLbs: 0.3,
    flowLabel: "None",
    sapHeadline: "Second hard freeze, pressure building",
    weatherAlert: null,
    narration: {
      title: "Second frozen day - pressure building",
      script:
        "Second day locked up, still basically nothing. But pressure is building inside the trees the whole time. Also worth watching: Bucket #05 out in the West Field started with the weakest battery and cold nights drain it faster than the rest.",
      beats: [
        "Still essentially no flow",
        "Bucket #05 battery sliding - it started weakest at 41%",
        "Two frozen days in a row means the next thaw will be big",
      ],
    },
  },
  {
    baseYieldLbs: 4.6,
    flowLabel: "Strong",
    sapHeadline: "Big thaw after two frozen days",
    weatherAlert: null,
    narration: {
      title: "The release - and our first full bucket",
      script:
        "Now watch this. It thawed all the way to 46 after two frozen days, and everything that was backed up let go at once. Twenty pounds in a single day. And Bucket #03 is pegged at capacity, twelve of twelve. That is the alert firing in the header, and over on Stations that bucket has flipped to Complete.",
      beats: [
        "20.5 lbs - biggest day of the season so far",
        "Bucket #03 sitting at 12 of 12 lbs, high-fill alert raised",
        "Bell lit in the header; #03 reads Attention on the dashboard panel and Complete on Stations",
        "Nobody has to guess which bucket needs emptying",
      ],
    },
  },
  {
    baseYieldLbs: 0.4,
    flowLabel: "Low",
    sapHeadline: "No overnight freeze - flow stalling",
    weatherAlert: "Heat Advisory: 71F and no overnight freeze",
    collection: {
      bucketIds: [1, 3],
      loggedBy: "Chloe M.",
      collectedBy: { 1: "Chloe M.", 3: "Chloe M." },
      notes:
        "Bucket #03 was pegged at capacity overnight - cleared both before the warm front moved in.",
    },
    narration: {
      title: "Cleared out - and a 71 degree anomaly",
      script:
        "Two things happening today. First, somebody went out and cleared #03 and topped off #01, so you can watch #03 drop from full back down to nearly empty and the alert clear itself. Second, it hit 71 degrees with 30 mile an hour wind. No overnight freeze at all, so flow basically stops. That is the real risk a warm spell poses to a season.",
      beats: [
        "Bucket #03 drops 12 lbs back to near zero, alert resolved",
        "New collection appears under Data then Collections: 22.1 lbs",
        "71F with 30 mph wind - heat advisory in the banner, flow stalls",
        "Batch #01 created from that collection",
      ],
    },
  },
  {
    baseYieldLbs: 1.2,
    flowLabel: "Low",
    sapHeadline: "Rain event - sap running dilute",
    weatherAlert: "Weather Alert: Heavy Rain Expected",
    narration: {
      title: "Heavy rain",
      script:
        "Back to reality. Two thirds of an inch of rain and a wintry mix. Flow picks back up a little, but rain dilutes the sap so the sugar content drops, which means a worse sap-to-syrup ratio. That is something we can eventually flag automatically.",
      beats: [
        "Heavy rain alert in the banner",
        "5.4 lbs - a modest run",
        "Bucket #02 is quietly getting close to full at 10.3 lbs",
      ],
    },
  },
  {
    baseYieldLbs: 0.5,
    flowLabel: "Low",
    sapHeadline: "Snow moving in - buckets moved indoors",
    weatherAlert: "Weather Alert: Snow - Buckets Moved Indoors",
    collection: {
      bucketIds: [2, 4, 5],
      loggedBy: "Mr. Adams",
      collectedBy: { 2: "Mr. Adams", 4: "Jordan T.", 5: "Jordan T." },
      notes:
        "Snow moving in - pulled three buckets indoors and emptied them before carrying them in.",
    },
    offlineBucketIds: [2, 4, 5],
    narration: {
      title: "Snow - buckets come inside",
      script:
        "This is the one I really wanted to show you. Snow moving in, so the club goes out, empties the three fullest buckets and carries them into the shed. Now watch the whole dashboard react. Those three nodes stop reporting and go Offline, the cards grey out, the Offline filter jumps to three, and the summary drops from five online down to two.",
      beats: [
        "#02, #04 and #05 go Offline - cards grey out to 45%",
        "Emptied before they were carried in, so they hold their last reading of 0",
        "Biggest collection of the season logged: 27 lbs",
        "Only #01 and #03 are still out in the grove collecting",
      ],
    },
  },
  {
    baseYieldLbs: 2.6,
    flowLabel: "Moderate",
    sapHeadline: "Freeze-thaw returns, buckets redeployed",
    weatherAlert: null,
    narration: {
      title: "Back out, back online",
      script:
        "Snow is done, the buckets go back out, and all three nodes come straight back online on their own. Freeze-thaw is back too, 26 up to 41, so we are collecting again. Notice the three that were emptied are starting over from zero while #01 and #03 carry on from where they were.",
      beats: [
        "All 5 stations online again",
        "11.8 lbs - flow fully resumed",
        "Offline count back to zero",
      ],
    },
  },
  {
    baseYieldLbs: 2.8,
    flowLabel: "Moderate",
    sapHeadline: "Textbook freeze-thaw conditions",
    weatherAlert: null,
    narration: {
      title: "Textbook conditions",
      script:
        "This is just what a good day looks like. 27 overnight, 41 in the afternoon, nothing dramatic. Steady accumulation across all five buckets and not a single alert to deal with.",
      beats: [
        "12.7 lbs, consistent across the grove",
        "No alerts anywhere",
        "Bucket #03 back out in front at 9.2 lbs",
      ],
    },
  },
  {
    baseYieldLbs: 3.4,
    flowLabel: "Strong",
    sapHeadline: "Best freeze-thaw window of the stretch",
    weatherAlert: null,
    collection: {
      bucketIds: [1, 3],
      loggedBy: "Sam R.",
      collectedBy: { 1: "Sam R.", 3: "Sam R." },
      notes:
        "Collected to feed the evaporator - best freeze-thaw run of the season.",
    },
    narration: {
      title: "Best run yet, and we boil",
      script:
        "Best freeze-thaw of the whole stretch, 26 up to 47. Before the run they collected #01 and #03 to feed the evaporator, so Batch #02 goes into processing today. You can watch it move from Waiting to Processing over in the Batches tab, and Batch #01 has already finished.",
      beats: [
        "Third collection logged: 16.7 lbs",
        "Batch #02 moves from Waiting to Processing",
        "15.4 lbs collected on top of that",
        "Batch #01 already completed - 0.9 lbs of syrup at 66.4 Brix",
      ],
    },
  },
  {
    baseYieldLbs: 0.3,
    flowLabel: "None",
    sapHeadline: "Snowstorm, never climbed above freezing",
    weatherAlert: "Weather Alert: Heavy Snow and High Wind",
    narration: {
      title: "Snowstorm and a dying battery",
      script:
        "Two inches of snow, 20 mile an hour wind, and it never gets above 33 so flow stops again. And here is the second failure mode worth showing. Bucket #05 in the West Field has finally dropped under 20 percent battery, so we raise a low-battery alert. It is exactly the bucket that has been the weakest all along, which is the point - you find out before it dies, not after.",
      beats: [
        "Heavy snow alert in the banner",
        "Bucket #05 battery at 19% - low-battery alert raised",
        "#05 reads Attention on the dashboard stations panel",
        "Flow down to 1.4 lbs across the grove",
      ],
    },
  },
  {
    baseYieldLbs: 0.1,
    flowLabel: "None",
    sapHeadline: "Hard freeze - pressure loading again",
    weatherAlert: null,
    narration: {
      title: "Hard freeze - the calm before",
      script:
        "Coldest day of the stretch, 18 up to only 30. Basically zero flow. But the exact same thing is happening as on days three and four - pressure is loading right back up in the trees. Meanwhile Batch #02 comes off the evaporator.",
      beats: [
        "Under half a pound all day",
        "Batch #02 completes - 1.1 lbs of syrup at 66.8 Brix",
        "Two frozen days again, so expect a big release tomorrow",
      ],
    },
  },
  {
    baseYieldLbs: 6.5,
    flowLabel: "Peak",
    sapHeadline: "Massive thaw - peak sap flow of the season",
    weatherAlert: null,
    narration: {
      title: "Season peak",
      script:
        "And there it is. Twenty-six degrees up to fifty-one, a twenty-five degree swing after two hard freezes. Twenty-six pounds in one day, the biggest of the season, and three of the five buckets hit capacity at the same time. This is the day the club absolutely has to know about, and with this they would know it before they even left the school building.",
      beats: [
        "26.4 lbs - season high by a wide margin",
        "#02, #03 and #04 all at 12 of 12 - three high-fill alerts at once",
        "Complete filter on Stations shows 3",
        "Season total 121.7 lbs, ahead of both 2021 and 2020",
      ],
    },
  },
];

export interface DemoBatchStage {
  /** Day index this stage takes effect */
  fromDay: number;
  status: BatchStatus;
  syrupOutLbs: number;
  brix: number;
  notes?: string;
}

export interface DemoBatchSpec {
  batchNumber: string;
  /** Day index the batch is created, which is also its collection day */
  fromDay: number;
  createdBy: string;
  stages: DemoBatchStage[];
}

export const demoBatchSpecs: DemoBatchSpec[] = [
  {
    batchNumber: "Batch #01",
    fromDay: 5,
    createdBy: "Mr. Adams",
    stages: [
      {
        fromDay: 5,
        status: "waiting",
        syrupOutLbs: 0,
        brix: 0,
        notes: "Holding in cold storage until the evaporator frees up.",
      },
      {
        fromDay: 7,
        status: "processing",
        syrupOutLbs: 0,
        brix: 0,
        notes: "Evaporation in progress.",
      },
      { fromDay: 9, status: "completed", syrupOutLbs: 0.9, brix: 66.4 },
    ],
  },
  {
    batchNumber: "Batch #02",
    fromDay: 7,
    createdBy: "Mr. Adams",
    stages: [
      {
        fromDay: 7,
        status: "waiting",
        syrupOutLbs: 0,
        brix: 0,
        notes: "Sap held indoors through the snow event.",
      },
      {
        fromDay: 10,
        status: "processing",
        syrupOutLbs: 0,
        brix: 0,
        notes: "On the evaporator today.",
      },
      {
        fromDay: 12,
        status: "completed",
        syrupOutLbs: 1.1,
        brix: 66.8,
        notes: "Best clarity of the season.",
      },
    ],
  },
  {
    batchNumber: "Batch #03",
    fromDay: 10,
    createdBy: "Sam R.",
    stages: [
      {
        fromDay: 10,
        status: "active",
        syrupOutLbs: 0,
        brix: 0,
        notes: "Open batch - new collections are going into this one.",
      },
    ],
  },
];
