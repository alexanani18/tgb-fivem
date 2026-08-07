# Baza de date

Acest director conține toate fișierele necesare pentru crearea și inițializarea bazei de date a aplicației.

## Structură

```text
database/
├── schema/      # Structura bazei de date
├── seed/        # Date implicite ale aplicației
└── scripts/     # Scripturi pentru administrarea bazei de date
```

## Comenzi disponibile

### Instalarea bazei de date

Creează toate tabelele și inserează datele implicite.

```bash
npm.cmd run db:install
```

### Resetarea bazei de date

Șterge toate tabelele din baza de date.

```bash
npm.cmd run db:reset
```

### Resetare completă

Șterge toate tabelele și reinstalează complet baza de date împreună cu datele implicite.

```bash
npm.cmd run db:fresh
```

## Schema

Directorul `schema` conține structura bazei de date.

- fiecare tabel este definit într-un fișier separat;
- fișierele sunt executate automat în ordine alfabetică.

## Seed

Directorul `seed` conține doar datele implicite necesare funcționării aplicației.

Exemple:

- roluri utilizatori;
- rank-uri;
- cont administrator;
- alte configurații implicite.

Datele generate de utilizatori **nu trebuie** adăugate în acest director.

## Observații

- baza de date trebuie creată înainte de rularea scripturilor;
- conexiunea la baza de date este preluată din fișierul `.env`;
- orice tabel nou trebuie adăugat în directorul `schema`;
- dacă tabelul necesită date implicite, se creează și un fișier corespunzător în directorul `seed`.