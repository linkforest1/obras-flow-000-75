import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autenticação necessária');
    }

    const { messages } = await req.json();
    
    // Input validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Mensagens inválidas');
    }
    
    // Validate message content
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage.content || typeof lastMessage.content !== 'string' || lastMessage.content.length > 1000) {
      throw new Error('Conteúdo da mensagem inválido ou muito longo');
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados relevantes do Supabase
    console.log('Buscando dados do Supabase...');
    
    const [activitiesResult, commentsResult, photosResult, reportsResult] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, description, responsible_name, discipline, status, progress, start_date, end_date, location, asset')
        .order('created_at', { ascending: false })
        .limit(50),
      
      supabase
        .from('activity_comments')
        .select(`
          id,
          comment_text,
          created_at,
          profiles:user_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50),
      
      supabase
        .from('activity_photos')
        .select('id, activity_id, caption, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      
      supabase
        .from('daily_reports')
        .select('id, report_date, description, weather, employee_count')
        .order('report_date', { ascending: false })
        .limit(30)
    ]);

    // Construir contexto com os dados
    const activities = activitiesResult.data || [];
    const comments = commentsResult.data || [];
    const photos = photosResult.data || [];
    const reports = reportsResult.data || [];

    console.log(`Dados carregados: ${activities.length} atividades, ${comments.length} comentários, ${photos.length} fotos, ${reports.length} relatórios`);

    const contextData = {
      totalActivities: activities.length,
      activities: activities.map(a => ({
        titulo: a.title,
        descricao: a.description,
        responsavel: a.responsible_name,
        disciplina: a.discipline,
        status: a.status,
        progresso: a.progress,
        inicio: a.start_date,
        fim: a.end_date,
        local: a.location,
        ativo: a.asset
      })),
      totalComments: comments.length,
      comments: comments.map(c => ({
        texto: c.comment_text,
        data: c.created_at,
        usuario: c.profiles?.full_name || 'Usuário'
      })),
      totalPhotos: photos.length,
      photos: photos.map(p => ({
        legenda: p.caption,
        data: p.created_at
      })),
      totalReports: reports.length,
      reports: reports.map(r => ({
        data: r.report_date,
        descricao: r.description,
        clima: r.weather,
        funcionarios: r.employee_count
      }))
    };

    const systemPrompt = `Você é um assistente de IA especializado em gestão de projetos e construção civil. 
Você tem acesso ao banco de dados do sistema e pode responder perguntas sobre:
- Atividades do projeto (tarefas, responsáveis, status, progresso)
- Comentários nas atividades
- Fotos das atividades
- Relatórios diários (RDO)

Contexto atual do banco de dados:
${JSON.stringify(contextData, null, 2)}

Instruções:
- Responda de forma clara e objetiva em português brasileiro
- Use os dados fornecidos acima para responder com precisão
- Se perguntarem sobre números específicos, use os dados do contexto
- Se não souber algo, seja honesto
- Mantenha um tom profissional mas amigável
- Forneça insights úteis quando apropriado`;

    // Fazer chamada para o Lovable AI Gateway
    console.log('Chamando Gemini AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro do Gemini AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), 
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Por favor, adicione créditos ao seu workspace.' }), 
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw new Error(`Erro do Gemini AI: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
    
    console.log('Resposta do Gemini recebida');

    return new Response(
      JSON.stringify({ response: aiMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro na edge function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        response: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
