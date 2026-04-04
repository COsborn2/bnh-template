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

export function removeClient(client: WsClient): void {
  const topics = clientTopics.get(client);
  if (!topics) return;

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
}

export function getTopicClients(topic: string): Set<WsClient> | undefined {
  return topicClients.get(topic);
}
