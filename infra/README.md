# Infraestructura (AWS · us-west-2)

ChatBot Creator es una app **100 % cliente**: no hay backend ni base de datos.
Los flujos viven en el navegador y se mueven con Exportar/Importar JSON.

```
navegador ──► CloudFront ──► S3 (privado, solo accesible por CloudFront)
     │
     └──────► Cognito Hosted UI (login con Authorization Code + PKCE)
```

| Pieza | Para qué |
|---|---|
| **S3** | Los archivos compilados. Bucket privado: no se sirve nada directamente desde él. |
| **CloudFront** | CDN + HTTPS. Devuelve `index.html` en cualquier ruta desconocida (SPA). |
| **Cognito** | Login. Sin auto-registro: los usuarios los crea un administrador. |

Todo el stack lleva la etiqueta `Project=ChatBotMediaCreator`.

## Desplegar

Requiere el perfil `~/.aws/Personal` y Docker (la compilación corre en contenedor).

```bash
./infra/deploy.sh              # infraestructura + compilar + subir
./infra/deploy.sh --solo-app   # solo cambios de código (lo habitual)
```

El script lee del stack el dominio y el cliente de Cognito, compila la app con
esos valores (`VITE_COGNITO_DOMINIO`, `VITE_COGNITO_CLIENTE`, `VITE_URL_APP`),
sube los assets con caché de un año y el `index.html` sin caché, e invalida
CloudFront.

## Usuarios

```bash
./infra/usuario.sh correo@ejemplo.com
```

Cognito manda una contraseña temporal por correo; el Hosted UI obliga a
cambiarla en el primer acceso.

## Notas

- **En desarrollo no hay login**: sin las variables `VITE_COGNITO_*`, el módulo
  `src/auth.js` se desactiva y `docker compose up` funciona como siempre.
- Los tokens se guardan en `sessionStorage` (mueren al cerrar la pestaña), nunca
  junto a los flujos. No hay refresco automático: al expirar, se vuelve a pedir
  login.
- El bucket tiene `DeletionPolicy: Retain` — borrar el stack no borra los
  archivos.
- **Cuando haga falta backend** (publicar en la Cloud API, recibir webhooks de
  Meta): API Gateway HTTP API + Lambda + Secrets Manager, que sigue sin coste en
  reposo. No hace falta tocar nada de lo de aquí.
