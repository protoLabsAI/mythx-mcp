/**
 * Markdown Formatter
 *
 * Pure functions for formatting entity lookup results as markdown.
 * Supports GM vs player access levels.
 */

import type { LookupResult, LookupEntityType } from "./entity-resolver.js";

/**
 * Template types for formatting
 */
export type TemplateType = "full" | "summary" | "reference";

/**
 * Access level for formatting
 */
export type AccessLevel = "gm" | "player";

/**
 * Options for formatting
 */
export interface FormatOptions {
  /** Template type (default: full) */
  template?: TemplateType;
  /** Access level (default: gm) */
  accessLevel?: AccessLevel;
  /** Whether to include references (default: true) */
  includeReferences?: boolean;
  /** Heading level to start at (default: 2) */
  headingLevel?: number;
}

/**
 * Format an entity lookup result as markdown
 *
 * @param result - Lookup result to format
 * @param options - Formatting options
 * @returns Markdown string
 */
export function formatEntityAsMarkdown(result: LookupResult, options: FormatOptions = {}): string {
  const {
    template = "full",
    accessLevel = "gm",
    includeReferences = true,
    headingLevel = 2,
  } = options;

  if (!result.found || !result.entity) {
    return `**Not Found:** ${result.type}/${result.id}\n\n${result.error ?? "Entity not found"}`;
  }

  const h = (level: number) => "#".repeat(Math.min(level, 6));
  const entity = result.entity as Record<string, unknown>;

  switch (result.type) {
    case "monster":
      return formatMonster(entity, template, accessLevel, h(headingLevel));
    case "npc":
      return formatNPC(entity, template, accessLevel, h(headingLevel));
    case "location":
      return formatLocation(
        entity,
        template,
        accessLevel,
        h(headingLevel),
        includeReferences ? result.references : undefined
      );
    case "situation":
      return formatSituation(entity, template, accessLevel, h(headingLevel));
    case "archetype":
      return formatArchetype(entity, template, accessLevel, h(headingLevel));
    case "item":
      return formatItem(entity, template, accessLevel, h(headingLevel));
    case "encounter":
      return formatEncounter(
        entity,
        template,
        accessLevel,
        h(headingLevel),
        includeReferences ? result.references : undefined
      );
    case "condition":
      return formatCondition(entity, template, h(headingLevel));
    case "faction":
      return formatFaction(entity, template, accessLevel, h(headingLevel));
    case "arc":
      return formatArc(entity, template, accessLevel, h(headingLevel));
    default:
      return formatGeneric(entity, result.type, h(headingLevel));
  }
}

/**
 * Format monster entity
 */
function formatMonster(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const threat = entity.threat as string;
  const description = entity.description as string;

  lines.push(`${h} ${name}`);
  lines.push(`**Threat:** ${threat}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Stats
  const hp = entity.hp as number;
  const armor = entity.armor as number;
  const abilities = entity.abilities as Record<string, number>;

  lines.push("");
  lines.push(`**HP:** ${hp} | **Armor:** ${armor}`);

  if (abilities) {
    const statLine = Object.entries(abilities)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    lines.push(`**Abilities:** ${statLine}`);
  }

  // Attacks
  const attacks = entity.attacks as Array<{
    name: string;
    damage: string;
    description: string;
  }>;
  if (attacks?.length) {
    lines.push("");
    lines.push(`${h}# Attacks`);
    for (const atk of attacks) {
      lines.push(`- **${atk.name}** (${atk.damage}): ${atk.description}`);
    }
  }

  // Special abilities
  const specialAbilities = entity.specialAbilities as string[];
  if (specialAbilities?.length) {
    lines.push("");
    lines.push(`${h}# Special Abilities`);
    for (const ability of specialAbilities) {
      lines.push(`- ${ability}`);
    }
  }

  if (template === "full") {
    // Morale and tactics (GM info)
    const morale = entity.morale as { breakpoint: string; fleeBehavior: string };
    const tactics = entity.tactics as {
      preferred: string;
      fallback: string;
      targetPriority: string;
    };

    if (accessLevel === "gm" && morale) {
      lines.push("");
      lines.push(`${h}# Morale`);
      lines.push(`**Breakpoint:** ${morale.breakpoint}`);
      lines.push(`**Flee Behavior:** ${morale.fleeBehavior}`);
    }

    if (accessLevel === "gm" && tactics) {
      lines.push("");
      lines.push(`${h}# Tactics`);
      lines.push(`**Preferred:** ${tactics.preferred}`);
      lines.push(`**Fallback:** ${tactics.fallback}`);
      lines.push(`**Target Priority:** ${tactics.targetPriority}`);
    }

    // Encounter text
    const encounterText = entity.encounterText as string;
    if (encounterText) {
      lines.push("");
      lines.push(`${h}# Encounter`);
      lines.push(`*${encounterText}*`);
    }

    // Lore
    const lore = entity.lore as string;
    if (lore) {
      lines.push("");
      lines.push(`${h}# Lore`);
      lines.push(lore);
    }
  }

  return lines.join("\n");
}

/**
 * Format NPC entity
 */
function formatNPC(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const description = entity.description as string;
  const attitude = entity.attitude as string;
  const narrativeRole = entity.narrativeRole as string;

  lines.push(`${h} ${name}`);
  lines.push(`**Role:** ${narrativeRole} | **Attitude:** ${attitude}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Personality and motivation. Motivation accepts the want/fear/lie
  // triad (preferred) or a flat string (legacy fallback).
  const personality = entity.personality as string;
  const motivation = entity.motivation as
    | string
    | { want?: string; fear?: string; lie?: string }
    | undefined;

  if (personality) {
    lines.push("");
    lines.push(`${h}# Personality`);
    lines.push(personality);
  }

  if (motivation) {
    lines.push("");
    lines.push(`${h}# Motivation`);
    if (typeof motivation === "string") {
      lines.push(motivation);
    } else {
      if (motivation.want) lines.push(`- Want: ${motivation.want}`);
      if (motivation.fear) lines.push(`- Fear: ${motivation.fear}`);
      if (motivation.lie) lines.push(`- Lie: ${motivation.lie}`);
    }
  }

  // Dialogue hints
  const dialogueHints = entity.dialogueHints as string[];
  if (dialogueHints?.length) {
    lines.push("");
    lines.push(`${h}# Dialogue Hints`);
    for (const hint of dialogueHints) {
      lines.push(`- ${hint}`);
    }
  }

  // GM-only: Secrets
  if (accessLevel === "gm" && template === "full") {
    const secrets = entity.secrets as string[];
    if (secrets?.length) {
      lines.push("");
      lines.push(`${h}# Secrets (GM Only)`);
      for (const secret of secrets) {
        lines.push(`- ${secret}`);
      }
    }

    // Locations
    const locations = entity.locations as string[];
    if (locations?.length) {
      lines.push("");
      lines.push(`${h}# Locations`);
      lines.push(locations.join(", "));
    }
  }

  return lines.join("\n");
}

/**
 * Format location entity
 */
function formatLocation(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string,
  references?: Record<string, LookupResult[]>
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const type = entity.type as string;
  const description = entity.description as string;
  const atmosphere = entity.atmosphere as string;

  lines.push(`${h} ${name}`);
  lines.push(`**Type:** ${type}`);
  lines.push("");
  lines.push(description);

  if (atmosphere) {
    lines.push("");
    lines.push(`*${atmosphere}*`);
  }

  if (template === "reference") {
    return lines.join("\n");
  }

  // Features
  const features = entity.features as string[];
  if (features?.length) {
    lines.push("");
    lines.push(`${h}# Features`);
    for (const feature of features) {
      lines.push(`- ${feature}`);
    }
  }

  // Connections (referenced locations). Accept structured form with
  // travel narrative or flat ID strings.
  const connections = entity.connections as Array<
    string | { to: string; travel?: string; observation?: string; risk?: string }
  >;
  if (connections?.length) {
    lines.push("");
    lines.push(`${h}# Connections`);
    if (references?.connections) {
      for (const ref of references.connections) {
        if (ref.found) {
          const refEntity = ref.entity as Record<string, unknown>;
          lines.push(`- **${refEntity.name}** (${ref.id})`);
        } else {
          lines.push(`- ${ref.id} (not found)`);
        }
      }
    } else {
      lines.push(connections.map((c) => (typeof c === "string" ? c : c.to)).join(", "));
    }
  }

  // NPCs present
  const npcs = entity.npcs as string[];
  if (npcs?.length) {
    lines.push("");
    lines.push(`${h}# NPCs`);
    if (references?.npcs) {
      for (const ref of references.npcs) {
        if (ref.found) {
          const refEntity = ref.entity as Record<string, unknown>;
          lines.push(
            `- **${refEntity.name}** - ${(refEntity.narrativeRole as string) ?? "unknown role"}`
          );
        } else {
          lines.push(`- ${ref.id} (not found)`);
        }
      }
    } else {
      lines.push(npcs.join(", "));
    }
  }

  // GM-only content
  if (accessLevel === "gm" && template === "full") {
    const secrets = entity.secrets as string[];
    if (secrets?.length) {
      lines.push("");
      lines.push(`${h}# Secrets (GM Only)`);
      for (const secret of secrets) {
        lines.push(`- ${secret}`);
      }
    }

    const gmNotes = entity.gmNotes as string;
    if (gmNotes) {
      lines.push("");
      lines.push(`${h}# GM Notes`);
      lines.push(gmNotes);
    }

    // Encounters
    const encounters = entity.encounters as string[];
    if (encounters?.length) {
      lines.push("");
      lines.push(`${h}# Encounters`);
      lines.push(encounters.join(", "));
    }
  }

  return lines.join("\n");
}

/**
 * Format situation entity
 */
function formatSituation(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const description = entity.description as string;
  const status = entity.status as string;

  lines.push(`${h} ${name}`);
  lines.push(`**Status:** ${status}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Stakes
  const stakes = entity.stakes as {
    risks: string[];
    opportunities: string[];
    ifIgnored: string;
  };
  if (stakes) {
    lines.push("");
    lines.push(`${h}# Stakes`);

    if (stakes.risks?.length) {
      lines.push("**Risks:**");
      for (const risk of stakes.risks) {
        lines.push(`- ${risk}`);
      }
    }

    if (stakes.opportunities?.length) {
      lines.push("**Opportunities:**");
      for (const opp of stakes.opportunities) {
        lines.push(`- ${opp}`);
      }
    }

    if (stakes.ifIgnored) {
      lines.push("");
      lines.push(`**If Ignored:** ${stakes.ifIgnored}`);
    }
  }

  // Complications
  const complications = entity.complications as Array<{
    description: string;
    type: string;
    resolutions: string[];
  }>;
  if (complications?.length) {
    lines.push("");
    lines.push(`${h}# Complications`);
    for (const comp of complications) {
      lines.push(`- **${comp.type}:** ${comp.description}`);
      if (comp.resolutions?.length) {
        lines.push(`  - Resolutions: ${comp.resolutions.join(", ")}`);
      }
    }
  }

  // GM-only content
  if (accessLevel === "gm" && template === "full") {
    // Clock
    const clock = entity.clock as {
      stages: Array<{ name: string; description: string }>;
      currentStage: number;
    };
    if (clock) {
      lines.push("");
      lines.push(`${h}# Clock`);
      lines.push(`**Current Stage:** ${clock.currentStage}`);
      for (let i = 0; i < clock.stages.length; i++) {
        const stage = clock.stages[i];
        const marker = i === clock.currentStage ? "→" : "○";
        lines.push(`${marker} **${stage.name}:** ${stage.description}`);
      }
    }

    // Outcomes
    const outcomes = entity.outcomes as {
      victory: { description: string };
      failure: { description: string };
    };
    if (outcomes) {
      lines.push("");
      lines.push(`${h}# Outcomes`);
      if (outcomes.victory) {
        lines.push(`**Victory:** ${outcomes.victory.description}`);
      }
      if (outcomes.failure) {
        lines.push(`**Failure:** ${outcomes.failure.description}`);
      }
    }

    // GM Guidance
    const gmGuidance = entity.gmGuidance as {
      themes: string[];
      toneNotes: string;
      foreshadowing: string[];
    };
    if (gmGuidance) {
      lines.push("");
      lines.push(`${h}# GM Guidance`);
      if (gmGuidance.themes?.length) {
        lines.push(`**Themes:** ${gmGuidance.themes.join(", ")}`);
      }
      if (gmGuidance.toneNotes) {
        lines.push(`**Tone:** ${gmGuidance.toneNotes}`);
      }
      if (gmGuidance.foreshadowing?.length) {
        lines.push("**Foreshadowing:**");
        for (const hint of gmGuidance.foreshadowing) {
          lines.push(`- ${hint}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format archetype entity
 */
function formatArchetype(
  entity: Record<string, unknown>,
  template: TemplateType,
  _accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const tagline = entity.tagline as string;
  const description = entity.description as string;
  const playstyle = entity.playstyle as string;

  lines.push(`${h} ${name}`);
  lines.push(`*${tagline}*`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  lines.push("");
  lines.push(`${h}# Playstyle`);
  lines.push(playstyle);

  // Starting stats
  const starting = entity.starting as {
    hp: number;
    abilities: Record<string, number>;
  };
  if (starting) {
    lines.push("");
    lines.push(`${h}# Starting Stats`);
    lines.push(`**HP:** ${starting.hp}`);
    if (starting.abilities) {
      const statLine = Object.entries(starting.abilities)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      lines.push(`**Abilities:** ${statLine}`);
    }
  }

  // Features
  const features = entity.features as Array<{
    name: string;
    description: string;
  }>;
  if (features?.length) {
    lines.push("");
    lines.push(`${h}# Features`);
    for (const feature of features) {
      lines.push(`- **${feature.name}:** ${feature.description}`);
    }
  }

  if (template === "full") {
    // Starting items
    const startingItems = entity.startingItems as string[];
    if (startingItems?.length) {
      lines.push("");
      lines.push(`${h}# Starting Equipment`);
      lines.push(startingItems.join(", "));
    }

    // Background and flavor
    const background = entity.background as string;
    if (background) {
      lines.push("");
      lines.push(`${h}# Background`);
      lines.push(background);
    }

    const flavor = entity.flavor as string;
    if (flavor) {
      lines.push("");
      lines.push(`*${flavor}*`);
    }
  }

  return lines.join("\n");
}

/**
 * Format item entity
 */
function formatItem(
  entity: Record<string, unknown>,
  template: TemplateType,
  _accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const kind = entity.kind as string;
  const description = entity.description as string;
  const tags = entity.tags as string[];

  lines.push(`${h} ${name}`);
  lines.push(`**Type:** ${kind}${tags?.length ? ` | **Tags:** ${tags.join(", ")}` : ""}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Weapon properties
  const weapon = entity.weapon as {
    damage: string;
    ability: string;
    properties: string[];
  };
  if (weapon) {
    lines.push("");
    lines.push(`${h}# Weapon`);
    lines.push(`**Damage:** ${weapon.damage}`);
    lines.push(`**Ability:** ${weapon.ability}`);
    if (weapon.properties?.length) {
      lines.push(`**Properties:** ${weapon.properties.join(", ")}`);
    }
  }

  // Armor properties
  const armor = entity.armor as {
    damageReduction: number;
    properties: string[];
  };
  if (armor) {
    lines.push("");
    lines.push(`${h}# Armor`);
    lines.push(`**Damage Reduction:** ${armor.damageReduction}`);
    if (armor.properties?.length) {
      lines.push(`**Properties:** ${armor.properties.join(", ")}`);
    }
  }

  // Consumable properties
  const consumable = entity.consumable as {
    uses: number;
    effect: string;
    effectDescription: string;
  };
  if (consumable) {
    lines.push("");
    lines.push(`${h}# Consumable`);
    lines.push(`**Uses:** ${consumable.uses}`);
    lines.push(`**Effect:** ${consumable.effect}`);
    if (consumable.effectDescription) {
      lines.push(consumable.effectDescription);
    }
  }

  // Flavor
  if (template === "full") {
    const flavor = entity.flavor as string;
    if (flavor) {
      lines.push("");
      lines.push(`*${flavor}*`);
    }
  }

  return lines.join("\n");
}

/**
 * Format encounter entity
 */
function formatEncounter(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string,
  references?: Record<string, LookupResult[]>
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const type = entity.type as string;
  const description = entity.description as string;
  const text = entity.text as string;

  lines.push(`${h} ${name}`);
  lines.push(`**Type:** ${type}`);
  lines.push("");
  lines.push(description);

  if (text) {
    lines.push("");
    lines.push(`*${text}*`);
  }

  if (template === "reference") {
    return lines.join("\n");
  }

  // Combat setup
  const combat = entity.combat as {
    monsters: Array<{ monsterId: string; count: number | string }>;
    environment?: { hazards: string[] };
  };
  if (combat) {
    lines.push("");
    lines.push(`${h}# Combat`);

    if (references?.monsters) {
      for (let i = 0; i < references.monsters.length; i++) {
        const ref = references.monsters[i];
        const count = combat.monsters[i]?.count ?? 1;
        if (ref.found) {
          const refEntity = ref.entity as Record<string, unknown>;
          lines.push(`- ${count}x **${refEntity.name}** (${refEntity.threat})`);
        } else {
          lines.push(`- ${count}x ${combat.monsters[i]?.monsterId} (not found)`);
        }
      }
    } else {
      for (const m of combat.monsters) {
        lines.push(`- ${m.count}x ${m.monsterId}`);
      }
    }

    if (combat.environment?.hazards?.length) {
      lines.push("");
      lines.push("**Hazards:**");
      for (const hazard of combat.environment.hazards) {
        lines.push(`- ${hazard}`);
      }
    }
  }

  // Social setup
  const social = entity.social as {
    npcIds: string[];
    initialAttitude: string;
    negotiable: boolean;
  };
  if (social) {
    lines.push("");
    lines.push(`${h}# Social`);
    lines.push(`**Initial Attitude:** ${social.initialAttitude}`);
    lines.push(`**Negotiable:** ${social.negotiable ? "Yes" : "No"}`);

    if (references?.npcs) {
      lines.push("");
      lines.push("**NPCs:**");
      for (const ref of references.npcs) {
        if (ref.found) {
          const refEntity = ref.entity as Record<string, unknown>;
          lines.push(`- **${refEntity.name}** (${refEntity.attitude})`);
        } else {
          lines.push(`- ${ref.id} (not found)`);
        }
      }
    } else if (social.npcIds?.length) {
      lines.push(`**NPCs:** ${social.npcIds.join(", ")}`);
    }
  }

  // Outcomes
  const outcomes = entity.outcomes as string[];
  if (outcomes?.length) {
    lines.push("");
    lines.push(`${h}# Possible Outcomes`);
    for (const outcome of outcomes) {
      lines.push(`- ${outcome}`);
    }
  }

  // GM Guidance
  if (accessLevel === "gm") {
    const gmGuidance = entity.gmGuidance as string;
    if (gmGuidance) {
      lines.push("");
      lines.push(`${h}# GM Guidance`);
      lines.push(gmGuidance);
    }
  }

  return lines.join("\n");
}

/**
 * Format condition entity
 */
function formatCondition(
  entity: Record<string, unknown>,
  template: TemplateType,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const description = entity.description as string;
  const duration = entity.duration as string | number;

  lines.push(`${h} ${name}`);
  lines.push(`**Duration:** ${duration}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Effects
  const effects = entity.effects as Array<{ type: string; [key: string]: unknown }>;
  if (effects?.length) {
    lines.push("");
    lines.push(`${h}# Effects`);
    for (const effect of effects) {
      lines.push(`- **${effect.type}**: ${JSON.stringify(effect)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format faction entity
 */
function formatFaction(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const description = entity.description as string;

  lines.push(`${h} ${name}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Goals
  const goals = entity.goals as string[];
  if (goals?.length) {
    lines.push("");
    lines.push(`${h}# Goals`);
    for (const goal of goals) {
      lines.push(`- ${goal}`);
    }
  }

  // Resources
  const resources = entity.resources as string[];
  if (resources?.length) {
    lines.push("");
    lines.push(`${h}# Resources`);
    for (const resource of resources) {
      lines.push(`- ${resource}`);
    }
  }

  // GM-only: Secrets
  if (accessLevel === "gm" && template === "full") {
    const secrets = entity.secrets as string[];
    if (secrets?.length) {
      lines.push("");
      lines.push(`${h}# Secrets (GM Only)`);
      for (const secret of secrets) {
        lines.push(`- ${secret}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format arc entity
 */
function formatArc(
  entity: Record<string, unknown>,
  template: TemplateType,
  accessLevel: AccessLevel,
  h: string
): string {
  const lines: string[] = [];
  const name = entity.name as string;
  const description = entity.description as string;

  lines.push(`${h} ${name}`);
  lines.push("");
  lines.push(description);

  if (template === "reference") {
    return lines.join("\n");
  }

  // Structure
  const structure = entity.structure as { phases: Array<{ name: string; description: string }> };
  if (structure?.phases?.length) {
    lines.push("");
    lines.push(`${h}# Phases`);
    for (const phase of structure.phases) {
      lines.push(`- **${phase.name}:** ${phase.description}`);
    }
  }

  // Themes
  const themes = entity.themes as string[];
  if (themes?.length) {
    lines.push("");
    lines.push(`${h}# Themes`);
    lines.push(themes.join(", "));
  }

  // GM-only content
  if (accessLevel === "gm" && template === "full") {
    // Situations
    const situationIds = entity.situationIds as string[];
    if (situationIds?.length) {
      lines.push("");
      lines.push(`${h}# Situations`);
      lines.push(situationIds.join(", "));
    }
  }

  return lines.join("\n");
}

/**
 * Generic entity formatter
 */
function formatGeneric(entity: Record<string, unknown>, type: LookupEntityType, h: string): string {
  const lines: string[] = [];
  const name = (entity.name as string) ?? type;
  const description = entity.description as string;

  lines.push(`${h} ${name}`);
  if (description) {
    lines.push("");
    lines.push(description);
  }

  return lines.join("\n");
}

/**
 * Format multiple lookup results as a combined document
 */
export function formatMultipleEntities(
  results: LookupResult[],
  options: FormatOptions = {}
): string {
  const sections = results.map((result) => formatEntityAsMarkdown(result, options));
  return sections.join("\n\n---\n\n");
}
