"use strict";
const Schedule = require("../models/schedule.model");
var RestResult = require("../models/restResult.model");

exports.findAllOr1 = async function(req, res) {
  if(req.query.name){
    try {
      const schedule = await Schedule.findByName(req.query.name);
      res.json(new RestResult("success", "schedule found", schedule, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find schedule", null, err.toString()));
    }
  }else{
    try {
      const schedules = await Schedule.findAll();
      res.json(new RestResult("success", "schedules found", schedules, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find schedules", null, err.toString()));
    }
  }
};

exports.create = async function (req, res) {
  try {
    const new_schedule = new Schedule(req.body);
    //handles null error

    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      const schedule = await Schedule.create(new_schedule);
      res.json(new RestResult("success", "schedule added", schedule, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to create schedule", null, err.toString()));
  }
};
exports.findById = async function (req, res) {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (schedule.length > 0) {
      res.json(new RestResult("success", "found schedule", schedule[0], ""));
    } else {
      res.json(new RestResult("error", "failed to find schedule", null, err.toString()));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to find schedule", null, err.toString()));
  }
};
exports.update = async function (req, res) {
  try {
    delete req.body.schedulename;
    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      await Schedule.update(new Schedule(req.body), req.params.id);
      res.json(new RestResult("success", "schedule updated", null, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to update schedule", null, err.toString()));
  }
};
exports.delete = async function (req, res) {
  try {
    await Schedule.delete(req.params.id);
    res.json(new RestResult("success", "schedule deleted", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to delete schedule", null, err.toString()));
  }
};
exports.launch = async function (req, res) {
  try {
    await Schedule.queue(req.params.id);
    res.json(new RestResult("success", "schedule imported", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to import schedule", null, err.toString()));
  }
};
