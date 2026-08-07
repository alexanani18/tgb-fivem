# Database

Acest director conține exclusiv accesul la baza de date.

## Reguli

- un fișier pentru fiecare tabel sau modul;
- doar query-uri SQL;
- nu se face validare;
- nu se face logică de business;
- nu se folosesc obiectele `req` sau `res`.

## Exemplu

```ts
getUserById()

getUniforms()

updateNotification()
```