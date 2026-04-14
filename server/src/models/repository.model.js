'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import helpers from "../lib/common.js";
import Repo from "./repo.model.js";
import path from "path";
import fs from "fs";
import appConfig from "../../config/app.config.js";
import CrudModel from './crud.model.js';

class Repository extends CrudModel {
  static modelName = 'repositories';

  // Override create to trigger clone after creation
  static async create(data) {
    logger.info(`Creating repository ${data.name}`);
    const insertId = await super.create(this.modelName, data);
    Repository.clone(data.name); // Don't await - clone happens in background
    return insertId;
  }

  // Override update to handle password properly
  static async update(data, name) {
    logger.info(`Updating repository ${name}`);
    // Get current record to find id
    const repo = await this.findByName(name);
    if (!repo) throw new Error(`No repository found with name ${name}`);
    
    // Remove empty fields
    helpers.removeEmptyFields(data);
    
    return super.update(this.modelName, data, repo.id);
  }

  // Override delete to cleanup disk
  static async delete(name) {
    logger.info(`Deleting repository ${name}`);
    const repo = await this.findByName(name);
    if (!repo) throw new Error(`No repository found with name ${name}`);
    
    Repo.delete(name);
    const res = await mysql.do("DELETE FROM AnsibleForms.`repositories` WHERE name = ?", [name]);
    return res;
  }

  static async findById(id) {
    const repo = await super.findById(this.modelName, id);
    // Mask password for API
    if (repo && repo.password) repo.password = '**********';
    return repo;
  }

  static async findAll() {
    const repos = await super.findAll(this.modelName);
    // Mask passwords before returning to API
    repos.forEach(r => {
      if (r.password) r.password = '**********';
    });
    return repos;
  }

  static async findByName(name) {
    logger.debug(`Finding repository ${name}`);
    const repo = await super.findByName(this.modelName, name);
    if (!repo) throw new Error("No repository found with name " + name);
    // Don't mask password here - internal use needs real password
    return repo;
  }

  // Override reset to use CRUD pattern
  static async reset(name) {
    logger.info(`Resetting repository ${name}`);
    await Repo.delete(name); // delete the repo on disk
    await Repository.clone(name); // recreate the repo
  }

  // Helper methods (not CRUD operations)

  static getPrivateUri(repo) {
  if(repo.uri){
    if(repo.user && repo.password){
      var httpRegex = new RegExp("^http[s]{0,1}:\/\/[^@]+$", "g");

      var match = httpRegex.exec(repo.uri);
      if(match){
        var privateUri = repo.uri.replace(/(http[s]{0,1}):\/\/(.*)/gm,`$1://${repo.user}:${repo.password}@$2`)
        return privateUri
      }else{
        logger.debug("Not an http uri")
        return repo.uri
      }
  
    } else {
      return repo.uri
    }

  } else {
    logger.warning("No uri defined")
    return ""
  }
}

  static async hasFormsRepository() {
    try {
      var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_forms")
      return (repositories.length > 0)
    } catch (e) {
      logger.error("Failed to check repositories : ", e)
      return false
    }
  }

  static async getConfigPath() {
  try{
    // First check for repositories with use_for_config enabled (new way since 6.1.0)
    var configRepositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_config")
    
    if(configRepositories.length > 0){
      // Found config repository/repositories
      if(configRepositories.length > 1){
        const repoNames = configRepositories.map(r => r.name).join(", ")
        logger.warning(`Multiple repositories are marked as 'use_for_config': ${repoNames}. Only one should be enabled. Using first one: ${configRepositories[0].name}`)
      }
      
      const repoPath = path.join(appConfig.repoPath, configRepositories[0].name)
      
      // Check for config.yaml first (new way)
      const configPath = path.join(repoPath, "config.yaml")
      if(fs.existsSync(configPath)){
        logger.debug(`Found config.yaml in use_for_config repository: ${configRepositories[0].name}`)
        return configPath
      }
      
      // Fallback to forms.yaml (legacy)
      const formsYamlPath = path.join(repoPath, "forms.yaml")
      if(fs.existsSync(formsYamlPath)){
        logger.debug(`Found forms.yaml (legacy) in use_for_config repository: ${configRepositories[0].name}`)
        return formsYamlPath
      }
      
      // Config repo exists but no config file found
      logger.warning(`Repository '${configRepositories[0].name}' is marked as use_for_config but no config.yaml or forms.yaml found`)
      return ""
    }
    
    // Fall back to old behavior: check use_for_forms repositories (backwards compatibility)
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_forms")
  }catch(e){
    logger.error("Failed to get repositories.",e)
    return ""
  }    
  
  if(repositories.length === 0){
    return ""
  }
  
  var foundConfigs = []
  
  // Loop through all form repositories to find config files
  for(const repo of repositories){
    var repoPath = path.join(appConfig.repoPath, repo.name)
    
    // Check for config.yaml first (new way)
    const configPath = path.join(repoPath, "config.yaml")
    if(fs.existsSync(configPath)){
      foundConfigs.push({ repo: repo.name, path: configPath, isLegacy: false })
      continue // found config.yaml, no need to check forms.yaml
    }
    
    // Fallback to forms.yaml (legacy)
    const formsYamlPath = path.join(repoPath, "forms.yaml")
    if(fs.existsSync(formsYamlPath)){
      foundConfigs.push({ repo: repo.name, path: formsYamlPath, isLegacy: true })
    }
  }
  
  if(foundConfigs.length === 0){
    return ""
  }
  
  if(foundConfigs.length > 1){
    const configList = foundConfigs.map(c => `${c.repo}/${path.basename(c.path)}`).join(", ")
    logger.warning(`Multiple config files found in repositories: ${configList}. Using first one: ${foundConfigs[0].repo}/${path.basename(foundConfigs[0].path)}`)
  }
  
    return foundConfigs[0].path
  }

  static async getFormsFolderPath() {
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_forms")
  }catch(e){
    logger.error("Failed to get repositories.",e)
    return []
  }    
  
  if(repositories.length === 0){
    return []
  }
  
  // Return array of all forms folder paths from all form repositories
  // Check if 'forms' subfolder exists, otherwise use repo root
  const formsPaths = repositories.map(repo => {
    const repoPath = path.join(appConfig.repoPath, repo.name)
    const formsSubPath = path.join(repoPath, "forms")
    
    // Check if forms subfolder exists
    if(fs.existsSync(formsSubPath)){
      logger.debug(`Using forms subfolder for repository '${repo.name}': ${formsSubPath}`)
      return formsSubPath
    } else {
      logger.debug(`Forms subfolder not found for repository '${repo.name}', using root path: ${repoPath}`)
      return repoPath
    }
  })
  
    logger.debug(`Found ${formsPaths.length} forms folder(s) from repositories: ${formsPaths.join(", ")}`)
    return formsPaths
  }

  static async getAnsiblePath() {
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_playbooks")
    
    if(repositories.length === 0){
      return ""
    }
    
    if(repositories.length > 1){
      const repoNames = repositories.map(r => r.name).join(", ")
      logger.warning(`Multiple repositories are marked as 'use_for_playbooks': ${repoNames}. Only one should be enabled. Playbooks cannot be merged. Using first one: ${repositories[0].name}`)
    }
    
    const repoPath = path.join(appConfig.repoPath, repositories[0].name)
    const playbooksSubPath = path.join(repoPath, "playbooks")
    
    // Check if playbooks subfolder exists
    if(fs.existsSync(playbooksSubPath)){
      logger.debug(`Using playbooks subfolder for repository '${repositories[0].name}': ${playbooksSubPath}`)
      return playbooksSubPath
    } else {
      logger.debug(`Playbooks subfolder not found for repository '${repositories[0].name}', using root path: ${repoPath}`)
      return repoPath
    }
  }catch(e){
      logger.error("Failed to get ansible path : ", e)
      return ""
    }
  }

  static async getVarsFilesPath() {
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_vars_files")
    
    if(repositories.length === 0){
      // No repository configured, return default local path
      return appConfig.varsFilesPath
    }
    
    if(repositories.length > 1){
      const repoNames = repositories.map(r => r.name).join(", ")
      logger.warning(`Multiple repositories are marked as 'use_for_vars_files': ${repoNames}. Only one should be enabled. Using first one: ${repositories[0].name}`)
    }
    
    const repoPath = path.join(appConfig.repoPath, repositories[0].name)
    const varsSubPath = path.join(repoPath, "vars")
    
    // Check if vars subfolder exists
    if(fs.existsSync(varsSubPath)){
      logger.debug(`Using vars subfolder for repository '${repositories[0].name}': ${varsSubPath}`)
      return varsSubPath
    } else {
      logger.debug(`Vars subfolder not found for repository '${repositories[0].name}', using root path: ${repoPath}`)
      return repoPath
    }
  }catch(e){
    logger.error("Failed to get vars files path : ",e)
    return appConfig.varsFilesPath
  }
  }

  static async clone(name) {
    var output, status, head
    try {
      await mysql.do("update AnsibleForms.`repositories` set status = ? where name = ?", ["running", name])
      var repo = await Repository.findByName(name)
      var uri = Repository.getPrivateUri(repo)
      var branch = repo.branch || undefined
      output = await Repo.clone(uri, name, branch)
      status = "success"
    } catch (e) {
      output = e.message
      status = "failed"
    }
    await mysql.do("update AnsibleForms.`repositories` set output = ?,status = ? where name = ?", [output, status, name])
    if (status == "success") {
      head = await Repo.info(name)
      await mysql.do("update AnsibleForms.`repositories` set head = ? where name = ?", [head, name])
    }
  }

  static async pull(name) {
    var output, status, head
    try {
      await mysql.do("update AnsibleForms.`repositories` set status = ? where name = ?", ["running", name])
      output = await Repo.pull(name)
      status = "success"
    } catch (e) {
      output = e.message
      status = "failed"
    }
    await mysql.do("update AnsibleForms.`repositories` set output = ?,status = ? where name = ?", [output, status, name])
    if (status == "success") {
      head = await Repo.info(name)
      await mysql.do("update AnsibleForms.`repositories` set head = ? where name = ?", [head, name])
    }
  }
}

export default Repository;
