# AnsibleForms : a playbook's structured events, one JSON line each in the file AF_EVENTS_FILE
# names, next to the usual text output : a play starts, a task starts, a host's result (ok,
# changed, failed, skipped, unreachable), and the recap. The RTE reads the file as the playbook
# runs and the app stores the events (job_events) : the job page draws its host-by-task grid,
# its timeline and its recap from them.
#
# Loaded without being enabled (CALLBACK_NEEDS_ENABLED False), as af_artifacts : the RTE puts its
# folder first in the callback plugins path, and it writes nothing when AF_EVENTS_FILE is not set.
# A result carries its message and a few fields, never the module's whole return : the full text
# is in the output already, and a result can be large.
from __future__ import annotations

import json
import os
import time

from ansible.plugins.callback import CallbackBase

DOCUMENTATION = """
name: af_events
type: aggregate
short_description: writes the playbook's events as JSON lines, for AnsibleForms
description:
  - Writes one JSON line per play start, task start, host result and the recap to the file the
    AF_EVENTS_FILE environment variable names.
"""

# the fields of a result kept on its event : enough to say what happened, never the whole return
RESULT_FIELDS = ("msg", "rc", "stderr", "changed", "skip_reason", "failed_when_result", "attempts")
# a text field cut at this length : the full text is in the output
MAX_TEXT = 2000
# the whole result, as a task's details show it (the job page, a click on a host's line) : at most
# this many characters of JSON ; past it, its long texts and lists are cut
MAX_RESULT = 65536
MAX_RESULT_TEXT = 8000
MAX_RESULT_ITEMS = 200


def _short(value):
    """Cuts a long text, leaves anything else as it is.

    Args:
        value: a field's value.

    Returns:
        The value, a text cut at MAX_TEXT characters.
    """
    if isinstance(value, str) and len(value) > MAX_TEXT:
        return value[:MAX_TEXT] + "..."
    return value


def _trim(value):
    """Cuts a result's long texts and lists, recursively, so its JSON stays readable and small.

    Args:
        value: a result or one of its values.

    Returns:
        The value, its texts at most MAX_RESULT_TEXT characters and its lists MAX_RESULT_ITEMS long.
    """
    if isinstance(value, str):
        return value if len(value) <= MAX_RESULT_TEXT else value[:MAX_RESULT_TEXT] + "..."
    if isinstance(value, list):
        cut = [_trim(v) for v in value[:MAX_RESULT_ITEMS]]
        if len(value) > MAX_RESULT_ITEMS:
            cut.append(f"... {len(value) - MAX_RESULT_ITEMS} more")
        return cut
    if isinstance(value, dict):
        return {k: _trim(v) for k, v in value.items()}
    return value


def _full(data):
    """A host's whole result, as its details show it : Ansible's own keys (_ansible_*) left out,
    cut when its JSON is longer than MAX_RESULT. A task with no_log has its result censored by
    Ansible before it comes here.

    Args:
        data: the result's dictionary.

    Returns:
        The result to keep, or None when there is none.
    """
    kept = {k: v for k, v in (data or {}).items() if not str(k).startswith("_ansible")}
    if not kept:
        return None
    if len(json.dumps(kept, default=str)) > MAX_RESULT:
        kept = _trim(kept)
        if len(json.dumps(kept, default=str)) > MAX_RESULT:
            kept = {"msg": "The result is too large to keep", "keys": sorted(kept.keys())}
    return kept


class CallbackModule(CallbackBase):
    CALLBACK_VERSION = 2.0
    CALLBACK_TYPE = "aggregate"
    CALLBACK_NAME = "af_events"
    CALLBACK_NEEDS_ENABLED = False

    def __init__(self, *args, **kwargs):
        """Opens the events file, when one is named."""
        super().__init__(*args, **kwargs)
        self._path = os.environ.get("AF_EVENTS_FILE")
        self._handle = None
        self._play = ""
        self._task = ""
        self._task_uuid = ""
        # when each host started the current task : a result's duration
        self._started = {}
        if self._path:
            try:
                self._handle = open(self._path, "a", encoding="utf-8")
            except OSError as error:
                self._display.warning(f"AnsibleForms could not write the playbook's events : {error}")

    def _emit(self, kind, **fields):
        """Writes one event as a JSON line, at once (the RTE reads the file as it grows).

        Args:
            kind: the event's type (play, task, ok, changed, failed, skipped, unreachable, stats).
            fields: its fields.
        """
        if not self._handle:
            return
        event = {"type": kind, "time": round(time.time(), 3), "play": self._play, "task": self._task}
        event.update({k: v for k, v in fields.items() if v is not None})
        try:
            self._handle.write(json.dumps(event, default=str) + "\n")
            self._handle.flush()
        except OSError:
            self._handle = None

    def v2_playbook_on_play_start(self, play):
        """A play starts.

        Args:
            play: the play.
        """
        self._play = play.get_name().strip()
        self._task = ""
        self._emit("play")

    def v2_playbook_on_task_start(self, task, is_conditional):
        """A task starts on the play's hosts.

        Args:
            task: the task.
            is_conditional: whether it runs only on some hosts.
        """
        self._task = task.get_name().strip()
        self._task_uuid = task._uuid
        self._started = {}
        self._emit("task", action=task.action)

    def v2_playbook_on_handler_task_start(self, task):
        """A handler starts : a task like the others.

        Args:
            task: the handler.
        """
        self.v2_playbook_on_task_start(task, False)

    def v2_runner_on_start(self, host, task):
        """A host starts the task : its duration counts from here.

        Args:
            host: the host.
            task: the task.
        """
        self._started[host.get_name()] = time.time()

    def _result(self, kind, result):
        """A host's result.

        Args:
            kind: ok, changed, failed, skipped or unreachable.
            result: the task's result for that host.
        """
        host = result._host.get_name()
        data = result._result or {}
        began = self._started.pop(host, None)
        self._emit(kind, host=host, duration=round(time.time() - began, 3) if began else None, start=round(began, 3) if began else None, **self._fields(result, data))

    def _fields(self, result, data):
        """What a host's result or loop item says : its summary, its item, its module and its whole
        result (its details).

        Args:
            result: the task's result for that host.
            data: its dictionary.

        Returns:
            The event's fields.
        """
        fields = {k: _short(data[k]) for k in RESULT_FIELDS if k in data}
        item = data.get("item") if "item" in data else None
        task = getattr(result, "_task", None)
        return {
            "item": _short(item if isinstance(item, (str, int, float, bool)) else json.dumps(item, default=str)) if item is not None else None,
            "data": fields or None,
            "action": getattr(task, "action", None),
            "result": _full(data),
        }

    def _item(self, status, result):
        """One item of a loop : a line of the output of its own, with its details.

        Args:
            status: ok, changed, failed or skipped.
            result: the item's result.
        """
        data = result._result or {}
        self._emit("item", host=result._host.get_name(), status=status, **self._fields(result, data))

    def v2_runner_item_on_ok(self, result):
        """A loop's item was ok, or changed something.

        Args:
            result: the item's result.
        """
        self._item("changed" if (result._result or {}).get("changed") else "ok", result)

    def v2_runner_item_on_failed(self, result):
        """A loop's item failed.

        Args:
            result: the item's result.
        """
        self._item("failed", result)

    def v2_runner_item_on_skipped(self, result):
        """A loop's item was skipped.

        Args:
            result: the item's result.
        """
        self._item("skipped", result)

    def v2_runner_on_ok(self, result):
        """A host's result was ok, or changed something.

        Args:
            result: the result.
        """
        self._result("changed" if (result._result or {}).get("changed") else "ok", result)

    def v2_runner_on_failed(self, result, ignore_errors=False):
        """A host's task failed.

        Args:
            result: the result.
            ignore_errors: the task ignores errors : the play goes on.
        """
        self._result("failed", result)
        if ignore_errors:
            self._emit("ignored", host=result._host.get_name())

    def v2_runner_on_skipped(self, result):
        """A host skipped the task.

        Args:
            result: the result.
        """
        self._result("skipped", result)

    def v2_runner_on_unreachable(self, result):
        """A host could not be reached.

        Args:
            result: the result.
        """
        self._result("unreachable", result)

    def v2_playbook_on_stats(self, stats):
        """The recap : per host, how many tasks were ok, changed, failed...

        Args:
            stats: the playbook's stats.
        """
        hosts = {}
        for host in sorted(stats.processed.keys()):
            summary = stats.summarize(host)
            hosts[host] = {k: summary.get(k, 0) for k in ("ok", "changed", "unreachable", "failures", "skipped", "rescued", "ignored")}
        self._task = ""
        self._emit("stats", data=hosts)
        if self._handle:
            try:
                self._handle.close()
            except OSError:
                pass
            self._handle = None
