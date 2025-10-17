import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import pacote1Image from "@/assets/pacote1-diagram.jpeg";

export function PackageOverview() {
  const { user } = useAuth();
  const [userPackage, setUserPackage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPackage = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('pacote')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user package:', error);
        } else if (data) {
          setUserPackage(data.pacote);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPackage();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão Geral do Pacote</CardTitle>
        <CardDescription>Informações detalhadas sobre o seu pacote de trabalho</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {userPackage === 'Pacote 1' ? (
          <>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Pacote 1 (RT-1000KN-M-500002)</h3>
              
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={pacote1Image} 
                  alt="Diagrama do Pacote 1" 
                  className="w-full h-auto"
                />
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Toda a montagem eletromecânica referente ao novo prédio do peneiramento 
                  secundário anexo (ED-1310KN-01) (incluso o novo tripper TR-1310KN126), 
                  bem como subestação (SE-1310KN-10), escritório/vestiário, ponto de ônibus, 
                  caminho seguro e oficina de caldeiraria. Atualmente, o pacote 1 está em 
                  execução a partir da mão de obra da empresa PAREX Engenharia S.A.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Em breve</p>
            <p className="text-sm text-muted-foreground mt-2">
              As informações sobre {userPackage || 'este pacote'} estarão disponíveis em breve.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
