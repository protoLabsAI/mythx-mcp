/**
 * Content Parser Tests
 *
 * Tests for the XML parsers that convert LLM output to validated schemas.
 */
import { describe, it, expect } from "vitest";
import { parseArchetypesXML } from "../parsers/archetype-parser.js";
import { parseSeedXML } from "../parsers/seed-parser.js";
import { parseMonstersXML } from "../parsers/monster-parser.js";
import { parseItemsXML } from "../parsers/item-parser.js";
import { parseLocationsXML } from "../parsers/location-parser.js";
import { parseNPCsXML } from "../parsers/npc-parser.js";
import { parseFactionsXML } from "../parsers/faction-parser.js";

describe("parseArchetypesXML", () => {
  const VALID_ARCHETYPE_XML = `
    <archetypes>
      <archetype>
        <id>archetype:shadow-dancer</id>
        <name>Shadow Dancer</name>
        <tagline>Master of darkness and misdirection</tagline>
        <description>A nimble warrior who uses shadows as both weapon and shield.</description>

        <starting>
          <abilities>
            <str>-1</str>
            <agi>2</agi>
            <wit>1</wit>
            <con>0</con>
          </abilities>
          <hp>6</hp>
          <max_hp>6</max_hp>
        </starting>

        <starting_items>
          <item>item:obsidian-daggers</item>
          <item>item:smoke-bombs</item>
        </starting_items>

        <features>
          <feature>
            <id>feature:shadow-step</id>
            <name>Shadow Step</name>
            <description>Once per encounter, teleport to any shadow within 30 feet.</description>
          </feature>
        </features>

        <playstyle>Hit-and-run tactics, exploiting darkness and positioning.</playstyle>
        <background>Shadow dancers train in secret monasteries high in mist-shrouded mountains.</background>
        <flavor>The darkness is not your enemy—it is your ally.</flavor>
      </archetype>
    </archetypes>
  `;

  it("parses a valid archetype", () => {
    const archetypes = parseArchetypesXML(VALID_ARCHETYPE_XML);

    expect(archetypes).toHaveLength(1);
    const archetype = archetypes[0];

    expect(archetype.id).toBe("archetype:shadow-dancer");
    expect(archetype.name).toBe("Shadow Dancer");
    expect(archetype.tagline).toBe("Master of darkness and misdirection");
    expect(archetype.description).toContain("nimble warrior");
  });

  it("parses starting abilities correctly", () => {
    const archetypes = parseArchetypesXML(VALID_ARCHETYPE_XML);
    const { starting } = archetypes[0];

    expect(starting.abilities.STR).toBe(-1);
    expect(starting.abilities.AGI).toBe(2);
    expect(starting.abilities.WIT).toBe(1);
    expect(starting.abilities.CON).toBe(0);
    expect(starting.hp).toBe(6);
    expect(starting.maxHp).toBe(6);
  });

  it("parses starting items", () => {
    const archetypes = parseArchetypesXML(VALID_ARCHETYPE_XML);

    expect(archetypes[0].startingItems).toEqual(["item:obsidian-daggers", "item:smoke-bombs"]);
  });

  it("parses features", () => {
    const archetypes = parseArchetypesXML(VALID_ARCHETYPE_XML);
    const { features } = archetypes[0];

    expect(features).toHaveLength(1);
    expect(features[0].id).toBe("feature:shadow-step");
    expect(features[0].name).toBe("Shadow Step");
    expect(features[0].description).toContain("teleport");
  });

  it("parses multiple archetypes", () => {
    const xml = `
      <archetypes>
        <archetype>
          <id>archetype:warrior</id>
          <name>Warrior</name>
          <tagline>Frontline fighter</tagline>
          <description>A stalwart defender.</description>
          <starting>
            <abilities><str>2</str><agi>0</agi><wit>-1</wit><con>1</con></abilities>
            <hp>10</hp><max_hp>10</max_hp>
          </starting>
          <playstyle>Tank and hit hard.</playstyle>
          <background>Trained in the arena.</background>
          <flavor>Steel and glory.</flavor>
        </archetype>
        <archetype>
          <id>archetype:mage</id>
          <name>Mage</name>
          <tagline>Arcane scholar</tagline>
          <description>Wielder of mystical forces.</description>
          <starting>
            <abilities><str>-2</str><agi>0</agi><wit>3</wit><con>-1</con></abilities>
            <hp>4</hp><max_hp>4</max_hp>
          </starting>
          <playstyle>Stay back and cast.</playstyle>
          <background>Studied in the tower.</background>
          <flavor>Knowledge is power.</flavor>
        </archetype>
      </archetypes>
    `;

    const archetypes = parseArchetypesXML(xml);

    expect(archetypes).toHaveLength(2);
    expect(archetypes[0].name).toBe("Warrior");
    expect(archetypes[1].name).toBe("Mage");
    expect(archetypes[0].starting.abilities.STR).toBe(2);
    expect(archetypes[1].starting.abilities.WIT).toBe(3);
  });

  it("handles empty optional arrays", () => {
    const xml = `
      <archetypes>
        <archetype>
          <id>archetype:minimalist</id>
          <name>Minimalist</name>
          <tagline>Less is more</tagline>
          <description>A character with nothing.</description>
          <starting>
            <abilities><str>0</str><agi>0</agi><wit>0</wit><con>0</con></abilities>
            <hp>5</hp><max_hp>5</max_hp>
          </starting>
          <playstyle>Improvise.</playstyle>
          <background>Came from nothing.</background>
          <flavor>Empty hands, full heart.</flavor>
        </archetype>
      </archetypes>
    `;

    const archetypes = parseArchetypesXML(xml);

    expect(archetypes[0].startingItems).toEqual([]);
    expect(archetypes[0].features).toEqual([]);
  });

  it("uses fallbacks for missing optional fields", () => {
    const xml = `
      <archetypes>
        <archetype>
          <id>archetype:incomplete</id>
          <name>Incomplete</name>
          <!-- missing tagline and other optional fields -->
        </archetype>
      </archetypes>
    `;

    // Parser now uses sensible defaults instead of throwing
    const archetypes = parseArchetypesXML(xml);
    expect(archetypes).toHaveLength(1);
    expect(archetypes[0].id).toBe("archetype:incomplete");
    expect(archetypes[0].name).toBe("Incomplete");
    // Missing fields get defaults
    expect(archetypes[0].tagline).toBe("");
    expect(archetypes[0].features).toEqual([]);
  });
});

describe("parseSeedXML", () => {
  const VALID_SEED_XML = `
    <seed>
      <id>world:noir-city</id>
      <name>Noir City</name>
      <tagline>Where shadows hide secrets</tagline>
      <core_conflict>The city teeters on the brink of gang war as old alliances crumble.</core_conflict>

      <aesthetic>
        <visual_style>Rain-slicked streets, neon lights, and smoky bars</visual_style>
        <tone>Gritty, morally ambiguous, tension-filled</tone>
        <themes>
          <theme>Corruption</theme>
          <theme>Redemption</theme>
        </themes>
        <inspirations>
          <inspiration>Blade Runner</inspiration>
          <inspiration>Chinatown</inspiration>
        </inspirations>
      </aesthetic>

      <settings>
        <lethality>high</lethality>
        <magic_level>rare</magic_level>
        <technology_level>industrial</technology_level>
        <supernatural_presence>subtle</supernatural_presence>
      </settings>

      <archetype_seeds>
        <archetype>
          <name>Private Eye</name>
          <concept>A hardboiled detective seeking truth in a city of lies</concept>
        </archetype>
      </archetype_seeds>

      <location_seeds>
        <location>
          <name>The Rusty Anchor</name>
          <concept>A dockside bar where information flows like whiskey</concept>
        </location>
      </location_seeds>

      <npc_seeds>
        <npc>
          <name>Vince "The Shadow" Morello</name>
          <concept>Crime boss with a veneer of respectability</concept>
        </npc>
      </npc_seeds>

      <monster_seeds>
        <monster>
          <name>Street Thug</name>
          <concept>Low-level muscle for hire</concept>
          <threat>minion</threat>
        </monster>
      </monster_seeds>
    </seed>
  `;

  it("parses a valid seed", () => {
    const seed = parseSeedXML(VALID_SEED_XML, "noir detective steampunk");

    expect(seed.id).toBe("world:noir-city");
    expect(seed.name).toBe("Noir City");
    expect(seed.tagline).toBe("Where shadows hide secrets");
    expect(seed.campaignSeed).toBe("noir detective steampunk");
    expect(seed.coreConflict).toContain("gang war");
  });

  it("parses aesthetic settings", () => {
    const seed = parseSeedXML(VALID_SEED_XML, "test");

    expect(seed.aesthetic.visualStyle).toContain("Rain-slicked");
    expect(seed.aesthetic.tone).toContain("Gritty");
    expect(seed.aesthetic.themes).toEqual(["Corruption", "Redemption"]);
    expect(seed.aesthetic.inspirations).toEqual(["Blade Runner", "Chinatown"]);
  });

  it("parses game settings", () => {
    const seed = parseSeedXML(VALID_SEED_XML, "test");

    expect(seed.settings.lethality).toBe("high");
    expect(seed.settings.magicLevel).toBe("rare");
    expect(seed.settings.technologyLevel).toBe("industrial");
    expect(seed.settings.supernaturalPresence).toBe("subtle");
  });

  it("parses content seeds", () => {
    const seed = parseSeedXML(VALID_SEED_XML, "test");

    expect(seed.archetypeSeeds).toHaveLength(1);
    expect(seed.archetypeSeeds[0].name).toBe("Private Eye");

    expect(seed.locationSeeds).toHaveLength(1);
    expect(seed.locationSeeds[0].name).toBe("The Rusty Anchor");

    expect(seed.npcSeeds).toHaveLength(1);
    expect(seed.npcSeeds[0].name).toBe('Vince "The Shadow" Morello');

    expect(seed.monsterSeeds).toHaveLength(1);
    expect(seed.monsterSeeds[0].threat).toBe("minion");
  });

  it("handles case-insensitive enum values", () => {
    const xml = `
      <seed>
        <id>world:test</id>
        <name>Test World</name>
        <tagline>A test</tagline>
        <core_conflict>Testing</core_conflict>
        <aesthetic>
          <visual_style>Plain</visual_style>
          <tone>Neutral</tone>
          <themes><theme>None</theme></themes>
          <inspirations><inspiration>N/A</inspiration></inspirations>
        </aesthetic>
        <settings>
          <lethality>HIGH</lethality>
          <magic_level>RARE</magic_level>
          <technology_level>MEDIEVAL</technology_level>
          <supernatural_presence>SUBTLE</supernatural_presence>
        </settings>
      </seed>
    `;

    const seed = parseSeedXML(xml, "test");

    expect(seed.settings.lethality).toBe("high");
    expect(seed.settings.magicLevel).toBe("rare");
    expect(seed.settings.technologyLevel).toBe("medieval");
  });

  it("handles optional situation and arc seeds", () => {
    const xmlWithSituations = `
      <seed>
        <id>world:test</id>
        <name>Test World</name>
        <tagline>A test</tagline>
        <core_conflict>Testing</core_conflict>
        <aesthetic>
          <visual_style>Plain</visual_style>
          <tone>Neutral</tone>
          <themes><theme>None</theme></themes>
          <inspirations><inspiration>N/A</inspiration></inspirations>
        </aesthetic>
        <settings>
          <lethality>medium</lethality>
          <magic_level>common</magic_level>
          <technology_level>medieval</technology_level>
          <supernatural_presence>common</supernatural_presence>
        </settings>
        <situation_seeds>
          <situation>
            <name>The Missing Heir</name>
            <concept>A noble's child has vanished</concept>
            <urgency>high</urgency>
          </situation>
        </situation_seeds>
        <arc_seeds>
          <arc>
            <name>Rise of Darkness</name>
            <concept>An ancient evil awakens</concept>
            <structure>funnel</structure>
          </arc>
        </arc_seeds>
      </seed>
    `;

    const seed = parseSeedXML(xmlWithSituations, "test");

    expect(seed.situationSeeds).toHaveLength(1);
    expect(seed.situationSeeds![0].urgency).toBe("high");
    expect(seed.arcSeeds).toHaveLength(1);
    expect(seed.arcSeeds![0].structure).toBe("funnel");
  });

  it("throws for invalid enum values", () => {
    const xml = `
      <seed>
        <id>world:test</id>
        <name>Test</name>
        <tagline>Test</tagline>
        <core_conflict>Test</core_conflict>
        <aesthetic>
          <visual_style>X</visual_style>
          <tone>X</tone>
          <themes><theme>X</theme></themes>
          <inspirations><inspiration>X</inspiration></inspirations>
        </aesthetic>
        <settings>
          <lethality>invalid_value</lethality>
          <magic_level>rare</magic_level>
          <technology_level>medieval</technology_level>
          <supernatural_presence>subtle</supernatural_presence>
        </settings>
      </seed>
    `;

    expect(() => parseSeedXML(xml, "test")).toThrow("invalid value");
  });
});

describe("parseMonstersXML", () => {
  const VALID_MONSTER_XML = `
    <monsters>
      <monster>
        <id>monster:shadow-hound</id>
        <name>Shadow Hound</name>
        <description>A beast of living darkness, eyes gleaming with malevolent intelligence.</description>

        <hp>12</hp>
        <armor>1</armor>
        <threat>standard</threat>

        <abilities>
          <str>1</str>
          <agi>2</agi>
          <wit>-1</wit>
          <con>0</con>
        </abilities>

        <attacks>
          <attack>
            <name>Shadow Bite</name>
            <ability>AGI</ability>
            <damage>1d8</damage>
            <properties>
              <property>reach</property>
            </properties>
            <flavor>The hound's jaws phase through armor.</flavor>
          </attack>
        </attacks>

        <special_abilities>
          <ability>Shadow Meld: Can hide in any shadow as a bonus action.</ability>
          <ability>Pack Tactics: Advantage when ally is adjacent to target.</ability>
        </special_abilities>

        <morale>
          <threshold>6</threshold>
          <check_when>belowHalfHP</check_when>
          <flees_below_hp>3</flees_below_hp>
        </morale>

        <tactics>
          <preferred_range>melee</preferred_range>
          <target_priority>weakest</target_priority>
          <special_behavior>Attempts to flank with pack members.</special_behavior>
        </tactics>

        <lore>Shadow hounds are bound to dark masters through blood rituals.</lore>
        <encounter_text>Crimson eyes materialize from the darkness.</encounter_text>
        <death_text>The hound dissolves into wisps of shadow.</death_text>
      </monster>
    </monsters>
  `;

  it("parses a valid monster", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);

    expect(monsters).toHaveLength(1);
    const monster = monsters[0];

    expect(monster.id).toBe("monster:shadow-hound");
    expect(monster.name).toBe("Shadow Hound");
    expect(monster.hp).toBe(12);
    expect(monster.armor).toBe(1);
    expect(monster.threat).toBe("standard");
  });

  it("parses abilities correctly", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);
    const { abilities } = monsters[0];

    // Abilities are optional in the schema; the test XML emits the
    // <abilities> block so the parsed result must be defined here.
    expect(abilities).toBeDefined();
    expect(abilities!.STR).toBe(1);
    expect(abilities!.AGI).toBe(2);
    expect(abilities!.WIT).toBe(-1);
    expect(abilities!.CON).toBe(0);
  });

  it("returns undefined abilities when the block is omitted", () => {
    const xml = `
      <monsters>
        <monster>
          <id>monster:thug</id>
          <name>Thug</name>
          <threat_tier>minion</threat_tier>
          <hp>4</hp>
          <damage>1d4</damage>
          <description>Generic enforcer</description>
        </monster>
      </monsters>
    `;
    const monsters = parseMonstersXML(xml);
    expect(monsters[0].abilities).toBeUndefined();
  });

  it("parses attacks", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);
    const { attacks } = monsters[0];

    expect(attacks).toHaveLength(1);
    expect(attacks[0].name).toBe("Shadow Bite");
    expect(attacks[0].ability).toBe("AGI");
    expect(attacks[0].damage).toBe("1d8");
    expect(attacks[0].properties).toEqual(["reach"]);
    expect(attacks[0].flavor).toContain("phase through");
  });

  it("parses special abilities as strings", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);

    expect(monsters[0].specialAbilities).toHaveLength(2);
    expect(monsters[0].specialAbilities[0]).toContain("Shadow Meld");
    expect(monsters[0].specialAbilities[1]).toContain("Pack Tactics");
  });

  it("parses morale settings", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);
    const { morale } = monsters[0];

    expect(morale.threshold).toBe(6);
    expect(morale.checkWhen).toBe("belowHalfHP");
    expect(morale.fleesBelowHP).toBe(3);
  });

  it("parses tactics", () => {
    const monsters = parseMonstersXML(VALID_MONSTER_XML);
    const { tactics } = monsters[0];

    expect(tactics.preferredRange).toBe("melee");
    expect(tactics.targetPriority).toBe("weakest");
    expect(tactics.specialBehavior).toContain("flank");
  });

  it("handles multiple monsters", () => {
    const xml = `
      <monsters>
        <monster>
          <id>monster:goblin</id>
          <name>Goblin</name>
          <description>Small green menace.</description>
          <hp>4</hp>
          <armor>0</armor>
          <threat>minion</threat>
          <abilities><str>-1</str><agi>1</agi><wit>0</wit><con>0</con></abilities>
          <attacks>
            <attack>
              <name>Shiv</name>
              <ability>AGI</ability>
              <damage>1d4</damage>
              <flavor>Quick and dirty.</flavor>
            </attack>
          </attacks>
          <morale><threshold>4</threshold><check_when>firstHit</check_when></morale>
          <tactics><preferred_range>melee</preferred_range><target_priority>nearest</target_priority></tactics>
          <lore>Goblins are everywhere.</lore>
          <encounter_text>Chittering fills the air.</encounter_text>
          <death_text>It squeaks and falls.</death_text>
        </monster>
        <monster>
          <id>monster:orc</id>
          <name>Orc Warrior</name>
          <description>Hulking brute.</description>
          <hp>18</hp>
          <armor>2</armor>
          <threat>elite</threat>
          <abilities><str>3</str><agi>0</agi><wit>-1</wit><con>2</con></abilities>
          <attacks>
            <attack>
              <name>Great Axe</name>
              <ability>STR</ability>
              <damage>2d6</damage>
              <flavor>Cleaves through armor.</flavor>
            </attack>
          </attacks>
          <morale><threshold>8</threshold><check_when>allyDies</check_when></morale>
          <tactics><preferred_range>melee</preferred_range><target_priority>strongest</target_priority></tactics>
          <lore>Orcs live for battle.</lore>
          <encounter_text>A war cry echoes.</encounter_text>
          <death_text>Falls with a thud.</death_text>
        </monster>
      </monsters>
    `;

    const monsters = parseMonstersXML(xml);

    expect(monsters).toHaveLength(2);
    expect(monsters[0].threat).toBe("minion");
    expect(monsters[1].threat).toBe("elite");
  });

  it("handles optional attack properties", () => {
    const xml = `
      <monsters>
        <monster>
          <id>monster:simple</id>
          <name>Simple Monster</name>
          <description>Basic enemy.</description>
          <hp>5</hp>
          <armor>0</armor>
          <threat>minion</threat>
          <abilities><str>0</str><agi>0</agi><wit>0</wit><con>0</con></abilities>
          <attacks>
            <attack>
              <name>Punch</name>
              <ability>STR</ability>
              <damage>1d4</damage>
              <flavor>Simple attack.</flavor>
            </attack>
          </attacks>
          <morale><threshold>5</threshold><check_when>belowHalfHP</check_when></morale>
          <tactics><preferred_range>melee</preferred_range><target_priority>random</target_priority></tactics>
          <lore>Basic lore.</lore>
          <encounter_text>It appears.</encounter_text>
          <death_text>It falls.</death_text>
        </monster>
      </monsters>
    `;

    const monsters = parseMonstersXML(xml);

    expect(monsters[0].attacks[0].properties).toBeUndefined();
  });
});

describe("parseItemsXML", () => {
  it("parses valid weapon item", () => {
    const xml = `
      <items>
        <item>
          <id>item:shadow-blade</id>
          <name>Shadow Blade</name>
          <kind>weapon</kind>
          <description>A blade that absorbs light.</description>
          <flavor>The darkness hungers.</flavor>
          <tags>
            <tag>melee</tag>
            <tag>magical</tag>
          </tags>
          <slots>1</slots>
          <weapon>
            <damage>1d8</damage>
            <ability>AGI</ability>
            <properties>
              <property>finesse</property>
            </properties>
          </weapon>
        </item>
      </items>
    `;

    const items = parseItemsXML(xml);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("item:shadow-blade");
    expect(items[0].kind).toBe("weapon");
    expect(items[0].weapon?.damage).toBe("1d8");
    expect(items[0].weapon?.ability).toBe("AGI");
    expect(items[0].weapon?.properties).toEqual(["finesse"]);
    expect(items[0].tags).toEqual(["melee", "magical"]);
  });

  it("parses consumable item", () => {
    const xml = `
      <items>
        <item>
          <id>item:healing-potion</id>
          <name>Healing Potion</name>
          <kind>consumable</kind>
          <description>A ruby-red liquid that mends wounds.</description>
          <flavor>Tastes like cherries and regret.</flavor>
          <tags><tag>healing</tag></tags>
          <slots>1</slots>
          <consumable>
            <uses>1</uses>
            <effect>heal</effect>
            <effect_description>Restore 1d6+2 HP.</effect_description>
          </consumable>
        </item>
      </items>
    `;

    const items = parseItemsXML(xml);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("consumable");
    expect(items[0].consumable?.uses).toBe(1);
    expect(items[0].consumable?.effect).toBe("heal");
  });
});

describe("parseLocationsXML", () => {
  it("parses valid locations", () => {
    const xml = `
      <locations>
        <location>
          <id>location:rusty-anchor</id>
          <name>The Rusty Anchor</name>
          <description>A weathered dockside tavern where sailors trade stories and secrets.</description>
          <type>building</type>
          <atmosphere>Smoke hangs in the air, mingling with the smell of salt and cheap ale.</atmosphere>
          <features>
            <feature>A hidden back room for private meetings</feature>
            <feature>A trapdoor leading to smuggling tunnels</feature>
          </features>
          <connections>
            <connection>location:docks</connection>
            <connection>location:smuggler-tunnels</connection>
          </connections>
          <encounters>
            <encounter>encounter:bar-brawl</encounter>
          </encounters>
          <npcs>
            <npc>npc:one-eyed-jack</npc>
          </npcs>
          <secrets>
            <secret>The anchor is actually enchanted</secret>
          </secrets>
          <gm_notes>This is a hub for information.</gm_notes>
        </location>
      </locations>
    `;

    const locations = parseLocationsXML(xml);

    expect(locations).toHaveLength(1);
    expect(locations[0].id).toBe("location:rusty-anchor");
    expect(locations[0].type).toBe("building");
    expect(locations[0].atmosphere).toContain("Smoke");
    expect(locations[0].connections).toEqual(["location:docks", "location:smuggler-tunnels"]);
    expect(locations[0].features).toHaveLength(2);
    expect(locations[0].encounters).toEqual(["encounter:bar-brawl"]);
    expect(locations[0].npcs).toEqual(["npc:one-eyed-jack"]);
    expect(locations[0].secrets).toHaveLength(1);
    expect(locations[0].gmNotes).toContain("hub");
  });

  it("handles all location types", () => {
    const types = ["settlement", "dungeon", "wilderness", "landmark", "building"];
    for (const type of types) {
      const xml = `
        <locations>
          <location>
            <id>location:test</id>
            <name>Test Location</name>
            <description>A test.</description>
            <type>${type}</type>
            <atmosphere>Test atmosphere.</atmosphere>
          </location>
        </locations>
      `;
      const locations = parseLocationsXML(xml);
      expect(locations[0].type).toBe(type);
    }
  });
});

describe("parseNPCsXML", () => {
  it("parses valid NPCs", () => {
    const xml = `
      <npcs>
        <npc>
          <id>npc:one-eyed-jack</id>
          <name>One-Eyed Jack</name>
          <description>A grizzled bartender with a patch over his left eye.</description>
          <personality>Gruff but fair, with a soft spot for underdogs.</personality>
          <motivation>To protect his establishment.</motivation>
          <attitude>neutral</attitude>
          <narrative_role>information</narrative_role>
          <dialogue_hints>
            <hint>What'll it be, stranger?</hint>
            <hint>Keep your voice down.</hint>
          </dialogue_hints>
          <locations>
            <location>location:rusty-anchor</location>
          </locations>
          <relationships>
            <relationship>
              <id>npc:crime-boss</id>
              <description>Uneasy truce after past conflict</description>
            </relationship>
          </relationships>
          <secrets>
            <secret>He was once a notorious pirate captain</secret>
          </secrets>
        </npc>
      </npcs>
    `;

    const npcs = parseNPCsXML(xml);

    expect(npcs).toHaveLength(1);
    expect(npcs[0].id).toBe("npc:one-eyed-jack");
    expect(npcs[0].personality).toContain("Gruff");
    expect(npcs[0].attitude).toBe("neutral");
    expect(npcs[0].narrativeRole).toBe("information");
    expect(npcs[0].dialogueHints).toHaveLength(2);
    expect(npcs[0].locations).toEqual(["location:rusty-anchor"]);
    expect(npcs[0].relationships).toEqual({
      "npc:crime-boss": "Uneasy truce after past conflict",
    });
    expect(npcs[0].secrets).toHaveLength(1);
  });

  it("handles all attitude values", () => {
    const attitudes = ["friendly", "neutral", "hostile", "unknown"];
    for (const attitude of attitudes) {
      const xml = `
        <npcs>
          <npc>
            <id>npc:test</id>
            <name>Test NPC</name>
            <description>A test.</description>
            <personality>Test personality.</personality>
            <motivation>Test motivation.</motivation>
            <attitude>${attitude}</attitude>
            <narrative_role>background</narrative_role>
          </npc>
        </npcs>
      `;
      const npcs = parseNPCsXML(xml);
      expect(npcs[0].attitude).toBe(attitude);
    }
  });

  it("handles all narrative role values", () => {
    const roles = [
      "quest_giver",
      "ally",
      "obstacle",
      "information",
      "antagonist",
      "merchant",
      "background",
    ];
    for (const role of roles) {
      const xml = `
        <npcs>
          <npc>
            <id>npc:test</id>
            <name>Test NPC</name>
            <description>A test.</description>
            <personality>Test personality.</personality>
            <motivation>Test motivation.</motivation>
            <attitude>neutral</attitude>
            <narrative_role>${role}</narrative_role>
          </npc>
        </npcs>
      `;
      const npcs = parseNPCsXML(xml);
      expect(npcs[0].narrativeRole).toBe(role);
    }
  });
});

describe("parseFactionsXML", () => {
  it("parses valid factions with relationships", () => {
    const xml = `
      <factions>
        <faction>
          <id>faction:silver-thread</id>
          <name>The Silver Thread</name>
          <description>A clandestine network of weavers turned spies.</description>
          <goals>
            <goal>Topple the Velvet Court</goal>
            <goal>Recover the lost Tapestry</goal>
          </goals>
          <resources>
            <resource>Coded sigils woven into commoners' clothing</resource>
            <resource>Trusted couriers in every port</resource>
          </resources>
          <territory>
            <location>location:loom-cellars</location>
          </territory>
          <key_members>
            <npc>npc:mistress-tally</npc>
          </key_members>
          <relationships>
            <relationship>
              <faction_id>faction:velvet-court</faction_id>
              <attitude>hostile</attitude>
              <reason>The Court burned their founding hall</reason>
            </relationship>
            <relationship>
              <faction_id>faction:dock-fraternity</faction_id>
              <attitude>allied</attitude>
              <reason>Shared smuggling routes through the river-gates</reason>
            </relationship>
          </relationships>
          <hooks>
            <hook>A coded scrap arrives in the party's lodgings</hook>
          </hooks>
          <secrets>
            <secret>Mistress Tally is the last living daughter of the deposed queen</secret>
          </secrets>
        </faction>
      </factions>
    `;

    const factions = parseFactionsXML(xml);

    expect(factions).toHaveLength(1);
    expect(factions[0].id).toBe("faction:silver-thread");
    expect(factions[0].name).toBe("The Silver Thread");
    expect(factions[0].goals).toHaveLength(2);
    expect(factions[0].resources).toHaveLength(2);
    expect(factions[0].territory).toEqual(["location:loom-cellars"]);
    expect(factions[0].keyMembers).toEqual(["npc:mistress-tally"]);
    expect(factions[0].relationships["faction:velvet-court"]).toEqual({
      attitude: "hostile",
      reason: "The Court burned their founding hall",
    });
    expect(factions[0].relationships["faction:dock-fraternity"]).toEqual({
      attitude: "allied",
      reason: "Shared smuggling routes through the river-gates",
    });
    expect(factions[0].hooks).toHaveLength(1);
    expect(factions[0].secrets).toHaveLength(1);
  });

  it("normalizes unknown attitude values to neutral", () => {
    const xml = `
      <factions>
        <faction>
          <id>faction:test</id>
          <name>Test</name>
          <description>Test</description>
          <goals><goal>Test</goal></goals>
          <resources><resource>Test</resource></resources>
          <territory><location>location:x</location></territory>
          <key_members><npc>npc:y</npc></key_members>
          <relationships>
            <relationship>
              <faction_id>faction:other</faction_id>
              <attitude>WeIrDvAlUe</attitude>
              <reason>Test</reason>
            </relationship>
          </relationships>
          <hooks><hook>Test</hook></hooks>
          <secrets><secret>Test</secret></secrets>
        </faction>
      </factions>
    `;
    const factions = parseFactionsXML(xml);
    expect(factions[0].relationships["faction:other"].attitude).toBe("neutral");
  });

  it("handles missing optional sections gracefully", () => {
    const xml = `
      <factions>
        <faction>
          <id>faction:minimal</id>
          <name>Minimal</name>
          <description>Just enough fields</description>
          <goals></goals>
          <resources></resources>
          <territory></territory>
          <key_members></key_members>
          <relationships></relationships>
          <hooks></hooks>
          <secrets></secrets>
        </faction>
      </factions>
    `;
    const factions = parseFactionsXML(xml);
    expect(factions).toHaveLength(1);
    expect(factions[0].goals).toEqual([]);
    expect(factions[0].relationships).toEqual({});
  });

  it("strictly requires <faction_id> for relationship targets (not <faction>)", () => {
    // The outer XML container is <faction>...</faction>. If the LLM uses
    // <faction>X</faction> as the relationship target, our non-greedy
    // regex inside extractAllTags(..., "faction") would match outer-open
    // to inner-close — silently truncating the entire faction block. The
    // relationship would never even reach the parser. So we contract on
    // <faction_id> in the prompt; this test pins that behavior so the
    // invariant doesn't drift.
    const xml = `
      <factions>
        <faction>
          <id>faction:loose</id>
          <name>Loose Spec</name>
          <description>Test</description>
          <goals><goal>g</goal></goals>
          <resources><resource>r</resource></resources>
          <territory><location>location:x</location></territory>
          <key_members><npc>npc:y</npc></key_members>
          <relationships>
            <relationship>
              <faction>faction:other</faction>
              <attitude>friendly</attitude>
              <reason>Wrong inner tag</reason>
            </relationship>
          </relationships>
          <hooks><hook>h</hook></hooks>
          <secrets><secret>s</secret></secrets>
        </faction>
      </factions>
    `;
    // Parsing succeeds for the captured prefix, but the relationships
    // block is unreachable — empty object, not the misformatted entry.
    const factions = parseFactionsXML(xml);
    expect(factions).toHaveLength(1);
    expect(factions[0].relationships).toEqual({});
  });
});

describe("parser error handling", () => {
  it("provides helpful error messages for missing tags", () => {
    const xml = "<archetypes><archetype><id>test</id></archetype></archetypes>";

    expect(() => parseArchetypesXML(xml)).toThrow(/not found or empty/);
  });

  it("validates against Zod schema", () => {
    // This would pass XML parsing but fail Zod validation
    // if the parsed values don't match expected types
    const invalidXml = `
      <archetypes>
        <archetype>
          <id></id>
          <name>Test</name>
          <tagline>Test</tagline>
          <description>Test</description>
          <starting>
            <abilities><str>0</str><agi>0</agi><wit>0</wit><con>0</con></abilities>
            <hp>5</hp><max_hp>5</max_hp>
          </starting>
          <playstyle>Test</playstyle>
          <background>Test</background>
          <flavor>Test</flavor>
        </archetype>
      </archetypes>
    `;

    // Empty id should fail - either from extractRequiredTag or Zod
    expect(() => parseArchetypesXML(invalidXml)).toThrow();
  });
});
