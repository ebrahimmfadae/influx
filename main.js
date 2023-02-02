import { InfluxDB, Point } from "@influxdata/influxdb-client";

console.log("App started...");

const influxDb = new InfluxDB({
  url: "http://admin:superadmin@localhost:8086",
  token: "secret",
});
const writer = influxDb.getWriteApi("myOrg", "myBucket", "ms");
const reader = influxDb.getQueryApi("myOrg", "myBucket");

writer.useDefaultTags({ exchange: "binance", currency: "BTC" });

if (1) {
  console.log("Add sample prices for a year");
  const now = Date.now();
  const records = [];
  for (let i = 0; i < 365 * 24; i++) {
    records.push(
      new Point("price")
        .timestamp(now + i * 60 * 60 * 1000)
        .tag("exchange", "binance")
        .tag("currency", "BTC")
        .floatField("priceUSD", Math.random() * 600000)
        .floatField("priceRial", 25000 + Math.random() * 10000)
    );
  }
  writer.writePoints(records);
}

if (1) {
  console.log("Add sample assets for a year");
  const now = Date.now();
  const records = [];
  for (let i = 0; i < 365 * 24; i++) {
    records.push(
      new Point("assets")
        .tag("user", "ebi")
        .tag("currency", "BTC")
        .timestamp(now + i * 60 * 60 * 1000)
        .floatField("amount", Math.random() * 10)
    );
  }
  writer.writePoints(records);
}

await writer.flush();
console.log("Finished adding samples");

const query =
  '\
from(bucket:"myBucket")\
|> range(start: -10s)\
|> count()\
';

reader.queryRows(query, {
  next(row) {
    console.dir(row);
  },
  error(error) {
    console.error(error);
  },
  complete() {
    console.log("Query completed");
  },
});
