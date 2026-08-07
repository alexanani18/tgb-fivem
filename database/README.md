# TGB-FiveM — Database

Folderul conține schema și valorile standard necesare aplicației.

## Ce face `db:ensure`

Comanda este gândită să ruleze automat înainte de `npm run dev:all`:

1. verifică toate tabelele aplicației;
2. creează automat tabelele lipsă (`CREATE TABLE IF NOT EXISTS`);
3. repară diferențele cunoscute din bazele mai vechi (coloane/indexuri lipsă);
4. verifică seed-urile standard și inserează doar valorile lipsă;
5. NU șterge contracte, angajați, notificări sau alte date reale.

Prin urmare, comanda poate fi rulată de fiecare developer la fiecare pornire.

## Structură

```text
database/
├── schema/     # 13 tabele ale aplicației
├── seed/       # valori standard, idempotente
└── scripts/
    ├── ensure.ts
    ├── install.ts
    ├── reset.ts
    ├── utils.ts
    └── importDiscordRoles.ts
```

## Tabele

Schema include:

- user_roles
- user_ranks
- users
- employee_details
- employee_contracts
- notifications
- notification_images
- notification_image_submissions
- uniforms
- discord_roles
- employee_discord_roles
- employee_documents
- employee_document_versions

## Seed-uri standard

Seed-urile NU folosesc `DELETE` și NU resetează datele existente.

Sunt garantate cel puțin:

### Roluri
- GUEST
- ANGAJAT
- MAFIA
- ADMIN

### Rank-uri
1. Blackfold Chief Executive Officer
2. Director adjunct
3. Blackfold Manager
4. Blackfold Specialist — 15000 $/oră
5. Blackfold Crew — 10000 $/oră

Rank-urile confidențiale au `salary = 0` și `salary_type = CONFIDENTIAL`.

### Uniforme
Dacă lipsesc, sunt create configurațiile standard MALE/FEMALE. Dacă au fost deja editate din aplicație, `db:ensure` nu le suprascrie.

### User development
Dacă nu există username-ul `admin`, seed-ul creează contul development definit în `seed/03_users.sql`.

## Comenzi recomandate

După actualizarea `package.json`:

```bash
npm run db:ensure
npm run db:install
npm run db:reset
npm run db:fresh
npm run dev:all
```

`db:ensure` este comanda sigură pentru pornirea zilnică.
`db:reset` și `db:fresh` sunt destructive și trebuie folosite intenționat.

## Regula pentru viitor

Când apare un tabel nou:
- se adaugă un fișier nou numerotat în `schema/`;
- dacă are valori obligatorii standard, se adaugă seed idempotent;
- dacă o bază existentă trebuie actualizată cu o coloană/index nou, se adaugă verificarea în `repairLegacySchema()`.
