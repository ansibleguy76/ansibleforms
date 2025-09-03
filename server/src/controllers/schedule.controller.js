
"use strict";
import Schedule from "../models/schedule.model.js";
import RestResult from "../models/restResult.model.v2.js";
import Errors from "../lib/errors.js";

const scheduleController = {
  async find(req, res) {
    try {
      if (req.query.name) {
        const schedule = await Schedule.findByName(req.query.name);
        return res.json(RestResult.single(schedule));
      } else {
        const schedules = await Schedule.findAll();
        return res.json(RestResult.list(schedules));
      }
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async create(req, res) {
    try {
      const created = await Schedule.create(req.body);
      return res.status(201).json(RestResult.single("schedule added", created));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async findById(req, res) {
    try {
      const schedule = await Schedule.findById(req.params.id);
      return res.json(RestResult.single(schedule));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async update(req, res) {
    try {
      const updated = await Schedule.update(req.body, req.params.id);
      return res.json(RestResult.single(updated));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async delete(req, res) {
    try {
      const deleted = await Schedule.delete(req.params.id);
      return res.json(RestResult.single(deleted));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async queue(req, res) {
    try {
      await Schedule.queue(req.params.id);
      return res.json(RestResult.single("Schedule queued", req.params.id));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async launch(req, res) {
    try {
      await Schedule.launch(req.params.id);
      return res.json(RestResult.single("Schedule launched", req.params.id));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default scheduleController;