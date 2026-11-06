# JurisAI — scanner antimalware (rascunho, NÃO ATIVAR)

Esta branch é isolada da branch de entrega. O endpoint interno `POST /api/internal/documents/scan` está protegido por `JURISAI_SCAN_WORKER_TOKEN` e só pode ser acionado por um worker confiável. Não habilitar uploads ou publicar esta branch antes dos testes.

## Contrato do scanner

Configurar um gateway de scanner antimalware confiável, operado pelo servidor, em `JURISAI_SCANNER_URL` (HTTPS), com `JURISAI_SCANNER_TOKEN`. O gateway deve fazer varredura real com um motor atualizado (por exemplo ClamAV atualizado), calcular SHA-256 dos bytes examinados e responder apenas com HTTP 200 e JSON `{"verdict":"clean","sha256":"..."}` ou `{"verdict":"infected","sha256":"..."}`. Respostas ambíguas, erros e timeouts não liberam arquivos. Não usar provedores externos sem revisão de confidencialidade e tratamento de dados jurídicos.

## Fluxo

1. Upload atual permanece desligado: `JURISAI_ENABLE_UPLOADS` deve permanecer ausente ou diferente de `true`.
2. Upload futuro registra arquivo em `quarantined`.
3. Worker privado invoca a rota interna com `Authorization: Bearer <JURISAI_SCAN_WORKER_TOKEN>` e JSON `{"documentId":"<uuid>"}`.
4. Rota reivindica o item com atualização condicional `quarantined -> scanning`, baixa do bucket privado, confere tamanho e SHA-256, envia os bytes ao scanner por HTTPS.
5. Apenas resposta limpa com SHA-256 idêntico resulta em `available`. Infecção ou integridade inválida resulta em `rejected`; erro operacional volta para `quarantined`.
6. Rota existente de download só emite URL assinada para `available`.

## Pendências obrigatórias antes de merge/deploy

- Revisar e testar o gateway real, autenticação de serviço, TLS, limites de tamanho, tempo, concorrência e isolamento de rede.
- Criar mecanismo de fila com tentativas limitadas, backoff, monitoramento e recuperação de `scanning` abandonado após queda do worker.
- Persistir trilha de auditoria de scanner/versão/assinaturas, horário e resultado, sem dados pessoais desnecessários.
- Testar EICAR (amostra de teste inofensiva), arquivo limpo, falha, timeout, hash divergente, upload interrompido, revogação e concorrência.
- Confirmar que a resposta do banco realmente atualizou exatamente uma linha e que nenhuma transição administrativa externa contorna o scanner.
- Verificar configuração das credenciais somente no servidor e fluxo de agendamento.
- Considerar reduzir TTL de URL assinada e verificar comportamento após revogação.
- Executar typecheck, testes de segurança, build e testes HTTP de ponta a ponta em ambiente isolado.
- Manter `JURISAI_ENABLE_UPLOADS` desligado até a aprovação formal.

Nenhuma credencial, arquivo real ou configuração de produção está incluída neste rascunho.
