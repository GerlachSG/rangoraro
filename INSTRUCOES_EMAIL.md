# 📧 Guia de Configuração do Sistema de Email com Brevo

## 🎯 O que foi implementado

Foi criado um sistema completo de envio de emails gratuito usando **Brevo (antigo Sendinblue)** que:

1. ✅ Envia email automático quando uma entrega é concluída
2. ✅ Inclui o logo do RangoRaro
3. ✅ Lista todos os itens do pedido com imagens
4. ✅ Mostra o valor total da entrega
5. ✅ Botão "Avaliar o Serviço" que registra feedback no Firebase
6. ✅ Design responsivo e profissional

---

## 🚀 Como Configurar o Brevo (Passo a Passo)

### 1️⃣ Criar Conta no Brevo

1. Acesse: https://www.brevo.com/
2. Clique em **"Sign up free"** (Cadastrar gratuitamente)
3. Preencha seus dados:
   - Email
   - Nome da empresa (pode ser "RangoRaro")
   - Senha
4. Confirme seu email clicando no link enviado

### 2️⃣ Obter sua API Key

1. Faça login no Brevo
2. No menu superior direito, clique no seu nome
3. Vá em **"SMTP & API"**
4. Clique na aba **"API Keys"**
5. Clique em **"Generate a new API key"**
6. Dê um nome (ex: "RangoRaro Delivery")
7. **COPIE a chave gerada** (você só verá ela uma vez!)

### 3️⃣ Verificar seu Email Remetente

1. Vá em **"Senders, Domains & Dedicated IPs"** > **"Senders"**
2. Clique em **"Add a new sender"**
3. Adicione um email (ex: `noreply@rangoraro.com` ou seu email pessoal)
4. Confirme o email clicando no link enviado para sua caixa de entrada
5. ⚠️ **Importante**: Use este email verificado no código

### 4️⃣ Configurar o Código

Abra o arquivo: `src/js/email-service.js`

**Linha 4-7:** Substitua a API Key
```javascript
const BREVO_CONFIG = {
    apiKey: 'COLE_SUA_API_KEY_AQUI', // ← Cole a API key copiada do Brevo
    apiUrl: 'https://api.brevo.com/v3/smtp/email'
};
```

**Linha 95:** Substitua o email remetente
```javascript
sender: {
    name: "RangoRaro",
    email: "SEU_EMAIL_VERIFICADO@dominio.com" // ← Use o email que você verificou no Brevo
},
```

**Linha 162:** Substitua o domínio do link de avaliação
```javascript
<a href="http://localhost:5500/src/pages/avaliar.html?pedido=${orderData.id}" class="cta-button">
```

**⚠️ IMPORTANTE:** 
- Se você estiver hospedando localmente, use: `http://localhost:5500/src/pages/avaliar.html?pedido=`
- Se tiver um domínio, use: `https://rangoraro.com/src/pages/avaliar.html?pedido=`
- Para GitHub Pages: `https://SEU-USUARIO.github.io/rangoraro/src/pages/avaliar.html?pedido=`

---

## 📁 Arquivos Criados/Modificados

### ✨ Novos Arquivos:
- **`src/js/email-service.js`** - Serviço de envio de emails
- **`src/pages/avaliar.html`** - Página de avaliação do serviço
- **`INSTRUCOES_EMAIL.md`** - Este arquivo de instruções

### 🔧 Arquivos Modificados:
- **`src/js/delivery.js`** - Adicionada função de envio de email ao finalizar entrega
- **`src/pages/entregas.html`** - Incluído script do serviço de email

---

## 🔄 Fluxo de Funcionamento

1. **Entregador finaliza a entrega** → Clica em "Finalizar Entrega" e confirma o código
2. **Sistema salva no Firebase** → Pedido movido para `pedidos-entregues`
3. **Email é enviado automaticamente** → Via API do Brevo para o cliente
4. **Cliente recebe email** com:
   - Logo do RangoRaro
   - Lista de itens pedidos
   - Valor da entrega
   - Botão "Avaliar o Serviço"
5. **Cliente clica em "Avaliar"** → Redireciona para `avaliar.html`
6. **Avaliação é salva** → Coleção `avaliacoes` no Firebase

---

## 🎨 Personalização do Email

Para modificar o design do email, edite o arquivo `src/js/email-service.js` na função `sendDeliveryConfirmationEmail()`.

### Elementos que você pode customizar:

- **Cores**: Procure por `#FF6B35` e `#FF8C42` para mudar as cores principais
- **Logo**: Linha 44 - `<img src="https://cdn.jsdelivr.net/gh/eduardoamjunior/cdn-rangoraro@main/icon/logo.svg"`
- **Texto**: Linhas 156-162 - Mensagens para o cliente
- **Rodapé**: Linhas 175-183 - Links de redes sociais

---

## 🧪 Como Testar

### 1. Teste Local (Console do Navegador):
```javascript
// Cole no console do navegador enquanto estiver em entregas.html
const testOrder = {
    id: 'test-123',
    userInfo: {
        displayName: 'João Silva',
        email: 'seu-email@teste.com', // ← Use seu email real
        valorViagem: 25.50
    },
    itensPedido: [
        {
            nomeDoItem: 'Pizza Margherita',
            nomeLoja: 'Pizzaria Bella',
            imagemUrl: 'https://via.placeholder.com/60'
        }
    ]
};

sendDeliveryConfirmationEmail(testOrder, 'seu-email@teste.com', 'João Silva');
```

### 2. Teste Real:
1. Faça um pedido de teste no app
2. Use a conta de entregador para aceitar e finalizar
3. Verifique se o email chegou na caixa de entrada do cliente

---

## 📊 Limites do Plano Gratuito Brevo

- ✅ **300 emails por dia**
- ✅ **Sem custo mensal**
- ✅ **API completa**
- ⚠️ Inclui pequeno rodapé "Powered by Brevo" (removível em planos pagos)

---

## 🔧 Solução de Problemas

### ❌ Email não está sendo enviado

**Possíveis causas:**
1. API Key incorreta → Verifique se copiou corretamente
2. Email remetente não verificado → Confirme o email no Brevo
3. Limite diário atingido → Verifique no dashboard do Brevo
4. Erro de CORS → Adicione seu domínio nas configurações do Brevo

**Como verificar:**
- Abra o Console do Navegador (F12)
- Vá na aba "Console"
- Procure por erros em vermelho

### ❌ Email do destinatário não encontrado

O sistema precisa que o pedido tenha o email do cliente. Verifique se:
- O campo `userInfo.email` existe no pedido
- OU o campo `userEmail` está preenchido

Para adicionar o email, modifique onde o pedido é criado para incluir o email do usuário.

---

## 📝 Próximos Passos (Melhorias Opcionais)

- [ ] Adicionar tracking de abertura de emails (Brevo Analytics)
- [ ] Criar templates de email diferentes para cada tipo de notificação
- [ ] Enviar email quando pedido é aceito pelo entregador
- [ ] Email de lembrete se o cliente não avaliou após 24h
- [ ] Integrar avaliações em um dashboard de admin

---

## 💡 Dicas Importantes

1. **Guarde sua API Key em segredo** - Não compartilhe publicamente
2. **Teste sempre em ambiente de desenvolvimento** antes de usar em produção
3. **Monitore o uso** no dashboard do Brevo para não ultrapassar o limite
4. **Personalize os emails** para combinar com a identidade visual do RangoRaro

---

## 📞 Suporte

Se tiver dúvidas sobre o Brevo:
- Documentação: https://developers.brevo.com/
- Suporte: https://help.brevo.com/

Se tiver dúvidas sobre a implementação:
- Verifique os comentários no código
- Teste passo a passo usando o console do navegador

---

## ✅ Checklist de Configuração

- [ ] Criar conta no Brevo
- [ ] Gerar API Key
- [ ] Verificar email remetente
- [ ] Colar API Key no código (`email-service.js` linha 4)
- [ ] Atualizar email remetente no código (`email-service.js` linha 95)
- [ ] Testar envio de email
- [ ] Testar página de avaliação
- [ ] Verificar se avaliação salva no Firebase

---

**🎉 Pronto! Seu sistema de emails está configurado e funcionando!**
