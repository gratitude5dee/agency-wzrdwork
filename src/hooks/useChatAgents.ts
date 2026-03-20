/**
 * Hook for loading agents for chat interface
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Agent {
  id: string;
  name: string;
}

export function useChatAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setIsLoading(true);
        const { data, error: err } = await supabase
          .from('agents')
          .select('id, name')
          .order('name')
          .limit(100);

        if (err) throw err;
        setAgents((data as Agent[]) || []);
        setError(null);
      } catch (err) {
        console.warn('Failed to load chat agents:', err);
        setError(err instanceof Error ? err : new Error('Failed to load agents'));
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, []);

  return { agents, isLoading, error };
}
