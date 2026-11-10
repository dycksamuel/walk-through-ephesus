# Walk Through Ephesus — Plan

An explorable, low-poly 3D Ephesus as it stood during Paul's stay (Acts 19–20, about AD 53–55), for a senior youth group studying Ephesians.

**Status: waiting for your approval. Nothing is built yet.**
The historian has reviewed this plan and its corrections are folded in. Full findings, sources, and the list of things it could not verify are in `docs/history-notes.md`.

A note on dates: Paul's stay is usually put at about AD 52–55. The emperor Claudius died in October 54, so by the time of the riot Nero was emperor.

---

## 1. Tech choices, in plain language

| Decision | What it means | Why |
|---|---|---|
| **Three.js**, copied into the project | Three.js is the free library that draws 3D in a web browser. We keep our own copy in the repo instead of loading it from someone else's server. | No third-party requests at all (good for privacy and for church wifi that blocks things). One fewer thing that can break. |
| **No build step** | The files in the repo *are* the game. There is no "compile" stage. | You can edit a text file on github.com, save, and the live game updates a minute later. Nothing to install on your computer, ever. |
| **Everything built in code** | Buildings, people, animals and props are assembled from simple shapes (boxes, cylinders, cones) with flat colours. | Tiny download, a consistent stylized look, and no licensing questions. |
| **Sound made in code** | Market murmur, hammers, gulls and the crowd chant are synthesized by the browser's built-in audio engine. No sound files. | Zero download, zero licences. Sound starts only after the first tap (browsers require that), with a mute button. |
| **First-person view** | You see through your own eyes; no player character on screen. | Feels most like "being there," and is the simplest to control on a phone. |
| **All words in `/content/*.json`** | Dialogue, plaques, quest notes, Scripture, discussion questions and even button labels live in plain text data files. | You can change wording without touching code. A small checker script catches typos in the file format before they go live. |
| **Saving on the device only** | Progress goes in the browser's `localStorage`, wrapped in try/catch. | No accounts, no server. If storage is blocked (private browsing), the game still plays; it just won't remember. |
| **GitHub Pages + GitHub Actions** | GitHub hosts the site for free. A small workflow file republishes it whenever the main branch changes. | One shareable link. |

**What the game will never do:** analytics, cookies, ads, logins, chat, network calls after loading, or AI calls. All dialogue is prewritten.

**Size and speed targets**
- Total download under about 1 MB (most of it Three.js, about 170 KB compressed over the wire).
- 30+ fps on a mid-range phone. How: few "draw calls" (similar objects are drawn in one batch), no real-time shadows (soft blob shadows instead), distance fog to hide far-off detail, capped screen resolution on high-density phones, and an automatic quality drop if the frame rate sags.

**Controls**
- Phone: left thumb joystick to walk, drag anywhere else to look, tap a glowing marker (or the big context button: "Talk", "Read", "Pick up") to interact.
- Laptop: WASD or arrow keys to walk, Shift to jog, click-and-drag to look, E or click to interact, M for map, J for journal.
- Projector: same as laptop, plus a "large text" setting and Leader Mode.

**Scripture accuracy:** a copy of the World English Bible text for Ephesians and Acts 18–20 is kept in the repo as a reference, and the checker script confirms every quoted passage matches it character for character.

---

## 2. The map

The real city is laid out around two hills with a valley street between them. We keep the real arrangement and directions but shrink distances by roughly 5–8×, so harbor to theatre is about a 30-second walk and the whole city is crossable in 3–4 minutes. The Temple of Artemis really stood about 2 km outside the city; here it is a 1-minute walk beyond the gate. The hill hides it from the theatre and the upper square, as it did in reality, so it comes into view from the Magnesian Gate and along the road.

```
                                  NORTH
                                                              ┌──────────────┐
   (north road, toward stadium                                │  TEMPLE OF   │
    and Koressian Gate: blocked                               │   ARTEMIS    │
    off, "road continues")                                    └──────┬───────┘
              :                                                      │
              :            ░ Panayırdağ ░                            │ Sacred
  ~~~~~~      :          ╔══════════╗  ░░░░                          │ Road
  ~~~~~~      :          ║  GREAT   ║   ░░░░░                        │ (tombs,
  HARBOR ═══ Harbor ═════╣ THEATRE  ║    ░░░░                        │ fields,
  ~quay~     Street   ●4 ╚══════════╝     ░░                         │ pilgrims)
  ~~~~~~   ┌────┐        ║                                           │
  ~~~~~~   │syn.│*       ║ Theatre–      ┌─────┐                     │
           └────┘        ║ agora street  │Hall │*                    │
        ┌───────────────┐║ ("Marble St") │Tyr. │   ┌────┐┌────┐┌───┐ │
        │  COMMERCIAL   │║               └─────┘   │Pry-││sac.││cou│*│
        │    AGORA      │║                         │tan.││prec││ncl│ │
        │ ●1 seal stalls│║                         └────┘└────┘└───┘ │
        │  silversmiths │║                        ╔═════════════════╗│
        │  [P&A shop]*  │║                        ║ BASILICA STOA   ║│
        └──────[gate]───┘║                        ╠═════════════════╣│
          (empty lot) ───╨── Triodos              ║  STATE AGORA    ╠╧═ Magnesian
          [scroll fire]*      ╲╲                  ║ (small temple)  ║    Gate
                               ╲╲ Curetes Street  ╚═════════════════╝
                                ╲╲═══════════════════╝
                          ▓▓ terrace houses ▓▓  (monuments along street)
                         ░░░░░░░ Bülbüldağ ░░░░░░░░░░░░   ── city wall on ridge ──

   * = location unknown; placed by us and labelled "imagined" in the game
   ● = example fragment spots (full list in section 5)
```

**Hill names.** We use the modern Turkish names first: Panayırdağ (probably ancient Mt Pion) to the north and Bülbüldağ (probably ancient Mt Preon) to the south. Scholars still argue about which ancient name belongs to which hill, and the plaques will say so.

City walls (built about 290 BC under Lysimachus) run along the hill ridges and close the map edges naturally. The sea closes the west.

---

## 3. Locations

Each gets an info plaque with two clearly separated parts: **"What we know"** and **"What's imagined here."**

### Known from archaeology or ancient texts (existing in the 50s AD)

| # | Location | Notes for the build |
|---|---|---|
| 1 | **Harbor and quay** | Merchant ships, cranes, cargo, gulls. Ephesus was the great port of the province of Asia; the harbor was slowly silting up. |
| 2 | **Harbor Street** | The road from the quay to the theatre. The grand colonnaded "Arcadian Way" tourists see is a rebuild from about AD 400, so ours is a plainer paved street. |
| 3 | **Great Theatre** | Built into Panayırdağ in the Hellenistic period. We show the older, smaller Greek theatre, without the top tier of seats. The huge version tourists see (often quoted at 21,500–25,000 seats) comes from a rebuild that current excavators date mostly after Paul's time, so we quote no seat count. Exactly how it looked in the 50s is uncertain, and the plaque says so. Scene of Acts 19:23–41. |
| 4 | **Theatre-to-agora street** | Later called Marble Street (the marble paving is much later). Ours is stone-paved. |
| 5 | **Commercial agora (Tetragonos Agora)** | Large square market ringed by shop rows. Stalls: pottery, fish, cloth, spices, bronze, seal-cutters, moneychangers. On the east side a new hall is going up (dedicated AD 54–59, under Nero), so that is where we show a building site with scaffolding. |
| 6 | **Gate of Mazaeus and Mithridates** | South gate of the agora, built 4/3 BC by two men freed from slavery in the emperor's family (the households of Augustus and Agrippa). A genuine landmark Paul would have walked through. |
| 7 | **Silversmiths' workshops** | Acts 19:24 says Demetrius made silver shrines of Artemis. Inscriptions from Ephesus mention an association of silversmiths, though most are later than Paul. No silver shrines have been found (silver gets melted down); small terracotta and marble ones have. The exact street is our choice. |
| 8 | **Triodos ("three ways") and the empty lot** | The junction below Curetes Street. A plaque marks where the Library of Celsus *will* stand: "You're about 60 years too early." |
| 9 | **Curetes Street (the Embolos)** | Sloping street lined with tombs and monuments that existed by the 50s: the Octagon (a tomb; whose it was is not known), the Heroon of Androklos, the Memmius Monument, and the Pollio Monument at the top of the street (its fountain is a later addition, so ours has none). |
| 10 | **Terrace houses** | Wealthy hillside homes on the south side of Curetes Street, built around a courtyard. The famous paintings and mosaics visitors see today are mostly 2nd–3rd century, so ours is decorated more plainly. One is enterable (the household scene). |
| 11 | **State agora** | The upper civic square, rebuilt under Augustus, with a small temple in the middle. Which god or ruler the temple honoured is not known (Isis, Julius Caesar and Roma, and Augustus have all been proposed). |
| 12 | **Basilica Stoa** | Long three-aisled hall on the north side of the state agora, dedicated about AD 11. |
| 13 | **Prytaneion** | City hall with the sacred hearth of Hestia, whose fire was never allowed to go out. |
| 14 | **Sacred precinct** | A walled precinct beside the Prytaneion, probably linked to the cult of Rome and the emperor's family. Which cult exactly is debated. |
| 15 | **Magnesian Gate** | The south-east city gate, from the 3rd century BC. Start of the road to the temple. |
| 16 | **Sacred Road** | Runs outside the walls around Panayırdağ, past roadside tombs and fields. |
| 17 | **Temple of Artemis (Artemision)** | One of the Seven Wonders: a forest of Ionic columns (the Roman writer Pliny says 127; the true count is uncertain) and about three times the footprint of the Parthenon, nearly four by Pliny's measurements. It faces west, with the great altar in front on the west side. Sellers of offerings outside. The hill behind it is bare (the castle and church there today are centuries later). The goddess's statue is not copied from the famous museum statues, which are later. |
| 17b | **Fishery toll-office** (small, optional) | At the harbor. An inscription of AD 54–59 records the fishermen and fish-sellers paying for it, so it is new or being built. |
| 18 | **City walls** | Lysimachus's walls on the ridges. Scenery and boundary. |

### Imagined placements (real from Acts, location unknown)

| # | Location | Scripture | Where we put it |
|---|---|---|---|
| 19 | **Synagogue** | Acts 19:8 | A modest hall in a residential block between the harbor street and the agora. No synagogue has been found at Ephesus, though a Jewish community is well attested. |
| 20 | **Lecture hall of Tyrannus** | Acts 19:9 | A hall on a side street east of the theatre–agora street (Acts does not say whether Paul rented it). Some manuscripts add that Paul taught "from the fifth hour to the tenth" (about 11 am to 4 pm, siesta time); plaque says so and flags it as uncertain. |
| 21 | **Priscilla and Aquila's workshop and home** | Acts 18:18–26; 1 Cor 16:19 | A shop in the row beside the agora with living space behind and above, where the house church meets. |
| 22 | **Scroll-burning site** | Acts 19:19 | A small open square near the Triodos, with a scorched patch of paving. Acts says it was done publicly but not where. |
| 23 | **Council house** | (not in Acts) | The city council certainly existed, but the council building visible today dates to about AD 100 and nothing earlier was found beneath it. Ours is a plain hall beside the precinct, labelled as a guess. |

### Deliberately left out (did not exist yet)

Library of Celsus (about AD 110–117), Temple of Hadrian, Hadrian's Gate, Temple of Domitian, Scholastica (Varius) Baths, Fountain of Trajan, Hercules Gate, the public latrines, Harbor Baths and gymnasium, Vedius and East gymnasia, the Fountain of Laecanius Bassus, the Serapeion, the Theatre Gymnasium, the Stoa of Damianus on the Sacred Road, the marble-paved Arcadian Way with its street lamps, the Church of Mary, the Basilica of St John, the "House of the Virgin Mary," and the Cave of the Seven Sleepers. Also no "Paul's prison" tower presented as fact (that is a later tradition).

Everyday-life checks: no tomatoes, potatoes, maize, peppers or oranges on market stalls; tunics and cloaks rather than togas for most people; coins and prices in denarii/drachmas; no stirrups, barrels, wheelbarrows, glass windowpanes in shopfronts, or printed books (scrolls and wax tablets only); ships steer with side oars, not a stern rudder; no prickly pear, agave or eucalyptus in the scenery; Roman men clean-shaven; statues and temples painted, not bare white; shop signs in Greek; no crosses, churches or Star of David. The historian's longer list is in `docs/history-notes.md`.

---

## 4. Characters

All are fictional portrayals. Named people from Acts are marked †. Invented characters have names that were common in the region and that no New Testament figure shares, so players don't mix them up.

| Character | Where | Conversation themes | Ephesians link |
|---|---|---|---|
| **Demetrius**† the silversmith | His workshop, commercial agora | Sales of shrines are down; pride in his craft; fear for the city's honour and his workers' wages. Not a cartoon villain. | Sets up the riot; Eph 1:19–23 |
| **Priscilla**† and **Aquila**† | Their leather/tent workshop | Why they left Rome (Claudius's edict), working with Paul, hosting the church in their home, teaching Apollos | Eph 1:1–14; 4:1–16 |
| **Theodotus**, a synagogue elder | Synagogue | Three months of Paul's teaching, why some were persuaded and some weren't, the hope of Israel. Portrayed with respect, not as a foil. | Eph 2:11–18 |
| **Metrodorus**, a student | Hall of Tyrannus | Daily discussions, people from all over Asia hearing the message, what "mystery" means to a Greek, and what it meant in the Jewish Scriptures | Eph 3 |
| **Ammia**, a pilgrim devoted to Artemis | Sacred Road / temple | Why she came, what Artemis means to her city and family; sincere devotion taken seriously | Eph 1:19–23; 2:19–22 |
| **Zosimus**, a former magician | Scroll-burning site | The "Ephesian letters" (famous magic charms), the sons of Sceva incident, what giving up his scrolls cost him. (The 50,000 silver coins in Acts 19:19 is the total for everyone's books, not one man's.) | Eph 5:8–14; 3 |
| **Valens**, a Roman soldier | Near the Basilica Stoa | His kit piece by piece, life far from his unit, boredom and duty. Asia had no legion, so he is one man on loan to the governor's staff, not city police, and he takes no part in the riot. Day to day he wears tunic, cloak, hobnailed boots and a belt with sword and dagger; his helmet, mail shirt, big shield and spear are stacked beside him. No red-and-plate movie legionary. | Eph 6:10–20 |
| **Household**: **Menander** the householder, his wife **Stratonice**, their daughter **Charite** (about the players' age), and **Eirene**, an enslaved worker | Terrace house | How a Roman household was ordered and who had power. The enslaved worker speaks for themself: honest about not being free, without graphic detail. The game does not soften slavery or pretend the letter abolished it; the journal note names what was radical in the passage (masters and slaves share one Master who shows no favouritism) and what Christians later had to reckon with. | Eph 5:21–6:9 |

**Background life (non-speaking):** shoppers, porters, a fishmonger, children, a street philosopher, donkeys, goats, dogs, chickens, pigeons, gulls. Some give a one-line "bark" when tapped.

**In the riot scene only:** the town clerk (unnamed in Acts), Gaius† and Aristarchus†, Alexander†. Only Demetrius, the crowd and the town clerk speak, in words from Acts 19 (WEB); Acts gives the other three no lines, so neither do we.

**Paul:** seen from across the room teaching at the Hall of Tyrannus. He has no dialogue tree. Tapping him shows his own words about his Ephesus years from Acts 20:18–21 (WEB), labelled as spoken later at Miletus. During the riot the narration notes, as Acts does, that his friends would not let him enter the theatre.

---

## 5. The "Letter Fragments" quest

**A framing note you should know about.** Ephesians was written *after* Paul left the city. The letter presents itself as written by Paul in prison, which would put it around AD 60–62. Scholars are divided: many think a follower of Paul wrote it in his name a decade or more later, and many others hold that Paul wrote it himself. Some of the earliest copies lack the words "at Ephesus," so it may have been a circular letter for churches across the region. The journal's "About this letter" page will lay this out evenly and leave the question open, and you can adjust that wording to fit your congregation. So a letter fragment lying in the street in AD 54 would itself be an anachronism. Proposed solution: the opening screen says plainly, *"You are a visitor from the future. The letter hasn't been written yet. As you explore, you'll find pieces of what will one day be read aloud in this city."* The fragments glow, clearly not part of the ancient world. The journal includes a short "About this letter" page stating the dating honestly.

Nine fragments (your eight, with Eph 2:11–22 split in two so both the synagogue and the civic centre get one):

| # | Passage | Place | The connection |
|---|---|---|---|
| 1 | Eph 1:1–14 | Seal-cutter's stall, commercial agora | Merchants pressed a seal into wax or clay to mark goods as theirs and guarantee delivery. "Sealed with the Holy Spirit of promise." |
| 2 | Eph 2:11–18 | Synagogue | "Far off" and "near"; the dividing wall broken down; one new people. |
| 3 | Eph 2:19–22 | Prytaneion / state agora | Citizenship was precious and restricted in a Greek city like this one, which ran its own affairs under the Roman governor. "Fellow citizens… a holy temple," built of people, within sight of the road to Artemis's temple of stone. |
| 4 | Eph 3:1–13 | Hall of Tyrannus | Paul's word "mystery" comes mainly from the Jewish Scriptures (Daniel): God's hidden plan, now revealed. In a city full of mystery cults with secrets for insiders, a mystery told to everyone would have stood out. |
| 5 | Eph 4:1–16 | Great Theatre, top rows | A crowd of thousands that Acts says mostly didn't know why it had gathered, set beside "one body… one Spirit." |
| 6 | Eph 5:8–14 | Scroll-burning site | People stepping publicly out of the dark. "Walk as children of light." |
| 7 | Eph 5:21–6:9 | Terrace house courtyard | Household instructions read in the kind of home they addressed. |
| 8 | Eph 6:10–20 | Beside the soldier | The armour everyone in the empire recognized, turned into a picture of standing firm. Paul wrote it "in chains." |
| 9 | Eph 1:19–23 | Temple of Artemis | The greatest power in Asia, and the claim that Christ is "far above all rule, and authority, and power." |

Each fragment gives: the full WEB passage, a 2–4 sentence "Why here?" note, and 2–3 open discussion questions. All of it is collected in the **Journal**, which can also be read as one printable page for group night.

**Riot trigger:** after 5 of 9 fragments, a message says a crowd is gathering at the theatre. The player chooses when to go.

**Optional epilogue (if you like it):** after the riot, a quiet scene at the harbor. Acts 20:1 says Paul said goodbye and left for Macedonia; it does not say he sailed from here, so the scene is labelled imagined. Unlocks Eph 3:14–21 (Paul's prayer for the church) as a closing journal page.

---

## 6. The riot event (Acts 19:23–41)

A scripted scene of about three minutes, watched from the theatre seats. The player can look around but not leave until it ends (or tap "Skip").

1. **At the workshops.** Demetrius speaks to a gathering of craftsmen (Acts 19:25–27). They are filled with anger and the chant breaks out for the first time: **"Great is Artemis of the Ephesians!"** (19:28)
2. **The rush.** The city fills with confusion and the crowd rushes into the theatre, having seized Gaius and Aristarchus, Paul's travel companions (19:29). Shown as being pulled along by the arms; no one is hurt. Gaius and Aristarchus say nothing, as in Acts.
3. **Outside.** Paul wants to go in. The disciples won't let him, and some of the Asiarchs (leading officials of the province who were his friends) send word begging him not to (19:30–31).
4. **Confusion.** "Some therefore cried one thing, and some another… most of them didn't know why they had come together." (19:32)
5. **Alexander.** He is pushed forward and motions to speak, but "when they perceived that he was a Jew," the crowd shouts him down (19:33–34). He never gets a word out. The narration names this plainly: the crowd's anger turns on a whole people, not only on Paul.
6. **Two hours.** The chant swells with on-screen text and synthesized crowd sound. Ours lasts about 30 seconds with a caption giving the real length.
7. **The town clerk** quiets the crowd and gives his speech (19:35–40), then dismisses the assembly (19:41).
8. Narration closes; the journal gains an "Acts 19" page with three discussion questions.

All spoken lines are quoted from Acts 19 (WEB): Demetrius, the crowd, and the town clerk are the only ones who speak.

Tone: loud and tense, not violent. No weapons drawn, no one hurt.

---

## 7. Leader Mode

Toggle in the Settings menu (also `?leader=1` on the link). It is a convenience switch, not security. It:
- unlocks every fragment, journal page and the riot scene;
- adds a "Jump to…" list of all locations;
- adds "Start the riot scene" and "Reset all progress" buttons;
- adds a large-text option for projectors and shows discussion questions full-screen.

Turning it off returns the player's own progress untouched.

---

## 8. File layout

```
index.html              the page
css/                    styles for menus, plaques, joystick
src/                    game code (world, controls, characters, quest, audio, UI)
vendor/three.module.min.js
content/
  ui.json               button labels, menus, intro text
  locations.json        plaques ("known" / "imagined")
  characters.json       dialogue trees
  fragments.json        passages, "Why here?" notes, discussion questions
  riot.json             the riot script
  about.json            "About this letter", sources
tools/check-content.mjs checks the JSON and the Scripture quotes
docs/history-notes.md   historian's findings and sources
docs/web-reference/     WEB text of Ephesians and Acts 18–20, for the checker
.github/workflows/      deploy to GitHub Pages
.claude/agents/         historian, scripture-writer, playtester
CREDITS.md  README.md  PLAN.md
```

---

## 9. Build phases

Each phase ends the same way: playtester run (phone 390×844 with touch, desktop 1440×900), fixes, commit, deploy, and a live link with a three-line "what to try."

| Phase | You get | Main work |
|---|---|---|
| **1. Blockout** | Walk a grey-box city on phone and laptop, live on GitHub Pages | Project skeleton, terrain and street layout, collision, joystick and keyboard controls, map/compass/you-are-here, deploy workflow |
| **2. Landmarks and plaques** | The city looks like Ephesus; tap landmarks to read about them | Detailed low-poly buildings, harbor and ships, temple, plaques (scripture-writer), historian check of every plaque |
| **3. Characters** | Talk to all eight characters/groups | Character figures, dialogue system with choices, all dialogue (scripture-writer), historian check |
| **4. Quest, journal, Leader Mode** | Find nine fragments, read the journal, use Leader Mode | Fragment pickups, WEB passages with exact-match check, journal and printable view, saving, Leader Mode |
| **5. Riot, life and polish** | The full experience | Riot scene, background townspeople and animals, synthesized sound, performance tuning on phone settings, README and CREDITS |

---

## 10. Things I need from you

1. **Publishing.** GitHub Pages has to be switched on once by you: repo **Settings → Pages → Source: "GitHub Actions"** (the repo must be public on a free account). GitHub only publishes from the main branch by default, and I am working on a separate branch, so at the end of each phase I would open a pull request for you to merge (one click). Is that OK, or would you rather I be allowed to publish from my working branch?
2. **The "visitor from the future" framing** for the fragments (section 5). OK?
3. **Nine fragments, riot after five**, and the optional harbor epilogue. OK?
4. **Paul's appearance** limited to a non-speaking figure with Acts 20 quoted (section 4). OK?
5. **The household scene** approach (section 4). This is the most sensitive part; tell me if your congregation would want it handled differently.
