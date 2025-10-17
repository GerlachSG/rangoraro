# 🚨 CORREÇÃO URGENTE - Permissões Firestore

## ❌ Problemas Identificados:

1. **Permissões do Firestore não estão atualizadas** - Usuários não conseguem ver pedidos
2. **Script duplicado** - `carrinho.js` carregado 2x em `abertura.html` ✅ CORRIGIDO
3. **Erro de geocodificação** - OpenStreetMap bloqueando (vou corrigir depois)

---

## ⚡ SOLUÇÃO IMEDIATA - Atualizar Regras Firestore

### 🔥 Opção 1: Pelo Firebase Console (RECOMENDADO)

1. Acesse: https://console.firebase.google.com/
2. Selecione: **rangoraro-app**
3. Menu lateral → **Firestore Database**
4. Aba → **Regras** (Rules)
5. **COPIE TODO O CONTEÚDO** do arquivo: `firebase-configs/firestore.rules`
6. **COLE** na caixa de texto do Firebase Console
7. Clique em **"Publicar"** (Publish)
8. Aguarde confirmação (pode levar 1-2 minutos)

### 💻 Opção 2: Pelo Firebase CLI (Mais Rápido)

Se você tem Firebase CLI instalado:

```powershell
# Navegue até a pasta do projeto
cd c:\Users\skill50\git-rangoraro-app\rangoraro-1

# Publique as regras
firebase deploy --only firestore:rules
```

---

## ✅ O Que Foi Corrigido no Código:

### 1. **firestore.rules** - Adicionadas permissões:
- ✅ `allow list: if isLogged();` em `pedidos`
- ✅ `allow list: if isLogged();` em `pedidos-entregues`
- ✅ Regras para coleção `avaliacoes`

### 2. **abertura.html**:
- ✅ Removido `carrinho.js` duplicado (linha 214)

---

## 🧪 Como Testar se Funcionou:

1. **Publique as regras** (passos acima)
2. **Recarregue a página** (Ctrl+F5)
3. **Faça login** como usuário comum
4. **Clique em "Meus Pedidos"**
5. ✅ Não deve mais dar erro de permissão!

---

## 🐛 Problemas Restantes (para depois):

### OpenStreetMap CORS Error
O erro `ERR_FAILED 403 (Forbidden)` acontece porque:
- OpenStreetMap bloqueia requisições muito frequentes
- Pode estar bloqueando seu IP temporariamente
- Solução: Usar outro serviço de geocodificação ou adicionar delay

**Solução Temporária:**
Aguarde alguns minutos antes de tentar enviar outro pedido.

**Solução Permanente (para implementar depois):**
- Usar Google Maps Geocoding API (pago mas tem créditos grátis)
- Ou implementar cache de endereços
- Ou adicionar rate limiting nas requisições

---

## 📋 Status das Correções:

- ✅ Script duplicado corrigido
- ✅ Regras Firestore corrigidas no código
- ⏳ **VOCÊ PRECISA:** Publicar regras no Firebase Console
- ⏳ **Geocodificação:** Aguardar ou implementar solução permanente

---

## ⚠️ IMPORTANTE:

**SEM PUBLICAR AS REGRAS NO FIREBASE, O APP NÃO VAI FUNCIONAR!**

As regras estão corretas no arquivo local, mas você **DEVE** publicá-las no Firebase Console para que tenham efeito.

---

## 🎯 Próximos Passos Após Corrigir:

1. Testar criação de pedidos
2. Testar visualização de pedidos
3. Configurar sistema de email (seguir INSTRUCOES_EMAIL.md)
4. Resolver geocodificação (se continuar dando erro)
