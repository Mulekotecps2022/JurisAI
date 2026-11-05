# Assistente jurídico — fase gratuita (desenvolvimento)

## Regras de custo
- **Orçamento novo autorizado: R$ 0,00.** Não habilitar plano pago nem vincular cartão.
- Provedor selecionado para piloto: **Groq Free Plan**. Segundo a documentação do provedor, o plano Free limita as solicitações com HTTP 429 em vez de cobrar. Verificar o plano real da conta antes de ativar.
- A API só funciona quando **ambas** as variáveis de servidor da branch de Preview estiverem presentes: `GROQ_API_KEY` (segredo) e `GROQ_FREE_PLAN_CONFIRMED=true` (opt-in depois de verificar o painel do plano Free). Não usar prefixo `NEXT_PUBLIC_`.
- O endpoint usa modelo fixo `openai/gpt-oss-20b` e no máximo 700 tokens de saída por solicitação; sem streaming, arquivos, pesquisas web, ferramentas externas nem retries.
- SQL `public.try_consume_ai_free_request()` limita atomicamente cada usuário a 8 solicitações por dia UTC, com 15 segundos entre elas; falhas na verificação da cota impedem chamadas ao provedor.
- Se o plano gratuito deixar de estar disponível, remover `GROQ_FREE_PLAN_CONFIRMED` para desabilitar imediatamente.
- **Não** ativar a flag caso a conta esteja em um plano pago: a flag é uma confirmação administrativa, não uma verificação automática do contrato do provedor.

## Privacidade e limitações
- Nenhum dado de pessoas, processos ou documentos é consultado ou enviado automaticamente à IA.
- O texto digitado e no máximo 4 mensagens recentes da conversa são transmitidos ao provedor externo quando habilitado. Para evitar informações sigilosas, testar exclusivamente com dados fictícios.
- O JurisAI não persiste conversas ou respostas no banco nesta fase. O provedor possui políticas próprias de processamento e retenção.
- Respostas de IA podem estar incorretas. Não é aconselhamento profissional e referências legais devem ser conferidas em fontes oficiais.
- O módulo é protegido por sessão Supabase; requisições POST exigem autenticação, têm validação de origem, tamanho, duração e cota.
- Produção não deve receber estas variáveis durante os testes.

## Ativação
1. Confirmar no painel do provedor que a conta está no **Free Plan** e que nenhuma cobrança será feita por uso; não informar chave no chat.
2. Adicionar a chave em segredo no painel Vercel, exclusivamente para Preview da branch `work/jurisai-primeira-entrega-2026-11-02`.
3. Adicionar `GROQ_FREE_PLAN_CONFIRMED=true` exclusivamente na mesma branch de Preview.
4. Publicar uma nova implantação de Preview e validar com pergunta genérica sem dados pessoais.
5. Desativar a flag se a quota, privacidade ou política do plano mudar.

Fontes: https://community.groq.com/t/do-i-get-charged-for-anything-on-the-groq-free-plan/832 e https://console.groq.com/docs/rate-limits
