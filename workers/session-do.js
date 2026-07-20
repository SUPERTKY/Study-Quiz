import { SessionDurableObject } from "../functions/api/session.js";

export { SessionDurableObject };

// Cloudflare's Durable Object starter/template exports a class named
// `MyDurableObject`. Some existing Pages bindings can still point at that
// entrypoint, so keep this compatibility alias to prevent runtime exceptions
// after connecting the namespace from the dashboard.
export class MyDurableObject extends SessionDurableObject {}

export default {
  async fetch(request, env) {
    const namespace = env.GAME_SESSION_DO;
    if (namespace && typeof namespace.idFromName === "function" && typeof namespace.get === "function") {
      const id = namespace.idFromName("school-rpg-session");
      return namespace.get(id).fetch(request);
    }

    return new Response("School RPG session Durable Object worker is running.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
