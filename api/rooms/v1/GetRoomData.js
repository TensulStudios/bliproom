import { createClient } from "@vercel/edge-config";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("ID");
  const name = searchParams.get("Name");

  if (!id && !name) {
    return new Response(JSON.stringify({ error: "Provide at least one query: ID or Name" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const edgeConfig = createClient(process.env["bliproom-token"]);

  let rooms;
  try {
    rooms = (await edgeConfig.get("rooms")) ?? {};
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read Edge Config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let room = null;

  if (id) {
    room = rooms[id] ?? null;
  } else {
    room = Object.values(rooms).find(
      (r) => r.name?.toLowerCase() === name.toLowerCase()
    ) ?? null;
  }

  if (!room) {
    return new Response(JSON.stringify({ error: "Room not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ room }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
