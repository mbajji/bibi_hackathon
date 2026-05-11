import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export function WorkspaceProvider({ children }) {
  const { session, user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [discordLink, setDiscordLink] = useState(null);
  const [loading, setLoading] = useState(true);

  const authHeaders = useCallback(() => (
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  ), [session?.access_token]);

  const refreshLink = useCallback(async (workspaceId) => {
    const id = workspaceId || workspace?.id;
    if (!id) return;
    const res = await fetch(`${BACKEND_URL}/api/discord/link/status?workspaceId=${id}`, {
      headers: authHeaders(),
    }).catch(() => null);
    if (!res) return;
    const data = await res.json();
    setDiscordLink(data.link || null);
  }, [authHeaders, workspace?.id]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function init() {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/workspace/ensure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ name: 'My Restaurant' }),
        });
        const data = await res.json();
        if (data.workspace) {
          setWorkspace(data.workspace);
          // Fetch active discord link
          const linkRes = await fetch(`${BACKEND_URL}/api/discord/link/status?workspaceId=${data.workspace.id}`, {
            headers: authHeaders(),
          }).catch(() => null);
          if (linkRes) {
            const linkData = await linkRes.json();
            setDiscordLink(linkData.link || null);
          }
        }
      } catch (err) {
        console.error('Workspace init failed:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [authHeaders, user]);

  async function linkDiscord({ guildId, guildName, channelId, channelName, linkMethod }) {
    const res = await fetch(`${BACKEND_URL}/api/discord/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ workspaceId: workspace.id, guildId, guildName, channelId, channelName, linkMethod }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Link failed');
    setDiscordLink(data.link);
    return data.link;
  }

  async function unlinkDiscord() {
    await fetch(`${BACKEND_URL}/api/discord/link`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    setDiscordLink(null);
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, discordLink, loading, refreshLink, linkDiscord, unlinkDiscord }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
