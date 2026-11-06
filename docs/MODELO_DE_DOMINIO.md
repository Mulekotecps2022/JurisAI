# Modelo de domínio — Pessoas e Partes

## Conceito confirmado

O módulo legado `tenentes` representa cadastros de pessoas ou entidades relacionadas a processos jurídicos. Pode contemplar clientes, partes autoras, partes rés/contrapartes, advogados, responsáveis, parceiros, colegas e outros participantes.

**Não é** cadastro de usuários autenticados, organizações/tenants ou workspace.

## Regras de domínio

1. Uma pessoa/entidade pode participar de vários processos.
2. A mesma pessoa pode ter papéis diferentes em processos diferentes.
3. Um processo pode ter vários participantes, inclusive mais de um participante com o mesmo papel.
4. O papel é atributo da relação pessoa-processo, não uma característica fixa e exclusiva da pessoa.
5. O registro legado em `public.tenentes` deve ser preservado e mapeado antes de qualquer migração.
6. A autenticação fica separada no Supabase Auth; a autorização usa propriedade e associação explícita de usuários aos dados.
7. A tabela `public.CASE` (maiúscula) permanece isolada até que sua finalidade seja identificada.

## Vocabulário de papéis inicial

- `client`: cliente/contratante.
- `plaintiff`: parte autora/requerente.
- `defendant`: parte ré/requerida/contraparte.
- `lawyer`: advogado(a).
- `responsible`: responsável pelo acompanhamento.
- `partner`: parceiro(a)/correspondente.
- `witness`: testemunha.
- `expert`: perito(a)/assistente técnico(a).
- `other`: outro papel.

Os códigos são internos; a interface deve apresentar rótulos em português. A lista deverá ser extensível e não pressupor que os papéis sejam mutuamente exclusivos.

## Modelo lógico pretendido (ainda não aplicado)

```text
auth.users
   │
   └── app_user_profiles (perfil e preferências)
          │
          └── case_access (usuários autorizados a acessar casos)

tenentes (cadastros legados de pessoas/entidades)
   │
   └── case_participants (pessoa + processo + papel)

case
   ├── case_participants
   └── document
          └── embedding
```

O desenho acima é conceitual. Os nomes físicos finais, cardinalidades, restrições, políticas RLS e estratégia de migração ainda precisam ser revisados antes de qualquer DDL.

## Decisões pendentes de implementação

- Definir se os dados de pessoas serão enriquecidos (tipo pessoa física/jurídica, contatos, identificadores) e quais campos são estritamente necessários.
- Definir se um caso pertence a um único usuário ou pode ser compartilhado com equipe.
- Definir fluxo para converter/migrar registros de `tenentes` sem perda de integridade.
- Identificar a finalidade da tabela `CASE` (maiúscula) sem alterar nem expor dados desnecessariamente.
- Definir as políticas RLS e privilégios mínimos para pessoas, processos, documentos e embeddings.

## Critérios de segurança

Nenhuma política deve usar `tenentes.id` como se fosse usuário autenticado. Os dados pessoais e documentos devem ser isolados por proprietário ou associação de acesso ao caso. A API pública não deve permitir acesso anônimo a dados jurídicos. Documentos devem permanecer em storage privado e a leitura deve depender de autorização no caso relacionado.
