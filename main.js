import { InfluxDB, Point } from "@influxdata/influxdb-client";

const ORG = "myOrg";
const BUCKET = "myBucket";

async function execQuery(query) {
  return await new Promise((resolve, reject) => {
    const result = [];
    reader.queryRows(query, {
      next(row, meta) {
        result.push(
          Object.fromEntries(row.map((u, i) => [meta.columns[i].label, u]))
        );
      },
      error(error) {
        reject(error);
      },
      complete() {
        resolve(result);
      },
      useCancellable(cancellable) {
        if (cancellable.isCancelled()) reject(new Error("Query canceled"));
      },
    });
  });
}

async function count(measurement) {
  const query = `\
  from(bucket: "myBucket")\
  |> range(start: -0s, stop: 1y)\
  |> filter(fn: (r) => r["_measurement"] == "${measurement}")\
  |> count()\
`;
  const result = await execQuery(query);
  return result.map((v) => +v._value).reduce((prev, cur) => prev + cur, 0);
}

console.log("App started...");

const influxDb = new InfluxDB({
  url: "http://influxdb:8086",
  token: "secret",
});
const writer = influxDb.getWriteApi(ORG, BUCKET, "ms");
const reader = influxDb.getQueryApi(ORG, BUCKET);

let countPrices = await count("price");
let countAssets = await count("asset");

if (countPrices * countAssets == 0) {
  const now = Date.now();
  const duration = 1;

  if (!countPrices) {
    console.log("Add sample prices for a year");
    const records = [];
    for (let i = 0; i < (365 * 24 * 60) / duration; i++) {
      records.push(
        new Point("price")
          .timestamp(now + i * 60 * duration * 1000)
          .tag("exchange", "binance")
          .tag("currency", "BTC")
          .floatField("priceUSD", Math.random() * 600000)
          .floatField("priceRial", 25000 + Math.random() * 10000)
      );
    }
    writer.writePoints(records);
  }

  if (!countAssets) {
    console.log("Add sample assets for a year");
    const records = [];
    let count = 0;
    for (let i = 0; i < (365 * 24 * 60) / duration; i++) {
      if (Math.random() < 0.01) {
        count++;
        records.push(
          new Point("asset")
            .tag("user", "ebi")
            .tag("currency", "BTC")
            .timestamp(now + i * 60 * duration * 1000)
            .floatField("amount", Math.random() * 10)
        );
      }
    }
    writer.writePoints(records);
    console.log("Added", count, "asset(s)");
  }

  await writer.flush();
  console.log("Finished adding samples");
}

const timeToCalculateUserWealth = "Time to calculate user wealth";

console.time(timeToCalculateUserWealth);

const userWealthQuery =
  '\
    from(bucket: "myBucket")\
    |> range(start: -0s, stop: 1y)\
    |> aggregateWindow(every: 1d, fn: last, createEmpty: false)\
    |> keep(columns: ["_time", "_field", "_value", "amount", "priceRial", "priceUSD"])\
    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")\
    |> group()\
    |> sort(columns: ["_time"])\
    |> fill(column: "amount", usePrevious: true)\
    |> fill(column: "priceRial", usePrevious: true)\
    |> fill(column: "priceUSD", usePrevious: true)\
    |> map(fn: (r) => ({r with amountRial: r["priceRial"] * r["amount"]}))\
    |> map(fn: (r) => ({r with amountUSD: r["priceUSD"] * r["amount"]}))\
  ';

console.dir(await execQuery(userWealthQuery));

console.timeEnd(timeToCalculateUserWealth);
