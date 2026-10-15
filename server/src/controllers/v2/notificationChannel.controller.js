"use strict";
// Connections > Notifications : the channels notifications go to (models/notificationChannel),
// and a test notification through one (lib/notifiers). A Slack or Teams webhook address is a
// secret : every answer hands it back masked.
import NotificationChannel from "../../models/notificationChannel.model.js";
import { send } from "../../lib/notifiers.js";
import RestResult from "../../models/restResult.model.v2.js";
import Errors from "../../lib/errors.js";
import Helpers from "../../lib/common.js";
import i18n from "../../lib/i18n.js";

const find = async (req, res) => {
  try {
    if (req.query.name) {
      const [channel] = await NotificationChannel.withServer([await NotificationChannel.findByName(req.query.name)]);
      return res.json(RestResult.single(NotificationChannel.masked(channel)));
    }
    const channels = await NotificationChannel.withServer(await NotificationChannel.findAll());
    return res.json(RestResult.list(channels.map((c) => NotificationChannel.masked(c))));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const create = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Errors.BadRequestError(i18n.t(req, "errors.requiredFields"));
    }
    const id = await NotificationChannel.create(req.body);
    return res.status(201).json(RestResult.single({ message: i18n.t(req, "success.created", { resource: "Notification channel" }), id }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const findById = async (req, res) => {
  try {
    const channel = await NotificationChannel.findById(req.params.id);
    if (!channel) throw new Errors.NotFoundError(`No notification channel with id ${req.params.id}`);
    const [shown] = await NotificationChannel.withServer([channel]);
    return res.json(RestResult.single(NotificationChannel.masked(shown)));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const update = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Errors.BadRequestError(i18n.t(req, "errors.requiredFields"));
    }
    await NotificationChannel.update(req.body, req.params.id);
    return res.json(RestResult.single({ message: i18n.t(req, "success.updated", { resource: "Notification channel" }) }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const deleteChannel = async (req, res) => {
  try {
    await NotificationChannel.delete(req.params.id);
    return res.json(RestResult.single({ message: i18n.t(req, "success.deleted", { resource: "Notification channel" }) }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Send test : a notification through the saved channel, turned off or not, in the admin's
// language, naming who sent it ; a mail channel to the address given
const test = async (req, res) => {
  try {
    const channel = await NotificationChannel.findById(req.params.id);
    if (!channel) throw new Errors.NotFoundError(`No notification channel with id ${req.params.id}`);
    if (channel.type === "mail" && !req.body?.to) throw new Errors.BadRequestError(i18n.t(req, "errors.requiredFields"));
    const who = req.user?.user?.username || "someone";
    const message = {
      title: req.body?.subject || i18n.t(req, "email.test.subject"),
      text: i18n.t(req, "notifications.testText", { who, name: channel.name }),
      html: channel.type === "mail" ? req.body?.body || i18n.t(req, "email.test.body") : undefined,
      status: "test",
      event: "test",
      job: { id: 0, form: "", user: who },
      link: "",
    };
    const id = await send(channel, message, channel.type === "mail" ? [req.body.to] : []);
    const text = channel.type === "mail" ? i18n.t(req, "resources.mailSent", { id }) : i18n.t(req, "notifications.testSent", { name: channel.name });
    return res.json(RestResult.single({ message: text }));
  } catch (err) {
    if (err instanceof Errors.BadRequestError || err instanceof Errors.NotFoundError) return Errors.ReturnError(res, err);
    return res.status(500).json(RestResult.error(i18n.t(req, "notifications.testFailed"), Helpers.getError(err)));
  }
};

export default { find, create, findById, update, delete: deleteChannel, test };
