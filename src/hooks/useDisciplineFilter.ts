import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDisciplineFilter() {
  const { data: availableDisciplines, isLoading } = useQuery({
    queryKey: ['available-disciplines'],
    queryFn: async () => {
      console.log('Fetching available disciplines from Supabase...');
      
      const { data, error } = await supabase
        .from('activities')
        .select('discipline')
        .not('discipline', 'is', null)
        .neq('discipline', '');

      if (error) {
        console.error('Error fetching disciplines:', error);
        throw error;
      }

      // Extrair disciplinas únicas e ordenar alfabeticamente
      const disciplines = [...new Set(data
        .map(activity => activity.discipline)
        .filter(discipline => discipline !== null && discipline !== undefined && discipline !== '')
      )].sort(); // Ordenar alfabeticamente
      
      console.log('Available disciplines from database:', disciplines);

      return disciplines.map(discipline => ({
        value: String(discipline),
        label: String(discipline)
      }));
    },
  });

  return {
    availableDisciplines: availableDisciplines || [],
    isLoading
  };
}