'use strict';
import { readFile } from "fs/promises";
import config from "../../config/app.config.js";
import yaml from "yaml";

//lock object create
var Help = function () { };

Help.get = async function () {
  try {
    const fileContent = await Help.read();
    const parsed = yaml.parse(fileContent);
    return parsed;
  } catch (e) {
    console.error("Help.get error:", e);
    console.error("Help.get error message:", e.message);
    console.error("Help.get error stack:", e.stack);
    return Promise.reject(new Error(`Failed to load help.yaml: ${e.message || e.toString()}`));
  }
};

Help.read = async function () {
  return await readFile(config.helpPath, "utf8");
};

export default Help;
