import type { ServerWebSocket } from "bun";
import type { WsData } from "./protocol.js";

export type WsClient = ServerWebSocket<WsData>;

/** topic → set of connected clients */
const topicClients = new Map<string, Set<WsClient>>();

/** client → set of subscribed topics (for cleanup on disconnect) */
const clientTopics = new Map<WsClient, Set<string>>();

export interface TopicCallbacks {
  onFirstSubscribe: (topic: string) => void;
  onLastUnsubscribe: (topic: string) => void;
}

let callbacks: TopicCallbacks = {
  onFirstSubscribe: () => {},
  onLastUnsubscribe: () => {},
};

export function initTopics(cb: TopicCallbacks): void {
  callbacks = cb;
}

const MAX_SUBSCRIPTIONS_PER_CLIENT = 50;

export function subscribe(client: WsClient, topic: string): boolean {
  // Refuse sockets that are no longer open (readyState 1). A socket that
  // closes while a caller is suspended at an await has already had its close
  // handler (removeClient) run — adding it now would create a ghost
  // subscriber that no future close event will ever clean up.
  if (client.readyState !== 1) return false;

  const existing = clientTopics.get(client);
  if (existing && existing.size >= MAX_SUBSCRIPTIONS_PER_CLIENT && !existing.has(topic)) {
    return false;
  }

  let clients = topicClients.get(topic);
  if (!clients) {
    clients = new Set();
    topicClients.set(topic, clients);
    callbacks.onFirstSubscribe(topic);
  }
  clients.add(client);

  let topics = existing;
  if (!topics) {
    topics = new Set();
    clientTopics.set(client, topics);
  }
  topics.add(topic);
  return true;
}

export function unsubscribe(client: WsClient, topic: string): void {
  const clients = topicClients.get(topic);
  if (!clients) return;

  clients.delete(client);
  if (clients.size === 0) {
    topicClients.delete(topic);
    callbacks.onLastUnsubscribe(topic);
  }

  const topics = clientTopics.get(client);
  if (topics) {
    topics.delete(topic);
    if (topics.size === 0) {
      clientTopics.delete(client);
    }
  }
}

/** Removes the client from every topic. Returns the topics it was subscribed
 *  to so callers can follow up per topic (e.g. re-broadcast presence). */
export function removeClient(client: WsClient): string[] {
  const topics = clientTopics.get(client);
  if (!topics) return [];

  for (const topic of topics) {
    const clients = topicClients.get(topic);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        topicClients.delete(topic);
        callbacks.onLastUnsubscribe(topic);
      }
    }
  }
  clientTopics.delete(client);
  return [...topics];
}

export function getTopicClients(topic: string): Set<WsClient> | undefined {
  return topicClients.get(topic);
}

/** Topics with at least one locally connected subscriber. */
export function getActiveTopics(): string[] {
  return [...topicClients.keys()];
}
