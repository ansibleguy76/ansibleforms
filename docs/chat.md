---
layout: default
title: Chat assistant
nav_order: 7.5
---

# Chat assistant
{: .no_toc }

Fill in and launch forms by talking. A chat button on every page opens an assistant that
finds the right form, asks for what is missing, offers the form's own choices as buttons,
and shows a summary with a **Launch** button. A job starts only when the user clicks it.

1. TOC
{:toc}

## How it works

```text
the user types           -> AnsibleForms server -> the AI model (Anthropic, OpenAI, ...)
                                   |                  asks for a tool
                                   v
                         catalog | resolve | relaunch preview | job status
                                   |   the same form engine as the browser and the MCP server,
                                   |   as the logged-in user, with their roles
                                   v
the page shows the reply, the choices, and a summary card with a Launch button
the user clicks Launch   -> AnsibleForms resolves the form again and launches exactly that payload, once
```

- **Every model call goes from the AnsibleForms server**, never from the browser. The
  browser only talks to AnsibleForms; the provider's API key never leaves the server. On an
  isolated site only the AnsibleForms server needs a route to the model - or the model runs
  inside the network (see [Providers](#providers)).
- **The model cannot launch anything.** Its tools are: list the forms, evaluate a form with
  the answers so far, preview a relaunch, read a job's status. There is no launch tool. A
  complete form becomes a *summary*: sealed, for this user and this conversation, valid 15
  minutes, usable once. The Launch button sends that summary's id - never a payload - and
  the server resolves the form again: when anything moved (a query answers differently, the
  form was edited) it refuses and the user asks again.
- **The user chooses the targets.** A cluster, an SVM, a name to create - every choice field
  and every required name without a default - must be typed by the user or picked from the
  buttons the form offered. The model cannot pick one for them, and never gets the
  browser's "first option" (`__auto__`).
- **Typing "yes" or "launch" does nothing.** Only the button launches.

## Switching it on

Four things, all needed:

1. **`ENABLE_CHAT=1`** - the environment variable (restart). See [customization](customization).
2. **A model provider** - Settings -> Connections -> **Chat assistant**: provider, model, API
   key (stored encrypted), optional base URL, limits. The **Test connection** button makes one
   tiny call. On Kubernetes, declare it in the [config seed](seed) instead.
3. **Forms that take part** - `enableForChat: true` on each form the assistant may offer
   (the designer: form settings -> Chat assistant). It is the only allowlist: a form without
   it is never discussed, even for a user who may open it.
4. **Users who may use it** - the role option `allowChat` (default: true). Set
   `allowChat: false` on a role to keep its members out.

The button appears for a user once all of that holds.

## Providers

Pick the provider on the settings page; it fills in the base URL, the authentication and the
API version, which stay editable. Empty fields fall back to the provider's defaults.

| Provider | Protocol | Base URL (default) | Key sent as |
|---|---|---|---|
| **Anthropic** | Anthropic | `https://api.anthropic.com` | `x-api-key` |
| **OpenAI** | OpenAI | `https://api.openai.com/v1` | `Authorization: Bearer` |
| **Azure OpenAI** | OpenAI | required: `https://<resource>.openai.azure.com/openai/deployments/<deployment>` | `api-key`, API version `2024-10-21` |
| **Google Gemini** | OpenAI | `https://generativelanguage.googleapis.com/v1beta/openai` | Bearer |
| **xAI Grok** | OpenAI | `https://api.x.ai/v1` | Bearer |
| **Mistral** | OpenAI | `https://api.mistral.ai/v1` | Bearer |
| **DeepSeek** | OpenAI | `https://api.deepseek.com/v1` | Bearer |
| **Groq** | OpenAI | `https://api.groq.com/openai/v1` | Bearer |
| **OpenRouter** | OpenAI | `https://openrouter.ai/api/v1` | Bearer |
| **Ollama** | OpenAI | `http://localhost:11434/v1` | none |
| **Other OpenAI-compatible** (LiteLLM, a gateway, vLLM, LM Studio, ...) | OpenAI | required, usually ending in `/v1` | Bearer |

The model id is the one the provider or proxy uses (`claude-opus-5-5`, `gpt-5`, `llama3.3`,
...). The assistant needs a model that supports **tool calling**; small local models vary.

A base URL without a key is enough to switch the chat on: many local model servers and
internal proxies take no key. Then no authorization header is sent at all.

### For a proxy

- **Authentication** - how the key is sent: `Authorization: Bearer`, `api-key`, `x-api-key`,
  or none. Empty is the provider's default.
- **API version** - Anthropic: the `anthropic-version` header (default `2023-06-01`).
  OpenAI-compatible: added to the URL as `?api-version=` (Azure), unless the URL has one.
- **User** - sent with every call as `user` (OpenAI-compatible) or `metadata.user_id`
  (Anthropic). Some proxies require it. Empty sends none.
- **Ignore certificate errors** - for a proxy on a self-signed certificate. Insecure: the
  key goes to whoever answers. Prefer trusting its CA with `NODE_EXTRA_CA_CERTS`.
- **Extra headers** - a JSON object, e.g. `{"X-Org": "ops"}`. One-line text values, at most 20;
  the key and content headers cannot be replaced.

### In a container, behind a proxy

The chat is plain outbound HTTPS from the AnsibleForms server container. Behind a
corporate egress proxy, set `HTTPS_PROXY` **and** `NODE_USE_ENV_PROXY=1` - Node's built-in
HTTP client ignores `HTTPS_PROXY` without the second one. A provider on an internal CA needs
that CA trusted by Node (`NODE_EXTRA_CA_CERTS=/path/to/ca.pem`).
With `NODE_USE_ENV_PROXY=1`, a model or proxy inside the network must be listed in
`NO_PROXY`, or the call goes to the egress proxy, which cannot reach it.

When the connection test fails, its message names the host and the reason: a name that does
not resolve, a refused connection, or a certificate the container does not trust.

## What leaves the network

Sent to the provider, for the forms that take part:

- the form names and descriptions, the field labels, help texts, choices and the values being
  filled in;
- the conversation.

Never sent - not to the provider, not to the page, not to the log:

- passwords (the assistant does not handle password fields: a form that needs one says so and
  sends the user to the browser), stored credentials, the provider's API key;
- a job's output, and its stored extravars (the assistant reads a job's status only, and only
  when **Job status** is on in the settings).

Anything under a key that looks like a secret (`password`, `secret`, `token`, `api_key`, ...)
is masked before the model or the page sees it.

Choose the provider with that in mind: a model in your own tenant (Azure OpenAI) or inside
the network (Ollama) keeps the form data in-house; a public API does not.

## Limits

Set on the settings page:

- **Messages per conversation** (20) - then the user starts a new conversation.
- **Tool rounds per message** (6) - how often the model may call a tool before it answers.
- **Timeout** (60 s) - for one call to the provider.

Fixed: one message at a time per conversation, 60 messages per user per hour, 5
conversations per user, a conversation is forgotten after 2 hours without a message.
Conversations and summaries live in memory: a restart means "start a new conversation".

## Relaunching

"Run job 1234 again" (the user must type the job id) previews a relaunch with the same rules
as the MCP server's `relaunch_job` - including the password rule of
[launch validation](launch-validation) - and shows a **Relaunch** summary; the button
launches it, once. "Run job 1234 again with server web02" changes only that field.

## Audit

Every launch from the chat is recorded as **chat.launch** with the user, the job, the form,
the provider, and the payload hash of the summary that was approved. The settings changes are
recorded as any other settings change.

## Limitations

- **Wizard forms** cannot take part (`enableForChat` is refused on them), nor can the fields
  the assistant does not fill in: passwords, file uploads and `table` fields.
- Replies come in one piece; there is no streaming yet.
- The model can misunderstand. The summary card shows exactly what will be sent - read it
  before you click.
