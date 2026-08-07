# Validators

Acest director conține toate funcțiile de validare.

## Reguli

- validează datele primite din request;
- nu accesează baza de date;
- nu folosesc `req` sau `res`;
- returnează valori validate sau `null`.

## Exemplu

```ts
validateUsername()

validateTitle()

parseRack()
```