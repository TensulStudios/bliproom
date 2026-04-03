export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("ID");
  const name = searchParams.get("Name");
  const author = searchParams.get("Author");
  const roomStore = searchParams.get("RoomStore");

  if (!id && !name) {
    return new Response(JSON.stringify({ error: "Provide at least one query: ID or Name" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const readRes = await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/item/rooms`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
  });

  const rooms = readRes.ok ? ((await readRes.json()).value ?? {}) : {};

  // Create or override the room
  const roomKey = id || name; // Use ID if available, otherwise use name
  const newRoom = {
    id: id || roomKey,
    name: name || roomKey,
    author: author || "Unknown",
    roomStore: roomStore || "default",
    createdAt: new Date().toISOString(),
  };

  rooms[roomKey] = newRoom;

  // Write back to Edge Config
  const writeRes = await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/item/rooms`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    body: JSON.stringify({ value: rooms }),
  });

  if (!writeRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to create room" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ room: newRoom, success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
