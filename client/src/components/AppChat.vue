<script setup>
/******************************************************************/
/*                                                                */
/*  The chat assistant (ENABLE_CHAT)                              */
/*                                                                */
/*  A floating button on every page ; the panel talks to          */
/*  /api/v2/chat. The model runs on the server - this page never  */
/*  sees a provider or a key. It shows the reply, the choices the */
/*  form offers, and a summary card : the ONLY way a job starts   */
/*  from here is a click on that card's button, which sends the   */
/*  plan id - never the payload - to /chat/approve.               */
/*                                                                */
/******************************************************************/
import axios from 'axios';
import showdown from 'showdown';
import { useI18n } from 'vue-i18n';
import TokenStorage from '@/lib/TokenStorage';
import { sanitize } from '@/lib/HtmlSanitizer';
import { useAppStore } from '@/stores/app';

const { t } = useI18n();
const store = useAppStore();

const SESSION_KEY = 'af_chat_session';
const MAX_SHOWN_CHOICES = 12;

const visible = computed(() => store.authenticated && store.chatEnabled && store.profile?.options?.allowChat !== false);
const open = ref(false);
const fullscreen = ref(false);
const busy = ref(false);
const input = ref('');
const entries = ref([]); // { role: user|assistant|error, text, choices, proposals, job }
const scroller = ref(null);
const inputBox = ref(null);
let sessionId = readSession();

const converter = new showdown.Converter({ ghCodeBlocks: true, simplifiedAutoLink: true, tables: true, openLinksInNewWindow: true, strikethrough: true });
// the model's text is untrusted : markdown to html, then the one html policy of the app
const render = (text) => sanitize(converter.makeHtml(String(text || '')));

function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}
function writeSession(id) {
    sessionId = id || '';
    try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* private window */ }
}

async function ensureSession() {
    if (sessionId) return sessionId;
    const res = await axios.post('/api/v2/chat/session', {}, TokenStorage.getAuthentication());
    writeSession(res.data.sessionId);
    return sessionId;
}

function errorText(err, fallback) {
    const e = err?.response?.data?.error;
    return e?.message || err?.message || fallback;
}

async function scrollDown() {
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

async function send(text, selection) {
    const message = String(text ?? input.value).trim();
    if (!message || busy.value) return;
    input.value = '';
    entries.value.push({ role: 'user', text: message });
    busy.value = true;
    scrollDown();
    try {
        await ensureSession();
        let res;
        try {
            res = await axios.post('/api/v2/chat/message', { sessionId, message, selection }, TokenStorage.getAuthentication());
        } catch (err) {
            // the server forgot the conversation (a restart) : one new one, same message
            if (err?.response?.data?.error?.code !== 'session_not_found') throw err;
            writeSession('');
            await ensureSession();
            res = await axios.post('/api/v2/chat/message', { sessionId, message, selection }, TokenStorage.getAuthentication());
        }
        const d = res.data || {};
        entries.value.push({
            role: 'assistant',
            text: d.reply,
            choices: (d.choices || []).slice(0, 3),
            proposals: (d.proposals || []).map((p) => ({ ...p, state: 'open', showDetails: false })),
            job: d.job || null,
        });
    } catch (err) {
        const code = err?.response?.data?.error?.code;
        entries.value.push({ role: 'error', text: errorText(err, t('chat.failed')), limit: code === 'turn_limit' });
    } finally {
        busy.value = false;
        scrollDown();
        nextTick(() => inputBox.value?.focus());
    }
}

function pick(group, option) {
    send(String(option.value), { slot: group.slot, value: String(option.value) });
}

async function approve(proposal) {
    if (proposal.state !== 'open') return;
    proposal.state = 'busy';
    try {
        const res = await axios.post('/api/v2/chat/approve', { sessionId, planId: proposal.planId }, TokenStorage.getAuthentication());
        proposal.state = 'done';
        proposal.jobId = res.data?.job?.id ?? null;
        if (proposal.jobId) track(proposal);
    } catch (err) {
        proposal.state = 'failed';
        proposal.error = errorText(err, t('chat.failed'));
    }
    scrollDown();
}

// Follow a launched job until it ends, as the form page does : its status and the last
// lines of its output, here in the page only - none of it goes to the model.
const FINAL = ['success', 'error', 'failed', 'warning', 'rejected', 'abandoned', 'aborted'];
const TAIL_LINES = 6;
const timers = new Set();
function track(proposal, failures = 0) {
    const timer = setTimeout(async () => {
        timers.delete(timer);
        try {
            const res = await axios.get(`/api/v2/job/${proposal.jobId}`, TokenStorage.getAuthentication());
            const job = res.data || {};
            proposal.jobStatus = job.status;
            proposal.jobTail = String(job.output || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
                .split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean).slice(-TAIL_LINES).join('\n');
            if (!FINAL.includes(job.status)) track(proposal);
            scrollDown();
        } catch {
            // a blip, or no permission to read jobs : stop after a few, the link stays
            if (failures < 3) track(proposal, failures + 1);
        }
    }, 2000);
    timers.add(timer);
}
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t)));

const statusClass = (s) => ({ success: 'text-success', failed: 'text-danger', error: 'text-danger', aborted: 'text-danger', warning: 'text-warning', rejected: 'text-danger' }[s] || 'text-body-secondary');

async function newConversation() {
    const old = sessionId;
    writeSession('');
    entries.value = [];
    input.value = '';
    if (old) axios.post('/api/v2/chat/reset', { sessionId: old }, TokenStorage.getAuthentication()).catch(() => {});
    nextTick(() => inputBox.value?.focus());
}

function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
}

function toggle() {
    open.value = !open.value;
    if (open.value) nextTick(() => { inputBox.value?.focus(); scrollDown(); });
}

function onEscape(e) {
    if (e.key === 'Escape' && open.value) {
        if (fullscreen.value) fullscreen.value = false;
        else open.value = false;
    }
}
onMounted(() => window.addEventListener('keydown', onEscape));
onBeforeUnmount(() => window.removeEventListener('keydown', onEscape));

const labelFor = (p) => ({ Approve: t('chat.approve'), Launch: t('chat.launch'), Relaunch: t('chat.relaunch') }[p.label] || p.label);
const pretty = (v) => JSON.stringify(v, null, 2);
const expires = (p) => { try { return new Date(p.expiresAt).toLocaleTimeString(); } catch { return ''; } };
</script>

<template>
    <template v-if="visible">
        <button v-if="!open" type="button" class="af-chat-button btn btn-primary rounded-circle shadow" :title="t('chat.open')" :aria-label="t('chat.open')" @click="toggle">
            <FaIcon icon="comments" size="lg" />
        </button>

        <section v-if="open" class="af-chat-panel card shadow-lg" :class="{ 'af-chat-full': fullscreen }" role="dialog" :aria-label="t('chat.title')">
            <header class="card-header d-flex align-items-center gap-2 py-2">
                <FaIcon icon="robot" class="text-primary" />
                <strong class="me-auto">{{ t('chat.title') }}</strong>
                <button type="button" class="btn btn-sm btn-link text-body" :title="t('chat.newConversation')" @click="newConversation"><FaIcon icon="rotate-right" /></button>
                <button type="button" class="btn btn-sm btn-link text-body d-none d-md-inline" :title="fullscreen ? t('chat.exitFullscreen') : t('chat.fullscreen')" @click="fullscreen = !fullscreen">
                    <FaIcon :icon="fullscreen ? 'compress' : 'expand'" />
                </button>
                <button type="button" class="btn btn-sm btn-link text-body" :title="t('chat.close')" @click="open = false"><FaIcon icon="xmark" /></button>
            </header>

            <div ref="scroller" class="card-body af-chat-body">
                <p v-if="!entries.length" class="text-body-secondary small">{{ t('chat.intro') }}</p>
                <div v-for="(e, i) in entries" :key="i" class="mb-3">
                    <div v-if="e.role === 'user'" class="d-flex justify-content-end">
                        <div class="af-chat-bubble af-chat-user">{{ e.text }}</div>
                    </div>
                    <div v-else-if="e.role === 'error'" class="alert alert-warning py-2 mb-0 small">
                        {{ e.text }}
                        <button v-if="e.limit" type="button" class="btn btn-sm btn-link p-0 ms-1" @click="newConversation">{{ t('chat.newConversation') }}</button>
                    </div>
                    <div v-else>
                        <!-- eslint-disable-next-line vue/no-v-html -- markdown of the model, through the app's html sanitizer -->
                        <div class="af-chat-bubble af-chat-assistant" v-html="render(e.text)"></div>

                        <div v-for="g in e.choices" :key="g.slot" class="mt-2">
                            <div class="small text-body-secondary mb-1">{{ g.slot }}</div>
                            <div class="d-flex flex-wrap gap-1">
                                <button v-for="o in g.options.slice(0, MAX_SHOWN_CHOICES)" :key="String(o.value)" type="button" class="btn btn-sm btn-outline-primary" :disabled="busy || i !== entries.length - 1" @click="pick(g, o)">{{ o.value }}</button>
                                <span v-if="g.options.length > MAX_SHOWN_CHOICES" class="small text-body-secondary align-self-center">{{ t('chat.moreChoices', { count: g.options.length - MAX_SHOWN_CHOICES }) }}</span>
                            </div>
                        </div>

                        <div v-for="p in e.proposals" :key="p.planId" class="card mt-2 border-primary">
                            <div class="card-body py-2">
                                <div class="fw-semibold">{{ p.summary }}</div>
                                <div v-if="p.optionalSwitches?.length" class="small text-body-secondary mt-1">
                                    {{ t('chat.switchesOff') }} {{ p.optionalSwitches.map((s) => s.prompt).join(', ') }}
                                </div>
                                <button type="button" class="btn btn-sm btn-link p-0 mt-1" @click="p.showDetails = !p.showDetails">
                                    {{ p.showDetails ? t('chat.hideDetails') : t('chat.showDetails') }}
                                </button>
                                <pre v-if="p.showDetails" class="af-chat-pre small mt-1 mb-2">{{ pretty(p.extravars) }}</pre>
                                <div class="d-flex align-items-center gap-2 mt-2">
                                    <button v-if="p.state === 'open' || p.state === 'busy'" type="button" class="btn btn-sm" :class="p.risk === 'read' ? 'btn-primary' : 'btn-warning'" :disabled="p.state === 'busy'" @click="approve(p)">
                                        <FaIcon :icon="p.state === 'busy' ? 'spinner' : 'play'" class="me-1" />{{ labelFor(p) }}
                                    </button>
                                    <span v-if="p.state === 'open'" class="small text-body-secondary">{{ t('chat.expires', { time: expires(p) }) }}</span>
                                    <span v-if="p.state === 'done'" class="small">
                                        <FaIcon :icon="p.jobStatus && !FINAL.includes(p.jobStatus) ? 'spinner' : 'circle-check'" class="me-1" :class="statusClass(p.jobStatus || 'success')" />
                                        <router-link v-if="p.jobId" :to="`/jobs/${p.jobId}`">{{ t('chat.job') }} #{{ p.jobId }}</router-link>
                                        <strong class="ms-1" :class="statusClass(p.jobStatus)">{{ p.jobStatus || t('chat.jobStarted') }}</strong>
                                    </span>
                                    <span v-if="p.state === 'failed'" class="small text-danger">{{ p.error }}</span>
                                </div>
                                <pre v-if="p.jobTail" class="af-chat-pre small mt-2 mb-0">{{ p.jobTail }}</pre>
                            </div>
                        </div>

                        <div v-if="e.job" class="small text-body-secondary mt-1">
                            <router-link :to="`/jobs/${e.job.id}`">#{{ e.job.id }}</router-link> {{ e.job.form }} : <strong>{{ e.job.status }}</strong>
                        </div>
                    </div>
                </div>
                <div v-if="busy" class="text-body-secondary small"><FaIcon icon="spinner" class="me-1" />{{ t('chat.thinking') }}</div>
            </div>

            <footer class="card-footer p-2">
                <div class="d-flex gap-2 align-items-end">
                    <textarea ref="inputBox" v-model="input" class="form-control form-control-sm af-chat-input" rows="2" :placeholder="t('chat.placeholder')" :disabled="busy" @keydown="onKey"></textarea>
                    <button type="button" class="btn btn-primary btn-sm" :disabled="busy || !input.trim()" :title="t('chat.send')" @click="send()"><FaIcon icon="paper-plane" /></button>
                </div>
                <div class="small text-body-secondary mt-1">{{ t('chat.disclaimer') }}</div>
            </footer>
        </section>
    </template>
</template>

<style scoped>
.af-chat-button {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    width: 3.5rem;
    height: 3.5rem;
    z-index: 1060;
}
.af-chat-panel {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    width: min(520px, calc(100vw - 2.5rem));
    height: min(720px, calc(100vh - 2.5rem));
    z-index: 1060;
    display: flex;
    flex-direction: column;
}
.af-chat-full {
    inset: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
}
/* a phone gets the whole screen */
@media (max-width: 767.98px) {
    .af-chat-panel { inset: 0; width: 100vw; height: 100vh; border-radius: 0; }
}
.af-chat-body {
    flex: 1 1 auto;
    overflow-y: auto;
}
.af-chat-bubble {
    display: inline-block;
    max-width: 90%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    overflow-wrap: anywhere;
}
.af-chat-user {
    background: var(--bs-primary);
    color: var(--bs-white);
    white-space: pre-wrap;
}
.af-chat-assistant {
    background: var(--bs-tertiary-bg);
}
.af-chat-assistant :deep(p:last-child) { margin-bottom: 0; }
.af-chat-assistant :deep(pre) { white-space: pre-wrap; }
.af-chat-pre {
    max-height: 16rem;
    overflow: auto;
    background: var(--bs-tertiary-bg);
    padding: 0.5rem;
    border-radius: 0.375rem;
}
.af-chat-input { resize: none; }
</style>
