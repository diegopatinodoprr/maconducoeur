# Maconducoeur

Application web avec:
- Frontend Angular (`maconducoeur/`) pour l'espace admin et utilisateur
- Backend Node.js TypeScript (`api-maconducoeur/`) pour API et securite
- MongoDB en local (sans Docker compose)

## Prerequis

- Node.js 22+
- MongoDB lance en local (ex: `mongodb://127.0.0.1:27017`)

## Lancer le backend

```bash
cd api-maconducoeur
cp .env.example .env
npm install
npm run dev
```

API:
- `GET http://localhost:3000/api/health`
- `POST http://localhost:3000/api/auth/login`
- `PUT http://localhost:3000/api/auth/me/email` (auth)
- `PUT http://localhost:3000/api/auth/me/password` (auth)
- `GET http://localhost:3000/api/users`
- `GET http://localhost:3000/api/users/me` (auth)
- `PUT http://localhost:3000/api/users/me` (auth)
- `PUT http://localhost:3000/api/users/me/avatar` (auth)
- `GET http://localhost:3000/api/users/me/addresses` (auth)
- `POST http://localhost:3000/api/users/me/addresses` (auth)
- `PUT http://localhost:3000/api/users/me/addresses/:id/photo` (auth)
- `DELETE http://localhost:3000/api/users/me/addresses/:id` (auth)
- `GET http://localhost:3000/api/utils`
- `POST http://localhost:3000/api/utils`
- `PUT http://localhost:3000/api/utils/:id/image` (auth)
- `GET http://localhost:3000/api/utils/manufacturers`
- `POST http://localhost:3000/api/utils/manufacturers` (admin)
- `PUT http://localhost:3000/api/utils/manufacturers/:id` (admin)
- `DELETE http://localhost:3000/api/utils/manufacturers/:id` (admin)
- `POST http://localhost:3000/api/files` (auth, form-data field: `file`)
- `GET http://localhost:3000/api/files` (auth)
- `GET http://localhost:3000/api/files/:id/data` (public binaire file/image)
- `POST http://localhost:3000/api/admin/seedprod` (admin)
- `GET http://localhost:3000/api/admin/migrations` (admin)
- `POST http://localhost:3000/api/admin/migrations/run` (admin)
- `POST http://localhost:3000/api/borrowings` (auth)
- `GET http://localhost:3000/api/borrowings` (auth)
- `PUT http://localhost:3000/api/borrowings/:id/status` (owner only)

## Seeder MongoDB (comptes de test)

```bash
cd api-maconducoeur
npm run seed
```

Seeds disponibles:
- `npm run seed:users`
- `npm run seed:manufacturers`
- `npm run seed:tools`

## Lancer le frontend

```bash
cd maconducoeur
npm install
npm start
```

Web:
- `http://localhost:4200`

## Comptes de test

- Admin: `admin@maconducoeur.local` / `Admin@123`
- User: `user@maconducoeur.local` / `User@123`

## Categories d'outils

- `jardin`
- `placo`
- `electricite`
- `bois`
- `eau`

## Notes API utils

- `POST /api/utils` attend `marque_id` (ObjectId MongoDB) qui doit exister dans `manufacturers`.
- `POST /api/utils` attend aussi `owner_user_id` (ObjectId MongoDB) qui doit exister dans `users`.
- `POST /api/utils` peut accepter `borrowed_by_user_id` (ObjectId MongoDB) pour indiquer l'emprunteur.
- `GET /api/utils` retourne:
  `marque_id`, `marque`, `image_file_id`, `image_url`, `owner_user_id`, `owner_user`, `borrowed_by_user_id`, `borrowed_by_user`.

## Notes API files

- Regle projet: pour afficher une image ou telecharger un fichier depuis le frontend, toujours utiliser `GET /api/files/:id/data`.
- Ne pas utiliser `/uploads/<filename>` dans le frontend (detail d'implementation backend/proxy).
- Les references stockees/echangees doivent etre des ids (`avatar_file_id`, `image_file_id`, etc.).
- Formats acceptes: `jpeg`, `png`, `webp`.
- Taille max a l'entree: `30MB` (puis optimisation serveur).
- Le backend optimise automatiquement les images (redimensionnement + conversion WebP).

## Notes API borrowings

- `POST /api/borrowings` cree une demande d'emprunt avec `status: pending`.
- Objet emprunt: `tool_id`, `start_date`, `end_date`, `borrower_user_id`, `owner_user_id`, `status`.
- Status possibles: `pending`, `active`, `finished`.
- `PUT /api/borrowings/:id/status` ne peut etre appele que par le proprietaire de l'outil.
- Transitions autorisees: `pending -> active -> finished`.

## Notes API migrations

- Les migrations doivent passer par le router admin (`/api/admin/migrations/*`).
- Migration disponible: `users_credits_default_10_v1`
  - ajoute `credits: 10` uniquement pour les users qui n'ont pas encore le champ `credits` (ou `null`).
  - n'ecrase jamais les credits deja presents.
- Migration disponible: `borrowings_backfill_mousse_cost_v1`
  - calcule et renseigne `mousse_cost` pour les emprunts existants qui ne l'ont pas encore.
  - n'ecrase jamais un `mousse_cost` deja present.
- Migration disponible: `borrowings_backfill_pending_ledger_v1`
  - cree les lignes `mousse_ledger` manquantes pour les emprunts historiques en `pending`.
  - evite les doublons via `borrowing_id` unique.
