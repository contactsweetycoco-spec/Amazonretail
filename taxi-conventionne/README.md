# 🚕 Taxi Conventionné — bourse de courses entre chauffeurs

Application mobile (iPhone et Android) qui remplace les groupes WhatsApp :

- **Carte en temps réel** des chauffeurs disponibles et des courses à prendre.
- **Donneurs d'ordre** : chaque chauffeur peut publier une course (départ, destination, date, type).
- **Acceptation en un geste** : le premier qui accepte obtient la course. Elle est verrouillée
  aussitôt, donc deux chauffeurs ne peuvent pas la prendre en même temps.
- **Notification** sur le téléphone à chaque nouvelle course proche.
- **Suivi** : acceptée → en route → patient à bord → terminée, avec possibilité de se désister.
- **Bon de transport par mail** : l'app ouvre un mail pré-rempli adressé au chauffeur, et le
  donneur d'ordre y joint le bon. **Le bon ne passe jamais par l'application.**
- **Validation des chauffeurs** par un administrateur : carte pro, ADS, convention CPAM.

## Protection des données de santé

L'application ne stocke **aucune donnée de santé** : pas de nom de patient, pas de motif médical,
pas de bon de transport. Les lieux sont saisis sous forme de ville, de quartier ou
d'établissement. Les courses terminées sont effacées au bout de 90 jours, et les positions
GPS au bout de 24 h (fonction `purge_old_data`, lancée chaque nuit).

La position d'un chauffeur n'est partagée que lorsqu'il active « Disponible », et seulement
quand l'application est ouverte. Elle disparaît de la carte après 15 minutes sans mise à jour.

## Organisation du code

```
src/app/                 Écrans (Expo Router)
  login.tsx, register.tsx, pending.tsx     Connexion, inscription, attente de validation
  (tabs)/carte.tsx                         Carte des chauffeurs et des courses
  (tabs)/courses.tsx                       Courses disponibles (filtre par distance)
  (tabs)/mes-courses.tsx                   Courses acceptées / données
  (tabs)/profil.tsx                        Profil, rayon des notifications
  publier.tsx                              Donner une course
  course/[id].tsx                          Détail : accepter, étapes, bon par mail
  admin.tsx                                Validation des nouveaux chauffeurs
src/lib/                 Connexion Supabase, session, géolocalisation, notifications
supabase/migrations/     Base de données et règles de sécurité
supabase/functions/      Envoi des notifications « nouvelle course »
supabase/tests/          Tests automatiques des règles de sécurité
scripts/setup-supabase.sh  Installation du serveur en une commande
```

## Mise en route

Prérequis : [Node.js](https://nodejs.org) installé sur votre ordinateur.

### 1. Créer le serveur (Supabase, gratuit pour démarrer)

1. Créez un compte et un **nouveau projet** sur [supabase.com](https://supabase.com), dans la
   région **Europe (Paris ou Francfort)**. Notez bien le mot de passe de la base.
2. Dans ce dossier, lancez :
   ```bash
   npm install
   npm run supabase:setup
   ```
   Le script vous connecte à Supabase, crée les tables et les règles de sécurité, déploie
   les notifications, programme la purge RGPD de chaque nuit et écrit le fichier `.env.local`.

> Sans le script, vous pouvez aussi coller `supabase/migrations/20261025000000_init.sql`
> dans **SQL Editor**, puis copier `.env.example` en `.env.local` et y mettre l'URL et la clé
> « anon » (Project Settings → API).

### 2. Tester sur votre téléphone

```bash
npx expo start
```

Scannez le QR code avec l'application **Expo Go** (App Store / Play Store).

Inscrivez-vous dans l'app, puis nommez-vous administrateur dans Supabase → **SQL Editor** :

```sql
update profiles set verified = true, is_admin = true where email = 'votre@mail.fr';
```

Ensuite, vous validerez les autres chauffeurs directement dans l'app (Profil → Valider les
nouveaux chauffeurs).

> Les notifications ne fonctionnent pas dans Expo Go. Il faut une version installée
> (étape 3, profil `preview`).

### 3. Publier sur l'App Store et le Play Store

Il vous faut un compte [Expo](https://expo.dev) (gratuit), un compte Apple Developer
(99 €/an) et un compte Google Play Console (25 € une fois).

```bash
npx eas-cli@latest login
npx eas-cli@latest init                    # relie l'app à votre compte Expo
# Clés de l'app pour les versions installées (mêmes valeurs que .env.local) :
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co" --environment production --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "votre-cle" --environment production --environment preview --visibility plaintext
# Clé Google Maps (Google Cloud Console → « Maps SDK for Android ») :
npx eas-cli@latest env:create --name GOOGLE_MAPS_API_KEY --value "votre-cle" --environment production --environment preview --visibility sensitive

npx eas-cli@latest build --profile preview --platform android   # APK à installer pour tester
npx eas-cli@latest build --profile production --platform all    # versions pour les stores
npx eas-cli@latest submit --platform all
```

## Vérifications automatiques

À chaque modification, GitHub vérifie que l'application compile et que les règles de
sécurité de la base sont respectées (`.github/workflows/taxi-conventionne.yml`).
En local : `npx tsc --noEmit` et `npm run test:db` (avec un PostgreSQL local).

## Avant le lancement

- Faites valider par un juriste le statut de « centrale de réservation » (Code des transports),
  surtout si vous prenez une commission.
- Rédigez des CGU et une politique de confidentialité (RGPD). Les stores l'exigent.
- Pour le bon de transport, privilégiez une messagerie sécurisée de santé ou un mail chiffré.
