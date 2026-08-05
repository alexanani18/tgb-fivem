# Services

Acest director conține logica reutilizabilă a aplicației.

## Reguli

- conține logică de business;
- poate folosi baza de date;
- poate folosi alte servicii;
- nu trimite răspunsuri HTTP.

## Exemple

```ts
requireAdmin()

requireEmployee()

uniformUpload()
```