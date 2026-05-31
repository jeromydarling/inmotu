// Generates migrations/0015_seed_venues.sql — a national starter set of marquee
// US motorsports venues so the canvas is full coast-to-coast on day one, even
// before the OSM/Overpass import runs in production. Real facilities, all four
// categories. Run: node scripts/seed_venues.mjs
import { writeFileSync } from "node:fs";

// name, category, surface, city, ST, lat, lng, website
const V = [
  // Road courses / circuits
  ["Road America","road","paved","Elkhart Lake","WI",43.798,-87.989,"https://roadamerica.com"],
  ["Watkins Glen International","road","paved","Watkins Glen","NY",42.336,-76.927,"https://theglen.com"],
  ["Mid-Ohio Sports Car Course","road","paved","Lexington","OH",40.689,-82.634,"https://midohio.com"],
  ["Laguna Seca","road","paved","Monterey","CA",36.584,-121.753,"https://weathertechraceway.com"],
  ["Sebring International Raceway","road","paved","Sebring","FL",27.453,-81.350,"https://sebringraceway.com"],
  ["Road Atlanta","road","paved","Braselton","GA",34.150,-83.815,"https://roadatlanta.com"],
  ["Virginia International Raceway","road","paved","Alton","VA",36.561,-79.205,"https://virnow.com"],
  ["Circuit of the Americas","road","paved","Austin","TX",30.135,-97.641,"https://circuitoftheamericas.com"],
  ["Barber Motorsports Park","road","paved","Birmingham","AL",33.534,-86.620,"https://barbermotorsports.com"],
  ["Sonoma Raceway","road","paved","Sonoma","CA",38.161,-122.454,"https://sonomaraceway.com"],
  ["Lime Rock Park","road","paved","Lakeville","CT",41.927,-73.385,"https://limerock.com"],
  ["Thunderhill Raceway Park","road","paved","Willows","CA",39.538,-122.331,"https://thunderhill.com"],
  ["Blackhawk Farms Raceway","road","paved","South Beloit","IL",42.476,-89.088,"https://blackhawkfarms.com"],
  ["Gingerman Raceway","road","paved","South Haven","MI",42.408,-86.236,"https://gingermanraceway.com"],
  ["NOLA Motorsports Park","road","paved","Avondale","LA",29.860,-90.203,"https://nolamotor.com"],
  ["Hallett Motor Racing Circuit","road","paved","Jennings","OK",36.235,-96.584,"https://hallettracing.net"],
  // Ovals / dirt & short tracks
  ["Eldora Speedway","oval","dirt","Rossburg","OH",40.319,-84.665,"https://eldoraspeedway.com"],
  ["Knoxville Raceway","oval","dirt","Knoxville","IA",41.317,-93.110,"https://knoxvilleraceway.com"],
  ["Bristol Motor Speedway","oval","paved","Bristol","TN",36.516,-82.257,"https://bristolmotorspeedway.com"],
  ["Brainerd International Raceway","road","paved","Brainerd","MN",46.419,-94.073,"https://brainerdraceway.com"],
  ["Williams Grove Speedway","oval","dirt","Mechanicsburg","PA",40.207,-77.009,"https://williamsgrove.com"],
  ["Volusia Speedway Park","oval","dirt","Barberville","FL",29.169,-81.331,"https://volusiaspeedwaypark.com"],
  ["Elko Speedway","oval","paved","Elko New Market","MN",44.570,-93.327,"https://elkospeedway.com"],
  ["I-70 Speedway","oval","dirt","Odessa","MO",38.997,-93.949,""],
  ["Lernerville Speedway","oval","dirt","Sarver","PA",40.747,-79.717,"https://lernerville.com"],
  ["Cedar Lake Speedway","oval","dirt","New Richmond","WI",45.137,-92.583,"https://cedarlakespeedway.com"],
  // Motocross / off-road
  ["Spring Creek MX Park","motocross","dirt","Millville","MN",43.979,-92.254,"https://springcreekmx.com"],
  ["RedBud MX","motocross","dirt","Buchanan","MI",41.886,-86.315,"https://redbudmx.com"],
  ["Loretta Lynn's Ranch","motocross","dirt","Hurricane Mills","TN",35.920,-87.710,"https://lorettalynnmx.com"],
  ["Glen Helen Raceway","motocross","dirt","San Bernardino","CA",34.193,-117.402,"https://glenhelen.com"],
  ["Hangtown / Prairie City","motocross","dirt","Rancho Cordova","CA",38.594,-121.108,""],
  ["Unadilla MX","motocross","dirt","New Berlin","NY",42.624,-75.353,"https://unadillamx.com"],
  ["Washougal MX Park","motocross","dirt","Washougal","WA",45.601,-122.353,"https://washougalmx.com"],
  ["Ironman Raceway","motocross","dirt","Crawfordsville","IN",39.985,-86.844,"https://ironmanraceway.com"],
  ["Gopher Dunes","motocross","dirt","Courtland","ON",42.850,-80.650,""],
  // Drag strips
  ["Gainesville Raceway","drag","paved","Gainesville","FL",29.768,-82.282,"https://gainesvilleraceway.com"],
  ["zMAX Dragway","drag","paved","Concord","NC",35.354,-80.685,"https://zmaxdragway.com"],
  ["Lucas Oil Raceway","drag","paved","Brownsburg","IN",39.804,-86.357,"https://lucasoilraceway.com"],
  ["Bandimere Speedway","drag","paved","Morrison","CO",39.665,-105.171,""],
  ["Pomona Raceway (In-N-Out Burger)","drag","paved","Pomona","CA",34.073,-117.722,""],
  ["World Wide Technology Raceway","drag","paved","Madison","IL",38.650,-90.134,"https://wwtraceway.com"],
  // Karting
  ["New Castle Motorsports Park","karting","paved","New Castle","IN",39.929,-85.345,"https://newcastleraceway.com"],
  ["GoPro Motorplex","karting","paved","Mooresville","NC",35.585,-80.811,"https://gopromotorplex.com"],
  ["Dallas Karting Complex","karting","paved","Caddo Mills","TX",33.041,-96.232,"https://dallaskarting.com"],
  ["SpeedSportz Racing Park","karting","paved","New Caney","TX",30.151,-95.180,"https://speedsportzracingpark.com"],
];

const now = 1780000000;
const esc = (s) => String(s).replace(/'/g, "''");
const rows = V.map((v, i) => {
  const [name, cat, surf, city, st, lat, lng, web] = v;
  const id = `ven_seed_${String(i).padStart(3, "0")}`;
  return `('${id}','seed','${esc(name)}','${cat}','${surf}','${esc(city)}','${st}',${lat},${lng},${web ? `'${esc(web)}'` : "NULL"},${now},${now})`;
});

const sql = `-- inmotu — national starter venues. Marquee US facilities across all four
-- categories so the map is full coast-to-coast on day one, before the OSM
-- import runs. Generated by scripts/seed_venues.mjs. Idempotent via INSERT OR
-- IGNORE on the stable seed ids.

INSERT OR IGNORE INTO venues
  (id, source, name, category, surface, city, state, lat, lng, website, created_at, updated_at)
VALUES
${rows.join(",\n")};
`;

writeFileSync(new URL("../migrations/0015_seed_venues.sql", import.meta.url), sql);
console.log(`wrote migrations/0015_seed_venues.sql with ${V.length} venues`);
