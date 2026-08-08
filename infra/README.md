# Infraestructura (AWS · us-west-2)

ChatBot Creator no tiene base de datos: los flujos viven en el navegador y su
copia duradera son **objetos JSON en el mismo bucket de S3** que sirve el sitio.

```
navegador ──► CloudFront ──► S3  (privado, solo accesible por CloudFront)
     │                        ▲
     │                        │  flujos/<sub>/…  ← escribe solo la Lambda
     ├──────► Cognito         │
     └──────► Lambda ─────────┘  (invocada con SigV4, verifica el token)
```

| Pieza | Para qué |
|---|---|
| **S3** | Los archivos compilados **y los flujos de los usuarios** (`flujos/<sub>/`, versionado). Bucket privado: no se sirve nada directamente desde él. |
| **CloudFront** | CDN + HTTPS. Devuelve `index.html` en cualquier ruta desconocida (SPA). |
| **Cognito** | Login. Sin auto-registro: los usuarios los crea un administrador. El formulario es de la propia app (no el Hosted UI): se llama a la API de Cognito desde el navegador, así nunca se sale del dominio. |

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

## Motor de cómputo (Lambda)

El auto-organizado (dagre) y el análisis del flujo se calculan en una **Lambda**,
no en el portátil. El navegador la invoca así:

1. El `id_token` de Cognito se cambia por **credenciales temporales de AWS** en
   un **Identity Pool** (`src/aws/sigv4.js`).
2. Con ellas se **firma la petición con SigV4** —sin SDK, con WebCrypto— y se
   llama a la **API `Invoke` de Lambda**.

Dos caminos que **no** funcionan en esta cuenta y por qué, para no repetirlos:

- **Function URL pública** (`AuthType: NONE`): devuelve 403 aunque la política de
  recursos lo permita.
- **Function URL con `AWS_IAM`**: acepta credenciales de root pero **rechaza las
  credenciales temporales del Identity Pool**, con el mismo rol que IAM sí
  autoriza (`simulate-principal-policy` dice *allowed*). La API `Invoke` acepta
  esas mismas credenciales sin problema — de ahí la vía elegida.
- **CloudFront + OAC hacia la Function URL**: CloudFront no llega a firmar.

Sin API Gateway, por tanto sin coste fijo. El endpoint de Lambda admite CORS
(`access-control-allow-origin: *`), así que el navegador puede llamarlo directo.

## Flujos guardados (persistencia)

Cada flujo se guarda en `s3://<bucket>/flujos/<sub>/<id>.json`, con un
`index.json` por usuario para la portada. `<sub>` es el identificador del usuario
**tomado del token verificado en la Lambda**, nunca de lo que mande el navegador,
y el `id` se valida contra `[A-Za-z0-9_-]{1,64}` (nada de `../`).

Tres cosas que hacen que compartir bucket con el sitio sea seguro y no un riesgo:

- La política del bucket **deniega** a CloudFront leer `flujos/*`: aunque alguien
  acierte la ruta, recibe 403 (que el mapeo SPA convierte en `index.html`).
- El rol de la Lambda solo puede tocar ese prefijo; el rol del navegador **no
  tiene permisos de S3**: todo pasa por la función.
- `deploy.sh` excluye `flujos/*` del `aws s3 sync --delete`. Sin esa exclusión,
  cada despliegue borraría los flujos de todo el mundo (pasó una vez, en pruebas).

El bucket tiene **versionado** con expiración de versiones antiguas a los 30 días:
un guardado malo o un borrado accidental se puede recuperar dentro de ese plazo.

El navegador sube el flujo **2,5 s después de dejar de editar**, agrupando la
ráfaga del autoguardado; al entrar cruza su índice con el de S3 y gana la copia
más reciente de cada flujo. Si la nube falla, se sigue editando en local y la
subida se reintenta.

## Dominio propio

La app responde en **https://dev.sebasgomezrubio.com** (CloudFront + certificado
de ACM en *us-east-1*, que es donde CloudFront los exige).

El DNS del dominio **no está en Route 53** (lo gestiona Hostinger), así que el
registro se crea allí a mano:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| CNAME | `dev` | `d3vl8jx5qstlaa.cloudfront.net` | 300 |

El dominio y el certificado se pasan como parámetros del stack (ver `deploy.sh`):
`DominioApp` y `CertificadoArn`. Con `DominioApp=""` se vuelve al dominio de
CloudFront sin tocar nada más.

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
- El bucket tiene `DeletionPolicy: Retain` — borrar el stack no borra ni los
  archivos del sitio ni los flujos.
- **Cuando haga falta backend** (publicar en la Cloud API, recibir webhooks de
  Meta): API Gateway HTTP API + Lambda + Secrets Manager, que sigue sin coste en
  reposo. No hace falta tocar nada de lo de aquí.
