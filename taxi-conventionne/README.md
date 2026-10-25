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
GPS au bout de 24 h (fonction `purge_old_data`).

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
supabase/schema.sql      Base de données et règles de sécurité
supabase/functions/      Envoi des notifications « nouvelle course »
```

## Mise en route

### 1. Créer le serveur (Supabase, gratuit pour démarrer)

1. Créez un projet sur [supabase.com](https://supabase.com), de préférence dans la région
   **Europe (Paris ou Francfort)**.
2. Dans **SQL Editor**, collez et exécutez le contenu de `supabase/schema.sql`.
3. Inscrivez-vous dans l'application, puis nommez-vous administrateur dans **SQL Editor** :
   ```sql
   update profiles set verified = true, is_admin = true where email = 'votre@mail.fr';
   ```
4. Notifications (facultatif) : déployez la fonction avec
   `npx supabase functions deploy notify-new-ride`. Ensuite, dans
   **Database → Webhooks**, créez un webhook sur `INSERT` de la table `rides` qui appelle
   cette fonction.
5. Purge automatique : activez l'extension **pg_cron**, puis exécutez
   `select cron.schedule('purge', '0 3 * * *', 'select public.purge_old_data()');`

### 2. Lancer l'application

```bash
cd taxi-conventionne
npm install
cp .env.example .env.local   # puis collez l'URL et la clé "anon" de Supabase
npx expo start
```

Scannez le QR code avec l'application **Expo Go** sur votre téléphone pour tester.

### 3. Publier sur l'App Store et le Play Store

```bash
npx eas-cli@latest init      # crée le projet EAS (nécessaire aussi pour les notifications)
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```

Pour Android en production, ajoutez une clé Google Maps dans `app.json`, avec le plugin
`["react-native-maps", { "androidGoogleMapsApiKey": "..." }]`.

## Avant le lancement

- Faites valider par un juriste le statut de « centrale de réservation » (Code des transports),
  surtout si vous prenez une commission.
- Rédigez des CGU et une politique de confidentialité (RGPD).
- Pour le bon de transport, privilégiez une messagerie sécurisée de santé ou un mail chiffré.
