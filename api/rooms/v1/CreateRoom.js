import { createClient } from "@vercel/edge-config";

export const config = { runtime: "edge" };

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("Name");
  const id = searchParams.get("ID");
  const author = searchParams.get("Author");
  const roomStore = searchParams.get("RoomStore");

  if (!name || !id || !author || !roomStore) {
    return new Response(JSON.stringify({ error: "Missing required query parameters: Name, ID, Author, RoomStore" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!/^\d{9}$/.test(id)) {
    return new Response(JSON.stringify({ error: "ID must be exactly 9 digits" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const bucket = rateLimitMap.get(ip) ?? { count: 0, start: now };

  if (now - bucket.start > RATE_LIMIT_WINDOW) {
    bucket.count = 0;
    bucket.start = now;
  }

  bucket.count++;
  rateLimitMap.set(ip, bucket);

  if (bucket.count > RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "invalid", reason: "ratelimited" }), {
      status: 429,
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

  const nameLower = name.toLowerCase();
  const alreadyExists = Object.values(rooms).some(
    (room) => room.name?.toLowerCase() === nameLower
  );

  if (alreadyExists) {
    return new Response(JSON.stringify({ error: "invalid", reason: "room name already exists" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  rooms[id] = {
    name,
    id,
    author,
    roomStore,
    createdAt: new Date().toISOString(),
  };

  try {
    await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: "rooms", value: rooms }],
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to write to Edge Config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, room: rooms[id] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
