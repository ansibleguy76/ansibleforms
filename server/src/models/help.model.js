'use strict';
import { readFile } from "fs/promises";
import config from "../../config/app.config.js";
import yaml from "yaml";

//lock object create
var Help = function () { };

Help.get = async function () {
  try {
    const fileContent = await Help.read();
    return yaml.parse(fileContent);
  } catch (e) {
    return Promise.reject(e.toString());
  }
};

Help.read = async function () {
  return await readFile(config.helpPath, "utf8");
};

export default Help;
