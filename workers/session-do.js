export { SessionDurableObject } from "../functions/api/session.js";

export default {
  async fetch() {
    return new Response("School RPG session Durable Object worker is running.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
