import type { SectorId } from "@shared/types";

// "How to start" guides — the missing manual for first-time families. Authored
// from the community research briefs (docs/communities/*). Plain-English, honest
// about cost and the real first step. Used by the /start page (and reusable for
// future per-sector SEO landing pages).

export interface StarterGuide {
  sector: SectorId;
  /** the reassuring one-liner under the sector name */
  hook: string;
  /** who it's for / the welcoming truth */
  whoFor: string;
  /** the single easiest first step to actually try it */
  firstStep: string;
  /** rough cost to try it once (not to commit) */
  tryCost: string;
  /** what to bring the first day */
  bring: string[];
  /** what the youngest can start in */
  youngest: string;
  /** 4-6 first-day glossary terms so they're not lost */
  glossary: { term: string; def: string }[];
  /** the honest "what a first day feels like" */
  firstDay: string;
}

export const STARTER_GUIDES: Partial<Record<SectorId, StarterGuide>> = {
  bmx: {
    sector: "bmx",
    hook: "The most affordable, all-ages way into racing — a bike and a helmet, and you're on the gate.",
    whoFor:
      "Families with kids as young as 18 months (balance bikes) up through adults. No experience, no license, no engine. The friendliest first paddock there is.",
    firstStep:
      "Find your local USA BMX track and show up to a weeknight practice or a 'try-it' day. Many tracks have loaner bikes and helmets — you can roll the gate before you buy anything.",
    tryCost: "$1–3 gate/practice fee to try; a used race-ready bike is often $150–400.",
    bring: ["A bike (or borrow a loaner)", "A helmet (full-face if you have one)", "Long sleeves and pants", "Closed-toe shoes", "Water"],
    youngest: "Balance Bike / Strider class — ages ~18 months to 5, no pedals, races a short 'half track'.",
    glossary: [
      { term: "Moto", def: "A short qualifying race. You usually run three." },
      { term: "Main", def: "The final — the race that decides it." },
      { term: "Gate", def: "The starting gate; you pick a lane 1–8." },
      { term: "Transfer", def: "Advancing from motos to the main by finishing well." },
      { term: "Plate", def: "Your number plate; a #1 plate means champion." },
    ],
    firstDay:
      "You'll sign up an hour before racing, run three short motos against kids your child's age and skill, and (almost always) make a main. It's over in a couple hours and everyone cheers everyone.",
  },
  drag: {
    sector: "drag",
    hook: "Run what ya brung. Bring almost any car to a Friday test-and-tune and make a pass down the strip.",
    whoFor:
      "Anyone with a safe vehicle and a helmet — teenagers in Jr. Dragsters (ages 5–17) through grandparents. Bracket racing means a minivan can race a dragster fairly.",
    firstStep:
      "Find a local strip's 'Test & Tune' night, pay at the gate, pass a quick safety tech, and make a pass. No license or membership needed just to try.",
    tryCost: "$20–35 to run test-and-tune; a Jr. Dragster starter car is ~$5,000 when you're ready.",
    bring: ["Your car (it just needs to be safe)", "A helmet (loaners sometimes available)", "Long pants & closed shoes", "Your driver's license", "A folding chair"],
    youngest: "Jr. Dragster — ages 5–17 in half-scale dragsters, classes capped by age and speed.",
    glossary: [
      { term: "Dial-in", def: "The time you predict your car will run; you write it on the window." },
      { term: "The Tree", def: "The starting-line lights you launch on." },
      { term: "Reaction time", def: "How fast you leave after the green — 0.000 is perfect." },
      { term: "Breakout", def: "Running quicker than your dial — it loses the round." },
      { term: "Time slip", def: "The printed receipt of your run: reaction, 60-foot, ET, MPH." },
    ],
    firstDay:
      "You'll make a few easy practice passes to learn your car's time, then (on a points night) race a bracket where being consistent beats being fast. Keep your first time slip — everyone does.",
  },
  karting_sprint: {
    sector: "karting_sprint",
    hook: "Where champions start — and the cheapest seat in real wheel-to-wheel motorsport.",
    whoFor:
      "Kids from ~5 (Kid Kart) through adults (Senior/Masters). You don't need to own a kart to start — many tracks rent.",
    firstStep:
      "Book an 'arrive-and-drive' session or a learn-to-race school at a sprint track. They supply the kart, helmet, and a coach — you just drive.",
    tryCost: "$30–60 for arrive-and-drive laps; a turnkey LO206 kart is under ~$4,500 when you commit.",
    bring: ["Closed-toe shoes", "Long sleeves & pants", "A helmet if you own one (rentals available)", "Water"],
    youngest: "Kid Kart — ages ~5–7, on a small, speed-limited engine.",
    glossary: [
      { term: "LO206", def: "The affordable, sealed spec engine — a level playing field where the driver wins." },
      { term: "Arrive-and-drive", def: "The track provides the kart and gear; you just show up and race." },
      { term: "Heat", def: "A short qualifying race that sets your grid for the final." },
      { term: "Grid", def: "The starting lineup." },
      { term: "Prefinal", def: "A shorter race before the main final." },
    ],
    firstDay:
      "Arrive-and-drive means zero commitment: helmet on, quick briefing, and you're turning laps in minutes. If you love it, the LO206 class is where most families plant roots.",
  },
  karting_dirt: {
    sector: "karting_dirt",
    hook: "Hot laps and the feature on a clay oval — short-track racing the whole family can do.",
    whoFor:
      "Kids through adults at your local dirt-oval kart club. Working-class, welcoming, and close to home.",
    firstStep:
      "Find a nearby dirt-oval kart club's race night, come watch a week, then ask about their rookie/beginner class — these clubs love new families and will walk you through it.",
    tryCost: "Club membership + small race fees; used dirt karts are an affordable entry.",
    bring: ["Closed-toe shoes", "Long sleeves & pants", "A helmet if you have one", "A chair and shade — you'll stay for the feature"],
    youngest: "Kid/rookie classes vary by club — ask; most start kids young.",
    glossary: [
      { term: "Hot laps", def: "The warm-up/practice session at speed." },
      { term: "Heat", def: "A short qualifying race." },
      { term: "Feature", def: "The main event — the race that counts." },
      { term: "Pill draw", def: "A random draw for your starting spot." },
      { term: "The cushion", def: "The built-up groove of dirt high on the track." },
    ],
    firstDay:
      "Dirt karting is feature-focused: hot laps, a heat or two, then the feature. Clubs are tight-knit — introduce yourself and someone will show you the ropes before the night's over.",
  },
  motocross: {
    sector: "motocross",
    hook: "From the PW50 to the pro ranks — start small, on a beginner-friendly track, with your family in the pits.",
    whoFor:
      "Riders from ~4 (50cc) up. Start with a beginner school or a practice day before you ever line up for a race.",
    firstStep:
      "Book a beginner riding school or a practice day at a local track — coaches teach the basics in a low-pressure setting before you enter a moto.",
    tryCost: "$25–45 for a practice/clinic day; gear and a used beginner bike are the bigger commitment.",
    bring: ["A dirt bike suited to the rider's size", "Helmet, goggles, boots, gloves", "Long sleeves & pants (or jersey/pants)", "Water and snacks"],
    youngest: "50cc / PW50 classes — ages ~4–8 on small, manageable bikes.",
    glossary: [
      { term: "Moto", def: "A race; you usually run two and combine finishes." },
      { term: "The gate", def: "The drop-gate start — all riders launch together." },
      { term: "Holeshot", def: "Being first into the opening turn." },
      { term: "Berm", def: "A banked corner you can lean into." },
      { term: "Whoops", def: "A row of bumps you learn to skim across." },
    ],
    firstDay:
      "Start at a practice day, not a race. Get comfortable on the track, learn the flags, and let a coach build the basics. Racing comes when the rider's ready — there's no rush.",
  },
  roadrace: {
    sector: "roadrace",
    hook: "Your own street car, a helmet, and a coach — the safest way to feel real speed on a real track.",
    whoFor:
      "Adults (and teens in some programs) curious about track driving. You don't need a race car — you need the car in your driveway.",
    firstStep:
      "Sign up for an entry-level track day or 'Track Night in America' — bring your daily driver, get a helmet (often loanable), and a coach rides along.",
    tryCost: "~$150–250 for an entry-level track day/HPDE.",
    bring: ["Your street car (mechanically sound)", "A helmet (loaners often available)", "Long sleeves, closed shoes", "Tire pressure gauge if you have one"],
    youngest: "Mostly adults; some programs admit teens with a guardian.",
    glossary: [
      { term: "HPDE", def: "High-Performance Driving Education — coached track-day driving, not racing." },
      { term: "Apex", def: "The inside point of a corner you aim for." },
      { term: "Session", def: "A timed block of track time for your run group." },
      { term: "Run group", def: "Drivers of similar experience who share the track." },
      { term: "Black flag", def: "Come into the pits — something needs your attention." },
    ],
    firstDay:
      "You'll do a classroom briefing, then lapping sessions with an instructor in the passenger seat. It's coaching, not competition — the goal is smooth and safe, and it's a blast.",
  },
  autocross: {
    sector: "autocross",
    hook: "Cones in a parking lot — the lowest-cost, lowest-risk way to try motorsport in your own car.",
    whoFor:
      "Anyone with a license and a car. Genuinely the easiest, cheapest front door to the whole sport.",
    firstStep:
      "Find a local SCCA region's novice autocross, register (often same-day), and run. Experienced drivers ride along and coach you for free.",
    tryCost: "~$30–60 for a full day of runs.",
    bring: ["Your car (empty the trunk!)", "A helmet (loaners available)", "Closed-toe shoes", "Sunscreen and water"],
    youngest: "Licensed drivers; some regions have junior programs.",
    glossary: [
      { term: "Run", def: "One timed lap through the cone course." },
      { term: "Cone penalty", def: "Two seconds added each time you hit a cone." },
      { term: "PAX/index", def: "A handicap so different cars compete fairly." },
      { term: "Course walk", def: "Walking the layout before you drive it." },
      { term: "Worker", def: "Everyone helps — you'll shag cones between your runs." },
    ],
    firstDay:
      "Speeds are low and there's nothing to hit but cones. You'll walk the course, get a few coached runs, and chase your own best time. Most people are hooked after the first day.",
  },
};
