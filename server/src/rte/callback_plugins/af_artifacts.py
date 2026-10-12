# AnsibleForms : the data a playbook's set_stats gathered (its artifacts, AWX's word), written as
# JSON to the file AF_ARTIFACTS_FILE names when the playbook ends. The RTE stores it on the job,
# and a workflow passes it to the nodes after this one as extra vars, as AWX does.
#
# Loaded without being enabled (CALLBACK_NEEDS_ENABLED False) : the RTE puts its folder first in
# the callback plugins path, and it writes nothing when AF_ARTIFACTS_FILE is not set. Only the
# playbook-wide data (set_stats with per_host false, the default) is written, as AWX does.
from __future__ import annotations

import json
import os

from ansible.plugins.callback import CallbackBase

DOCUMENTATION = """
name: af_artifacts
type: aggregate
short_description: writes the set_stats data to a file, for AnsibleForms
description:
  - When the playbook ends, writes the data set_stats gathered (per_host false) as JSON to the
    file the AF_ARTIFACTS_FILE environment variable names.
"""


class CallbackModule(CallbackBase):
    CALLBACK_VERSION = 2.0
    CALLBACK_TYPE = "aggregate"
    CALLBACK_NAME = "af_artifacts"
    CALLBACK_NEEDS_ENABLED = False

    def v2_playbook_on_stats(self, stats):
        """Writes the playbook-wide set_stats data, once the playbook ended.

        Args:
            stats: the playbook's stats ; its custom data under '_run' is set_stats'.
        """
        path = os.environ.get("AF_ARTIFACTS_FILE")
        if not path:
            return
        data = (getattr(stats, "custom", None) or {}).get("_run", {}) or {}
        try:
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(data, handle, default=str)
        except OSError as error:
            self._display.warning(f"AnsibleForms could not store the set_stats data : {error}")
