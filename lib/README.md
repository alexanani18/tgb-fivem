# Lib

Acest director conține toată logica backend-ului.

## Structură

- `database` - acces la baza de date și query-uri SQL.
- `routes` - endpoint-urile API.
- `services` - logică reutilizabilă.
- `validators` - validarea datelor.
- `types` - tipuri și interfețe comune.

## Reguli

- fiecare componentă are o singură responsabilitate;
- evităm duplicarea codului;
- accesul la baza de date se face exclusiv prin `database/`.