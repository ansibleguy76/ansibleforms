/******************************************************************/
/*                                                                */
/*  A playbook's structured events (job_events) : what the        */
/*  af_events callback plugin writes - a play starts, a task      */
/*  starts, a host's result, the recap - stored as they come and  */
/*  read back by the job page for its host-by-task grid, its      */
/*  timeline and its recap. Masked as the output : a result's     */
/*  message may hold a secret.                                    */
/*                                                                */
/******************************************************************/
import mysql from "./db.model.js";
import { maskOutput } from "../lib/outputMask.js";

// the event types the plugin writes ; anything else is not stored
const TYPES = new Set(["play", "task", "ok", "changed", "failed", "skipped", "unreachable", "ignored", "stats"]);

/**
 * Cuts a text to a column's length.
 *
 * Args:
 *   value (any): the value.
 *   max (number): the length.
 *
 * Returns:
 *   string|null: the text, or null for none.
 */
const cut = (value, max) => (value === undefined || value === null || value === "" ? null : String(value).slice(0, max));

/**
 * A number, or null.
 *
 * Args:
 *   value (any): the value.
 *
 * Returns:
 *   number|null
 */
const num = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);

const JobEvent = {
  /**
   * Stores events of a job. An event already stored (the same order, resent after a reconnect)
   * is left as it is.
   *
   * Args:
   *   jobId (number): the job.
   *   events (object[]): [{ order, type, play, task, host, duration, time, item, data }].
   *
   * Returns:
   *   Promise<number>: the events stored.
   */
  async create(jobId, events) {
    const rows = [];
    for (const e of events || []) {
      if (!e || !TYPES.has(e.type) || !Number.isInteger(Number(e.order))) continue;
      const data = e.data === undefined && e.item === undefined ? null : JSON.stringify(e.item === undefined ? e.data : { ...(e.data || {}), item: e.item });
      rows.push([
        jobId,
        Number(e.order),
        e.type,
        cut(e.play, 500),
        cut(e.task, 500),
        cut(e.host, 250),
        num(e.duration),
        num(e.time),
        data === null ? null : maskOutput(jobId, data),
      ]);
    }
    if (!rows.length) return 0;
    const res = await mysql.do(
      "INSERT IGNORE INTO AnsibleForms.`job_events` (job_id, `order`, type, play, task, host, duration, time, data) VALUES ?",
      [rows]
    );
    return res?.affectedRows || 0;
  },

  /**
   * A job's events, in order.
   *
   * Args:
   *   jobId (number): the job.
   *
   * Returns:
   *   Promise<object[]>: [{ order, type, play, task, host, duration, time, data }], data parsed.
   */
  async findByJob(jobId) {
    const rows = await mysql.do(
      "SELECT `order`, type, play, task, host, duration, time, data FROM AnsibleForms.`job_events` WHERE job_id=? ORDER BY `order`",
      [jobId]
    );
    return (rows || []).map((r) => {
      let data = null;
      if (r.data) {
        try {
          data = JSON.parse(r.data);
        } catch {
          data = { msg: r.data };
        }
      }
      return {
        order: r.order,
        type: r.type,
        play: r.play,
        task: r.task,
        host: r.host,
        duration: r.duration === null ? null : Number(r.duration),
        time: r.time === null ? null : Number(r.time),
        data,
      };
    });
  },
};

export default JobEvent;
