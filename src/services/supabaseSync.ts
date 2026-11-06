const CLOUD_CONFIG_KEY = 'dulce_control_supabase_config';

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
}

export const SUPABASE_SETUP_SQL = `create table if not exists public.dulce_control_store (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.dulce_control_store enable row level security;
drop policy if exists "Permitir acceso completo a la app DulceControl" on public.dulce_control_store;
create policy "Permitir acceso completo a la app DulceControl"
  on public.dulce_control_store for all using (true) with check (true);`;

export function getSupabaseConfig(): SupabaseConnectionConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseConnectionConfig>;
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url.trim().replace(/\/$/, ''),
          anonKey: parsed.anonKey.trim(),
        };
      }
    }
  } catch {
    // ignore storage read error
  }

  if (envUrl && envKey) {
    return {
      url: envUrl.trim().replace(/\/$/, ''),
      anonKey: envKey.trim(),
    };
  }

  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = anonKey.trim();
  if (!cleanUrl || !cleanKey) {
    localStorage.removeItem(CLOUD_CONFIG_KEY);
    return;
  }
  localStorage.setItem(
    CLOUD_CONFIG_KEY,
    JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
  );
}

export async function fetchCloudState<T>(): Promise<{
  ok: boolean;
  state?: T;
  updatedAt?: string;
  error?: string;
}> {
  const cfg = getSupabaseConfig();
  if (!cfg) return { ok: false, error: 'Sin configuración de nube' };

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/dulce_control_store?id=eq.main&select=state,updated_at`,
      {
        method: 'GET',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const rows = (await res.json()) as Array<{ state: T; updated_at: string }>;
    if (rows && rows.length > 0 && rows[0].state) {
      return {
        ok: true,
        state: rows[0].state,
        updatedAt: rows[0].updated_at,
      };
    }

    return { ok: true, state: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red al conectar con Supabase',
    };
  }
}

export async function pushCloudState<T>(state: T): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cfg = getSupabaseConfig();
  if (!cfg) return { ok: false, error: 'Sin configuración de nube' };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/dulce_control_store`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 'main',
        state,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red al guardar en Supabase',
    };
  }
}
