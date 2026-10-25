#!/usr/bin/env bash
# Installe tout le serveur Supabase en une commande : npm run supabase:setup
#   1. connexion à votre compte Supabase
#   2. liaison au projet que vous avez créé sur supabase.com
#   3. création des tables et des règles de sécurité
#   4. déploiement de la fonction de notifications
#   5. écriture du fichier .env.local pour l'application
set -euo pipefail
cd "$(dirname "$0")/.."
SB="npx --yes supabase@2.122.0"

echo "→ Connexion à Supabase (une page va s'ouvrir dans le navigateur)"
$SB login

echo
echo "Identifiant du projet : dans Supabase > Project Settings > General > Project ID"
read -rp "Project ID : " REF

echo "→ Liaison au projet (le mot de passe de la base vous sera demandé)"
$SB link --project-ref "$REF"

echo "→ Création des tables et des règles de sécurité"
$SB db push

echo "→ Déploiement des notifications"
$SB functions deploy notify-new-ride --project-ref "$REF"

echo "→ Écriture de .env.local"
ANON=$($SB projects api-keys --project-ref "$REF" -o json \
  | node -e 'const k=JSON.parse(require("fs").readFileSync(0));process.stdout.write((k.find(x=>x.name==="anon")||k.find(x=>x.type==="publishable")||{}).api_key||"")')
if [ -z "$ANON" ]; then
  echo "Clé introuvable : copiez-la depuis Supabase > Project Settings > API dans .env.local"
  ANON="a-remplir"
fi
cat > .env.local <<ENV
EXPO_PUBLIC_SUPABASE_URL=https://$REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
ENV

echo
echo "✅ Serveur prêt. Lancez l'application avec : npx expo start"
echo "   Puis, après votre inscription dans l'app, nommez-vous administrateur :"
echo "   Supabase > SQL Editor >"
echo "   update profiles set verified = true, is_admin = true where email = 'votre@mail.fr';"
