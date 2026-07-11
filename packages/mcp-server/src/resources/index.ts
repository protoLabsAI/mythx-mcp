/**
 * MCP Resource handlers
 */

import { sessionManager, listSessions } from "../state/manager.js";
import { worldPackManager, listWorldPacks } from "../state/worldpacks.js";
import type { ResourceHandler } from "../server.js";

/**
 * Create resource handler for session data
 */
export function createResourceHandler(): ResourceHandler {
  return {
    async list() {
      const sessionIds = await listSessions();
      const resources: Array<{ uri: string; name: string; mimeType?: string }> = [];

      // Add sessions list resource
      resources.push({
        uri: "rpg://sessions",
        name: "All Sessions",
        mimeType: "application/json",
      });

      // Add world packs list resource
      resources.push({
        uri: "rpg://worlds",
        name: "All World Packs",
        mimeType: "application/json",
      });

      // Add individual world pack resources
      const packIds = await listWorldPacks();
      for (const packId of packIds) {
        const pack = await worldPackManager.get(packId);
        if (pack) {
          resources.push({
            uri: `rpg://worlds/${packId}`,
            name: pack.meta.name,
            mimeType: "application/json",
          });
        }
      }

      // Add individual session resources
      for (const id of sessionIds) {
        const session = await sessionManager.get(id);
        if (session) {
          resources.push({
            uri: `rpg://session/${id}`,
            name: session.metadata.name,
            mimeType: "application/json",
          });

          // Add character resources for this session
          for (const [charId, char] of Object.entries(session.characters)) {
            resources.push({
              uri: `rpg://session/${id}/character/${charId}`,
              name: `${char.name} (${session.metadata.name})`,
              mimeType: "application/json",
            });
          }

          // Add generation resource if generation session exists
          if (session.generation) {
            resources.push({
              uri: `rpg://generation/${id}`,
              name: `Generation State (${session.metadata.name})`,
              mimeType: "application/json",
            });
          }
        }
      }

      return resources;
    },

    async read(uri: string) {
      const url = new URL(uri);

      if (url.protocol !== "rpg:") {
        throw new Error(`Unknown protocol: ${url.protocol}`);
      }

      const path = url.pathname.replace(/^\/\//, "");
      const parts = path.split("/");

      // rpg://sessions
      if (path === "sessions") {
        const sessionIds = await listSessions();
        const sessions = await Promise.all(
          sessionIds.map(async (id) => {
            const session = await sessionManager.get(id);
            return session
              ? {
                  id: session.metadata.id,
                  name: session.metadata.name,
                  createdAt: session.metadata.createdAt,
                  characterCount: Object.keys(session.characters).length,
                }
              : null;
          })
        );

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ sessions: sessions.filter(Boolean) }, null, 2),
            },
          ],
        };
      }

      // rpg://session/:id
      if (parts[0] === "session" && parts.length === 2) {
        const sessionId = parts[1];
        const session = await sessionManager.get(sessionId);

        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(session, null, 2),
            },
          ],
        };
      }

      // rpg://session/:id/character/:charId
      if (parts[0] === "session" && parts[2] === "character" && parts.length === 4) {
        const sessionId = parts[1];
        const characterId = parts[3];

        const session = await sessionManager.get(sessionId);
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        const character = session.characters[characterId];
        if (!character) {
          throw new Error(`Character not found: ${characterId}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(character, null, 2),
            },
          ],
        };
      }

      // rpg://generation/:sessionId
      if (parts[0] === "generation" && parts.length === 2) {
        const sessionId = parts[1];
        const session = await sessionManager.get(sessionId);

        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        if (!session.generation) {
          throw new Error(`No generation state for session: ${sessionId}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(session.generation, null, 2),
            },
          ],
        };
      }

      // rpg://worlds
      if (path === "worlds") {
        const packIds = await listWorldPacks();
        const packs = await Promise.all(
          packIds.map(async (id) => {
            const pack = await worldPackManager.get(id);
            return pack
              ? {
                  id: pack.meta.id,
                  name: pack.meta.name,
                  tagline: pack.meta.tagline,
                  contentCounts: pack.meta.contentCounts,
                }
              : null;
          })
        );

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ worlds: packs.filter(Boolean) }, null, 2),
            },
          ],
        };
      }

      // rpg://worlds/:packId
      if (parts[0] === "worlds" && parts.length === 2) {
        const packId = parts[1];
        const pack = await worldPackManager.get(packId);

        if (!pack) {
          throw new Error(`World pack not found: ${packId}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(pack, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    },
  };
}
