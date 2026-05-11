import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

const WorkspaceContext = createContext(null);

const BACKEND_URL = 'http://localhost:3001';

export function WorkspaceProvider({ children }) {
  const { user } = useUser();
  const [workspace, setWorkspace] = useState(null);
  const [discordLink, setDiscordLink] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshLink = useCallback(async (workspaceId) => {
    const id = workspaceId || workspace?.id;
    if (!id) return;
    const res = await fetch(`${BACKEND_URL}/api/discord/link/status?workspaceId=${id}`).catch(() => null);
    if (!res) return;
    const data = await res.json();
    setDiscordLink(data.link || null);
  }, [workspace?.id]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function init() {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/workspace/ensure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, name: 'My Restaurant' }),
        });
        const data = await res.json();
        if (data.workspace) {
          setWorkspace(data.workspace);
          // Fetch active discord link
          const linkRes = await fetch(`${BACKEND_URL}/api/discord/link/status?workspaceId=${data.workspace.id}`).catch(() => null);
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
  }, [user]);

  async function linkDiscord({ guildId, guildName, channelId, channelName, linkMethod }) {
    const res = await fetch(`${BACKEND_URL}/api/discord/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
