/**
 * Хранилище для истории цен и подписок на уведомления.
 *
 * Если заданы UPSTASH_REDIS_REST_URL/TOKEN — пишем в Upstash Redis.
 * Если нет — работает in-memory заглушка: сайт полностью функционален,
 * но история цен не переживает перезапуск (на Vercel — почти каждый запрос).
 * Это осознанный компромисс: каталог DLC и фильтры не должны требовать базы.
 */

export interface Kv {
  readonly persistent: boolean;
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

type Command = (string | number)[];

class UpstashKv implements Kv {
  readonly persistent = true;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async run<T>(command: Command): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Upstash ответил ${response.status}`);
    }
    const body = (await response.json()) as { result?: T; error?: string };
    if (body.error) throw new Error(`Upstash: ${body.error}`);
    return body.result as T;
  }

  private async pipeline<T>(commands: Command[]): Promise<T[]> {
    if (commands.length === 0) return [];
    const response = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Upstash ответил ${response.status}`);
    const body = (await response.json()) as Array<{ result?: T; error?: string }>;
    return body.map((entry) => entry.result as T);
  }

  get(key: string): Promise<string | null> {
    return this.run<string | null>(["GET", key]);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.run<(string | null)[]>(["MGET", ...keys]);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.run(ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]);
  }

  async del(key: string): Promise<void> {
    await this.run(["DEL", key]);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.run(["SADD", key, member]);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.run(["SREM", key, member]);
  }

  async smembers(key: string): Promise<string[]> {
    return (await this.run<string[] | null>(["SMEMBERS", key])) ?? [];
  }
}

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

class MemoryKv implements Kv {
  readonly persistent = false;
  private readonly values = new Map<string, MemoryEntry>();
  private readonly sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  async sadd(key: string, member: string): Promise<void> {
    const set = this.sets.get(key) ?? new Set<string>();
    set.add(member);
    this.sets.set(key, set);
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }
}

let instance: Kv | null = null;

export function kv(): Kv {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  instance = url && token ? new UpstashKv(url, token) : new MemoryKv();
  return instance;
}

export function kvIsPersistent(): boolean {
  return kv().persistent;
}
