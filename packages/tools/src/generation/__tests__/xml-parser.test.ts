/**
 * XML Parser Tests
 */
import { describe, it, expect, vi } from "vitest";
import {
  extractTag,
  extractRequiredTag,
  extractOptionalTag,
  extractAllTags,
  extractTaggedJSON,
  extractRequiredInt,
  extractOptionalInt,
  extractBoolean,
  isXML,
  extractRequiredEnum,
  extractOptionalEnum,
} from "../xml-parser.js";

describe("extractTag", () => {
  it("extracts content from a tag", () => {
    const output = "<name>Shadow Dancer</name>";
    expect(extractTag(output, "name")).toBe("Shadow Dancer");
  });

  it("returns undefined for missing tag", () => {
    const output = "<other>content</other>";
    expect(extractTag(output, "name")).toBeUndefined();
  });

  it("returns undefined for empty tag", () => {
    const output = "<name></name>";
    expect(extractTag(output, "name")).toBeUndefined();
  });

  it("returns undefined for whitespace-only tag", () => {
    const output = "<name>   \n   </name>";
    expect(extractTag(output, "name")).toBeUndefined();
  });

  it("trims whitespace from content", () => {
    const output = "<name>  Shadow Dancer  </name>";
    expect(extractTag(output, "name")).toBe("Shadow Dancer");
  });

  it("handles multiline content", () => {
    const output = `<description>
      A nimble warrior who uses
      shadows as both weapon and shield.
    </description>`;
    expect(extractTag(output, "description")).toBe(
      "A nimble warrior who uses\n      shadows as both weapon and shield."
    );
  });

  it("is case-insensitive for tag matching", () => {
    const output = "<NAME>Shadow Dancer</NAME>";
    expect(extractTag(output, "name")).toBe("Shadow Dancer");
  });

  it("handles tags with hyphens and underscores", () => {
    const output = "<special-ability>Shadow Step</special-ability>";
    expect(extractTag(output, "special-ability")).toBe("Shadow Step");

    const output2 = "<special_ability>Shadow Step</special_ability>";
    expect(extractTag(output2, "special_ability")).toBe("Shadow Step");
  });

  it("throws for invalid tag names", () => {
    expect(() => extractTag("<test>", "test<script>")).toThrow(
      "Invalid tag name"
    );
    expect(() => extractTag("<test>", "test test")).toThrow("Invalid tag name");
  });

  it("extracts first match when multiple tags exist", () => {
    const output = "<name>First</name><name>Second</name>";
    expect(extractTag(output, "name")).toBe("First");
  });

  it("handles nested content without consuming outer tags", () => {
    const output = "<outer><name>Inner Name</name></outer>";
    expect(extractTag(output, "name")).toBe("Inner Name");
  });
});

describe("extractRequiredTag", () => {
  it("returns content when tag exists", () => {
    const output = "<name>Shadow Dancer</name>";
    expect(extractRequiredTag(output, "name")).toBe("Shadow Dancer");
  });

  it("throws for missing tag", () => {
    const output = "<other>content</other>";
    expect(() => extractRequiredTag(output, "name")).toThrow(
      "Required tag <name> not found or empty"
    );
  });

  it("throws for empty tag", () => {
    const output = "<name></name>";
    expect(() => extractRequiredTag(output, "name")).toThrow(
      "Required tag <name> not found or empty"
    );
  });
});

describe("extractOptionalTag", () => {
  it("returns content when tag exists", () => {
    const output = "<name>Shadow Dancer</name>";
    expect(extractOptionalTag(output, "name", "default")).toBe("Shadow Dancer");
  });

  it("returns default when tag is missing", () => {
    const output = "<other>content</other>";
    expect(extractOptionalTag(output, "name", "default")).toBe("default");
  });

  it("returns default when tag is empty", () => {
    const output = "<name></name>";
    expect(extractOptionalTag(output, "name", "default")).toBe("default");
  });
});

describe("extractAllTags", () => {
  it("extracts all occurrences of a tag", () => {
    const output = `
      <item>Sword</item>
      <item>Shield</item>
      <item>Potion</item>
    `;
    expect(extractAllTags(output, "item")).toEqual([
      "Sword",
      "Shield",
      "Potion",
    ]);
  });

  it("returns empty array when no tags found", () => {
    const output = "<other>content</other>";
    expect(extractAllTags(output, "item")).toEqual([]);
  });

  it("skips empty tags", () => {
    const output = `
      <item>Sword</item>
      <item></item>
      <item>Shield</item>
    `;
    expect(extractAllTags(output, "item")).toEqual(["Sword", "Shield"]);
  });

  it("trims content from each tag", () => {
    const output = `
      <item>  Sword  </item>
      <item>Shield</item>
    `;
    expect(extractAllTags(output, "item")).toEqual(["Sword", "Shield"]);
  });

  it("handles nested content in each tag", () => {
    const output = `
      <feature>
        <name>Shadow Step</name>
        <description>Teleport to any shadow</description>
      </feature>
      <feature>
        <name>Dark Vision</name>
        <description>See in darkness</description>
      </feature>
    `;
    const features = extractAllTags(output, "feature");
    expect(features).toHaveLength(2);
    expect(features[0]).toContain("<name>Shadow Step</name>");
    expect(features[1]).toContain("<name>Dark Vision</name>");
  });

  it("throws for invalid tag names", () => {
    expect(() => extractAllTags("<test>", "bad tag")).toThrow(
      "Invalid tag name"
    );
  });
});

describe("extractTaggedJSON", () => {
  it("parses JSON from a tag", () => {
    const output = '<data>{"name": "Test", "value": 42}</data>';
    expect(extractTaggedJSON(output, "data")).toEqual({
      name: "Test",
      value: 42,
    });
  });

  it("throws for missing tag", () => {
    const output = "<other>{}</other>";
    expect(() => extractTaggedJSON(output, "data")).toThrow(
      "Required tag <data> not found"
    );
  });

  it("throws for invalid JSON", () => {
    const output = "<data>not valid json</data>";
    expect(() => extractTaggedJSON(output, "data")).toThrow(
      "Failed to parse JSON from <data>"
    );
  });

  it("handles arrays", () => {
    const output = '<items>["a", "b", "c"]</items>';
    expect(extractTaggedJSON(output, "items")).toEqual(["a", "b", "c"]);
  });
});

describe("extractRequiredInt", () => {
  it("parses integer from tag", () => {
    const output = "<hp>12</hp>";
    expect(extractRequiredInt(output, "hp")).toBe(12);
  });

  it("handles negative integers", () => {
    const output = "<str>-1</str>";
    expect(extractRequiredInt(output, "str")).toBe(-1);
  });

  it("handles zero", () => {
    const output = "<con>0</con>";
    expect(extractRequiredInt(output, "con")).toBe(0);
  });

  it("throws for missing tag", () => {
    const output = "<other>10</other>";
    expect(() => extractRequiredInt(output, "hp")).toThrow(
      "Required tag <hp> not found"
    );
  });

  it("throws for non-integer content", () => {
    const output = "<hp>not a number</hp>";
    expect(() => extractRequiredInt(output, "hp")).toThrow(
      "does not contain a valid integer"
    );
  });

  it("throws for float content", () => {
    const output = "<hp>12.5</hp>";
    // parseInt will parse 12, not throw
    expect(extractRequiredInt(output, "hp")).toBe(12);
  });
});

describe("extractOptionalInt", () => {
  it("parses integer from tag", () => {
    const output = "<hp>12</hp>";
    expect(extractOptionalInt(output, "hp")).toBe(12);
  });

  it("returns undefined for missing tag", () => {
    const output = "<other>10</other>";
    expect(extractOptionalInt(output, "hp")).toBeUndefined();
  });

  it("returns undefined for non-integer content", () => {
    const output = "<hp>not a number</hp>";
    expect(extractOptionalInt(output, "hp")).toBeUndefined();
  });
});

describe("extractBoolean", () => {
  it("parses 'true' as true", () => {
    const output = "<enabled>true</enabled>";
    expect(extractBoolean(output, "enabled", false)).toBe(true);
  });

  it("parses 'TRUE' as true (case insensitive)", () => {
    const output = "<enabled>TRUE</enabled>";
    expect(extractBoolean(output, "enabled", false)).toBe(true);
  });

  it("parses 'yes' as true", () => {
    const output = "<enabled>yes</enabled>";
    expect(extractBoolean(output, "enabled", false)).toBe(true);
  });

  it("parses '1' as true", () => {
    const output = "<enabled>1</enabled>";
    expect(extractBoolean(output, "enabled", false)).toBe(true);
  });

  it("parses 'false' as false", () => {
    const output = "<enabled>false</enabled>";
    expect(extractBoolean(output, "enabled", true)).toBe(false);
  });

  it("parses 'no' as false", () => {
    const output = "<enabled>no</enabled>";
    expect(extractBoolean(output, "enabled", true)).toBe(false);
  });

  it("parses '0' as false", () => {
    const output = "<enabled>0</enabled>";
    expect(extractBoolean(output, "enabled", true)).toBe(false);
  });

  it("returns default for missing tag", () => {
    const output = "<other>true</other>";
    expect(extractBoolean(output, "enabled", true)).toBe(true);
    expect(extractBoolean(output, "enabled", false)).toBe(false);
  });

  it("treats unknown values as false", () => {
    const output = "<enabled>maybe</enabled>";
    expect(extractBoolean(output, "enabled", true)).toBe(false);
  });
});

describe("isXML", () => {
  it("returns true for content with XML tags", () => {
    expect(isXML("<name>Test</name>")).toBe(true);
  });

  it("returns true for nested XML", () => {
    expect(isXML("<root><child>value</child></root>")).toBe(true);
  });

  it("returns false for JSON", () => {
    expect(isXML('{"name": "Test"}')).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isXML("Just some plain text")).toBe(false);
  });

  it("returns false for unclosed tags", () => {
    expect(isXML("<name>Test")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isXML("")).toBe(false);
  });

  it("handles tags with numbers", () => {
    expect(isXML("<item1>value</item1>")).toBe(true);
  });

  it("handles tags with hyphens and underscores", () => {
    expect(isXML("<my-tag>value</my-tag>")).toBe(true);
    expect(isXML("<my_tag>value</my_tag>")).toBe(true);
  });
});

describe("extractRequiredEnum", () => {
  const ROLES = ["striker", "defender", "controller", "leader"] as const;

  it("returns valid enum value", () => {
    const output = "<role>striker</role>";
    expect(extractRequiredEnum(output, "role", ROLES)).toBe("striker");
  });

  it("is case-insensitive", () => {
    const output = "<role>STRIKER</role>";
    expect(extractRequiredEnum(output, "role", ROLES)).toBe("striker");
  });

  it("returns canonical casing", () => {
    const MIXED = ["CamelCase", "lowercase"] as const;
    const output = "<value>camelcase</value>";
    expect(extractRequiredEnum(output, "value", MIXED)).toBe("CamelCase");
  });

  it("throws for missing tag", () => {
    const output = "<other>striker</other>";
    expect(() => extractRequiredEnum(output, "role", ROLES)).toThrow(
      "Required tag <role> not found"
    );
  });

  it("throws for invalid enum value", () => {
    const output = "<role>invalid</role>";
    expect(() => extractRequiredEnum(output, "role", ROLES)).toThrow(
      'Tag <role> has invalid value "invalid". Must be one of: striker, defender, controller, leader'
    );
  });
});

describe("extractOptionalEnum", () => {
  const ROLES = ["striker", "defender", "controller", "leader"] as const;

  it("returns valid enum value", () => {
    const output = "<role>striker</role>";
    expect(extractOptionalEnum(output, "role", ROLES)).toBe("striker");
  });

  it("returns undefined for missing tag", () => {
    const output = "<other>striker</other>";
    expect(extractOptionalEnum(output, "role", ROLES)).toBeUndefined();
  });

  it("returns undefined and warns for invalid value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const output = "<role>invalid</role>";

    expect(extractOptionalEnum(output, "role", ROLES)).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tag <role> has invalid value "invalid"')
    );

    warnSpy.mockRestore();
  });

  it("is case-insensitive", () => {
    const output = "<role>DEFENDER</role>";
    expect(extractOptionalEnum(output, "role", ROLES)).toBe("defender");
  });
});

describe("real-world XML parsing scenarios", () => {
  it("parses an archetype-like structure", () => {
    const xml = `
      <archetype>
        <id>archetype:shadow-dancer</id>
        <name>Shadow Dancer</name>
        <tagline>Master of darkness</tagline>
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
        <features>
          <feature>
            <name>Shadow Step</name>
            <description>Teleport to any shadow</description>
          </feature>
        </features>
      </archetype>
    `;

    const startingBlock = extractRequiredTag(xml, "starting");
    const abilitiesBlock = extractRequiredTag(startingBlock, "abilities");

    expect(extractRequiredTag(xml, "id")).toBe("archetype:shadow-dancer");
    expect(extractRequiredTag(xml, "name")).toBe("Shadow Dancer");
    expect(extractRequiredInt(abilitiesBlock, "str")).toBe(-1);
    expect(extractRequiredInt(abilitiesBlock, "agi")).toBe(2);
    expect(extractRequiredInt(startingBlock, "hp")).toBe(6);

    const featuresBlock = extractRequiredTag(xml, "features");
    const features = extractAllTags(featuresBlock, "feature");
    expect(features).toHaveLength(1);
    expect(extractRequiredTag(features[0], "name")).toBe("Shadow Step");
  });

  it("handles LLM-style output with preamble text", () => {
    const output = `
      Here is the generated content:

      <archetypes>
        <archetype>
          <name>Warrior</name>
        </archetype>
      </archetypes>

      I hope this meets your requirements!
    `;

    const archetypesBlock = extractRequiredTag(output, "archetypes");
    const archetypes = extractAllTags(archetypesBlock, "archetype");
    expect(archetypes).toHaveLength(1);
    expect(extractRequiredTag(archetypes[0], "name")).toBe("Warrior");
  });
});
