// TEMPORARY one-time cleanup — removes the test subscriber record. Delete after use.
import { getStore } from "@netlify/blobs";

export async function handler() {
  const store = getStore("subscribers");
  const key = "billymitchell58@gmail.com";
  let existed = false;
  try { existed = !!(await store.get(key, { type: "json" })); } catch (e) {}
  await store.delete(key);
  const { blobs } = await store.list();
  return { statusCode: 200, body: `Deleted "${key}" (existed: ${existed}). Remaining subscribers: ${blobs.length}` };
}
