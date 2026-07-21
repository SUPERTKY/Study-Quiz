import { SessionDurableObject } from "../functions/api/session.js";

export { SessionDurableObject };

// Cloudflare Pages calls the Durable Object class configured on the Pages
// binding. Keep `MyDurableObject` as the primary class because many dashboard
// bindings created from the starter template use that entrypoint name.
export class MyDurableObject {
  constructor(state, env) {
    this.sessionDurableObject = new SessionDurableObject(state, env);
  }

  async fetch(request) {
    return this.sessionDurableObject.fetch(request);
  }
}

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
